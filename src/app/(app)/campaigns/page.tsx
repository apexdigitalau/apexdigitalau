'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, Mail, Send, Clock, CheckCircle, PauseCircle, FileEdit,
  TrendingUp, Eye, MessageSquare, AlertCircle, Loader2, BarChart2, X
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  subject: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  sent_count: number
  delivered_count: number
  opened_count: number
  replied_count: number
  bounced_count: number
  spam_count: number
  sent_at: string | null
  leads_targeted: number
  industry?: string
  created_at: string
}

const statusConfig = {
  draft:     { label: 'Draft',     icon: FileEdit,    color: 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]' },
  scheduled: { label: 'Scheduled', icon: Clock,       color: 'text-amber-400 bg-amber-400/10' },
  sending:   { label: 'Sending',   icon: Send,        color: 'text-blue-400 bg-blue-400/10' },
  sent:      { label: 'Sent',      icon: CheckCircle, color: 'text-emerald-400 bg-emerald-400/10' },
  paused:    { label: 'Paused',    icon: PauseCircle, color: 'text-orange-400 bg-orange-400/10' },
}

function MetricPill({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-xs font-medium tabular-nums">{value.toLocaleString()}</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
    </div>
  )
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Campaign['status'] | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', industry: '' })

  async function loadCampaigns() {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns ?? [])
      } else {
        setCampaigns([])
      }
    } catch {
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCampaign() {
    if (!newCampaign.name.trim()) {
      alert('Campaign name is required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaign.name.trim(),
          subject: newCampaign.subject.trim() || null,
          industry: newCampaign.industry.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCreateOpen(false)
        setNewCampaign({ name: '', subject: '', industry: '' })
        loadCampaigns()
      } else {
        alert('Failed to create campaign: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to create campaign: ' + String(err))
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)

  const totals = campaigns.reduce((acc, c) => ({
    sent: acc.sent + c.sent_count,
    opened: acc.opened + c.opened_count,
    replied: acc.replied + c.replied_count,
    campaigns: acc.campaigns + 1,
  }), { sent: 0, opened: 0, replied: 0, campaigns: 0 })

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Campaigns"
        subtitle={`${campaigns.length} campaigns`}
        actions={
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Campaigns', value: totals.campaigns, icon: BarChart2, color: 'text-[hsl(var(--primary))]', bg: 'bg-[hsl(var(--primary)/0.1)]' },
            { label: 'Emails Sent', value: totals.sent.toLocaleString(), icon: Send, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Total Opens', value: totals.opened.toLocaleString(), icon: Eye, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'Total Replies', value: totals.replied.toLocaleString(), icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '…' : s.value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {(['all', 'sent', 'sending', 'scheduled', 'draft', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg capitalize transition-colors',
                filter === s
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
              )}
            >
              {s === 'all' ? 'All' : statusConfig[s as keyof typeof statusConfig]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Campaign cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
                <Mail className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No campaigns yet</p>
              </div>
            )}
            {filtered.map(c => {
              const cfg = statusConfig[c.status]
              const Icon = cfg.icon
              const openRate = c.sent_count > 0 ? ((c.opened_count / c.sent_count) * 100).toFixed(1) : '0.0'
              const replyRate = c.sent_count > 0 ? ((c.replied_count / c.sent_count) * 100).toFixed(1) : '0.0'
              const progress = c.leads_targeted > 0 ? (c.sent_count / c.leads_targeted) * 100 : 0

              return (
                <div key={c.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 hover:border-[hsl(var(--primary)/0.3)] transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium', cfg.color)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {c.industry && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2 py-0.5 rounded-md">{c.industry}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-[hsl(var(--foreground))]">{c.name}</h3>
                      {c.subject && <p className="text-sm text-[hsl(var(--muted-foreground))] truncate mt-0.5">{c.subject}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {c.sent_at && <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(c.sent_at)}</p>}
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.leads_targeted.toLocaleString()} targeted</p>
                    </div>
                  </div>

                  {/* Progress bar for active campaigns */}
                  {(c.status === 'sending' || c.status === 'sent') && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1.5">
                        <span>{c.sent_count.toLocaleString()} sent</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]">
                        <div
                          className={cn('h-full rounded-full transition-all', c.status === 'sending' ? 'bg-blue-400' : 'bg-emerald-500')}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Metrics */}
                  {c.sent_count > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <MetricPill label="sent" value={c.sent_count} icon={Send} color="text-[hsl(var(--muted-foreground))]" />
                      <MetricPill label="delivered" value={c.delivered_count} icon={CheckCircle} color="text-emerald-400" />
                      <MetricPill label="opened" value={c.opened_count} icon={Eye} color="text-amber-400" />
                      <MetricPill label="replied" value={c.replied_count} icon={MessageSquare} color="text-blue-400" />
                      {c.bounced_count > 0 && <MetricPill label="bounced" value={c.bounced_count} icon={AlertCircle} color="text-red-400" />}
                      <div className="ml-auto flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs">
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-medium">{openRate}%</span>
                          <span className="text-[hsl(var(--muted-foreground))]">open</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-medium">{replyRate}%</span>
                          <span className="text-[hsl(var(--muted-foreground))]">reply</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {c.status === 'draft' && (
                    <button className="mt-2 flex items-center gap-2 px-3 py-1.5 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
                      <Send className="w-3.5 h-3.5" /> Launch Campaign
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Campaign modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !creating && setCreateOpen(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">New Campaign</h2>
              <button onClick={() => !creating && setCreateOpen(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Campaign name *</label>
                <input type="text" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} placeholder="Sydney Builders — March outreach" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Email subject</label>
                <input type="text" value={newCampaign.subject} onChange={e => setNewCampaign({ ...newCampaign, subject: e.target.value })} placeholder="Quick question about your website" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Target industry</label>
                <input type="text" value={newCampaign.industry} onChange={e => setNewCampaign({ ...newCampaign, industry: e.target.value })} placeholder="Builders" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
            </div>

            <div className="p-5 border-t border-[hsl(var(--border))] flex gap-3">
              <button onClick={() => setCreateOpen(false)} disabled={creating} className="flex-1 py-2.5 px-4 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleCreateCampaign} disabled={creating || !newCampaign.name.trim()} className="flex-1 py-2.5 px-4 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4" /> Create</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
