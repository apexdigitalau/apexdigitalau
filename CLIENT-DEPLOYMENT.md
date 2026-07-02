# CRM TEMPLATE — CLIENT DEPLOYMENT PLAYBOOK

This is your step-by-step checklist for deploying this CRM for a new paying client.
Estimated time once practiced: **1-2 hours per client.**

---

## WHAT YOU NEED BEFORE STARTING

- [ ] Client's business name, branding colors, and logo preference
- [ ] What industry THEY serve (for AI email/analysis prompts)
- [ ] Who THEIR target customers are (for lead finding)
- [ ] A Gmail/Google Workspace account they'll connect for email
- [ ] Agreed pricing: setup fee + monthly retainer (hosting, support)

---

## STEP 1 — CLONE THE TEMPLATE (5 min)

1. Create a new GitHub repo for the client, e.g. `clientname-crm`
2. Clone your template repo locally, remove the git history, point at the new repo:

```
git clone https://github.com/apexdigitalau/apexdigitalau.git clientname-crm
cd clientname-crm
Remove-Item -Recurse -Force .git
git init
git add .
git commit -m "initial from template"
git remote add origin https://github.com/YOURACCOUNT/clientname-crm.git
git push -u origin main
```

---

## STEP 2 — BRAND IT (10 min)

1. Open `src/lib/brand.ts` — change every value for the client:
   - companyName, companyFullName, tagline, pageTitle
   - emailSenderName
   - agencyType (what THEIR business is)
   - services (what THEY sell)
   - targetAudience (who THEY target)

2. Colors: open `src/app/globals.css`, change `--primary` (and optionally
   other CSS variables) to the client's brand color (HSL format).

3. Lead rotation: open `src/lib/lead-rotation.ts` and replace INDUSTRIES
   and LOCATIONS with lists relevant to the CLIENT's target customers.

---

## STEP 3 — NEW SUPABASE PROJECT (15 min)

1. supabase.com → New project (name it after the client)
2. SQL Editor → paste and run the FULL contents of `supabase-schema.sql`
3. Then run the Gmail columns migration:
```sql
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS gmail_email TEXT,
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMPTZ;
```
4. Create the client's login user (change email + password):
```sql
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'client@theirbusiness.com', crypt('TheirPassword123!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}');
```
5. Copy from Project Settings → API: Project URL, anon key, service_role key

---

## STEP 4 — GOOGLE CLOUD PROJECT (20 min)

Create a NEW Google Cloud project per client (keeps billing/quotas separate):

1. console.cloud.google.com → New Project (client name)
2. Enable APIs: **Gmail API** AND **Places API (New)** (both, separately!)
3. OAuth consent screen → External → app name = client's CRM name →
   add the CLIENT's email as a Test User → leave in Testing mode
4. Credentials → Create OAuth client ID → Web application →
   Authorized redirect URI: `https://CLIENT-DOMAIN.vercel.app/api/auth/gmail/callback`
   (you'll know the domain after Step 5 — come back and set it)
5. Credentials → Create API key → this is GOOGLE_PLACES_API_KEY
6. Note: Client ID, Client Secret, Places API key

---

## STEP 5 — VERCEL DEPLOYMENT (15 min)

1. vercel.com → New Project → import the client's GitHub repo
2. Add environment variables (all Production):

| Variable | Value |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | from Step 3 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | from Step 3 |
| SUPABASE_SERVICE_ROLE_KEY | from Step 3 |
| ANTHROPIC_API_KEY | your key OR client's own |
| NEXT_PUBLIC_APP_URL | https://their-project.vercel.app |
| GOOGLE_CLIENT_ID | from Step 4 |
| GOOGLE_CLIENT_SECRET | from Step 4 |
| GOOGLE_PLACES_API_KEY | from Step 4 |

3. Deploy. Note the final URL, go BACK to Google Cloud and set the
   OAuth redirect URI to match: `https://FINAL-URL/api/auth/gmail/callback`
   and update NEXT_PUBLIC_APP_URL if needed, then redeploy.

---

## STEP 6 — HANDOVER TEST (15 min)

- [ ] Login works with client credentials
- [ ] Settings → Connect Gmail works (client's Gmail)
- [ ] Inbox syncs their real email
- [ ] Find Leads pulls businesses in THEIR industry
- [ ] Website analysis runs
- [ ] AI email generates and sends
- [ ] Daily cron appears in Vercel → Settings → Cron Jobs

---

## BILLING NOTES (your costs per client)

- Supabase free tier: fine for most single-user clients
- Vercel free (Hobby): fine, but commercial use technically requires Pro
  ($20/mo) — factor into pricing when scaling
- Google Places: $200/mo free credit per Google Cloud project = usually $0
- Anthropic API: ~$3-15/mo depending on AI email/analysis volume
- **Your realistic cost per client: $0-35/month → charge $150-300/month**

---

## SUPPORT BOUNDARY (put this in your client contract)

Included in monthly fee:
- Hosting, uptime, bug fixes
- Minor text/branding tweaks

Billed separately (hourly or quoted):
- New features
- New integrations
- Workflow changes
