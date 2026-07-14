-- The Settings → Integrations tab has a "Webhook Secret" field with nowhere to store it:
-- the settings table has n8n_webhook_url but no matching secret column. Until this runs,
-- that input is inert and the UI says so.
--
-- Run in the Supabase SQL editor, then add 'n8n_webhook_secret' to WRITABLE_FIELDS in
-- src/app/api/settings/route.ts and send it from payloadFor('integrations').

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS n8n_webhook_secret TEXT;
