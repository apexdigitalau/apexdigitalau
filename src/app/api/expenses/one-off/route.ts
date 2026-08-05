import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/supabase-server'
import { failSupabase, failWith, failure } from '@/lib/api-error'

const ROUTE = '/api/expenses/one-off'
const DATE = /^\d{4}-\d{2}-\d{2}$/

function badRequest(message: string) {
  return failWith({ error: message, stage: 'validate', status: 400 })
}

/** Trim to a string or null — empty optional fields are stored as NULL, not ''. */
function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function GET() {
  try {
    const gate = await requireOwner(ROUTE)
    if (!gate.ok) return gate.response

    const { data, error } = await gate.supabase
      .from('one_off_expenses')
      .select('*')
      .order('purchase_date', { ascending: false })

    if (error) return failSupabase('one_off.select', error, 'Failed to load expenses')
    return NextResponse.json({ expenses: data ?? [] })
  } catch (err) {
    return failure(err, 'one_off.get')
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireOwner(ROUTE)
    if (!gate.ok) return gate.response

    const body = await request.json()

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return badRequest('Name is required')

    const amount = Number(body.amount_aud)
    if (!Number.isFinite(amount) || amount < 0) return badRequest('Amount must be a positive number')

    if (typeof body.purchase_date !== 'string' || !DATE.test(body.purchase_date)) {
      return badRequest('Purchase date must be YYYY-MM-DD')
    }

    const { data, error } = await gate.supabase
      .from('one_off_expenses')
      .insert([{
        name,
        amount_aud: amount,
        purchase_date: body.purchase_date,
        category: optionalText(body.category),
        notes: optionalText(body.notes),
        created_by: gate.user.id,
      }])
      .select()
      .single()

    if (error) return failSupabase('one_off.insert', error, 'Failed to add expense')
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return failure(err, 'one_off.post')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireOwner(ROUTE)
    if (!gate.ok) return gate.response

    const body = await request.json()
    if (typeof body.id !== 'string' || !body.id) return badRequest('id is required')

    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return badRequest('Name cannot be empty')
      updates.name = name
    }
    if (body.amount_aud !== undefined) {
      const amount = Number(body.amount_aud)
      if (!Number.isFinite(amount) || amount < 0) return badRequest('Amount must be a positive number')
      updates.amount_aud = amount
    }
    if (body.purchase_date !== undefined) {
      if (typeof body.purchase_date !== 'string' || !DATE.test(body.purchase_date)) {
        return badRequest('Purchase date must be YYYY-MM-DD')
      }
      updates.purchase_date = body.purchase_date
    }
    if (body.category !== undefined) updates.category = optionalText(body.category)
    if (body.notes !== undefined) updates.notes = optionalText(body.notes)

    if (Object.keys(updates).length === 0) return badRequest('Nothing to update')

    const { data, error } = await gate.supabase
      .from('one_off_expenses')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) return failSupabase('one_off.update', error, 'Failed to update expense')
    return NextResponse.json(data)
  } catch (err) {
    return failure(err, 'one_off.patch')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireOwner(ROUTE)
    if (!gate.ok) return gate.response

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return badRequest('id is required')

    const { error } = await gate.supabase.from('one_off_expenses').delete().eq('id', id)
    if (error) return failSupabase('one_off.delete', error, 'Failed to delete expense')

    return NextResponse.json({ ok: true })
  } catch (err) {
    return failure(err, 'one_off.delete')
  }
}
