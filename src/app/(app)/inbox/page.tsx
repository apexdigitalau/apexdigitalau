'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Search, Mail, Star, Archive, Clock, Send, Loader2,
  Reply, Building2, ChevronRight, Sparkles, RefreshCw
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'

interface Email {
  id: string
  lead_id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name: string | null
  subject: string
  body: string
  status: 'unread' | 'read' | 'replied' | 'archived' | 'starred'
  created_at: string
  leads?: { company_name: string; status: string }
}

type TabFilter = 'all' | 'unread' | 'starred' | 'waiting' | 'archived'

const MOCK_EMAILS: Email[] = [
  { id: '1', lead_id: '3', direction: 'inbound', from_email: 'contact@coastalcafe.com.au', from_name: 'Emma Watson', subject: 'Re: Your website could be losing customers', body: "Hi there,\n\nThanks for reaching out. You actually caught me at the right time - we've been thinking about a website refresh for a while now.\n\nThe comparison you showed between our site and competitors was eye-opening. We especially want to fix the mobile experience and add online ordering.\n\nCould we have a quick 20-minute chat this week?\n\nCheers,\nEmma", status: 'unread', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), leads: { company_name: 'Coastal Cafe & Bakery', status: 'replied' } },
  { id: '2', lead_id: '4', direction: 'inbound', from_email: 'hello@techstart.com.au', from_name: 'Mike Chen', subject: 'Re: Quick question about TechStart\'s website', body: "Hey,\n\nYep, we've definitely noticed the high bounce rate. Our current site is 4 years old and doesn't reflect where we are as a company now.\n\nWe have budget set aside for a redesign in Q1. Send me your portfolio and pricing.\n\nMike", status: 'read', created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), leads: { company_name: 'TechStart Solutions', status: 'replied' } },
  { id: '3', lead_id: '7', direction: 'inbound', from_email: 'bella@bellasbeauty.com.au', from_name: 'Bella Romano', subject: 'Re: Website proposal for Bella\'s Beauty Studio', body: "Hi,\n\nI've looked over the proposal and it all looks great. Just one question - can we add a booking system integration with our existing Fresha account?\n\nIf yes, I'm ready to go ahead.\n\nBella x", status: 'unread', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), leads: { company_name: "Bella's Beauty Studio", status: 'proposal_sent' } },
  { id: '4', lead_id: '5', direction: 'outbound', from_email: 'team@apexdigital.au', from_name: 'Apex Digital', subject: 'Green Gardens — website proposal', body: "Hi Tom,\n\nGreat speaking with you yesterday! As promised, here is our proposal for the Green Gardens website redesign...", status: 'replied', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), leads: { company_name: 'Green Gardens Landscaping', status: 'meeting_booked' } },
]

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Email | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function loadEmails() {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      if (res.ok) {
        const data = await res.json()
        const list = data.emails ?? []
        setEmails(list)
        if (list.length > 0 && !selected) setSelected(list[0])
        else if (list.length === 0) setSelected(null)
      } else {
        setEmails([])
        setSelected(null)
      }
    } catch {
      setEmails([])
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncGmail() {
    setSyncing(true)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await res.json()
      console.log('Gmail sync response:', res.status, data)
      if (res.ok) {
        alert(`Synced ${data.synced ?? 0} new · removed ${data.deleted ?? 0} deleted`)
        await loadEmails()
      } else {
        alert('Sync failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Gmail sync error:', err)
      alert('Failed to sync Gmail: ' + String(err))
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    // Auto-sync Gmail silently on page load, then load emails
    async function initialLoad() {
      setSyncing(true)
      try {
        await fetch('/api/gmail/sync', { method: 'POST' })
      } catch {
        // ignore sync errors on auto-load
      } finally {
        setSyncing(false)
      }
      await loadEmails()
    }
    initialLoad()
  }, [])

  const tabCounts = {
    all: emails.length,
    unread: emails.filter(e => e.status === 'unread').length,
    starred: emails.filter(e => e.status === 'starred').length,
    waiting: emails.filter(e => e.direction === 'outbound' && e.status !== 'replied').length,
    archived: emails.filter(e => e.status === 'archived').length,
  }

  const filtered = emails.filter(e => {
    const matchSearch = !search ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.from_email.toLowerCase().includes(search.toLowerCase()) ||
      e.leads?.company_name.toLowerCase().includes(search.toLowerCase())

    const matchTab = tab === 'all' ? true
      : tab === 'unread' ? e.status === 'unread'
      : tab === 'starred' ? e.status === 'starred'
      : tab === 'waiting' ? (e.direction === 'outbound' && e.status !== 'replied')
      : e.status === 'archived'

    return matchSearch && matchTab
  })

  async function handleSend() {
    if (!reply.trim() || !selected) return
    setSending(true)
    await new Promise(r => setTimeout(r, 800))
    setSending(false)
    setReply('')
    setEmails(prev => prev.map(e => e.id === selected.id ? { ...e, status: 'replied' } : e))
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Inbox"
        subtitle={`${tabCounts.unread} unread`}
        actions={
          <button
            onClick={handleSyncGmail}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync Gmail'}
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-80 flex-shrink-0 border-r border-[hsl(var(--border))] flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-[hsl(var(--border))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                placeholder="Search emails…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 px-2 py-2 border-b border-[hsl(var(--border))] overflow-x-auto">
            {(['all', 'unread', 'starred', 'waiting', 'archived'] as TabFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors capitalize',
                  tab === t
                    ? 'bg-[hsl(var(--primary))] text-white'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
                )}
              >
                {t} {tabCounts[t] > 0 && <span className="ml-0.5 opacity-70">{tabCounts[t]}</span>}
              </button>
            ))}
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                <Mail className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No emails</p>
              </div>
            )}
            {filtered.map(email => (
              <button
                key={email.id}
                onClick={() => setSelected(email)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--accent)/0.5)] transition-colors',
                  selected?.id === email.id && 'bg-[hsl(var(--primary)/0.08)] border-l-2 border-l-[hsl(var(--primary))]',
                  email.status === 'unread' && 'bg-[hsl(var(--card))]'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {email.status === 'unread' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] flex-shrink-0 mt-1" />
                    )}
                    <span className={cn(
                      'text-sm truncate',
                      email.status === 'unread' ? 'font-semibold text-[hsl(var(--foreground))]' : 'font-medium text-[hsl(var(--foreground)/0.8)]'
                    )}>
                      {email.direction === 'inbound' ? (email.from_name || email.from_email) : 'You'}
                    </span>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] flex-shrink-0">{formatRelativeTime(email.created_at)}</span>
                </div>
                <p className={cn('text-xs mb-1 truncate', email.status === 'unread' ? 'font-medium text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>
                  {email.subject}
                </p>
                <div className="flex items-center gap-2">
                  {email.leads?.company_name && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                      {email.leads.company_name}
                    </span>
                  )}
                  {email.direction === 'outbound' && (
                    <span className="text-xs text-blue-400 flex items-center gap-0.5">
                      <Send className="w-2.5 h-2.5" /> Sent
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — email detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
              <div className="text-center">
                <Mail className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select an email to read</p>
              </div>
            </div>
          ) : (
            <>
              {/* Email header */}
              <div className="p-6 border-b border-[hsl(var(--border))]">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] leading-tight">{selected.subject}</h2>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button className="p-2 rounded-lg hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] transition-colors" title="Star">
                      <Star className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] transition-colors" title="Archive">
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                      <span className="text-xs font-bold text-[hsl(var(--primary))]">
                        {(selected.from_name || selected.from_email)[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-[hsl(var(--foreground))]">{selected.from_name || selected.from_email}</p>
                      <p className="text-xs">{selected.from_email}</p>
                    </div>
                  </div>
                  {selected.leads && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-xs">{selected.leads.company_name}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                  <span className="text-xs">{formatRelativeTime(selected.created_at)}</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-[hsl(var(--foreground))] leading-relaxed">{selected.body}</pre>
                </div>
              </div>

              {/* Reply box */}
              <div className="border-t border-[hsl(var(--border))] p-4">
                <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    rows={4}
                    placeholder={`Reply to ${selected.from_name || selected.from_email}…`}
                    className="w-full px-4 py-3 text-sm bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none"
                  />
                  <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--muted)/0.5)] border-t border-[hsl(var(--border))]">
                    <button className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                      <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                      AI Draft
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        <Clock className="w-3 h-3 inline mr-1" />Follow-up reminder
                      </span>
                      <button
                        onClick={handleSend}
                        disabled={!reply.trim() || sending}
                        className="flex items-center gap-2 px-4 py-1.5 bg-[hsl(var(--primary))] text-white text-sm rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Reply className="w-3.5 h-3.5" />}
                        {sending ? 'Sending…' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
