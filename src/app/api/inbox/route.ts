import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const direction = searchParams.get('direction')

    let query = getSupabaseAdmin()
      .from('emails')
      .select('*, leads(company_name, status)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)
    if (direction) query = query.eq('direction', direction)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ emails: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
