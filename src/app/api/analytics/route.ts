import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Percent change vs the previous period. Null when there is no baseline to compare
// against — the UI hides the indicator rather than showing an invented trend.
function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  const db = getSupabaseAdmin();
  const now = new Date();

  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const weekStart = new Date(now.getTime() - 6 * DAY_MS);
  const revenueWindowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Unsent drafts sit in the emails table as direction 'outbound', status 'draft' until
  // they are actually sent, so every outbound count below filters them out — otherwise
  // drafting mail would inflate sent volume and deflate the reply/open rates.
  const [
    leadsToday,
    leadsYesterday,
    emailsToday,
    emailsYesterday,
    repliesThisMonth,
    repliesLastMonth,
    meetings,
    won,
    revenueThisMonth,
    revenueLastMonth,
    totalSent,
    totalOpened,
    totalReplied,
    totalLeads,
    recentEmails,
    recentClients,
    recentLeads,
    followUps,
  ] = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true }).eq("date_added", today),
    db.from("leads").select("id", { count: "exact", head: true }).eq("date_added", yesterday),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound").neq("status", "draft").gte("created_at", today),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound").neq("status", "draft").gte("created_at", yesterday).lt("created_at", today),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "inbound").gte("created_at", monthStart),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "inbound").gte("created_at", lastMonthStart).lt("created_at", monthStart),
    db.from("leads").select("id", { count: "exact", head: true }).eq("status", "meeting_booked"),
    db.from("leads").select("id", { count: "exact", head: true }).eq("status", "won"),
    db.from("clients").select("project_value").gte("created_at", monthStart),
    db.from("clients").select("project_value").gte("created_at", lastMonthStart).lt("created_at", monthStart),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound").neq("status", "draft"),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound").neq("status", "draft").not("opened_at", "is", null),
    db.from("emails").select("id", { count: "exact", head: true }).eq("direction", "inbound"),
    db.from("leads").select("id", { count: "exact", head: true }),
    db.from("emails").select("created_at, direction").neq("status", "draft").gte("created_at", weekStart.toISOString()),
    db.from("clients").select("created_at, project_value").gte("created_at", revenueWindowStart.toISOString()),
    db.from("leads").select("id, company_name, industry, status, website_score").order("created_at", { ascending: false }).limit(5),
    db.from("leads").select("id, company_name, follow_up_date").not("follow_up_date", "is", null).lte("follow_up_date", today).order("follow_up_date", { ascending: true }).limit(5),
  ]);

  const sumValue = (rows: { project_value: number | null }[] | null) =>
    (rows ?? []).reduce((s, c) => s + (c.project_value || 0), 0);

  const revenueMTD = sumValue(revenueThisMonth.data);
  const revenuePrevMonth = sumValue(revenueLastMonth.data);

  // Last 7 days of email activity, bucketed by day so gaps render as zeros.
  const emailBuckets = new Map<string, { date: string; sent: number; replies: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    emailBuckets.set(dayKey(d), {
      date: d.toLocaleDateString("en-AU", { weekday: "short" }),
      sent: 0,
      replies: 0,
    });
  }
  for (const email of recentEmails.data ?? []) {
    const bucket = emailBuckets.get(dayKey(new Date(email.created_at)));
    if (!bucket) continue;
    if (email.direction === "outbound") bucket.sent++;
    else bucket.replies++;
  }

  // Trailing 6 months of revenue, bucketed by month so quiet months render as zeros.
  const revenueBuckets = new Map<string, { month: string; revenue: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueBuckets.set(monthKey(d), {
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      revenue: 0,
    });
  }
  for (const client of recentClients.data ?? []) {
    const bucket = revenueBuckets.get(monthKey(new Date(client.created_at)));
    if (bucket) bucket.revenue += client.project_value || 0;
  }

  const sentCount = totalSent.count || 0;
  const leadCount = totalLeads.count || 0;
  const wonCount = won.count || 0;

  return NextResponse.json({
    leads_today: leadsToday.count || 0,
    emails_sent_today: emailsToday.count || 0,
    replies_received: repliesThisMonth.count || 0,
    meetings_booked: meetings.count || 0,
    websites_sold: wonCount,
    revenue_this_month: revenueMTD,
    reply_rate: sentCount ? ((totalReplied.count || 0) / sentCount) * 100 : 0,
    open_rate: sentCount ? ((totalOpened.count || 0) / sentCount) * 100 : 0,
    conversion_rate: leadCount ? (wonCount / leadCount) * 100 : 0,
    deltas: {
      leads_today: delta(leadsToday.count || 0, leadsYesterday.count || 0),
      emails_sent_today: delta(emailsToday.count || 0, emailsYesterday.count || 0),
      replies_received: delta(repliesThisMonth.count || 0, repliesLastMonth.count || 0),
      revenue_this_month: delta(revenueMTD, revenuePrevMonth),
    },
    email_activity: [...emailBuckets.values()],
    revenue_series: [...revenueBuckets.values()],
    recent_leads: recentLeads.data ?? [],
    follow_ups: followUps.data ?? [],
  });
}
