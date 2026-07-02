'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Rocket, GitBranch, Palette, Database, Cloud, Server,
  CheckCircle, DollarSign, Shield, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react'

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group">
      <pre className="bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg p-3 text-xs text-[hsl(var(--foreground))] overflow-x-auto whitespace-pre-wrap">{code}</pre>
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />}
      </button>
    </div>
  )
}

function Section({ icon: Icon, step, title, time, children, defaultOpen = false }: {
  icon: any, step: string, title: string, time: string, children: React.ReactNode, defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 hover:bg-[hsl(var(--accent))] transition-colors">
        <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-[hsl(var(--primary))]" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{step}</p>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</p>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))] mr-2">{time}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-sm text-[hsl(var(--foreground))]">{children}</div>}
    </div>
  )
}

export default function DeployGuidePage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Deploy Guide" subtitle="Your playbook for deploying this CRM for a new client" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl">
        <div className="p-4 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] flex items-start gap-3">
          <Rocket className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Time per client once practiced: 1-2 hours</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Follow the steps in order. Each client gets their own GitHub repo, Supabase project, Google Cloud project, and Vercel deployment — fully isolated from yours and from each other.</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Before you start — gather from the client:</p>
          <ul className="space-y-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            <li>• Business name, brand colors, logo preference</li>
            <li>• The industry THEY serve (drives AI email &amp; analysis prompts)</li>
            <li>• Who THEIR target customers are (drives lead finding)</li>
            <li>• A Gmail / Google Workspace account they will connect</li>
            <li>• Agreed pricing: setup fee + monthly retainer</li>
          </ul>
        </div>

        <Section icon={GitBranch} step="STEP 1" title="Clone the template" time="5 min">
          <p>Create a new GitHub repo for the client (e.g. <code className="text-xs bg-[hsl(var(--muted))] px-1 py-0.5 rounded">clientname-crm</code>), then:</p>
          <CodeBlock code={`git clone https://github.com/apexdigitalau/apexdigitalau.git clientname-crm
cd clientname-crm
Remove-Item -Recurse -Force .git
git init
git add .
git commit -m "initial from template"
git remote add origin https://github.com/YOURACCOUNT/clientname-crm.git
git push -u origin main`} />
        </Section>

        <Section icon={Palette} step="STEP 2" title="Brand it for the client" time="10 min">
          <p>1. Edit <code className="text-xs bg-[hsl(var(--muted))] px-1 py-0.5 rounded">src/lib/brand.ts</code> — change every value: company name, tagline, page title, email sender name, what their business does, what they sell, who they target.</p>
          <p>2. Colors: edit <code className="text-xs bg-[hsl(var(--muted))] px-1 py-0.5 rounded">src/app/globals.css</code> — change <code className="text-xs bg-[hsl(var(--muted))] px-1 py-0.5 rounded">--primary</code> to their brand color (HSL format).</p>
          <p>3. Lead targeting: edit <code className="text-xs bg-[hsl(var(--muted))] px-1 py-0.5 rounded">src/lib/lead-rotation.ts</code> — replace INDUSTRIES and LOCATIONS with lists relevant to THEIR target customers.</p>
        </Section>

        <Section icon={Database} step="STEP 3" title="New Supabase project" time="15 min">
          <p>1. supabase.com → New project (named after the client)</p>
          <p>2. SQL Editor → run the full contents of <code className="text-xs bg-[hsl(var(--muted))] px-1 py-0.5 rounded">supabase-schema.sql</code></p>
          <p>3. Then run the Gmail columns migration:</p>
          <CodeBlock code={`ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS gmail_email TEXT,
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMPTZ;`} />
          <p>4. Create the client's login user (change email + password):</p>
          <CodeBlock code={`INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'client@theirbusiness.com', crypt('TheirPassword123!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}');`} />
          <p>5. Copy from Project Settings → API: <strong>Project URL</strong>, <strong>anon key</strong>, <strong>service_role key</strong></p>
        </Section>

        <Section icon={Cloud} step="STEP 4" title="New Google Cloud project" time="20 min">
          <p>Create a NEW Google Cloud project per client (keeps billing and quotas separate):</p>
          <p>1. console.cloud.google.com → New Project (client name)</p>
          <p>2. Enable BOTH APIs (they are separate!): <strong>Gmail API</strong> and <strong>Places API (New)</strong></p>
          <p>3. OAuth consent screen → External → app name = client's CRM name → add the CLIENT's email as a Test User → leave in Testing mode</p>
          <p>4. Credentials → Create OAuth client ID → Web application → Authorized redirect URI:</p>
          <CodeBlock code={`https://CLIENT-DOMAIN.vercel.app/api/auth/gmail/callback`} />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">(You'll confirm the exact domain after Step 5 — come back and update it.)</p>
          <p>5. Credentials → Create API key → this becomes GOOGLE_PLACES_API_KEY</p>
        </Section>

        <Section icon={Server} step="STEP 5" title="Vercel deployment" time="15 min">
          <p>1. vercel.com → New Project → import the client's GitHub repo</p>
          <p>2. Add these environment variables (all Production):</p>
          <CodeBlock code={`NEXT_PUBLIC_SUPABASE_URL       → from Step 3
NEXT_PUBLIC_SUPABASE_ANON_KEY  → from Step 3
SUPABASE_SERVICE_ROLE_KEY      → from Step 3
ANTHROPIC_API_KEY              → your key OR client's own
NEXT_PUBLIC_APP_URL            → https://their-project.vercel.app
GOOGLE_CLIENT_ID               → from Step 4
GOOGLE_CLIENT_SECRET           → from Step 4
GOOGLE_PLACES_API_KEY          → from Step 4`} />
          <p>3. Deploy. Note the final URL, go BACK to Google Cloud and set the OAuth redirect URI to match, update NEXT_PUBLIC_APP_URL if needed, redeploy.</p>
        </Section>

        <Section icon={CheckCircle} step="STEP 6" title="Handover test checklist" time="15 min">
          <ul className="space-y-1.5">
            <li>☐ Login works with client credentials</li>
            <li>☐ Settings → Connect Gmail works (client's Gmail)</li>
            <li>☐ Inbox syncs their real email</li>
            <li>☐ Find Leads pulls businesses in THEIR industry</li>
            <li>☐ Website analysis runs</li>
            <li>☐ AI email generates and sends</li>
            <li>☐ Daily cron appears in Vercel → Settings → Cron Jobs</li>
          </ul>
        </Section>

        <Section icon={DollarSign} step="PRICING" title="Your costs vs what to charge" time="">
          <ul className="space-y-1.5">
            <li>• Supabase free tier: fine for most single-user clients</li>
            <li>• Vercel Hobby: fine to start; commercial use technically requires Pro ($20/mo) — factor in when scaling</li>
            <li>• Google Places: $200/mo free credit per project = usually $0</li>
            <li>• Anthropic API: ~$3-15/mo depending on AI volume</li>
          </ul>
          <p className="font-semibold mt-2">Your realistic cost per client: $0-35/month → charge $150-300/month + setup fee ($2k-8k)</p>
        </Section>

        <Section icon={Shield} step="CONTRACT" title="Support boundary (put in every contract)" time="">
          <p className="font-medium">Included in monthly fee:</p>
          <ul className="space-y-1 text-[hsl(var(--muted-foreground))]">
            <li>• Hosting, uptime, bug fixes</li>
            <li>• Minor text/branding tweaks</li>
          </ul>
          <p className="font-medium mt-2">Billed separately (hourly or quoted):</p>
          <ul className="space-y-1 text-[hsl(var(--muted-foreground))]">
            <li>• New features</li>
            <li>• New integrations</li>
            <li>• Workflow changes</li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
