import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = getSupabaseAdmin()
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('project_status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ clients: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('clients')
      .insert([{ ...body, project_status: body.project_status || 'active' }])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
