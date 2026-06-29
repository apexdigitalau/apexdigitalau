import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { content } = await request.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    const { data: lead } = await getSupabaseAdmin()
      .from('leads')
      .select('notes')
      .eq('id', id)
      .single()

    const timestamp = new Date().toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

    const newNote = `[${timestamp}] ${content.trim()}`
    const updatedNotes = lead?.notes ? `${lead.notes}\n\n${newNote}` : newNote

    const { data, error } = await getSupabaseAdmin()
      .from('leads')
      .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await getSupabaseAdmin().from('activity_log').insert({
      lead_id: id,
      action: 'note_added',
      description: content.trim().slice(0, 200),
    })

    return NextResponse.json({ success: true, notes: data.notes })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
