import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const ids = searchParams.get('ids')

    let query = getSupabaseAdmin().from('leads').select('*').order('date_added', { ascending: false })

    if (ids) {
      query = query.in('id', ids.split(','))
    } else if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const headers = [
      'id', 'company_name', 'industry', 'website', 'email', 'phone',
      'address', 'google_rating', 'contact_name', 'website_score',
      'status', 'date_added', 'last_contacted', 'follow_up_date',
      'assigned_user', 'notes'
    ]

    const rows = [
      headers.join(','),
      ...(data ?? []).map(lead =>
        headers.map(h => escapeCSV(lead[h as keyof typeof lead])).join(',')
      )
    ]

    const csv = rows.join('\n')
    const filename = `apex-leads-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
