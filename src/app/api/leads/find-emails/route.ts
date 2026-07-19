import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { scrapeEmailsForLeads } from '@/lib/email-finder'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    let limit = 20
    try {
      const body = await request.json()
      if (body?.limit) limit = Math.min(Math.max(parseInt(body.limit), 1), 30)
    } catch { /* no body is fine */ }

    const supabase = getSupabaseAdmin()

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, company_name, website')
      .eq('has_contact_email', false)
      .not('website', 'is', null)
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!leads || leads.length === 0) {
      return NextResponse.json({ scanned: 0, found: 0, message: 'No leads with a website and missing email.' })
    }

    const { found } = await scrapeEmailsForLeads(supabase, leads)

    return NextResponse.json({ scanned: leads.length, found })
  } catch (err) {
    console.error('Find emails error:', err)
    return NextResponse.json({ error: 'Server error finding emails' }, { status: 500 })
  }
}
