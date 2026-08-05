import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/supabase-server'
import { failSupabase, failWith, failure } from '@/lib/api-error'
import { advanceDueDate, type Cycle } from '@/lib/expenses'

const ROUTE = '/api/expenses/subscriptions'
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
      .from('subscriptions')
      .select('*')
      .order('next_due_date', { ascending: true })

    if (error) return failSupabase('subscriptions.select', error, 'Failed to load subscriptions')
    return NextResponse.json({ subscriptions: data ?? [] })
  } catch (err) {
    return failure(err, 'subscriptions.get')
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

    if (body.cycle !== 'monthly' && body.cycle !== 'yearly') {
      return badRequest("Cycle must be 'monthly' or 'yearly'")
    }

    if (typeof body.next_due_date !== 'string' || !DATE.test(body.next_due_date)) {
      return badRequest('Next due date must be YYYY-MM-DD')
    }

    const { data, error } = await gate.supabase
      .from('subscriptions')
      .insert([{
        name,
        amount_aud: amount,
        cycle: body.cycle as Cycle,
        next_due_date: body.next_due_date,
        category: optionalText(body.category),
        notes: optionalText(body.notes),
        created_by: gate.user.id,
      }])
      .select()
      .single()

    if (error) return failSupabase('subscriptions.insert', error, 'Failed to add subscription')
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return failure(err, 'subscriptions.post')
  }
}

/**
 * Edit a subscription, or roll its due date forward one cycle.
 *
 * `{ id, action: 'mark_paid' }` reads the row's own cycle and advances
 * next_due_date by it. Deliberately no other side effect — nothing is recorded
 * as having been paid, the date just moves on.
 */
export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireOwner(ROUTE)
    if (!gate.ok) return gate.response

    const body = await request.json()
    if (typeof body.id !== 'string' || !body.id) return badRequest('id is required')

    if (body.action === 'mark_paid') {
      const { data: current, error: readError } = await gate.supabase
        .from('subscriptions')
        .select('cycle, next_due_date')
        .eq('id', body.id)
        .single()

      // RLS turns "not allowed" into "no rows", so a miss here is a 404 either way.
      if (readError || !current) {
        return failWith({ error: 'Subscription not found', stage: 'subscriptions.select', status: 404 })
      }

      const { data, error } = await gate.supabase
        .from('subscriptions')
        .update({ next_due_date: advanceDueDate(current.next_due_date, current.cycle as Cycle) })
        .eq('id', body.id)
        .select()
        .single()

      if (error) return failSupabase('subscriptions.mark_paid', error, 'Failed to mark as paid')
      return NextResponse.json(data)
    }

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
    if (body.cycle !== undefined) {
      if (body.cycle !== 'monthly' && body.cycle !== 'yearly') {
        return badRequest("Cycle must be 'monthly' or 'yearly'")
      }
      updates.cycle = body.cycle
    }
    if (body.next_due_date !== undefined) {
      if (typeof body.next_due_date !== 'string' || !DATE.test(body.next_due_date)) {
        return badRequest('Next due date must be YYYY-MM-DD')
      }
      updates.next_due_date = body.next_due_date
    }
    if (body.category !== undefined) updates.category = optionalText(body.category)
    if (body.notes !== undefined) updates.notes = optionalText(body.notes)

    if (Object.keys(updates).length === 0) return badRequest('Nothing to update')

    const { data, error } = await gate.supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) return failSupabase('subscriptions.update', error, 'Failed to update subscription')
    return NextResponse.json(data)
  } catch (err) {
    return failure(err, 'subscriptions.patch')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireOwner(ROUTE)
    if (!gate.ok) return gate.response

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return badRequest('id is required')

    const { error } = await gate.supabase.from('subscriptions').delete().eq('id', id)
    if (error) return failSupabase('subscriptions.delete', error, 'Failed to delete subscription')

    return NextResponse.json({ ok: true })
  } catch (err) {
    return failure(err, 'subscriptions.delete')
  }
}
