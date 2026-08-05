'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsOwner } from '@/lib/use-is-owner'
import {
  daysUntil,
  dueLabel,
  dueTone,
  formatAud,
  monthlyBurn,
  type Subscription,
} from '@/lib/expenses'

/**
 * Owner-only dashboard panel: what's about to bill, and what the stack costs
 * per month. Renders nothing at all for non-owners — and the fetch it depends
 * on would 403 for them anyway.
 */
export function UpcomingSubscriptions() {
  const isOwner = useIsOwner()
  const [subs, setSubs] = useState<Subscription[] | null>(null)

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    fetch('/api/expenses/subscriptions')
      .then(res => (res.ok ? res.json() : { subscriptions: [] }))
      .then(data => { if (!cancelled) setSubs(data.subscriptions ?? []) })
      .catch(() => { if (!cancelled) setSubs([]) })
    return () => { cancelled = true }
  }, [isOwner])

  if (!isOwner) return null

  const all = subs ?? []
  // Overdue rows stay in the list — they are the ones most worth seeing.
  const upcoming = all
    .map(sub => ({ sub, days: daysUntil(sub.next_due_date) }))
    .filter(row => row.days <= 30)
    .sort((a, b) => a.days - b.days)

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarClock className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Upcoming subscriptions</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Due in the next 30 days</p>
          </div>
        </div>
        <Link href="/expenses" className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline shrink-0">
          Expenses <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {subs === null ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">Loading…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">
          Nothing due in the next 30 days
        </p>
      ) : (
        <div className="space-y-1">
          {upcoming.map(({ sub, days }) => (
            <div
              key={sub.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <p className="flex-1 min-w-0 text-sm font-medium text-[hsl(var(--foreground))] truncate">{sub.name}</p>
              <span className="text-sm font-semibold text-[hsl(var(--foreground))] shrink-0">
                {formatAud(Number(sub.amount_aud))}
              </span>
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 w-24 text-center', dueTone(days))}>
                {dueLabel(days)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Yearly plans amortised — see monthlyBurn(). */}
      <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
        This month&apos;s subscription burn:{' '}
        <span className="font-semibold text-[hsl(var(--foreground))]">
          {subs === null ? '—' : formatAud(monthlyBurn(all))}
        </span>
      </div>
    </div>
  )
}
