-- =============================================
-- Migration: add leads.has_contact_email
-- Run this in the Supabase SQL editor (or via `supabase db execute`).
-- Safe to run more than once.
-- =============================================
--
-- Adds a simple boolean flag for "this lead has a usable contact email".
-- The app uses it instead of repeating `email IS NOT NULL` checks. A trigger
-- keeps it perfectly in sync with the email column, so a manually added or
-- edited email flips the flag automatically and the flag can never drift.

-- 1. The column. Defaults to false so new rows without an email are flagged
--    as "no contact email" until one is found/added.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS has_contact_email BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill from existing data.
UPDATE public.leads
  SET has_contact_email = (email IS NOT NULL AND btrim(email) <> '')
  WHERE has_contact_email IS DISTINCT FROM (email IS NOT NULL AND btrim(email) <> '');

-- 3. Keep the flag in sync with email on every insert/update.
CREATE OR REPLACE FUNCTION public.sync_has_contact_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_contact_email := (NEW.email IS NOT NULL AND btrim(NEW.email) <> '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_sync_has_contact_email ON public.leads;
CREATE TRIGGER leads_sync_has_contact_email
  BEFORE INSERT OR UPDATE OF email ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_has_contact_email();

-- 4. Index so the "Has email" filter and the assistant's lookups stay cheap.
CREATE INDEX IF NOT EXISTS idx_leads_has_contact_email
  ON public.leads(has_contact_email);
