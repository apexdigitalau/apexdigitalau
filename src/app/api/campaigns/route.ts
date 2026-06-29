import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = getSupabaseAdmin()
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ campaigns: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, subject, industry, leads_targeted } = body

    if (!name) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

    const { data, error } = await getSupabaseAdmin()
      .from('email_campaigns')
      .insert([{
        name,
        subject: subject || '',
        industry: industry || null,
        status: 'draft',
        leads_targeted: leads_targeted || 0,
        sent_count: 0,
        delivered_count: 0,
        opened_count: 0,
        replied_count: 0,
        bounced_count: 0,
        spam_count: 0,
      }])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
