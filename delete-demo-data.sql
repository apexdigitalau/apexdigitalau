-- =============================================
-- DELETE DEMO DATA — Apex Digital AU CRM
-- Run this in the Supabase SQL editor.
-- =============================================
--
-- BACKGROUND
-- The old supabase-schema.sql ended with a single INSERT that seeded 8 demo leads.
-- That INSERT was the ONLY statement that ever wrote demo rows to the database —
-- no demo clients, campaigns, emails, or website analyses were ever seeded. (The
-- fake clients/emails/campaigns you saw in the UI were hardcoded in the React
-- pages and never reached Supabase; they have been deleted from the code.)
--
-- The 8 originally seeded companies:
--   1. Smith & Sons Plumbing       (https://smithsons.com.au)
--   2. Melbourne Dental Centre     (https://melbournedental.com.au)
--   3. Coastal Cafe & Bakery       (https://coastalcafe.com.au)
--   4. TechStart Solutions         (https://techstart.com.au)
--   5. Green Gardens Landscaping   (https://greengardens.com.au)
--   6. Sydney Law Group            (https://sydneylawgroup.com.au)
--   7. Bella's Beauty Studio       (https://bellasbeauty.com.au)
--   8. Quantum Real Estate         (https://quantumre.com.au)
--
-- As checked against the live database, 5 of the 8 are still present (Melbourne
-- Dental Centre, TechStart Solutions and Bella's Beauty Studio are already gone).
-- Listing all 8 is harmless and makes the script idempotent.
--
-- HOW ROWS ARE MATCHED
-- A lead is deleted only when BOTH company_name AND website match a seeded pair
-- exactly. Matching is deliberately NOT done on email or status: the demo rows in
-- your database have been edited since seeding (e.g. Coastal Cafe's address is now
-- hello@ rather than the seeded contact@), so those columns are no longer reliable.
-- Nor is `source` used — that column does not exist in your live leads table, and
-- your real Google Places leads carry a NULL source anyway, so it discriminates
-- nothing.
--
-- WHAT IS NOT TOUCHED (verified against the live database)
--   * Your 363 real leads (Google Places + your own imports).
--   * All 10 rows in public.emails — none is linked to a demo lead.
--   * All 173 rows in public.website_analyses — none is linked to a demo lead.
--   * public.clients and public.email_campaigns — both empty, and never seeded.
--   * public.settings — the default 'Apex Digital AU' row is required by the app.
--
-- EXPECTED EFFECT: 5 leads deleted, plus 1 cascaded row in email_templates
-- ("Quick thought on your Smith & Sons website"). Nothing else changes.

BEGIN;

-- ---------------------------------------------------------------
-- Step 1: identify the seeded rows
-- ---------------------------------------------------------------
CREATE TEMP TABLE demo_leads ON COMMIT DROP AS
SELECT l.id, l.company_name, l.website, l.status
FROM public.leads l
JOIN (
  VALUES
    ('Smith & Sons Plumbing',     'https://smithsons.com.au'),
    ('Melbourne Dental Centre',   'https://melbournedental.com.au'),
    ('Coastal Cafe & Bakery',     'https://coastalcafe.com.au'),
    ('TechStart Solutions',       'https://techstart.com.au'),
    ('Green Gardens Landscaping', 'https://greengardens.com.au'),
    ('Sydney Law Group',          'https://sydneylawgroup.com.au'),
    ('Bella''s Beauty Studio',    'https://bellasbeauty.com.au'),
    ('Quantum Real Estate',       'https://quantumre.com.au')
) AS demo(company_name, website)
  ON l.company_name = demo.company_name
 AND l.website      = demo.website;

-- Review this before committing. Expect only names from the list above.
SELECT * FROM demo_leads;

-- ---------------------------------------------------------------
-- Step 2: emails addressed to demo leads.
-- emails.lead_id is ON DELETE SET NULL, so these would survive as orphans rather
-- than cascade. Currently this deletes 0 rows — no real email is linked to a demo
-- lead — but it is here so the script stays correct if that changes.
-- ---------------------------------------------------------------
DELETE FROM public.emails
WHERE lead_id IN (SELECT id FROM demo_leads);

-- ---------------------------------------------------------------
-- Step 3: the demo leads themselves.
-- website_analyses, email_templates, notifications and activity_log rows belonging
-- to these leads are removed automatically via ON DELETE CASCADE.
-- ---------------------------------------------------------------
DELETE FROM public.leads
WHERE id IN (SELECT id FROM demo_leads);

COMMIT;

-- ---------------------------------------------------------------
-- Verify: should return 0 rows.
-- ---------------------------------------------------------------
SELECT company_name, website
FROM public.leads
WHERE (company_name, website) IN (
  ('Smith & Sons Plumbing',     'https://smithsons.com.au'),
  ('Melbourne Dental Centre',   'https://melbournedental.com.au'),
  ('Coastal Cafe & Bakery',     'https://coastalcafe.com.au'),
  ('TechStart Solutions',       'https://techstart.com.au'),
  ('Green Gardens Landscaping', 'https://greengardens.com.au'),
  ('Sydney Law Group',          'https://sydneylawgroup.com.au'),
  ('Bella''s Beauty Studio',    'https://bellasbeauty.com.au'),
  ('Quantum Real Estate',       'https://quantumre.com.au')
);

-- Sanity check: your real data is still there.
-- Expect roughly: leads 363, emails 10, analyses 173.
SELECT
  (SELECT COUNT(*) FROM public.leads)             AS remaining_leads,
  (SELECT COUNT(*) FROM public.emails)            AS remaining_emails,
  (SELECT COUNT(*) FROM public.website_analyses)  AS remaining_analyses;
