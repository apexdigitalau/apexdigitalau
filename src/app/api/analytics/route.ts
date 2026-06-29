import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [leadsToday, emailsToday, replies, meetings, won, revenue] = await Promise.all([
    getSupabaseAdmin().from("leads").select("id", { count: "exact", head: true }).gte("date_added", today),
    getSupabaseAdmin().from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound").gte("created_at", today),
    getSupabaseAdmin().from("emails").select("id", { count: "exact", head: true }).eq("direction", "inbound").gte("created_at", monthStart),
    getSupabaseAdmin().from("leads").select("id", { count: "exact", head: true }).eq("status", "meeting_booked"),
    getSupabaseAdmin().from("leads").select("id", { count: "exact", head: true }).eq("status", "won"),
    getSupabaseAdmin().from("clients").select("project_value").gte("created_at", monthStart),
  ]);

  const revenueTotal = (revenue.data || []).reduce((s: number, c: any) => s + (c.project_value || 0), 0);

  // Calculate rates
  const { count: totalSent } = await getSupabaseAdmin().from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound");
  const { count: totalOpened } = await getSupabaseAdmin().from("emails").select("id", { count: "exact", head: true }).eq("status", "opened");
  const { count: totalReplied } = await getSupabaseAdmin().from("emails").select("id", { count: "exact", head: true }).eq("direction", "inbound");
  const { count: totalLeads } = await getSupabaseAdmin().from("leads").select("id", { count: "exact", head: true });
  const { count: totalWon } = await getSupabaseAdmin().from("leads").select("id", { count: "exact", head: true }).eq("status", "won");

  return NextResponse.json({
    leads_today: leadsToday.count || 0,
    emails_sent_today: emailsToday.count || 0,
    replies_received: replies.count || 0,
    meetings_booked: meetings.count || 0,
    websites_sold: won.count || 0,
    revenue_this_month: revenueTotal,
    reply_rate: totalSent ? ((totalReplied || 0) / totalSent) * 100 : 0,
    open_rate: totalSent ? ((totalOpened || 0) / totalSent) * 100 : 0,
    conversion_rate: totalLeads ? ((totalWon || 0) / totalLeads) * 100 : 0,
  });
}
