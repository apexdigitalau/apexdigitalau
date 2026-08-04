import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { failSupabase, failure } from "@/lib/api-error";

/**
 * Industries available to the /calls queue.
 *
 * "Callable" here has to mean exactly what `claim_next_lead` means by it — a
 * phone number, and no call_log row yet — otherwise the dropdown offers
 * industries whose queue is already empty. The two definitions are duplicated
 * (one in SQL, one here) because PostgREST cannot express the NOT EXISTS; the
 * comment on each is the only thing keeping them in step.
 *
 * Industries are deduped case-insensitively ("Plumber" and "plumber" are one
 * option). The returned `value` is fed to `claim_next_lead(p_industry)`, which
 * matches with ILIKE, so any casing variant selects the whole group.
 */

const PAGE = 1000;

export interface IndustryOption {
  /** null for "All industries" — passed straight through to the RPC. */
  value: string | null;
  label: string;
  count: number;
}

/** Read every row of a column, past PostgREST's 1000-row default cap. */
async function readAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<{ rows: T[]; error: { message?: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) return { rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, error: null };
  }
}

export async function GET() {
  try {
    const db = getSupabaseAdmin();

    const [leadsRes, logsRes] = await Promise.all([
      readAll<{ id: string; industry: string | null }>((from, to) =>
        db
          .from("leads")
          .select("id, industry")
          .not("phone", "is", null)
          .neq("phone", "")
          .range(from, to),
      ),
      readAll<{ lead_id: string }>((from, to) =>
        db.from("call_logs").select("lead_id").range(from, to),
      ),
    ]);

    if (leadsRes.error) return failSupabase("query_leads", leadsRes.error, "Could not load industries");
    if (logsRes.error) return failSupabase("query_call_logs", logsRes.error, "Could not load industries");

    const called = new Set(logsRes.rows.map((r) => r.lead_id));

    // Key on the lowercased value; keep the most common original casing as the
    // label so the dropdown reads the way the data was entered.
    const groups = new Map<string, { count: number; labels: Map<string, number> }>();
    let callableTotal = 0;

    for (const lead of leadsRes.rows) {
      if (called.has(lead.id)) continue;
      callableTotal++;
      const raw = lead.industry?.trim();
      if (!raw) continue; // uncategorised leads stay reachable only via "All industries"
      const key = raw.toLowerCase();
      const group = groups.get(key) ?? { count: 0, labels: new Map<string, number>() };
      group.count++;
      group.labels.set(raw, (group.labels.get(raw) ?? 0) + 1);
      groups.set(key, group);
    }

    const industries: IndustryOption[] = [...groups.entries()]
      .map(([key, group]) => {
        const [label] = [...group.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        return { value: label, label, count: group.count, sortKey: key };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ value, label, count }) => ({ value, label, count }));

    return NextResponse.json({
      industries: [
        { value: null, label: "All industries", count: callableTotal },
        ...industries,
      ] satisfies IndustryOption[],
    });
  } catch (err) {
    return failure(err, "lead_industries", "Could not load industries");
  }
}
