-- =============================================
-- Migration: mobile call queue + hot leads
-- Run this in the Supabase SQL editor (or via `supabase db execute`).
-- Safe to run more than once — every statement is guarded (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS) and none rewrite existing rows.
-- =============================================
--
-- Adds everything the /calls page needs:
--   1. A soft-lock on leads (locked_by / locked_until) so two callers never get
--      the same lead. The lock auto-expires after 10 minutes, so nothing gets
--      stuck if the app closes mid-call.
--   2. A call_logs table — one row per logged outcome.
--   3. Three SECURITY DEFINER functions that do the concurrency-critical work
--      atomically inside Postgres (claim / log-and-advance / release), keyed off
--      auth.uid() so a caller can only ever act as themselves.

-- =============================================
-- 1. SOFT LOCK COLUMNS ON leads
-- =============================================
-- Chosen over a separate calls_lock table: a lead is locked by at most one user
-- at a time, so two nullable columns model it exactly with no join. The claim
-- function treats locked_until < now() as unlocked, so expiry needs no cleanup job.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS locked_by    UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Partial index so the "next unlocked, uncalled lead" scan stays cheap as the
-- table grows. Only currently-locked rows are indexed.
CREATE INDEX IF NOT EXISTS idx_leads_locked_until
  ON public.leads(locked_until) WHERE locked_until IS NOT NULL;

-- =============================================
-- 2. CALL LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.call_logs (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  called_by   UUID REFERENCES public.users(id),
  outcome     TEXT NOT NULL CHECK (outcome IN (
    'interested', 'callback', 'not_interested',
    'meeting_booked', 'voicemail', 'wrong_number'
  )),
  notes       TEXT,
  callback_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_lead        ON public.call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_called_by   ON public.call_logs(called_by);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at  ON public.call_logs(created_at);
-- Powers the "Callbacks due today" query.
CREATE INDEX IF NOT EXISTS idx_call_logs_callback_at
  ON public.call_logs(callback_at) WHERE outcome = 'callback';
-- Powers the "already called" exclusion in claim_next_lead.
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON public.call_logs(outcome);

-- =============================================
-- 3. ROW LEVEL SECURITY
-- =============================================
-- Matches the app's existing convention: any authenticated user can read/write.
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read call_logs" ON public.call_logs;
CREATE POLICY "Authenticated users can read call_logs"
  ON public.call_logs FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- 4. CONCURRENCY-SAFE FUNCTIONS
-- =============================================
-- All three are SECURITY DEFINER and derive the acting user from auth.uid(),
-- so the browser calls them with no trusted user-id parameter to spoof.

-- claim_next_lead: atomically grab the best eligible lead and lock it for 10 min.
--
-- Eligibility: has a phone number, has never been logged (uncalled), and is not
-- currently locked by the OTHER user. A lead already locked by the caller is
-- returned again (so a page reload resumes the same card instead of skipping it).
--
-- FOR UPDATE SKIP LOCKED is what makes two simultaneous callers get DIFFERENT
-- leads: each row-locks its candidate for the length of the UPDATE, and a
-- concurrent claim skips any row another transaction is mid-claim on.
CREATE OR REPLACE FUNCTION public.claim_next_lead()
RETURNS SETOF public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  UPDATE public.leads
     SET locked_by = v_user,
         locked_until = now() + interval '10 minutes'
   WHERE id = (
     SELECT l.id
       FROM public.leads l
      WHERE l.phone IS NOT NULL
        AND btrim(l.phone) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM public.call_logs cl WHERE cl.lead_id = l.id
        )
        AND (
          l.locked_until IS NULL
          OR l.locked_until < now()
          OR l.locked_by = v_user
        )
      ORDER BY l.google_rating DESC NULLS LAST, l.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
   RETURNING *;
END;
$$;

-- log_call_and_next: the hot path. In ONE round trip and ONE transaction it
-- writes the outcome, releases the lock, and returns the next claimed lead —
-- so the UI can advance immediately (the whole under-5-seconds point).
CREATE OR REPLACE FUNCTION public.log_call_and_next(
  p_lead        UUID,
  p_outcome     TEXT,
  p_notes       TEXT DEFAULT NULL,
  p_callback_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.call_logs (lead_id, called_by, outcome, notes, callback_at)
  VALUES (p_lead, v_user, p_outcome, NULLIF(btrim(p_notes), ''), p_callback_at);

  -- Release the lock. Once a call_log row exists the lead is "called" and will
  -- never be re-served by claim_next_lead, so clearing the lock is safe.
  UPDATE public.leads
     SET locked_by = NULL, locked_until = NULL
   WHERE id = p_lead;

  RETURN QUERY SELECT * FROM public.claim_next_lead();
END;
$$;

-- release_lock: best-effort unlock when a caller leaves a card without logging
-- (navigates away / closes the tab). Only clears the caller's own lock; the
-- 10-minute expiry is the real guarantee.
CREATE OR REPLACE FUNCTION public.release_lock(p_lead UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  UPDATE public.leads
     SET locked_by = NULL, locked_until = NULL
   WHERE id = p_lead AND locked_by = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_lead()                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_call_and_next(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_lock(UUID)                               TO authenticated;

-- =============================================
-- 5. VERIFY
-- =============================================
-- New columns on leads (expect 2 rows).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name IN ('locked_by', 'locked_until')
ORDER BY column_name;

-- call_logs exists (expect 1 row).
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'call_logs';

-- Functions exist (expect 3 rows).
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('claim_next_lead', 'log_call_and_next', 'release_lock')
ORDER BY routine_name;

-- How much runway: leads with a usable phone number that haven't been called yet.
SELECT count(*) AS callable_leads
FROM public.leads l
WHERE l.phone IS NOT NULL
  AND btrim(l.phone) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.call_logs cl WHERE cl.lead_id = l.id);
