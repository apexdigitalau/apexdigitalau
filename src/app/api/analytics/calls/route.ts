import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { failSupabase, failure } from "@/lib/api-error";
import { dayStart } from "@/lib/sydney-time";

/**
 * Team calls leaderboard — one row per user who has logged a call during the
 * current Sydney day, with a per-outcome breakdown.
 *
 * On the identity join: `call_logs.called_by` is a FK to `public.users`, which
 * `auth.users` populates on signup (id and email are the same row in both).
 * PostgREST only exposes the `public` schema, so `auth.users` cannot be embedded
 * directly — the embed below resolves the same email through the FK. Any
 * `called_by` with no `public.users` row (created before the sync trigger, say)
 * falls back to the Auth admin API so a caller never renders as "Unknown".
 */

export const OUTCOMES = [
  "interested",
  "meeting_booked",
  "callback",
  "not_interested",
  "voicemail",
  "wrong_number",
] as const;

type Outcome = (typeof OUTCOMES)[number];

type Breakdown = Record<Outcome, number>;

export interface LeaderboardRow {
  user_id: string | null;
  email: string | null;
  name: string | null;
  total: number;
  outcomes: Breakdown;
}

function emptyBreakdown(): Breakdown {
  return {
    interested: 0,
    meeting_booked: 0,
    callback: 0,
    not_interested: 0,
    voicemail: 0,
    wrong_number: 0,
  };
}

interface LogRow {
  called_by: string | null;
  outcome: string;
  // PostgREST returns an embedded to-one relation as an object, but the generated
  // types widen it to an array; accept both rather than casting at every use.
  user: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null;
}

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const since = dayStart(new Date()).toISOString();

    const { data, error } = await db
      .from("call_logs")
      .select("called_by, outcome, user:users(email, full_name)")
      .gte("created_at", since);

    if (error) return failSupabase("query_call_logs", error, "Could not load today's calls");

    // Group by caller. `called_by` is nullable, so unattributed logs collapse into
    // a single "Unknown caller" row rather than being dropped from the totals.
    const rows = new Map<string, LeaderboardRow>();
    for (const log of (data ?? []) as unknown as LogRow[]) {
      const key = log.called_by ?? "__unattributed__";
      let row = rows.get(key);
      if (!row) {
        const embedded = Array.isArray(log.user) ? log.user[0] : log.user;
        row = {
          user_id: log.called_by,
          email: embedded?.email ?? null,
          name: embedded?.full_name ?? null,
          total: 0,
          outcomes: emptyBreakdown(),
        };
        rows.set(key, row);
      }
      row.total++;
      if ((OUTCOMES as readonly string[]).includes(log.outcome)) {
        row.outcomes[log.outcome as Outcome]++;
      }
    }

    // Fallback for callers the FK could not resolve.
    const unresolved = [...rows.values()].filter((r) => r.user_id && !r.email);
    if (unresolved.length > 0) {
      const { data: authList } = await db.auth.admin.listUsers();
      const byId = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? null]));
      for (const row of unresolved) {
        row.email = byId.get(row.user_id!) ?? null;
      }
    }

    const leaderboard = [...rows.values()].sort(
      (a, b) => b.total - a.total || (a.email ?? "").localeCompare(b.email ?? ""),
    );

    return NextResponse.json({
      since,
      total_calls: leaderboard.reduce((s, r) => s + r.total, 0),
      leaderboard,
    });
  } catch (err) {
    return failure(err, "calls_leaderboard", "Could not load today's calls");
  }
}
