import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = getSupabaseAdmin()
    .from("leads")
    .select("*, website_analyses(overall_score)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,industry.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data, total: count, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Check for duplicate website
  if (body.website) {
    const { data: existing } = await getSupabaseAdmin()
      .from("leads")
      .select("id, company_name")
      .eq("website", body.website)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Duplicate: ${existing.company_name} already has this website` },
        { status: 409 }
      );
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .insert([body])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  if (!ids?.length) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

  const { error } = await getSupabaseAdmin().from("leads").delete().in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: ids.length });
}
