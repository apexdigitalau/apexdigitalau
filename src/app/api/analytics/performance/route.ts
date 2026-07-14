import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const MONTHS_OF_HISTORY = 7;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const db = getSupabaseAdmin();
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_OF_HISTORY - 1), 1);
  const windowStartISO = windowStart.toISOString();

  const [windowEmails, windowClients, allClients, allLeads] = await Promise.all([
    // Unsent drafts are outbound rows with status 'draft'. They are excluded here so they
    // cannot count towards the monthly sent series, subject-line volume, or reply rate.
    db
      .from("emails")
      .select("created_at, direction, subject, opened_at, replied_at, status")
      .neq("status", "draft")
      .gte("created_at", windowStartISO),
    db.from("clients").select("created_at, project_value").gte("created_at", windowStartISO),
    db.from("clients").select("project_value, lead_id"),
    db.from("leads").select("id, industry, status"),
  ]);

  const emails = windowEmails.data ?? [];
  const clients = allClients.data ?? [];
  const leads = allLeads.data ?? [];

  // Monthly series — every month in the window gets a bucket so quiet months plot as zero.
  const monthly = new Map<
    string,
    { month: string; emails: number; replies: number; sales: number; revenue: number }
  >();
  for (let i = MONTHS_OF_HISTORY - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.set(monthKey(d), {
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      emails: 0,
      replies: 0,
      sales: 0,
      revenue: 0,
    });
  }
  for (const email of emails) {
    const bucket = monthly.get(monthKey(new Date(email.created_at)));
    if (!bucket) continue;
    if (email.direction === "outbound") bucket.emails++;
    else bucket.replies++;
  }
  for (const client of windowClients.data ?? []) {
    const bucket = monthly.get(monthKey(new Date(client.created_at)));
    if (!bucket) continue;
    bucket.sales++;
    bucket.revenue += client.project_value || 0;
  }

  // Industry breakdown. Revenue is attributed through the client's originating lead;
  // clients created without a lead land in "Unassigned".
  const industryByLead = new Map<string, string>();
  const industries = new Map<string, { industry: string; leads: number; won: number; revenue: number }>();
  const bucketFor = (industry: string) => {
    if (!industries.has(industry)) {
      industries.set(industry, { industry, leads: 0, won: 0, revenue: 0 });
    }
    return industries.get(industry)!;
  };

  for (const lead of leads) {
    const industry = lead.industry || "Uncategorised";
    industryByLead.set(lead.id, industry);
    const bucket = bucketFor(industry);
    bucket.leads++;
    if (lead.status === "won") bucket.won++;
  }
  for (const client of clients) {
    const industry = (client.lead_id && industryByLead.get(client.lead_id)) || "Unassigned";
    bucketFor(industry).revenue += client.project_value || 0;
  }

  // Subject-line performance across outbound mail in the window.
  const subjects = new Map<string, { subject: string; sent: number; opened: number; replied: number }>();
  for (const email of emails) {
    if (email.direction !== "outbound" || !email.subject) continue;
    if (!subjects.has(email.subject)) {
      subjects.set(email.subject, { subject: email.subject, sent: 0, opened: 0, replied: 0 });
    }
    const row = subjects.get(email.subject)!;
    row.sent++;
    if (email.opened_at || email.status === "opened") row.opened++;
    if (email.replied_at || email.status === "replied") row.replied++;
  }

  const subjectLines = [...subjects.values()]
    .map((s) => ({
      ...s,
      openRate: s.sent ? (s.opened / s.sent) * 100 : 0,
      replyRate: s.sent ? (s.replied / s.sent) * 100 : 0,
    }))
    .sort((a, b) => b.openRate - a.openRate || b.sent - a.sent)
    .slice(0, 5);

  const totalRevenue = clients.reduce((s: number, c: { project_value: number | null }) => s + (c.project_value || 0), 0);
  const totalSales = clients.length;
  const totalEmails = emails.filter((e) => e.direction === "outbound").length;
  const totalReplies = emails.filter((e) => e.direction === "inbound").length;
  const wonLeads = leads.filter((l) => l.status === "won").length;

  return NextResponse.json({
    months_of_history: MONTHS_OF_HISTORY,
    monthly: [...monthly.values()],
    industries: [...industries.values()].sort((a, b) => b.revenue - a.revenue || b.leads - a.leads),
    subject_lines: subjectLines,
    totals: {
      revenue: totalRevenue,
      sales: totalSales,
      avg_deal: totalSales ? totalRevenue / totalSales : 0,
      emails: totalEmails,
      replies: totalReplies,
      reply_rate: totalEmails ? (totalReplies / totalEmails) * 100 : 0,
      leads: leads.length,
      conversion_rate: leads.length ? (wonLeads / leads.length) * 100 : 0,
    },
  });
}
