'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Sparkles, Send, Trash2, Loader2, ChevronDown, ChevronUp, Mail, Building2
} from 'lucide-react'

interface Draft {
  id: string
  lead_id: string | null
  to_email: string
  subject: string
  body: string
  created_at: string
  leads?: { company_name: string; industry: string | null; website: string | null } | null
}

const STAGE_LABELS: Record<string, string> = {
  parse: 'understanding your instruction',
  scrape: 'looking up leads and their email addresses',
  draft: 'writing the emails',
  save: 'saving the drafts',
}

/**
 * Render the structured error body from /api/assistant. The route reports which
 * stage failed and what the upstream service actually said, so show both — a
 * bare "Error: ..." previously made an Anthropic 401, a Supabase failure and a
 * malformed AI response all look identical.
 */
function formatError(data: any): string {
  const headline = data?.error || 'Something went wrong'
  const parts: string[] = []

  const stage = STAGE_LABELS[data?.stage] ?? data?.stage
  parts.push(stage ? `${headline} — failed while ${stage}.` : `${headline}.`)

  if (data?.upstream_error) {
    const status = data.upstream_status ? ` (HTTP ${data.upstream_status})` : ''
    parts.push(`Service said${status}: ${data.upstream_error}`)
  }

  return parts.join(' ')
}

export default function AssistantPage() {
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [discardingId, setDiscardingId] = useState<string | null>(null)

  async function loadDrafts() {
    try {
      const res = await fetch('/api/drafts')
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.drafts ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadDrafts() }, [])

  async function handleRun() {
    if (!instruction.trim() || running) return
    setRunning(true)
    setMessage(null)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      // A gateway timeout returns an HTML error page, not JSON — parse defensively.
      const raw = await res.text()
      let data: any
      try {
        data = JSON.parse(raw)
      } catch {
        // 504/408 is the one non-JSON case we can name confidently; anything
        // else that isn't JSON is a genuine unknown, so say so rather than
        // guessing at a cause.
        setMessage(
          res.status === 504 || res.status === 408
            ? 'The request took too long — try asking for fewer emails at once.'
            : 'Something went wrong — check logs.'
        )
        return
      }
      if (res.ok) {
        setMessage(data.message)
        if (data.drafts_created > 0) {
          setInstruction('')
          await loadDrafts()
        }
      } else {
        setMessage(formatError(data))
      }
    } catch (err) {
      setMessage('Error: ' + String(err))
    } finally {
      setRunning(false)
    }
  }

  function getDraftValues(d: Draft) {
    return edits[d.id] ?? { subject: d.subject, body: d.body }
  }

  async function handleSend(d: Draft) {
    const { subject, body } = getDraftValues(d)
    setSendingId(d.id)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: d.to_email, subject, body, lead_id: d.lead_id }),
      })
      const data = await res.json()
      if (res.ok) {
        // remove the draft row now that it's sent
        await fetch('/api/drafts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: d.id }),
        })
        setDrafts(prev => prev.filter(x => x.id !== d.id))
      } else {
        alert('Send failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Send failed: ' + String(err))
    } finally {
      setSendingId(null)
    }
  }

  async function handleDiscard(d: Draft) {
    setDiscardingId(d.id)
    try {
      await fetch('/api/drafts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id }),
      })
      setDrafts(prev => prev.filter(x => x.id !== d.id))
    } finally {
      setDiscardingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="AI Assistant" subtitle="Tell the AI what to do — review everything before it sends" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-safe space-y-6 max-w-4xl w-full">
        {/* Command box */}
        <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">What would you like me to do?</p>
          </div>
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }}
            placeholder={'e.g. "Write a draft email for 20 music schools pitching my CRM and website services"'}
            rows={2}
            className="w-full px-3 py-2.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
          />
          {/* Stacks on mobile so the hint text can't squeeze Ask AI to nothing. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Drafts land below for your review — nothing sends without you.</p>
            <button
              onClick={handleRun}
              disabled={running || !instruction.trim()}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-50"
            >
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : <><Sparkles className="w-4 h-4" /> Ask AI</>}
            </button>
          </div>
          {message && (
            <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]">
              <p className="text-sm text-[hsl(var(--foreground))]">{message}</p>
            </div>
          )}
        </div>

        {/* Draft review queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Review queue {drafts.length > 0 && <span className="text-[hsl(var(--muted-foreground))] font-normal">· {drafts.length} draft{drafts.length === 1 ? '' : 's'} waiting</span>}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="border border-dashed border-[hsl(var(--border))] rounded-xl p-10 text-center">
              <Mail className="w-6 h-6 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No drafts waiting. Give the AI an instruction above to generate some.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map(d => {
                const vals = getDraftValues(d)
                const isOpen = expanded === d.id
                return (
                  <div key={d.id} className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : d.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-[hsl(var(--accent))] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-[hsl(var(--primary))]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                          {d.leads?.company_name || d.to_email}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                          {vals.subject} → {d.to_email}
                        </p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3 border-t border-[hsl(var(--border))] pt-4">
                        <div>
                          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Subject</label>
                          <input
                            type="text"
                            value={vals.subject}
                            onChange={e => setEdits({ ...edits, [d.id]: { ...vals, subject: e.target.value } })}
                            className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Email body</label>
                          <textarea
                            value={vals.body}
                            onChange={e => setEdits({ ...edits, [d.id]: { ...vals, body: e.target.value } })}
                            rows={8}
                            className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-y"
                          />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                          <button
                            onClick={() => handleDiscard(d)}
                            disabled={discardingId === d.id || sendingId === d.id}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50 text-[hsl(var(--muted-foreground))]"
                          >
                            {discardingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Discard
                          </button>
                          <button
                            onClick={() => handleSend(d)}
                            disabled={sendingId === d.id || discardingId === d.id}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-50"
                          >
                            {sendingId === d.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send this email</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
