"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";

interface MonthlyPoint {
  month: string;
  emails: number;
  replies: number;
  sales: number;
  revenue: number;
}

interface IndustryRow {
  industry: string;
  leads: number;
  won: number;
  revenue: number;
}

interface SubjectRow {
  subject: string;
  sent: number;
  opened: number;
  replied: number;
  openRate: number;
  replyRate: number;
}

interface Performance {
  months_of_history: number;
  monthly: MonthlyPoint[];
  industries: IndustryRow[];
  subject_lines: SubjectRow[];
  totals: {
    revenue: number;
    sales: number;
    avg_deal: number;
    emails: number;
    replies: number;
    reply_rate: number;
    leads: number;
    conversion_rate: number;
  };
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-3 shadow-xl text-xs">
        <p className="font-medium text-[hsl(var(--foreground))] mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
            <span>{p.name}:</span>
            <span className="font-semibold">{p.name === "Revenue" ? formatCurrency(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function EmptyState({ message, height = 200 }: { message: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]"
      style={{ height }}
    >
      {message}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/analytics/performance");
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Analytics" subtitle="Performance insights across all channels" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>
    );
  }

  const monthly = data?.monthly ?? [];
  const industries = data?.industries ?? [];
  const subjectLines = data?.subject_lines ?? [];
  const totals = data?.totals;
  const months = data?.months_of_history ?? 7;

  const hasRevenue = monthly.some(m => m.revenue > 0);
  const hasEmails = monthly.some(m => m.emails > 0 || m.replies > 0);
  const industriesWithRevenue = industries.filter(i => i.revenue > 0);

  const kpis = [
    {
      label: "Total Revenue",
      value: formatCurrency(totals?.revenue ?? 0),
      sub: "all time",
      color: "text-[hsl(var(--primary))]",
    },
    {
      label: "Websites Sold",
      value: String(totals?.sales ?? 0),
      sub: totals?.sales ? `avg deal: ${formatCurrency(totals.avg_deal)}` : "no deals yet",
      color: "text-emerald-400",
    },
    {
      label: "Total Emails",
      value: (totals?.emails ?? 0).toLocaleString(),
      sub: totals?.emails ? `reply rate: ${totals.reply_rate.toFixed(1)}%` : `last ${months} months`,
      color: "text-amber-400",
    },
    {
      label: "Conversion Rate",
      value: `${(totals?.conversion_rate ?? 0).toFixed(1)}%`,
      sub: totals?.leads ? `${totals.leads.toLocaleString()} leads → closed` : "no leads yet",
      color: "text-violet-400",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Analytics" subtitle="Performance insights across all channels" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Revenue &amp; Sales Pipeline</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{months}-month overview</p>
            </div>
          </div>
          {hasRevenue ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No revenue recorded yet — closed clients will appear here" height={220} />
          )}
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Email funnel */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Email Funnel</h3>
            {hasEmails ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthly} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="emails" name="Sent" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.8} />
                  <Bar dataKey="replies" name="Replies" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No emails sent yet" />
            )}
          </div>

          {/* Industry performance */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Revenue by Industry</h3>
            {industries.length === 0 ? (
              <EmptyState message="No leads yet" />
            ) : (
              <div className="flex items-center gap-4">
                {industriesWithRevenue.length > 0 && (
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={industriesWithRevenue} dataKey="revenue" nameKey="industry" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={0}>
                        {industriesWithRevenue.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex-1 space-y-2 max-h-[160px] overflow-y-auto">
                  {industries.slice(0, 8).map((item, i) => (
                    <div key={item.industry} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.revenue > 0 ? PIE_COLORS[i % PIE_COLORS.length] : 'hsl(var(--muted))' }}
                        />
                        <span className="text-xs text-[hsl(var(--foreground))] truncate">{item.industry}</span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">({item.leads})</span>
                      </div>
                      <span className="text-xs font-medium text-[hsl(var(--foreground))] shrink-0">{formatCurrency(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top subject lines */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Best Performing Subject Lines</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Outbound mail, last {months} months</p>
          </div>
          {subjectLines.length === 0 ? (
            <EmptyState message="No outbound emails yet — subject line performance will appear once you start sending" height={120} />
          ) : (
            <div className="space-y-3">
              {subjectLines.map((row, i) => (
                <div key={row.subject} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-5 shrink-0">{i + 1}</span>
                  <p className="text-xs text-[hsl(var(--foreground))] flex-1 truncate">{row.subject}</p>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] w-14 text-right shrink-0">{row.sent} sent</span>
                  <div className="w-20">
                    <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">
                      <span>Open</span><span>{row.openRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[hsl(var(--muted))]">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(row.openRate, 100)}%` }} />
                    </div>
                  </div>
                  <div className="w-20">
                    <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">
                      <span>Reply</span><span>{row.replyRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[hsl(var(--muted))]">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(row.replyRate, 100)}%` }} />
                    </div>
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
