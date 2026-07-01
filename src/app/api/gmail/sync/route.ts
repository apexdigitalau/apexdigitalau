import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

interface GmailMessage {
  id: string
  threadId: string
  payload?: {
    headers?: { name: string; value: string }[]
    body?: { data?: string }
    parts?: { mimeType: string; body?: { data?: string } }[]
  }
  internalDate?: string
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function extractBody(payload: GmailMessage['payload']): string {
  if (!payload) return ''
  if (payload.body?.data) return decodeBase64Url(payload.body.data)
  if (payload.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
      || payload.parts.find(p => p.mimeType === 'text/html')
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)
  }
  return ''
}

function getHeader(payload: GmailMessage['payload'], name: string): string {
  return payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  return res.json()
}

export async function POST() {
  try {
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
        return NextResponse.json({ error: 'Failed to refresh Gmail token. Please reconnect Gmail.' }, { status: 401 })
      }
    }

    // Fetch recent message list
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=in:inbox',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const listData = await listRes.json()

    if (!listRes.ok) {
      console.error('Gmail list API error:', listData)
      return NextResponse.json({ error: `Gmail API error: ${listData.error?.message || listRes.status}` }, { status: 500 })
    }

    const messages = listData.messages || []

    // Get existing gmail_message_ids to avoid duplicates
    const { data: existingEmails } = await supabase
      .from('emails')
      .select('gmail_message_id')

    const existingIds = new Set((existingEmails ?? []).map((e: any) => e.gmail_message_id).filter(Boolean))

    let syncedCount = 0

    for (const msgRef of messages) {
      if (existingIds.has(msgRef.id)) continue

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const msg: GmailMessage = await msgRes.json()

      const fromHeader = getHeader(msg.payload, 'From')
      const subject = getHeader(msg.payload, 'Subject') || '(no subject)'
      const body = extractBody(msg.payload)

      // Parse "Name <email>" format
      const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromHeader
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader

      // Try to match to an existing lead by email
      const { data: matchedLead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', fromEmail)
        .limit(1)
        .single()

      await supabase.from('emails').insert([{
        lead_id: (matchedLead as any)?.id ?? null,
        direction: 'inbound',
        from_email: fromEmail,
        from_name: fromName || fromEmail,
        to_email: (settings as any).gmail_email,
        subject,
        body: body.slice(0, 10000),
        status: 'unread',
        gmail_message_id: msg.id,
        created_at: msg.internalDate ? new Date(parseInt(msg.internalDate)).toISOString() : new Date().toISOString(),
      }])

      syncedCount++
    }

    // CLEANUP: remove inbound emails from DB that no longer exist in Gmail inbox
    const gmailIds = new Set(messages.map((m: any) => m.id))

    // Get all inbound emails we have stored with a gmail_message_id
    const { data: storedInbound } = await supabase
      .from('emails')
      .select('id, gmail_message_id')
      .eq('direction', 'inbound')
      .not('gmail_message_id', 'is', null)

    let deletedCount = 0
    const idsToDelete = (storedInbound ?? [])
      .filter((e: any) => e.gmail_message_id && !gmailIds.has(e.gmail_message_id))
      .map((e: any) => e.id)

    if (idsToDelete.length > 0) {
      const { error: delError } = await supabase
        .from('emails')
        .delete()
        .in('id', idsToDelete)
      if (!delError) deletedCount = idsToDelete.length
    }

    return NextResponse.json({ synced: syncedCount, deleted: deletedCount })
  } catch (err) {
    console.error('Gmail sync error:', err)
    return NextResponse.json({ error: 'Server error during sync' }, { status: 500 })
  }
}
