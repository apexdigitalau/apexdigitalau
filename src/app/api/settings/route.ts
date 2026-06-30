import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('settings')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? {})
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    const { data: existing } = await getSupabaseAdmin()
      .from('settings')
      .select('id')
      .limit(1)
      .single()

    if (existing) {
      const { data, error } = await getSupabaseAdmin()
        .from('settings')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', (existing as any).id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    } else {
      const { data, error } = await getSupabaseAdmin()
        .from('settings')
        .insert([body])
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
