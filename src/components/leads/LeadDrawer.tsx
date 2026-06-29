'use client'

import { useState, useEffect } from 'react'
import {
  X, Globe, Mail, Phone, MapPin, Star, Calendar, User, MessageSquare,
  Sparkles, Send, Clock, ExternalLink, ChevronDown, Loader2,
  Building2, FileText, Copy, Check, Bell
} from 'lucide-react'
import { Lead, LeadStatus } from '@/types'
import { StatusBadge } from '@/components/leads/StatusBadge'
import { ScoreRing } from '@/components/common/ScoreRing'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface LeadDrawerProps {
  lead: Lead | null
  onClose: () => void
  onUpdate: (lead: Lead) => void
}

const STATUS_OPTIONS: LeadStatus[] = [
  'new', 'ready_to_contact', 'email_sent', 'replied',
  'meeting_booked', 'proposal_sent', 'won', 'lost', 'archived'
]

type Tab = 'overview' | 'email' | 'notes' | 'history'

export function LeadDrawer({ lead, onClose, onUpdate }: LeadDrawerProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<LeadStatus>(lead?.status || 'new')

  useEffect(() => {
    if (lead) {
      setCurrentStatus(lead.status)
      setGeneratedEmail(null)
      setNote('')
      setTab('overview')
    }
  }, [lead?.id])

  useEffect(() => {
    if (generatedEmail) {
      setEditedSubject(generatedEmail.subject)
      setEditedBody(generatedEmail.body)
    }
  }, [generatedEmail])

  if (!lead) return null

  async function handleGenerateEmail() {
    setGeneratingEmail(true)
    setTab('email')
    try {
      const res = await fetch('/api/campaigns/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead!.id }),
      })
      const data = await res.json()
      if (data.subject && data.body) {
        setGeneratedEmail({ subject: data.subject, body: data.body })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setGeneratingEmail(false)
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    await new Promise(r => setTimeout(r, 1000))
    setSendingEmail(false)
    setGeneratedEmail(null)
    handleStatusChange('email_sent')
  }

  async function handleStatusChange(status: LeadStatus) {
    setCurrentStatus(status)
    setStatusOpen(false)
    try {
      await fetch(`/api/leads/${lead!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      onUpdate({ ...lead!, status })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleSaveNote() {
    if (!note.trim()) return
    setSavingNote(true)
    try {
      await fetch(`/api/leads/${lead!.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note }),
      })
      setNote('')
    } catch (err) {
      console.error(err)
    } finally {
      setSavingNote(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(`Subject: ${editedSubject}\n\n${editedBody}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const score = lead.website_score ?? 0

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[hsl(var(--border))]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{lead.company_name}</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{lead.industry}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm hover:border-[hsl(var(--primary))] transition-colors"
              >
                <StatusBadge status={currentStatus} />
                <ChevronDown className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 z-10">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] transition-colors ${s === currentStatus ? 'bg-[hsl(var(--accent))]' : ''}`}
                    >
                      <StatusBadge status={s} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[hsl(var(--border))] px-6">
          {(['overview', 'email', 'notes', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
            >
              {t === 'email' ? 'AI Email' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {lead.website_score != null && (
                <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] flex items-center gap-4">
                  <ScoreRing score={score} size={64} strokeWidth={6} />
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">Website Score</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {score < 40 ? 'Poor — strong opportunity' : score < 60 ? 'Below average' : score < 80 ? 'Average' : 'Good'}
                    </p>
                  </div>
                  <a href="/website-analysis" className="ml-auto text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1">
                    Analysis <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Contact Details</h3>
                <div className="space-y-2.5">
                  {lead.contact_name && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <span>{lead.contact_name}</span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <a href={`mailto:${lead.email}`} className="text-[hsl(var(--primary))] hover:underline">{lead.email}</a>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline truncate">{lead.website}</a>
                    </div>
                  )}
                  {lead.address && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <span>{lead.address}</span>
                    </div>
                  )}
                  {lead.google_rating && (
                    <div className="flex items-center gap-3 text-sm">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>{lead.google_rating} / 5 on Google</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Timeline</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <span className="text-[hsl(var(--muted-foreground))]">Added</span>
                    <span className="ml-auto">{formatDate(lead.date_added)}</span>
                  </div>
                  {lead.last_contacted && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="text-[hsl(var(--muted-foreground))]">Last contacted</span>
                      <span className="ml-auto">{formatRelativeTime(lead.last_contacted)}</span>
                    </div>
                  )}
                  {lead.follow_up_date && (
                    <div className="flex items-center gap-3 text-sm">
                      <Bell className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="text-[hsl(var(--muted-foreground))]">Follow up</span>
                      <span className="ml-auto text-amber-500 font-medium">{formatDate(lead.follow_up_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {lead.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Notes</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}

              <div className="p-4 rounded-xl border border-dashed border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.04)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.15)] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Generate AI Email</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">Personalised for {lead.company_name} using website analysis</p>
                  </div>
                  <button
                    onClick={handleGenerateEmail}
                    disabled={generatingEmail}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--primary))] text-white text-sm rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-70 flex-shrink-0"
                  >
                    {generatingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI EMAIL */}
          {tab === 'email' && (
            <div className="space-y-4">
              {!generatedEmail && !generatingEmail && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-[hsl(var(--primary))]" />
                  </div>
                  <p className="text-sm font-medium mb-1">No email generated yet</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">Claude will craft a personalised cold email using the website analysis.</p>
                  <button onClick={handleGenerateEmail} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white text-sm rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors mx-auto">
                    <Sparkles className="w-4 h-4" /> Generate Email
                  </button>
                </div>
              )}

              {generatingEmail && (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))] mx-auto mb-4" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Claude is writing your email…</p>
                </div>
              )}

              {generatedEmail && !generatingEmail && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Generated Email</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button onClick={handleGenerateEmail} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                        <Sparkles className="w-3 h-3" /> Regenerate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">Subject</label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={e => setEditedSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">Body</label>
                    <textarea
                      value={editedBody}
                      onChange={e => setEditedBody(e.target.value)}
                      rows={14}
                      className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none font-mono leading-relaxed"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                      className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white text-sm font-medium rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-70"
                    >
                      {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sendingEmail ? 'Sending…' : 'Send Email'}
                    </button>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Edit above before sending</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTES */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Add note</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={4}
                  placeholder="Write a note about this lead…"
                  className="w-full px-3 py-2.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !note.trim()}
                  className="mt-2 flex items-center gap-2 px-3 py-2 bg-[hsl(var(--primary))] text-white text-sm rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-50"
                >
                  {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Save Note
                </button>
              </div>
              {lead.notes && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Existing Notes</h3>
                  <div className="p-4 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Email history will appear here once Gmail is connected.</p>
              <a href="/settings" className="text-xs text-[hsl(var(--primary))] hover:underline mt-2 block">Connect Gmail in Settings →</a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[hsl(var(--border))] flex items-center justify-between">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Added {formatRelativeTime(lead.date_added)}</p>
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
              <Globe className="w-3 h-3" /> Visit site
            </a>
          )}
        </div>
      </div>
    </>
  )
}
