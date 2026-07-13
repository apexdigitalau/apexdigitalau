import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findEmailForWebsite } from '@/lib/email-finder'

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
      .is('email', null)
      .not('website', 'is', null)
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!leads || leads.length === 0) {
      return NextResponse.json({ scanned: 0, found: 0, message: 'No leads with a website and missing email.' })
    }

    let found = 0
    for (let i = 0; i < leads.length; i += 5) {
      const batch = leads.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(async (lead: any) => ({ lead, email: await findEmailForWebsite(lead.website) }))
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.email) {
          await supabase.from('leads').update({ email: r.value.email }).eq('id', r.value.lead.id)
          found++
        }
      }
    }

    return NextResponse.json({ scanned: leads.length, found })
  } catch (err) {
    console.error('Find emails error:', err)
    return NextResponse.json({ error: 'Server error finding emails' }, { status: 500 })
  }
}
