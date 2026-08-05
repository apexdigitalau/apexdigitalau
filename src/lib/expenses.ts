import { dayKey } from '@/lib/sydney-time'

export type Cycle = 'monthly' | 'yearly'

export interface Subscription {
  id: string
  name: string
  amount_aud: number
  cycle: Cycle
  next_due_date: string
  category: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface OneOffExpense {
  id: string
  name: string
  amount_aud: number
  purchase_date: string
  category: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

/**
 * Date columns here are plain DATEs, so all arithmetic below works on the
 * YYYY-MM-DD parts rather than Date instants. Going through a local Date would
 * make "days until" flip by one whenever the server's timezone disagreed with
 * Sydney's — which on Vercel (UTC) it does for most of the working day.
 */

/** Today's Sydney calendar date, as YYYY-MM-DD. */
export function today(): string {
  return dayKey(new Date())
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Whole days from today (Sydney) until `date`. Negative once overdue, 0 today. */
export function daysUntil(date: string, from: string = today()): number {
  return Math.round((toUtcMs(date) - toUtcMs(from)) / 86_400_000)
}

/** YYYY-MM-DD `days` after today (Sydney). Used for the modal defaults. */
export function daysFromToday(days: number): string {
  return fromUtcMs(toUtcMs(today()) + days * 86_400_000)
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function lastDayOfMonth(year: number, monthIndex: number): number {
  if (monthIndex !== 1) return DAYS_IN_MONTH[monthIndex]
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return leap ? 29 : 28
}

/**
 * Roll a due date forward by one billing cycle.
 *
 * Calendar arithmetic, not "+30 days": a subscription billed on the 15th stays
 * on the 15th. Days past the end of the target month clamp to its last day, so
 * the 31st becomes the 28th/29th in February and does not silently skip a
 * month the way a naive overflow would.
 */
export function advanceDueDate(date: string, cycle: Cycle): string {
  const [y, m, d] = date.split('-').map(Number)
  let year = y
  let monthIndex = m - 1

  if (cycle === 'monthly') {
    monthIndex += 1
    if (monthIndex > 11) {
      monthIndex = 0
      year += 1
    }
  } else {
    year += 1
  }

  const day = Math.min(d, lastDayOfMonth(year, monthIndex))
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** What the subscriptions cost per month, with yearly plans amortised. */
export function monthlyBurn(subs: Pick<Subscription, 'amount_aud' | 'cycle'>[]): number {
  return subs.reduce(
    (total, s) => total + (s.cycle === 'yearly' ? Number(s.amount_aud) / 12 : Number(s.amount_aud)),
    0
  )
}

/**
 * Money with cents. The app-wide formatCurrency() drops the decimals, which is
 * right for deal values but wrong here — subscriptions are priced at $12.99.
 */
export function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Shared urgency colouring for the "days until" badges. */
export function dueTone(days: number): string {
  if (days <= 0) return 'bg-red-500/15 text-red-500'
  if (days < 7) return 'bg-amber-500/15 text-amber-500'
  return 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
}

/** "Overdue" / "Today" / "in 5 days" — the badge label beside a due date. */
export function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}
