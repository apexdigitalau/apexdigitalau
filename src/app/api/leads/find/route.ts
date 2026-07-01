import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

interface PlaceResult {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  primaryTypeDisplayName?: { text: string }
}

export async function POST(request: NextRequest) {
  try {
    const { industry, location, limit } = await request.json()

    if (!industry || !location) {
      return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    const maxLeads = Math.min(limit || 20, 60)
    const query = `${industry} in ${location}`

    const supabase = getSupabaseAdmin()

    // Get existing websites/phones for dedup
    const { data: existing } = await supabase
      .from('leads')
      .select('website, phone, company_name')

    const existingWebsites = new Set((existing ?? []).map((e: any) => e.website?.toLowerCase()).filter(Boolean))
    const existingPhones = new Set((existing ?? []).map((e: any) => e.phone?.replace(/\s/g, '')).filter(Boolean))
    const existingNames = new Set((existing ?? []).map((e: any) => e.company_name?.toLowerCase()).filter(Boolean))

    const collectedLeads: any[] = []
    let pageToken: string | undefined = undefined
    let pagesFetched = 0

    // Google Places returns 20 per page, up to 3 pages (60 max)
    while (collectedLeads.length < maxLeads && pagesFetched < 3) {
      const requestBody: any = {
        textQuery: query,
        maxResultCount: 20,
      }
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
        return NextResponse.json({ error: `Places API error: ${data.error?.message || res.status}` }, { status: 500 })
      }

      const places: PlaceResult[] = data.places || []

      for (const place of places) {
        if (collectedLeads.length >= maxLeads) break

        const name = place.displayName?.text
        if (!name) continue

        const website = place.websiteUri?.toLowerCase() || null
        const phone = place.nationalPhoneNumber?.replace(/\s/g, '') || null
        const nameLower = name.toLowerCase()

        // Dedup checks
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

        // Track to avoid dupes within this same batch
        existingNames.add(nameLower)
        if (website) existingWebsites.add(website)
        if (phone) existingPhones.add(phone)
      }

      pageToken = data.nextPageToken
      pagesFetched++
      if (!pageToken) break

      // Google requires a short delay before using a page token
      await new Promise(r => setTimeout(r, 2000))
    }

    let inserted = 0
    if (collectedLeads.length > 0) {
      const { data: insertedData, error } = await supabase
        .from('leads')
        .insert(collectedLeads)
        .select('id')

      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      inserted = insertedData?.length ?? 0
    }

    return NextResponse.json({
      found: collectedLeads.length,
      inserted,
    })
  } catch (err) {
    console.error('Find leads error:', err)
    return NextResponse.json({ error: 'Server error finding leads' }, { status: 500 })
  }
}
