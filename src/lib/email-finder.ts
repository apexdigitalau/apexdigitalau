// Finds a business's contact email by scanning their website.
// Checks the homepage and common contact pages for mailto: links
// and email addresses, then picks the most likely "real" one.

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
