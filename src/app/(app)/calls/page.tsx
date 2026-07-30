'use client'

// Mobile-first shared cold-calling queue. Tomas and Anthony call at the same
// time; the whole design is optimised for logging an outcome in under 5 seconds.
//
// Concurrency and identity live in Postgres (see supabase-migrations/add-calls.sql):
// the page talks to three SECURITY DEFINER RPCs via the browser Supabase client,
// so every call carries the logged-in user's JWT and the DB derives the actor
// from auth.uid(). Logging an outcome is a single round trip (log_call_and_next)
// that writes the log, releases the lock, and returns the next lead at once.

import { useState, useEffect, useCallback, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { getSupabase } from '@/lib/supabase'
import {
  Phone, Globe, Loader2, ChevronDown, ChevronUp, Voicemail, Ban,
  StickyNote, Star, PhoneCall, CalendarClock, Flame, PartyPopper,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types'

type Outcome =
  | 'interested' | 'callback' | 'not_interested'
  | 'meeting_booked' | 'voicemail' | 'wrong_number'

interface CallLog {
  id: string
  lead_id: string
  called_by: string | null
  outcome: Outcome
  notes: string | null
  callback_at: string | null
  created_at: string
  lead: Lead | null
}

// "44/50 Cosgrove Rd, Strathfield South NSW 2136, Australia" -> "Strathfield South"
function suburbFromAddress(address: string | null): string | null {
  if (!address) return null
  const m = address.match(/([A-Za-z][A-Za-z .'-]+?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{3,4}/)
  if (m) return m[1].trim()
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? null)
}

function subtitleFor(lead: Lead): string {
  return [lead.industry, suburbFromAddress(lead.address)].filter(Boolean).join(' · ')
}

// Callback presets. Computed in the browser so "Tomorrow" means the caller's
// tomorrow, then sent to the DB as an absolute timestamp.
function callbackAt(pick: 'tomorrow' | '3days' | 'nextweek'): string {
  const d = new Date()
  d.setDate(d.getDate() + (pick === 'tomorrow' ? 1 : pick === '3days' ? 3 : 7))
  return d.toISOString()
}

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function CallsPage() {
  const supabase = getSupabase()

  const [userId, setUserId] = useState<string | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)   // initial claim
  const [logging, setLogging] = useState(false)  // outcome in flight
  const [error, setError] = useState<string | null>(null)

  const [showMore, setShowMore] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [callbackOpen, setCallbackOpen] = useState(false)

  const [counts, setCounts] = useState({ called: 0, interested: 0, booked: 0 })
  const [hotLeads, setHotLeads] = useState<CallLog[]>([])
  const [callbacksDue, setCallbacksDue] = useState<CallLog[]>([])

  // Keep the current lead id in a ref so the unmount cleanup can release the
  // lock without re-subscribing the effect on every advance.
  const leadIdRef = useRef<string | null>(null)
  leadIdRef.current = lead?.id ?? null

  // ---- data loaders -------------------------------------------------------

  const loadCounters = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('call_logs')
      .select('outcome')
      .eq('called_by', userId)
      .gte('created_at', startOfTodayISO())
    const rows = data ?? []
    setCounts({
      called: rows.length,
      interested: rows.filter(r => r.outcome === 'interested').length,
      booked: rows.filter(r => r.outcome === 'meeting_booked').length,
    })
  }, [supabase, userId])

  const loadHotLeads = useCallback(async () => {
    // Shared across both callers. Dedupe to the latest log per lead.
    const { data } = await supabase
      .from('call_logs')
      .select('id, lead_id, called_by, outcome, notes, callback_at, created_at, lead:leads(*)')
      .in('outcome', ['interested', 'meeting_booked'])
      .order('created_at', { ascending: false })
    const seen = new Set<string>()
    const deduped: CallLog[] = []
    for (const row of (data ?? []) as unknown as CallLog[]) {
      if (seen.has(row.lead_id)) continue
      seen.add(row.lead_id)
      deduped.push(row)
    }
    setHotLeads(deduped)
  }, [supabase])

  const loadCallbacksDue = useCallback(async () => {
    const { data } = await supabase
      .from('call_logs')
      .select('id, lead_id, called_by, outcome, notes, callback_at, created_at, lead:leads(*)')
      .eq('outcome', 'callback')
      .lte('callback_at', new Date().toISOString())
      .order('callback_at', { ascending: true })
    setCallbacksDue((data ?? []) as unknown as CallLog[])
  }, [supabase])

  const refreshLists = useCallback(() => {
    loadCounters(); loadHotLeads(); loadCallbacksDue()
  }, [loadCounters, loadHotLeads, loadCallbacksDue])

  // ---- initial load: identify user, claim first lead ---------------------

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { setError('Not signed in.'); setLoading(false); return }
      setUserId(user.id)
      const { data, error } = await supabase.rpc('claim_next_lead')
      if (cancelled) return
      if (error) setError(error.message)
      else setLead((data?.[0] as Lead) ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => { refreshLists() }, [refreshLists])

  // Best-effort lock release when leaving the page. The DB lock also auto-expires
  // after 10 minutes, so this is an optimisation, not a correctness requirement.
  useEffect(() => {
    function release() {
      const id = leadIdRef.current
      if (id) supabase.rpc('release_lock', { p_lead: id })
    }
    window.addEventListener('pagehide', release)
    return () => {
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [supabase])

  // ---- the hot path: log outcome + advance -------------------------------

  const logOutcome = useCallback(async (outcome: Outcome, cbAt?: string) => {
    if (!lead || logging) return
    setLogging(true)
    setError(null)
    const { data, error } = await supabase.rpc('log_call_and_next', {
      p_lead: lead.id,
      p_outcome: outcome,
      p_notes: note.trim() || null,
      p_callback_at: cbAt ?? null,
    })
    if (error) {
      setError(error.message)
      setLogging(false)
      return
    }
    // Reset the card state and drop straight onto the next lead.
    setLead((data?.[0] as Lead) ?? null)
    setNote('')
    setShowNote(false)
    setShowMore(false)
    setCallbackOpen(false)
    setLogging(false)
    refreshLists()
  }, [supabase, lead, logging, note, refreshLists])

  function handleOutcome(outcome: Outcome) {
    if (outcome === 'callback') { setCallbackOpen(true); return }
    logOutcome(outcome)
  }

  // ---- render -------------------------------------------------------------

  const busy = loading || logging

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Call Queue"
        subtitle={`${counts.called} called · ${counts.interested} interested · ${counts.booked} booked`}
      />

      <div className="flex-1 overflow-auto p-4 pb-safe">
        <div className="mx-auto w-full max-w-md space-y-8">
          {/* ================= QUEUE ================= */}
          <section>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[hsl(var(--muted-foreground))]">
                <Loader2 className="w-6 h-6 animate-spin mb-3" />
                <p className="text-sm">Finding your next lead…</p>
              </div>
            ) : !lead ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-[hsl(var(--muted-foreground))]">
                <PartyPopper className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-base font-medium text-[hsl(var(--foreground))] mb-1">Queue is empty</p>
                <p className="text-sm">Every callable lead has been logged. Nice work.</p>
              </div>
            ) : (
              <>
                {/* Lead card */}
                <div className={cn(
                  'rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm transition-opacity',
                  logging && 'opacity-50 pointer-events-none'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight break-words">
                        {lead.company_name}
                      </h2>
                      {subtitleFor(lead) && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{subtitleFor(lead)}</p>
                      )}
                      {lead.website && (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline mt-1.5"
                        >
                          <Globe className="w-3 h-3" /> {lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                        </a>
                      )}
                    </div>
                    {lead.google_rating != null && (
                      <div className="flex items-center gap-1 shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-semibold text-amber-500">{lead.google_rating}</span>
                      </div>
                    )}
                  </div>

                  {/* Big call button — opens the phone dialer */}
                  <a
                    href={`tel:${(lead.phone ?? '').replace(/\s+/g, '')}`}
                    className="mt-5 flex items-center justify-center gap-2.5 w-full rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-lg font-bold py-4 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <Phone className="w-5 h-5" /> 📞 Call {lead.phone}
                  </a>
                </div>

                {/* Outcome buttons */}
                <div className="mt-4 space-y-2.5">
                  <OutcomeButton
                    onClick={() => handleOutcome('meeting_booked')}
                    disabled={busy}
                    className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 text-lg font-bold ring-2 ring-emerald-500/30"
                  >
                    🎯 Booked meeting
                  </OutcomeButton>
                  <OutcomeButton
                    onClick={() => handleOutcome('interested')}
                    disabled={busy}
                    className="bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 hover:bg-green-500/25"
                  >
                    🟢 Interested
                  </OutcomeButton>
                  <OutcomeButton
                    onClick={() => handleOutcome('callback')}
                    disabled={busy}
                    className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                  >
                    🟡 Callback
                  </OutcomeButton>
                  <OutcomeButton
                    onClick={() => handleOutcome('not_interested')}
                    disabled={busy}
                    className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/25"
                  >
                    🔴 Not interested
                  </OutcomeButton>

                  {/* Callback picker — inline, appears in place of an outcome */}
                  {callbackOpen && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2 px-1">
                        Call back when?
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ['tomorrow', 'Tomorrow'],
                          ['3days', '3 days'],
                          ['nextweek', 'Next week'],
                        ] as const).map(([key, label]) => (
                          <button
                            key={key}
                            disabled={busy}
                            onClick={() => logOutcome('callback', callbackAt(key))}
                            className="rounded-lg bg-[hsl(var(--card))] border border-amber-500/40 py-3 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 disabled:opacity-50"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCallbackOpen(false)}
                        className="w-full mt-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* More toggle */}
                  <button
                    onClick={() => setShowMore(v => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    More {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showMore && (
                    <div className="space-y-2.5">
                      <OutcomeButton
                        onClick={() => handleOutcome('voicemail')}
                        disabled={busy}
                        className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                      >
                        <Voicemail className="w-4 h-4" /> 📞 Voicemail
                      </OutcomeButton>
                      <OutcomeButton
                        onClick={() => handleOutcome('wrong_number')}
                        disabled={busy}
                        className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                      >
                        <Ban className="w-4 h-4" /> ❌ Wrong number
                      </OutcomeButton>
                      <button
                        onClick={() => setShowNote(v => !v)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
                        style={{ minHeight: 60 }}
                      >
                        <StickyNote className="w-4 h-4" /> 📝 Add note
                      </button>
                      {showNote && (
                        <textarea
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Optional note — saved with the next outcome you tap"
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                        />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ================= CALLBACKS DUE ================= */}
          {callbacksDue.length > 0 && (
            <section>
              <SectionHeader icon={<CalendarClock className="w-4 h-4 text-amber-500" />} title="Callbacks due today" count={callbacksDue.length} />
              <div className="space-y-2">
                {callbacksDue.map(log => (
                  <div key={log.id} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[hsl(var(--foreground))] truncate">{log.lead?.company_name ?? 'Unknown lead'}</p>
                      {log.lead && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{subtitleFor(log.lead)}</p>}
                    </div>
                    {log.lead?.phone && (
                      <a
                        href={`tel:${log.lead.phone.replace(/\s+/g, '')}`}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-2 text-sm font-medium"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ================= HOT LEADS ================= */}
          <section>
            <SectionHeader icon={<Flame className="w-4 h-4 text-orange-500" />} title="Hot Leads" count={hotLeads.length} />
            {hotLeads.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
                No interested or booked leads yet — get calling.
              </p>
            ) : (
              <div className="space-y-2">
                {hotLeads.map(log => (
                  <div key={log.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[hsl(var(--foreground))] truncate">{log.lead?.company_name ?? 'Unknown lead'}</p>
                      <span className={cn(
                        'shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                        log.outcome === 'meeting_booked'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-green-500/15 text-green-600 dark:text-green-400'
                      )}>
                        {log.outcome === 'meeting_booked' ? '🎯 Booked' : '🟢 Interested'}
                      </span>
                    </div>
                    {log.lead && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">{subtitleFor(log.lead)}</p>}
                    {log.notes && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 line-clamp-2">“{log.notes}”</p>}
                    <button
                      disabled
                      title="Wiring to the AI Assistant is coming soon"
                      className="mt-2.5 w-full rounded-lg border border-dashed border-[hsl(var(--border))] py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] cursor-not-allowed"
                    >
                      ✉️ Draft follow-up email — coming soon
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

// 60px-tall, full-width, thumb-friendly outcome button.
function OutcomeButton({
  children, onClick, disabled, className,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ minHeight: 60 }}
      className={cn(
        'w-full flex items-center justify-center gap-2 rounded-xl text-base font-semibold transition-colors active:scale-[0.99] disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  )
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h2>
      <span className="text-xs text-[hsl(var(--muted-foreground))]">({count})</span>
    </div>
  )
}
