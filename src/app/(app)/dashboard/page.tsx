'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import {
  Users, Mail, MessageSquare, Calendar, DollarSign,
  RefreshCw, ArrowRight, Clock, Send, UserPlus, PhoneCall
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { UpcomingSubscriptions } from '@/components/dashboard/UpcomingSubscriptions'

const statusColors: Record<string, string> = {
  new: "bg-slate-500/20 text-slate-400",
  ready_to_contact: "bg-indigo-500/20 text-indigo-400",
  email_sent: "bg-violet-500/20 text-violet-400",
  replied: "bg-amber-500/20 text-amber-400",
  meeting_booked: "bg-cyan-500/20 text-cyan-400",
  proposal_sent: "bg-blue-500/20 text-blue-400",
  won: "bg-emerald-500/20 text-emerald-400",
  lost: "bg-red-500/20 text-red-400",
  archived: "bg-slate-500/20 text-slate-500",
};

const statusLabels: Record<string, string> = {
  new: "New",
  ready_to_contact: "Ready",
  email_sent: "Email Sent",
  replied: "Replied",
  meeting_booked: "Meeting",
  proposal_sent: "Proposal",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-3 shadow-xl text-xs">
        <p className="font-medium text-[hsl(var(--foreground))] mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">{p.name === 'Revenue' ? formatCurrency(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-xs text-[hsl(var(--muted-foreground))]">
      {message}
    </div>
  );
}

interface RecentLead {
  id: string
  company_name: string
  industry: string | null
  status: string
  website_score: number | null
}

interface FollowUp {
  id: string
  company_name: string
  follow_up_date: string
}

interface Stats {
  today_emails_sent: number
  today_leads: number
  total_emails_sent: number
  total_leads: number
  replies_received: number
  meetings_booked: number
  websites_sold: number
  revenue_this_month: number
  reply_rate: number
  open_rate: number
  conversion_rate: number
  deltas: {
    leads_today: number | null
    emails_sent_today: number | null
    replies_received: number | null
    revenue_this_month: number | null
  }
  email_activity: { date: string; sent: number; replies: number }[]
  revenue_series: { month: string; revenue: number }[]
  recent_leads: RecentLead[]
  follow_ups: FollowUp[]
}

function followUpLabel(date: string): string {
  const today = new Date().toISOString().split('T')[0]
  if (date === today) return 'Today'
  return date < today ? 'Overdue' : formatDate(date)
}

// Team calls leaderboard. Order here is the order the chips render in — the two
// outcomes worth celebrating first, then the rest.
const CALL_OUTCOMES = [
  { key: 'meeting_booked', label: 'Booked', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { key: 'interested', label: 'Interested', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  { key: 'callback', label: 'Callback', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { key: 'not_interested', label: 'Not interested', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { key: 'voicemail', label: 'Voicemail', className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' },
  { key: 'wrong_number', label: 'Wrong number', className: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' },
] as const

interface CallLeaderboardRow {
  user_id: string | null
  email: string | null
  name: string | null
  total: number
  outcomes: Record<string, number>
}

// "tomas@apexdigitalau.com" -> "tomas" when there's no full_name to show.
function callerLabel(row: CallLeaderboardRow): string {
  if (row.name?.trim()) return row.name
  if (row.email) return row.email
  return 'Unknown caller'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [callRows, setCallRows] = useState<CallLeaderboardRow[]>([])
  const [callsLoading, setCallsLoading] = useState(true)

  async function fetchStats() {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/analytics')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setStatsLoading(false)
    }
  }

  async function fetchCalls() {
    setCallsLoading(true)
    try {
      const res = await fetch('/api/analytics/calls')
      const data = await res.json()
      setCallRows(Array.isArray(data?.leaderboard) ? data.leaderboard : [])
    } catch (err) {
      console.error(err)
    } finally {
      setCallsLoading(false)
    }
  }

  function refreshAll() {
    fetchStats()
    fetchCalls()
  }

  useEffect(() => { refreshAll() }, [])

  const emailActivity = stats?.email_activity ?? []
  const revenueSeries = stats?.revenue_series ?? []
  const recentLeads = stats?.recent_leads ?? []
  const followUps = stats?.follow_ups ?? []

  const hasEmailActivity = emailActivity.some(d => d.sent > 0 || d.replies > 0)
  const hasRevenue = revenueSeries.some(d => d.revenue > 0)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <button onClick={refreshAll} className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Emails Sent Today"
            value={stats?.today_emails_sent ?? 0}
            change={stats?.deltas?.emails_sent_today ?? undefined}
            changeLabel="vs yesterday"
            icon={<Mail className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Leads Today"
            value={stats?.today_leads ?? 0}
            change={stats?.deltas?.leads_today ?? undefined}
            changeLabel="vs yesterday"
            icon={<Users className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Total Emails Sent"
            value={stats?.total_emails_sent ?? 0}
            changeLabel="all time"
            icon={<Send className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Total Leads"
            value={stats?.total_leads ?? 0}
            changeLabel="all time"
            icon={<UserPlus className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Replies"
            value={stats?.replies_received ?? 0}
            change={stats?.deltas?.replies_received ?? undefined}
            changeLabel="this month"
            icon={<MessageSquare className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Meetings"
            value={stats?.meetings_booked ?? 0}
            changeLabel="in pipeline"
            icon={<Calendar className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Revenue MTD"
            value={formatCurrency(stats?.revenue_this_month ?? 0)}
            change={stats?.deltas?.revenue_this_month ?? undefined}
            changeLabel="vs last month"
            icon={<DollarSign className="w-4 h-4" />}
            loading={statsLoading}
          />
        </div>

        {/* Owner-only — renders nothing for everyone else */}
        <UpcomingSubscriptions />

        {/* Rate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {[
            { label: 'Reply Rate', value: stats?.reply_rate, bar: 'bg-[hsl(var(--primary))]' },
            { label: 'Open Rate', value: stats?.open_rate, bar: 'bg-amber-500' },
            { label: 'Conversion Rate', value: stats?.conversion_rate, bar: 'bg-emerald-500' },
          ].map(rate => (
            <div key={rate.label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">{rate.label}</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-[hsl(var(--foreground))]">
                  {statsLoading || rate.value === undefined ? '—' : `${rate.value.toFixed(1)}%`}
                </p>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[hsl(var(--muted))]">
                <div
                  className={`h-full rounded-full ${rate.bar}`}
                  style={{ width: `${Math.min(rate.value ?? 0, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
          {/* Email Chart */}
          <div className="lg:col-span-3 min-w-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Email Activity</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />Sent</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Replies</span>
              </div>
            </div>
            {hasEmailActivity ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={emailActivity}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sent" name="Sent" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#sentGrad)" />
                  <Area type="monotone" dataKey="replies" name="Replies" stroke="#10b981" strokeWidth={2} fill="url(#replyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={statsLoading ? 'Loading…' : 'No email activity in the last 7 days'} />
            )}
          </div>

          {/* Revenue Chart */}
          <div className="lg:col-span-2 min-w-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Revenue</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">6-month trend</p>
              </div>
            </div>
            {hasRevenue ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={revenueSeries} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message={statsLoading ? 'Loading…' : 'No revenue recorded yet'} />
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
          {/* Recent Leads */}
          <div className="lg:col-span-3 min-w-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Recent Leads</h3>
              <Link href="/leads" className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-1">
              {recentLeads.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">
                  {statsLoading ? 'Loading…' : 'No leads yet'}
                </p>
              )}
              {recentLeads.map(lead => (
                <Link
                  key={lead.id}
                  href="/leads"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold text-[hsl(var(--foreground))]">
                    {lead.company_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{lead.company_name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{lead.industry ?? 'Uncategorised'}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[lead.status] || 'bg-slate-500/20 text-slate-400'}`}>
                    {statusLabels[lead.status] || lead.status}
                  </span>
                  <div className="text-right w-8">
                    {lead.website_score === null ? (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">—</p>
                    ) : (
                      <>
                        <p className={`text-xs font-bold ${lead.website_score >= 70 ? 'text-emerald-500' : lead.website_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {lead.website_score}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">score</p>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Stats / Widgets */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {/* Websites Sold */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Websites Sold</p>
              <p className="text-3xl font-bold text-[hsl(var(--foreground))]">
                {statsLoading ? '—' : stats?.websites_sold ?? 0}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Leads marked won</p>
            </div>

            {/* Follow-ups due */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Follow-ups Due</p>
              <div className="space-y-2">
                {followUps.length === 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {statsLoading ? 'Loading…' : 'Nothing due right now'}
                  </p>
                )}
                {followUps.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-[hsl(var(--foreground))] truncate">{f.company_name}</p>
                    <span className="ml-auto text-[10px] text-amber-500 font-medium shrink-0">
                      {followUpLabel(f.follow_up_date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Team calls today */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Team calls today</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Sydney time · resets at midnight</p>
            </div>
            <Link href="/calls" className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
              Call queue <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {callsLoading ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">Loading…</p>
          ) : callRows.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">
              No calls logged today yet.
            </p>
          ) : (
            <div className="space-y-2">
              {callRows.map(row => (
                <div
                  key={row.user_id ?? 'unattributed'}
                  className="flex flex-col gap-2.5 rounded-lg border border-[hsl(var(--border))] p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 sm:w-56 sm:shrink-0">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center">
                      <PhoneCall className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                        {callerLabel(row)}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {row.total} {row.total === 1 ? 'call' : 'calls'}
                      </p>
                    </div>
                  </div>

                  {/* All six outcomes always render, so a row's shape is comparable
                      down the column; zeros are dimmed rather than hidden. */}
                  <div className="flex flex-wrap gap-1.5 sm:justify-end sm:flex-1">
                    {CALL_OUTCOMES.map(o => {
                      const n = row.outcomes?.[o.key] ?? 0
                      return (
                        <span
                          key={o.key}
                          title={o.label}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            n > 0 ? o.className : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] opacity-50'
                          }`}
                        >
                          {o.label} {n}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
