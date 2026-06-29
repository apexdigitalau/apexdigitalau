import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Expected CSV columns (case-insensitive):
// company_name, industry, website, email, phone, address, google_rating,
// contact_name, notes, status, follow_up_date

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []

  const rawHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  const headers = rawHeaders.map(normaliseHeader)

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter(row => row.company_name || row.companyname)
}

const VALID_STATUSES = ['new', 'ready_to_contact', 'email_sent', 'replied', 'meeting_booked', 'proposal_sent', 'won', 'lost', 'archived']

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Get existing websites for dedup
    const { data: existing } = await getSupabaseAdmin()
      .from('leads')
      .select('website, email')

    const existingWebsites = new Set((existing ?? []).map(e => e.website?.toLowerCase()).filter(Boolean))
    const existingEmails = new Set((existing ?? []).map(e => e.email?.toLowerCase()).filter(Boolean))

    const toInsert = []
    const skipped = []
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const company = (row.company_name || row.companyname || '').trim()

      if (!company) {
        errors.push(`Row ${i + 2}: missing company name`)
        continue
      }

      const website = row.website?.trim().toLowerCase() || null
      const email = row.email?.trim().toLowerCase() || null

      // Dedup check
      if (website && existingWebsites.has(website)) {
        skipped.push(company)
        continue
      }
      if (email && existingEmails.has(email)) {
        skipped.push(company)
        continue
      }

      const status = VALID_STATUSES.includes(row.status) ? row.status : 'new'

      const lead = {
        company_name: company,
        industry: row.industry?.trim() || null,
        website: row.website?.trim() || null,
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        address: row.address?.trim() || null,
        google_rating: row.google_rating ? parseFloat(row.google_rating) : null,
        contact_name: row.contact_name?.trim() || null,
        notes: row.notes?.trim() || null,
        status,
        follow_up_date: row.follow_up_date?.trim() || null,
        date_added: new Date().toISOString(),
      }

      toInsert.push(lead)
      if (website) existingWebsites.add(website)
      if (email) existingEmails.add(email)
    }

    let inserted = 0
    if (toInsert.length > 0) {
      const { data, error } = await getSupabaseAdmin()
        .from('leads')
        .insert(toInsert)
        .select('id')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      inserted = data?.length ?? 0
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: skipped.length,
      skipped_companies: skipped.slice(0, 20),
      errors: errors.slice(0, 20),
      total_rows: rows.length,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
