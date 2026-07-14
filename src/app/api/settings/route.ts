import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Secrets that must never reach the browser. Server routes that genuinely need these
// (gmail/send, gmail/sync, assistant, campaigns/generate-email) read the settings table
// directly through the admin client, so nothing depends on this endpoint exposing them.
const SECRET_FIELDS = [
  'claude_api_key',
  'openai_api_key',
  'gmail_access_token',
  'gmail_refresh_token',
] as const

// Columns the settings table actually has and that the UI is allowed to write. Anything
// else is dropped rather than passed to Supabase, where an unknown key would fail the
// whole update. The Gmail tokens are absent on purpose: they are written by the OAuth
// callback, never by a user, so there is no reason to accept them over HTTP.
const WRITABLE_FIELDS = [
  'claude_api_key',
  'openai_api_key',
  'n8n_webhook_url',
  'company_name',
  'company_logo',
  'email_signature',
  'default_prompt',
  'business_hours_start',
  'business_hours_end',
] as const

// Replace every secret with null and expose only whether one is set, so the UI can still
// render a "key saved" state without ever holding the key itself.
function redact(row: Record<string, unknown> | null) {
  if (!row) return {}

  const safe: Record<string, unknown> = { ...row }
  for (const field of SECRET_FIELDS) {
    if (field in safe) safe[field] = null
  }

  return {
    ...safe,
    has_claude_key: Boolean(row.claude_api_key),
    has_openai_key: Boolean(row.openai_api_key),
    has_gmail_tokens: Boolean(row.gmail_refresh_token),
  }
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('settings')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(redact(data as Record<string, unknown> | null))
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const raw = await request.json()

    const body = Object.fromEntries(
      Object.entries(raw ?? {}).filter(([key]) =>
        (WRITABLE_FIELDS as readonly string[]).includes(key),
      ),
    )

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No writable fields provided' }, { status: 400 })
    }

    const db = getSupabaseAdmin()
    const { data: existing } = await db.from('settings').select('id').limit(1).single()

    const { data, error } = existing
      ? await db
          .from('settings')
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('id', (existing as { id: string }).id)
          .select()
          .single()
      : await db.from('settings').insert([body]).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // The update echoes the full row back, secrets included — redact it the same way.
    return NextResponse.json(redact(data as Record<string, unknown> | null))
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
