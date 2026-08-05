'use client'

import { useCallback, useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/common/Toast'
import { cn, formatDate } from '@/lib/utils'
import {
  advanceDueDate,
  daysFromToday,
  daysUntil,
  dueLabel,
  dueTone,
  formatAud,
  monthlyBurn,
  today,
  type Cycle,
  type OneOffExpense,
  type Subscription,
} from '@/lib/expenses'
import {
  CheckCircle2, Loader2, Pencil, Plus, Receipt, Repeat, Trash2, X,
} from 'lucide-react'

const inputClass =
  'w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]'

const labelClass = 'block text-sm font-medium text-[hsl(var(--foreground))] mb-1'

const thClass =
  'px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] whitespace-nowrap'

const tdClass = 'px-4 py-3 align-middle whitespace-nowrap'

async function errorFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return body?.error || fallback
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------
// Subscription modal (add + edit)
// ---------------------------------------------------------------------------

interface SubForm {
  name: string
  amount: string
  cycle: Cycle
  next_due_date: string
  category: string
  notes: string
}

function blankSubForm(): SubForm {
  return {
    name: '',
    amount: '',
    cycle: 'monthly',
    next_due_date: daysFromToday(30),
    category: '',
    notes: '',
  }
}

function SubscriptionModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Subscription | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<SubForm>(() =>
    editing
      ? {
          name: editing.name,
          amount: String(editing.amount_aud),
          cycle: editing.cycle,
          next_due_date: editing.next_due_date,
          category: editing.category ?? '',
          notes: editing.notes ?? '',
        }
      : blankSubForm()
  )
  // Once the owner picks a date themselves, switching cycle stops rewriting it.
  const [dateTouched, setDateTouched] = useState(Boolean(editing))
  const [saving, setSaving] = useState(false)

  function setCycle(cycle: Cycle) {
    setForm(f => ({
      ...f,
      cycle,
      next_due_date: dateTouched ? f.next_due_date : daysFromToday(cycle === 'yearly' ? 365 : 30),
    }))
  }

  async function save() {
    const amount = Number(form.amount)
    if (!form.name.trim()) return toast.error('Name is required')
    if (!Number.isFinite(amount) || amount < 0) return toast.error('Enter a valid amount')

    setSaving(true)
    try {
      const res = await fetch('/api/expenses/subscriptions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: form.name.trim(),
          amount_aud: amount,
          cycle: form.cycle,
          next_due_date: form.next_due_date,
          category: form.category,
          notes: form.notes,
        }),
      })
      if (!res.ok) {
        toast.error('Could not save subscription', await errorFrom(res, 'Unknown error'))
        return
      }
      toast.success(editing ? 'Subscription updated' : 'Subscription added')
      onSaved()
      onClose()
    } catch (err) {
      toast.error('Could not save subscription', String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={editing ? 'Edit subscription' : 'Add subscription'} busy={saving} onClose={onClose}>
      <div className="overflow-y-auto flex-1 p-5 space-y-3">
        <div>
          <label className={labelClass}>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Adobe Creative Cloud"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount (AUD) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="89.99"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Cycle</label>
            <select
              value={form.cycle}
              onChange={e => setCycle(e.target.value as Cycle)}
              className={inputClass}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Next due</label>
            <input
              type="date"
              value={form.next_due_date}
              onChange={e => {
                setDateTouched(true)
                setForm({ ...form, next_due_date: e.target.value })
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <input
              type="text"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="Software"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Which account it's billed to, who uses it…"
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      </div>

      <ModalFooter
        busy={saving}
        disabled={!form.name.trim() || !form.amount}
        label={editing ? 'Save changes' : 'Add subscription'}
        onCancel={onClose}
        onConfirm={save}
      />
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// One-off expense modal (add + edit)
// ---------------------------------------------------------------------------

interface ExpenseForm {
  name: string
  amount: string
  purchase_date: string
  category: string
  notes: string
}

function OneOffModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: OneOffExpense | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<ExpenseForm>(() =>
    editing
      ? {
          name: editing.name,
          amount: String(editing.amount_aud),
          purchase_date: editing.purchase_date,
          category: editing.category ?? '',
          notes: editing.notes ?? '',
        }
      : { name: '', amount: '', purchase_date: today(), category: '', notes: '' }
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    const amount = Number(form.amount)
    if (!form.name.trim()) return toast.error('Name is required')
    if (!Number.isFinite(amount) || amount < 0) return toast.error('Enter a valid amount')

    setSaving(true)
    try {
      const res = await fetch('/api/expenses/one-off', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: form.name.trim(),
          amount_aud: amount,
          purchase_date: form.purchase_date,
          category: form.category,
          notes: form.notes,
        }),
      })
      if (!res.ok) {
        toast.error('Could not save expense', await errorFrom(res, 'Unknown error'))
        return
      }
      toast.success(editing ? 'Expense updated' : 'Expense added')
      onSaved()
      onClose()
    } catch (err) {
      toast.error('Could not save expense', String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={editing ? 'Edit expense' : 'Add expense'} busy={saving} onClose={onClose}>
      <div className="overflow-y-auto flex-1 p-5 space-y-3">
        <div>
          <label className={labelClass}>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Standing desk"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount (AUD) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="450.00"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Purchase date</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={e => setForm({ ...form, purchase_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <input
            type="text"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            placeholder="Equipment"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="What it was for…"
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      </div>

      <ModalFooter
        busy={saving}
        disabled={!form.name.trim() || !form.amount}
        label={editing ? 'Save changes' : 'Add expense'}
        onCancel={onClose}
        onConfirm={save}
      />
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Shared modal chrome
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  busy,
  onClose,
  children,
}: {
  title: string
  busy: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{title}</h2>
          <button
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({
  busy,
  disabled,
  label,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  disabled: boolean
  label: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="p-5 border-t border-[hsl(var(--border))] flex gap-3">
      <button
        onClick={onCancel}
        disabled={busy}
        className="flex-1 py-2.5 px-4 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={busy || disabled}
        className="flex-1 py-2.5 px-4 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : label}
      </button>
    </div>
  )
}

function RowAction({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'w-8 h-8 inline-flex items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-40',
        className
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ExpensesClient() {
  const toast = useToast()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [oneOffs, setOneOffs] = useState<OneOffExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [subModal, setSubModal] = useState<{ open: boolean; editing: Subscription | null }>({ open: false, editing: null })
  const [expModal, setExpModal] = useState<{ open: boolean; editing: OneOffExpense | null }>({ open: false, editing: null })
  // id of the row currently mid-request, so its buttons can lock individually
  const [busyId, setBusyId] = useState<string | null>(null)

  // No toast dependency here: the toast context value changes identity every
  // time a toast appears or expires, which would re-fire the load effect.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subRes, expRes] = await Promise.all([
        fetch('/api/expenses/subscriptions'),
        fetch('/api/expenses/one-off'),
      ])
      const subData = subRes.ok ? await subRes.json() : { subscriptions: [] }
      const expData = expRes.ok ? await expRes.json() : { expenses: [] }
      setSubs(subData.subscriptions ?? [])
      setOneOffs(expData.expenses ?? [])
    } catch (err) {
      console.error('[expenses] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function markPaid(sub: Subscription) {
    setBusyId(sub.id)
    try {
      const res = await fetch('/api/expenses/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, action: 'mark_paid' }),
      })
      if (!res.ok) {
        toast.error('Could not mark as paid', await errorFrom(res, 'Unknown error'))
        return
      }
      toast.success(`${sub.name} rolled to ${formatDate(advanceDueDate(sub.next_due_date, sub.cycle))}`)
      load()
    } catch (err) {
      toast.error('Could not mark as paid', String(err))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(kind: 'subscriptions' | 'one-off', id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/expenses/${kind}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not delete', await errorFrom(res, 'Unknown error'))
        return
      }
      toast.success(`Deleted ${name}`)
      load()
    } catch (err) {
      toast.error('Could not delete', String(err))
    } finally {
      setBusyId(null)
    }
  }

  const perMonth = monthlyBurn(subs)
  const oneOffTotal = oneOffs.reduce((sum, e) => sum + Number(e.amount_aud), 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Expenses"
        subtitle={
          loading
            ? 'Loading…'
            : `${subs.length} subscription${subs.length === 1 ? '' : 's'} · ${formatAud(perMonth)}/month`
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Subscriptions                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2.5 min-w-0">
              <Repeat className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Subscriptions</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Recurring, soonest due first</p>
              </div>
            </div>
            <button
              onClick={() => setSubModal({ open: true, editing: null })}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add subscription</span><span className="sm:hidden">Add</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : subs.length === 0 ? (
            <p className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]">No subscriptions tracked yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted)/0.4)]">
                  <tr>
                    <th className={thClass}>Name</th>
                    <th className={cn(thClass, 'text-right')}>Amount</th>
                    <th className={thClass}>Cycle</th>
                    <th className={thClass}>Next due</th>
                    <th className={thClass}>Category</th>
                    <th className={cn(thClass, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {subs.map(sub => {
                    const days = daysUntil(sub.next_due_date)
                    return (
                      <tr key={sub.id} className="hover:bg-[hsl(var(--accent)/0.5)] transition-colors">
                        <td className={tdClass}>
                          <p className="font-medium text-[hsl(var(--foreground))]">{sub.name}</p>
                          {sub.notes && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs truncate">{sub.notes}</p>
                          )}
                        </td>
                        <td className={cn(tdClass, 'text-right font-semibold text-[hsl(var(--foreground))]')}>
                          {formatAud(Number(sub.amount_aud))}
                        </td>
                        <td className={cn(tdClass, 'capitalize text-[hsl(var(--muted-foreground))]')}>{sub.cycle}</td>
                        <td className={tdClass}>
                          <div className="flex items-center gap-2">
                            <span className="text-[hsl(var(--foreground))]">{formatDate(sub.next_due_date)}</span>
                            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', dueTone(days))}>
                              {dueLabel(days)}
                            </span>
                          </div>
                        </td>
                        <td className={cn(tdClass, 'text-[hsl(var(--muted-foreground))]')}>{sub.category || '—'}</td>
                        <td className={cn(tdClass, 'text-right')}>
                          <div className="inline-flex items-center gap-0.5">
                            <RowAction
                              label="Mark paid"
                              disabled={busyId === sub.id}
                              onClick={() => markPaid(sub)}
                              className="hover:text-emerald-500"
                            >
                              {busyId === sub.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <CheckCircle2 className="w-4 h-4" />}
                            </RowAction>
                            <RowAction label="Edit" onClick={() => setSubModal({ open: true, editing: sub })}>
                              <Pencil className="w-4 h-4" />
                            </RowAction>
                            <RowAction
                              label="Delete"
                              disabled={busyId === sub.id}
                              onClick={() => remove('subscriptions', sub.id, sub.name)}
                              className="hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </RowAction>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Yearly plans are amortised, so this is the real monthly cost of the stack. */}
          {!loading && subs.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]">
              <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Total per month
              </span>
              <span className="text-sm font-bold text-[hsl(var(--foreground))]">{formatAud(perMonth)}</span>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* One-off expenses                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2.5 min-w-0">
              <Receipt className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">One-off expenses</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Most recent purchase first</p>
              </div>
            </div>
            <button
              onClick={() => setExpModal({ open: true, editing: null })}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add expense</span><span className="sm:hidden">Add</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : oneOffs.length === 0 ? (
            <p className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]">No one-off expenses logged yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted)/0.4)]">
                  <tr>
                    <th className={thClass}>Name</th>
                    <th className={cn(thClass, 'text-right')}>Amount</th>
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Category</th>
                    <th className={cn(thClass, 'whitespace-normal')}>Notes</th>
                    <th className={cn(thClass, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {oneOffs.map(exp => (
                    <tr key={exp.id} className="hover:bg-[hsl(var(--accent)/0.5)] transition-colors">
                      <td className={cn(tdClass, 'font-medium text-[hsl(var(--foreground))]')}>{exp.name}</td>
                      <td className={cn(tdClass, 'text-right font-semibold text-[hsl(var(--foreground))]')}>
                        {formatAud(Number(exp.amount_aud))}
                      </td>
                      <td className={cn(tdClass, 'text-[hsl(var(--muted-foreground))]')}>{formatDate(exp.purchase_date)}</td>
                      <td className={cn(tdClass, 'text-[hsl(var(--muted-foreground))]')}>{exp.category || '—'}</td>
                      <td className="px-4 py-3 align-middle text-[hsl(var(--muted-foreground))] max-w-xs">
                        <span className="line-clamp-2">{exp.notes || '—'}</span>
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        <div className="inline-flex items-center gap-0.5">
                          <RowAction label="Edit" onClick={() => setExpModal({ open: true, editing: exp })}>
                            <Pencil className="w-4 h-4" />
                          </RowAction>
                          <RowAction
                            label="Delete"
                            disabled={busyId === exp.id}
                            onClick={() => remove('one-off', exp.id, exp.name)}
                            className="hover:text-red-500"
                          >
                            {busyId === exp.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </RowAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && oneOffs.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]">
              <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Total logged
              </span>
              <span className="text-sm font-bold text-[hsl(var(--foreground))]">{formatAud(oneOffTotal)}</span>
            </div>
          )}
        </section>
      </div>

      {subModal.open && (
        <SubscriptionModal
          editing={subModal.editing}
          onClose={() => setSubModal({ open: false, editing: null })}
          onSaved={load}
        />
      )}
      {expModal.open && (
        <OneOffModal
          editing={expModal.editing}
          onClose={() => setExpModal({ open: false, editing: null })}
          onSaved={load}
        />
      )}
    </div>
  )
}
