import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getRotationForDay } from '@/lib/lead-rotation'

interface PlaceResult {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  primaryTypeDisplayName?: { text: string }
}

// How many leads to pull per day, and how many of them to auto-analyze.
const DAILY_LEAD_TARGET = 50
const MAX_ANALYSES_PER_RUN = 15  // keep AI cost/time bounded per run

function daysSinceEpoch(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24))
}

export async function GET(request: NextRequest) {
  // Protect the endpoint — only allow Vercel Cron (which sends this header)
  // or a manual call with the correct secret.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Places API key not configured' }, { status: 500 })
    }

    const supabase = getSupabaseAdmin()
    const { industry, location } = getRotationForDay(daysSinceEpoch())
    const query = `${industry} in ${location}`

    // Existing leads for dedup
    const { data: existing } = await supabase
      .from('leads')
      .select('website, phone, company_name')

    const existingWebsites = new Set((existing ?? []).map((e: any) => e.website?.toLowerCase()).filter(Boolean))
    const existingPhones = new Set((existing ?? []).map((e: any) => e.phone?.replace(/\s/g, '')).filter(Boolean))
    const existingNames = new Set((existing ?? []).map((e: any) => e.company_name?.toLowerCase()).filter(Boolean))

    const collectedLeads: any[] = []
    let pageToken: string | undefined = undefined
    let pagesFetched = 0

    while (collectedLeads.length < DAILY_LEAD_TARGET && pagesFetched < 3) {
      const requestBody: any = { textQuery: query, maxResultCount: 20 }
      if (pageToken) requestBody.pageToken = pageToken

      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.primaryTypeDisplayName,nextPageToken',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error('Places API error:', data)
        break
      }

      const places: PlaceResult[] = data.places || []
      for (const place of places) {
        if (collectedLeads.length >= DAILY_LEAD_TARGET) break
        const name = place.displayName?.text
        if (!name) continue

        const website = place.websiteUri?.toLowerCase() || null
        const phone = place.nationalPhoneNumber?.replace(/\s/g, '') || null
        const nameLower = name.toLowerCase()

        if (existingNames.has(nameLower)) continue
        if (website && existingWebsites.has(website)) continue
        if (phone && existingPhones.has(phone)) continue

        collectedLeads.push({
          company_name: name,
          industry: place.primaryTypeDisplayName?.text || industry,
          website: place.websiteUri || null,
          phone: place.nationalPhoneNumber || null,
          address: place.formattedAddress || null,
          google_rating: place.rating || null,
          status: 'new',
          date_added: new Date().toISOString(),
        })

        existingNames.add(nameLower)
        if (website) existingWebsites.add(website)
        if (phone) existingPhones.add(phone)
      }

      pageToken = data.nextPageToken
      pagesFetched++
      if (!pageToken) break
      await new Promise(r => setTimeout(r, 2000))
    }

    // Insert new leads
    let insertedLeads: any[] = []
    if (collectedLeads.length > 0) {
      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(collectedLeads)
        .select('id, website, company_name')
      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      insertedLeads = inserted ?? []
    }

    // Auto-analyze a subset of the new leads that have websites
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const toAnalyze = insertedLeads.filter(l => l.website).slice(0, MAX_ANALYSES_PER_RUN)

    let analyzed = 0
    for (const lead of toAnalyze) {
      try {
        const res = await fetch(`${appUrl}/api/website-analysis/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.id }),
        })
        if (res.ok) analyzed++
      } catch (err) {
        console.error(`Analysis failed for ${lead.company_name}:`, err)
      }
      // Small delay to be gentle on APIs
      await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({
      date: new Date().toISOString(),
      search: query,
      found: collectedLeads.length,
      inserted: insertedLeads.length,
      analyzed,
    })
  } catch (err) {
    console.error('Daily leads cron error:', err)
    return NextResponse.json({ error: 'Server error in daily lead job' }, { status: 500 })
  }
}
