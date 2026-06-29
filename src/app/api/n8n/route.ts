import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Verify webhook secret
function verifySecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-n8n-secret");
  return secret === process.env.N8N_WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, data } = body;

  switch (action) {
    case "create_lead": {
      // Deduplicate by website
      if (data.website) {
        const { data: existing } = await getSupabaseAdmin()
          .from("leads")
          .select("id")
          .eq("website", data.website)
          .single();
        if (existing) {
          return NextResponse.json({ skipped: true, reason: "duplicate", lead_id: existing.id });
        }
      }

      const { data: lead, error } = await getSupabaseAdmin()
        .from("leads")
        .insert([{ ...data, source: data.source || "n8n" }])
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Create notification
      await getSupabaseAdmin().from("notifications").insert([{
        type: "lead_imported",
        title: "New Lead Imported",
        message: `${lead.company_name} was imported via automation`,
        lead_id: lead.id,
      }]);

      return NextResponse.json({ success: true, lead_id: lead.id });
    }

    case "update_lead_status": {
      const { lead_id, status } = data;
      const { error } = await getSupabaseAdmin()
        .from("leads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", lead_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case "save_website_analysis": {
      const { lead_id, ...analysisData } = data;

      const { error } = await getSupabaseAdmin()
        .from("website_analyses")
        .insert([{ lead_id, ...analysisData }]);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Update lead website_score
      await getSupabaseAdmin()
        .from("leads")
        .update({ website_score: analysisData.overall_score })
        .eq("id", lead_id);

      // Notify
      await getSupabaseAdmin().from("notifications").insert([{
        type: "analysis_complete",
        title: "Website Analysis Complete",
        message: `Analysis finished — score: ${analysisData.overall_score}/100`,
        lead_id,
      }]);

      return NextResponse.json({ success: true });
    }

    case "save_email_reply": {
      const { lead_id, from_email, subject, body: emailBody, gmail_thread_id } = data;

      const { error } = await getSupabaseAdmin().from("emails").insert([{
        lead_id,
        direction: "inbound",
        from_email,
        to_email: "apex@apexdigital.com.au",
        subject,
        body: emailBody,
        gmail_thread_id,
        status: "replied",
        sent_at: new Date().toISOString(),
      }]);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Update lead status to replied + set last_contacted
      await getSupabaseAdmin().from("leads").update({
        status: "replied",
        last_contacted: new Date().toISOString(),
      }).eq("id", lead_id);

      await getSupabaseAdmin().from("notifications").insert([{
        type: "reply",
        title: "New Reply Received",
        message: `Reply from ${from_email}`,
        lead_id,
      }]);

      return NextResponse.json({ success: true });
    }

    case "bulk_create_leads": {
      const leads = data.leads || [];
      const results = { created: 0, skipped: 0, errors: 0 };

      for (const lead of leads) {
        if (lead.website) {
          const { data: existing } = await getSupabaseAdmin()
            .from("leads").select("id").eq("website", lead.website).single();
          if (existing) { results.skipped++; continue; }
        }

        const { error } = await getSupabaseAdmin()
          .from("leads")
          .insert([{ ...lead, source: "n8n_bulk" }]);

        if (error) results.errors++;
        else results.created++;
      }

      return NextResponse.json({ success: true, ...results });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
