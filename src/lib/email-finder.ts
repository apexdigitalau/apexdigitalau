// Finds a business's contact email by scanning their website.
// Checks the homepage and common contact pages for mailto: links
// and email addresses, then picks the most likely "real" one.

import type { SupabaseClient } from '@supabase/supabase-js'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

const BAD_PATTERNS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  'example.', 'sentry', 'wixpress', '@2x', 'no-reply', 'noreply',
  'godaddy', 'yourdomain', 'domain.com', 'email.com', 'yourname',
  'your-email', 'test@', 'user@', 'name@', 'someone@', 'schema.org',
]

function cleanCandidates(found: Set<string>, siteDomain: string): string | null {
  const candidates = [...found].filter(e =>
    !BAD_PATTERNS.some(b => e.includes(b)) &&
    !/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(e) &&
    e.length < 60
  )
  if (candidates.length === 0) return null

  const score = (e: string) => {
    let s = 0
    if (e.endsWith('@' + siteDomain)) s += 5
    if (e.split('@')[1]?.includes(siteDomain.split('.')[0])) s += 3
    if (/^(info|contact|hello|admin|enquiries|enquiry|sales|bookings|office|accounts)@/.test(e)) s += 3
    if (/(gmail|outlook|hotmail|bigpond|optusnet)\./.test(e)) s += 1
    return s
  }
  candidates.sort((a, b) => score(b) - score(a))
  return candidates[0]
}

export async function findEmailForWebsite(website: string): Promise<string | null> {
  let base = website.trim()
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base

  let origin: string
  let siteDomain: string
  try {
    const u = new URL(base)
    origin = u.origin
    siteDomain = u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }

  const paths = ['', '/contact', '/contact-us']
  const found = new Set<string>()

  for (const path of paths) {
    try {
      const res = await fetch(origin + path, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRMBot/1.0)' },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      })
      if (!res.ok) continue
      const html = await res.text()

      // mailto: links are the strongest signal
      const mailtos = html.match(/mailto:([^"'?\s>]+)/gi) || []
      for (const m of mailtos) {
        const e = m.replace(/mailto:/i, '').trim().toLowerCase()
        if (e.includes('@')) found.add(e)
      }

      // any email-looking strings in the page
      const matches = html.match(EMAIL_RE) || []
      for (const e of matches) found.add(e.toLowerCase())

      // if the homepage already gave us something, no need to keep crawling
      if (found.size > 0 && path !== '') break
    } catch {
      // site down / too slow / blocked — move on
    }
  }

  return cleanCandidates(found, siteDomain)
}

// How many website lookups we run at once. Each lookup can fire a few slow
// fetches, so this bounds the outbound load per serverless invocation.
export const SCRAPE_CONCURRENCY = 25

type ScrapeableLead = { id: string; website?: string | null; company_name?: string | null }

/**
 * Scrapes contact emails for a batch of freshly-inserted leads and writes any
 * hits back to the DB (email + has_contact_email = true). Runs in concurrent
 * waves so it stays fast without opening an unbounded number of connections.
 *
 * `maxTotal` caps how many lookups we attempt in a single run (used by the
 * daily cron to stay inside the 60s serverless budget). Leads beyond the cap
 * are left untouched — has_contact_email stays false, so the "Find Missing
 * Emails" button / next run can pick them up — and are logged for review.
 */
export async function scrapeEmailsForLeads(
  supabase: SupabaseClient,
  leads: ScrapeableLead[],
  opts: { maxTotal?: number; concurrency?: number } = {}
): Promise<{ scanned: number; found: number; skipped: number }> {
  const concurrency = opts.concurrency ?? SCRAPE_CONCURRENCY
  const withWebsite = leads.filter(
    (l): l is ScrapeableLead & { website: string } => Boolean(l.website)
  )

  let toScrape = withWebsite
  let skipped = 0
  if (opts.maxTotal != null && withWebsite.length > opts.maxTotal) {
    toScrape = withWebsite.slice(0, opts.maxTotal)
    const skippedLeads = withWebsite.slice(opts.maxTotal)
    skipped = skippedLeads.length
    console.warn(
      `[email-scrape] Capped at ${opts.maxTotal} lookups this run; skipped ${skipped} ` +
      `lead(s) with a website (they keep has_contact_email=false — use "Find Missing ` +
      `Emails" or the next run to retry): ` +
      skippedLeads.map((l) => l.company_name || l.id).join(', ')
    )
  }

  let found = 0
  for (let i = 0; i < toScrape.length; i += concurrency) {
    const batch = toScrape.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      batch.map(async (lead) => ({ lead, email: await findEmailForWebsite(lead.website) }))
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.email) {
        const { error } = await supabase
          .from('leads')
          .update({ email: r.value.email, has_contact_email: true })
          .eq('id', r.value.lead.id)
        if (error) {
          console.error(`[email-scrape] Failed to save email for ${r.value.lead.id}:`, error.message)
        } else {
          found++
        }
      }
    }
  }

  return { scanned: toScrape.length, found, skipped }
}
