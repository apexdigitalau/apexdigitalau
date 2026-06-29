"use client";

import { TopBar } from "@/components/layout/TopBar";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const monthlyData = [
  { month: "Jul", emails: 340, replies: 62, meetings: 8, sales: 2, revenue: 14500 },
  { month: "Aug", emails: 420, replies: 78, meetings: 11, sales: 3, revenue: 21000 },
  { month: "Sep", emails: 380, replies: 71, meetings: 9, sales: 4, revenue: 28500 },
  { month: "Oct", emails: 510, replies: 97, meetings: 15, sales: 5, revenue: 35000 },
  { month: "Nov", emails: 460, replies: 89, meetings: 13, sales: 6, revenue: 42000 },
  { month: "Dec", emails: 280, replies: 54, meetings: 7, sales: 4, revenue: 29500 },
  { month: "Jan", emails: 590, replies: 112, meetings: 18, sales: 9, revenue: 63500 },
];

const industryData = [
  { industry: "Healthcare", leads: 84, won: 12, revenue: 89400 },
  { industry: "Legal", leads: 61, won: 8, revenue: 68000 },
  { industry: "Real Estate", leads: 113, won: 14, revenue: 112000 },
  { industry: "Plumbing", leads: 248, won: 22, revenue: 66000 },
  { industry: "Food & Bev", leads: 196, won: 18, revenue: 54000 },
  { industry: "Technology", leads: 72, won: 11, revenue: 93500 },
];

const subjectLines = [
  { subject: "Your website is costing you customers...", openRate: 48.3, replyRate: 21.4, sent: 284 },
  { subject: "Is your [industry] practice invisible online?", openRate: 44.1, replyRate: 18.9, sent: 312 },
  { subject: "3 reasons your website isn't converting", openRate: 41.7, replyRate: 16.2, sent: 198 },
  { subject: "How we helped a [city] business get 40% more leads", openRate: 38.2, replyRate: 14.8, sent: 256 },
  { subject: "Quick question about [company name]", openRate: 35.6, replyRate: 12.1, sent: 421 },
];

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

export default function AnalyticsPage() {
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalSales = monthlyData.reduce((s, m) => s + m.sales, 0);
  const totalEmails = monthlyData.reduce((s, m) => s + m.emails, 0);
  const totalReplies = monthlyData.reduce((s, m) => s + m.replies, 0);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Analytics" subtitle="Performance insights across all channels" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: formatCurrency(totalRevenue), sub: "7-month total", color: "text-[hsl(var(--primary))]" },
            { label: "Websites Sold", value: totalSales.toString(), sub: "avg deal: " + formatCurrency(totalRevenue / totalSales), color: "text-emerald-400" },
            { label: "Total Emails", value: totalEmails.toLocaleString(), sub: "avg reply rate: " + ((totalReplies/totalEmails)*100).toFixed(1) + "%", color: "text-amber-400" },
            { label: "Conversion Rate", value: ((totalSales / 847) * 100).toFixed(1) + "%", sub: "leads → closed", color: "text-violet-400" },
          ].map(k => (
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
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Revenue & Sales Pipeline</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">7-month overview</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
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
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Email funnel */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Email Funnel</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="emails" name="Sent" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.8} />
                <Bar dataKey="replies" name="Replies" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="meetings" name="Meetings" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Industry performance */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Revenue by Industry</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={industryData} dataKey="revenue" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={0}>
                    {industryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {industryData.map((item, i) => (
                  <div key={item.industry} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-[hsl(var(--foreground))]">{item.industry}</span>
                    </div>
                    <span className="text-xs font-medium text-[hsl(var(--foreground))]">{formatCurrency(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top subject lines */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Best Performing Subject Lines</h3>
          <div className="space-y-3">
            {subjectLines.map((row, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-5 shrink-0">{i + 1}</span>
                <p className="text-xs text-[hsl(var(--foreground))] flex-1 truncate">{row.subject}</p>
                <span className="text-xs text-[hsl(var(--muted-foreground))] w-14 text-right shrink-0">{row.sent} sent</span>
                <div className="w-20">
                  <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">
                    <span>Open</span><span>{row.openRate}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[hsl(var(--muted))]">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${row.openRate}%` }} />
                  </div>
                </div>
                <div className="w-20">
                  <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">
                    <span>Reply</span><span>{row.replyRate}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[hsl(var(--muted))]">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.replyRate * 2}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
