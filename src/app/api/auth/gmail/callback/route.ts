import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=no_code`)
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri = `${appUrl}/api/auth/gmail/callback`

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error('Google token exchange error:', tokens)
      return NextResponse.redirect(`${appUrl}/settings?gmail_error=token_exchange_failed`)
    }

    // Get the user's Gmail address
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoResponse.json()

    // Store tokens in settings table
    const supabase = getSupabaseAdmin()
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('id')
      .limit(1)
      .single()

    const settingsData = {
      gmail_connected: true,
      gmail_email: userInfo.email,
      gmail_access_token: tokens.access_token,
      gmail_refresh_token: tokens.refresh_token,
      gmail_token_expiry: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existingSettings) {
      await supabase
        .from('settings')
        .update(settingsData)
        .eq('id', (existingSettings as any).id)
    } else {
      await supabase.from('settings').insert([settingsData])
    }

    return NextResponse.redirect(`${appUrl}/settings?gmail_connected=true`)
  } catch (err) {
    console.error('Gmail OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=server_error`)
  }
}
