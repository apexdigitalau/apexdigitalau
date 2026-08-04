-- =============================================
-- Migration: industry filter on the /calls queue
-- Run this in the Supabase SQL editor (or via `supabase db execute`).
-- Safe to run more than once — every signature is dropped before it is created,
-- so re-running replaces the functions rather than stacking overloads.
-- =============================================
--
-- Adds an optional p_industry filter to the two queue functions from
-- add-calls.sql. When NULL (the "All industries" default) behaviour is
-- byte-for-byte what it was before this migration.
--
-- WHY DROP FIRST, not just CREATE OR REPLACE:
--   CREATE OR REPLACE cannot change a function's argument list — Postgres treats
--   claim_next_lead() and claim_next_lead(TEXT) as two DIFFERENT functions, so a
--   bare CREATE OR REPLACE would leave the old zero-argument version in place
--   alongside the new one. A PostgREST call with no arguments would then still
--   resolve to the OLD unfiltered function and the filter would silently do
--   nothing. Dropping every known signature first is what makes this migration
--   both correct and idempotent.

-- =============================================
-- 1. DROP EXISTING SIGNATURES
-- =============================================
-- log_call_and_next goes first: it calls claim_next_lead. (Postgres does not
-- track function-to-function dependencies, so the order is for clarity, not a
-- hard requirement.) Both the pre-migration and post-migration signatures are
-- listed so a re-run is clean.
DROP FUNCTION IF EXISTS public.log_call_and_next(UUID, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.log_call_and_next(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.claim_next_lead();
DROP FUNCTION IF EXISTS public.claim_next_lead(TEXT);

-- =============================================
-- 2. claim_next_lead(p_industry)
-- =============================================
-- Unchanged from add-calls.sql except for the p_industry predicate.
--
-- Eligibility: has a phone number, has never been logged (uncalled), and is not
-- currently locked by the OTHER user. A lead already locked by the caller is
-- returned again (so a page reload resumes the same card instead of skipping it).
--
-- FOR UPDATE SKIP LOCKED is what makes two simultaneous callers get DIFFERENT
-- leads: each row-locks its candidate for the length of the UPDATE, and a
-- concurrent claim skips any row another transaction is mid-claim on.
--
-- The p_industry predicate is written `p_industry IS NULL OR l.industry ILIKE
-- p_industry` so one function serves both the filtered and unfiltered queue.
-- ILIKE (not =) makes the match case-insensitive, which is what lets the API
-- hand back a single option for leads stored as "Plumber" and "plumber" alike.
-- Note ILIKE treats % and _ in p_industry as wildcards; the values come from
-- /api/leads/industries (i.e. from the column itself), so this is a filter, not
-- an injection surface — the argument is still bound, never interpolated.
CREATE OR REPLACE FUNCTION public.claim_next_lead(p_industry TEXT DEFAULT NULL)
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
        AND (p_industry IS NULL OR l.industry ILIKE p_industry)
      ORDER BY l.google_rating DESC NULLS LAST, l.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
   RETURNING *;
END;
$$;

-- =============================================
-- 3. log_call_and_next(..., p_industry)
-- =============================================
-- The hot path. In ONE round trip and ONE transaction it writes the outcome,
-- releases the lock, and returns the next claimed lead — so the UI can advance
-- immediately (the whole under-5-seconds point).
--
-- p_industry is appended LAST so the existing positional/named call sites keep
-- working: omitting it defaults to NULL, i.e. the unfiltered queue.
CREATE OR REPLACE FUNCTION public.log_call_and_next(
  p_lead        UUID,
  p_outcome     TEXT,
  p_notes       TEXT DEFAULT NULL,
  p_callback_at TIMESTAMPTZ DEFAULT NULL,
  p_industry    TEXT DEFAULT NULL
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

  -- Stay inside the same filter the caller is working through.
  RETURN QUERY SELECT * FROM public.claim_next_lead(p_industry);
END;
$$;

-- =============================================
-- 4. GRANTS
-- =============================================
-- DROP removed the old grants along with the old functions, so both must be
-- re-granted here.
GRANT EXECUTE ON FUNCTION public.claim_next_lead(TEXT)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_call_and_next(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT)  TO authenticated;

-- =============================================
-- 5. VERIFY
-- =============================================
-- Exactly one row per function — a second row for either name means an old
-- overload survived and the filter will be bypassed intermittently.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('claim_next_lead', 'log_call_and_next')
ORDER BY p.proname;

-- Callable leads per industry, case-insensitively — the same set
-- /api/leads/industries builds the dropdown from. Top 10.
SELECT lower(btrim(l.industry)) AS industry, count(*) AS callable_leads
FROM public.leads l
WHERE l.phone IS NOT NULL
  AND btrim(l.phone) <> ''
  AND l.industry IS NOT NULL
  AND btrim(l.industry) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.call_logs cl WHERE cl.lead_id = l.id)
GROUP BY 1
ORDER BY callable_leads DESC
LIMIT 10;
