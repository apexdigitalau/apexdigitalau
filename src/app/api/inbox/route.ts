import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// The inbox only shows mail connected to outreach: replies from people we've emailed,
// and anything already tied to a lead. Everything else (newsletters, vendor mail, and
// other noise that lands in the same mailbox) stays in the emails table but is hidden
// here. Nothing is deleted.

// How many rows to pull before filtering. The relevance rules below can't be pushed
// into the query — the domain match needs the lead's website parsed — so we over-fetch
// and trim back to PAGE_SIZE afterwards, otherwise filtering a 100-row page would
// return far fewer than 100 relevant emails.
const PAGE_SIZE = 100
const CANDIDATE_LIMIT = 500

function domainOf(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./, '').toLowerCase() || null
  } catch {
    return null
  }
}

function domainOfEmail(address: string | null): string | null {
  if (!address) return null
  const at = address.lastIndexOf('@')
  if (at === -1) return null
  return address.slice(at + 1).trim().toLowerCase() || null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const direction = searchParams.get('direction')

    const db = getSupabaseAdmin()

    let query = db
      .from('emails')
      .select('*, leads(company_name, status)')
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_LIMIT)

    if (status) query = query.eq('status', status)
    if (direction) query = query.eq('direction', direction)

    const [emails, contacted, leads] = await Promise.all([
      query,
      // Everyone we've actually sent outbound mail to — a reply from any of these is ours.
      db.from('emails').select('to_email').eq('direction', 'outbound').neq('status', 'draft'),
      db.from('leads').select('website'),
    ])

    for (const result of [emails, contacted, leads]) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
    }

    const contactedAddresses = new Set(
      (contacted.data ?? [])
        .map((row) => row.to_email?.trim().toLowerCase())
        .filter((address): address is string => Boolean(address)),
    )

    const leadDomains = new Set(
      (leads.data ?? [])
        .map((row) => domainOf(row.website))
        .filter((domain): domain is string => Boolean(domain)),
    )

    const relevant = (emails.data ?? []).filter((email) => {
      // Already attributed to a lead — keep it regardless of who it came from.
      if (email.lead_id) return true

      const from = email.from_email?.trim().toLowerCase() ?? null
      if (from && contactedAddresses.has(from)) return true

      const fromDomain = domainOfEmail(from)
      return fromDomain !== null && leadDomains.has(fromDomain)
    })

    return NextResponse.json({ emails: relevant.slice(0, PAGE_SIZE) })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
