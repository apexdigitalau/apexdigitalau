-- Adds the email open/reply tracking columns to public.emails.
--
-- Why this exists: supabase-schema.sql has declared opened_at and replied_at since the
-- initial commit, but the live emails table was created before they were added and
-- CREATE TABLE IF NOT EXISTS will not backfill columns onto an existing table. The
-- analytics routes select both columns, so against the live table their queries fail with
--
--   42703: column emails.opened_at does not exist
--
-- which silently zeroes out the whole analytics page (0 emails, 0 replies, 0% reply rate,
-- no subject lines) and pins open_rate at 0% on the dashboard.
--
-- Safe to run more than once. Additive and non-destructive: both columns are nullable and
-- no existing row is rewritten.

ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS opened_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Verify: should return two rows, opened_at and replied_at.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'emails'
  AND column_name IN ('opened_at', 'replied_at')
ORDER BY column_name;
