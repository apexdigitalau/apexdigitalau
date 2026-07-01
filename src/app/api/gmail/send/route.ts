import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  return res.json()
}

function buildRawEmail(to: string, from: string, subject: string, body: string, inReplyTo?: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ]
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`)
    headers.push(`References: ${inReplyTo}`)
  }
  const email = headers.join('\r\n') + '\r\n\r\n' + body

  // base64url encode
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, lead_id } = await request.json()

    if (!to || !body) {
      return NextResponse.json({ error: 'Missing recipient or body' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single()

    if (!settings || !(settings as any).gmail_connected) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    let accessToken = (settings as any).gmail_access_token
    const tokenExpiry = (settings as any).gmail_token_expiry
    const refreshToken = (settings as any).gmail_refresh_token
    const fromEmail = (settings as any).gmail_email

    // Refresh token if expired
    if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
      const refreshed = await refreshAccessToken(refreshToken)
      if (refreshed.access_token) {
        accessToken = refreshed.access_token
        await supabase
          .from('settings')
          .update({
            gmail_access_token: refreshed.access_token,
            gmail_token_expiry: new Date(Date.now() + (refreshed.expires_in * 1000)).toISOString(),
          })
          .eq('id', (settings as any).id)
      } else {
        return NextResponse.json({ error: 'Failed to refresh Gmail token' }, { status: 401 })
      }
    }

    const finalSubject = subject || '(no subject)'
    const raw = buildRawEmail(to, fromEmail, finalSubject, body)

    const sendRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    )

    const sendData = await sendRes.json()

    if (!sendRes.ok) {
      console.error('Gmail send error:', sendData)
      return NextResponse.json({ error: `Gmail send failed: ${sendData.error?.message || sendRes.status}` }, { status: 500 })
    }

    // Store the sent email in our database
    await supabase.from('emails').insert([{
      lead_id: lead_id || null,
      direction: 'outbound',
      from_email: fromEmail,
      from_name: 'Apex Digital',
      to_email: to,
      subject: finalSubject,
      body,
      status: 'read',
      gmail_message_id: sendData.id,
      created_at: new Date().toISOString(),
    }])

    // If replying to a lead, update their status and last_contacted
    if (lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'email_sent', last_contacted: new Date().toISOString() })
        .eq('id', lead_id)
    }

    return NextResponse.json({ success: true, message_id: sendData.id })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Server error sending email' }, { status: 500 })
  }
}
