-- Owner-only expenses tracking: recurring subscriptions + one-off purchases.
--
-- AUD only by design: no currency column, no receipts, no client attribution.
-- This is a visibility tool for the two owners, not an accounting ledger.
--
-- Safe to re-run: every statement is guarded.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  amount_aud    NUMERIC(10,2) NOT NULL,
  cycle         TEXT NOT NULL CHECK (cycle IN ('monthly','yearly')),
  next_due_date DATE NOT NULL,
  category      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.one_off_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  amount_aud    NUMERIC(10,2) NOT NULL,
  purchase_date DATE NOT NULL,
  category      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- The dashboard panel filters on "due in the next 30 days" and the page sorts by
-- due date; the one-off list is always ordered newest purchase first.
CREATE INDEX IF NOT EXISTS subscriptions_next_due_date_idx
  ON public.subscriptions (next_due_date);
CREATE INDEX IF NOT EXISTS one_off_expenses_purchase_date_idx
  ON public.one_off_expenses (purchase_date DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger (subscriptions only — one-offs are never edited in place
-- often enough to need it, and the column does not exist there)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security — owners only
--
-- The allowlist is duplicated in src/lib/is-owner.ts. Keep the two in sync:
-- the app gate returns a clean 403, this is the belt-and-braces layer that
-- holds even if a route forgets to check.
--
-- FOR ALL covers SELECT/INSERT/UPDATE/DELETE. Both USING (existing rows) and
-- WITH CHECK (rows being written) are required — USING alone would let a
-- non-owner INSERT.
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_off_expenses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners only" ON public.subscriptions;
CREATE POLICY "Owners only" ON public.subscriptions
  FOR ALL
  USING      (auth.email() IN ('tomas@apexdigitalau.com','anthony@apexdigitalau.com'))
  WITH CHECK (auth.email() IN ('tomas@apexdigitalau.com','anthony@apexdigitalau.com'));

DROP POLICY IF EXISTS "Owners only" ON public.one_off_expenses;
CREATE POLICY "Owners only" ON public.one_off_expenses
  FOR ALL
  USING      (auth.email() IN ('tomas@apexdigitalau.com','anthony@apexdigitalau.com'))
  WITH CHECK (auth.email() IN ('tomas@apexdigitalau.com','anthony@apexdigitalau.com'));
