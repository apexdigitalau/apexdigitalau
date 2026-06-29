'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import {
  Users, Mail, MessageSquare, Calendar, Globe, DollarSign,
  TrendingUp, BarChart2, RefreshCw, ArrowRight, Star, Clock
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

// Static chart data (replace with real data from analytics API when email tracking is live)

const emailData = [
  { date: "Mon", sent: 42, replies: 8 },
  { date: "Tue", sent: 65, replies: 14 },
  { date: "Wed", sent: 58, replies: 11 },
  { date: "Thu", sent: 71, replies: 19 },
  { date: "Fri", sent: 84, replies: 23 },
  { date: "Sat", sent: 12, replies: 4 },
  { date: "Sun", sent: 8, replies: 2 },
];

const revenueData = [
  { month: "Jan", revenue: 12400 },
  { month: "Feb", revenue: 18200 },
  { month: "Mar", revenue: 15800 },
  { month: "Apr", revenue: 24600 },
  { month: "May", revenue: 22100 },
  { month: "Jun", revenue: 31500 },
];

const recentLeads = [
  { name: "Smith & Sons Plumbing", status: "replied", score: 42, industry: "Plumbing" },
  { name: "Melbourne Dental Centre", status: "email_sent", score: 58, industry: "Healthcare" },
  { name: "TechStart Solutions", status: "meeting_booked", score: 71, industry: "Technology" },
  { name: "Coastal Cafe", status: "new", score: 35, industry: "Food & Bev" },
  { name: "Green Gardens", status: "won", score: 82, industry: "Landscaping" },
];

const statusColors: Record<string, string> = {
  new: "bg-slate-500/20 text-slate-400",
  email_sent: "bg-violet-500/20 text-violet-400",
  replied: "bg-amber-500/20 text-amber-400",
  meeting_booked: "bg-cyan-500/20 text-cyan-400",
  won: "bg-emerald-500/20 text-emerald-400",
};

const statusLabels: Record<string, string> = {
  new: "New",
  email_sent: "Email Sent",
  replied: "Replied",
  meeting_booked: "Meeting",
  won: "Won",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-3 shadow-xl text-xs">
        <p className="font-medium text-[hsl(var(--foreground))] mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface Stats {
  leads_today: number
  emails_sent_today: number
  replies_received: number
  meetings_booked: number
  websites_sold: number
  revenue_this_month: number
  reply_rate: number
  open_rate: number
  conversion_rate: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

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

  useEffect(() => { fetchStats() }, [])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <button onClick={fetchStats} className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title="Leads Today"
            value={stats?.leads_today ?? 0}
            change={12}
            changeLabel="vs yesterday"
            icon={<Users className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Emails Sent"
            value={stats?.emails_sent_today ?? 0}
            change={6}
            changeLabel="today"
            icon={<Mail className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Replies"
            value={stats?.replies_received ?? 0}
            change={15}
            changeLabel="this month"
            icon={<MessageSquare className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Meetings"
            value={stats?.meetings_booked ?? 0}
            change={-8}
            changeLabel="this week"
            icon={<Calendar className="w-4 h-4" />}
            loading={statsLoading}
          />
          <StatCard
            title="Revenue MTD"
            value={formatCurrency(stats?.revenue_this_month ?? 0)}
            change={28}
            changeLabel="vs last month"
            icon={<DollarSign className="w-4 h-4" />}
            loading={statsLoading}
          />
        </div>

        {/* Rate Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Reply Rate</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-[hsl(var(--foreground))]">{stats ? `${stats.reply_rate.toFixed(1)}%` : '—'}</p>
              <p className="text-xs text-emerald-500 mb-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />3.1%
              </p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(stats?.reply_rate ?? 27, 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Open Rate</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-[hsl(var(--foreground))]">{stats ? `${stats.open_rate.toFixed(1)}%` : '—'}</p>
              <p className="text-xs text-emerald-500 mb-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />5.8%
              </p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(stats?.open_rate ?? 41, 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Conversion Rate</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-[hsl(var(--foreground))]">{stats ? `${stats.conversion_rate.toFixed(1)}%` : '—'}</p>
              <p className="text-xs text-emerald-500 mb-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />1.2%
              </p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full w-[8%] rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-5 gap-4">
          {/* Email Chart */}
          <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
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
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={emailData}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} fill="url(#sentGrad)" />
                <Area type="monotone" dataKey="replies" name="Replies" stroke="#10b981" strokeWidth={2} fill="url(#replyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Chart */}
          <div className="col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Revenue</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">6-month trend</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-5 gap-4">
          {/* Recent Leads */}
          <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Recent Leads</h3>
              <Link href="/leads" className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-1">
              {recentLeads.map((lead, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold text-[hsl(var(--foreground))]">
                    {lead.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{lead.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{lead.industry}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[lead.status] || 'bg-slate-500/20 text-slate-400'}`}>
                    {statusLabels[lead.status] || lead.status}
                  </span>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${lead.score >= 70 ? 'text-emerald-500' : lead.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {lead.score}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">score</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats / Widgets */}
          <div className="col-span-2 space-y-4">
            {/* Websites Sold */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Websites Sold</p>
              <p className="text-3xl font-bold text-[hsl(var(--foreground))]">12</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">This month</p>
              <div className="mt-3 flex items-center gap-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={`flex-1 h-5 rounded-sm ${i < 8 ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}
                    style={{ opacity: i < 8 ? 0.6 + (i * 0.05) : 1 }}
                  />
                ))}
              </div>
            </div>

            {/* Follow-ups due */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Follow-ups Due</p>
              <div className="space-y-2">
                {["TechStart Solutions", "Melbourne Dental", "Quantum RE"].map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-[hsl(var(--foreground))] truncate">{name}</p>
                    <span className="ml-auto text-[10px] text-amber-500 font-medium shrink-0">Today</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
