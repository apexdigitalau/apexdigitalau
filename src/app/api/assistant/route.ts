import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'
import { findEmailForWebsite } from '@/lib/email-finder'

export const maxDuration = 300

async function callClaude(system: string, user: string, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'AI request failed')
  return data.content?.[0]?.text || ''
}

function parseJson(text: string) {
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// Lead statuses that mean outreach has already happened — never draft for these,
// even if no outbound email row exists (e.g. contact was made outside the CRM).
const ALREADY_CONTACTED_STATUSES = new Set([
  'email_sent', 'replied', 'meeting_booked', 'proposal_sent', 'won', 'lost',
])

function skipSummary(contacted: number, drafted: number): string {
  const parts: string[] = []
  if (contacted > 0) parts.push(`${contacted} already contacted`)
  if (drafted > 0) parts.push(`${drafted} with drafts waiting`)
  return parts.length ? ` Skipped ${parts.join(' and ')}.` : ''
}

export async function POST(request: NextRequest) {
  try {
    const { instruction } = await request.json()
    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'No instruction given' }, { status: 400 })
    }

    // STEP 1 — parse the instruction into a structured task
    const parseSystem = `You parse natural-language CRM commands into JSON. The only supported action is drafting outreach emails for leads. Respond ONLY with valid JSON, no markdown.`
    const parsePrompt = `Parse this CRM instruction: "${instruction}"

Return JSON in exactly this format:
{
  "action": "draft_emails" | "unsupported",
  "keyword": "<industry or business-type keyword to filter leads by, e.g. 'music', 'plumb', 'builder'. Use a short stem so it matches broadly.>",
  "count": <number of emails requested, default 10, max 20>,
  "pitch": "<what is being pitched/offered, in a short phrase>"
}

If the instruction is not about drafting/writing emails to leads, set action to "unsupported".`

    const parsed = parseJson(await callClaude(parseSystem, parsePrompt, 400))

    if (parsed.action !== 'draft_emails') {
      return NextResponse.json({
        message: "I can currently help with drafting outreach emails, e.g. 'write a draft email for 20 music schools pitching my CRM and website'. Other commands are coming soon.",
        drafts_created: 0,
      })
    }

    const count = Math.min(Math.max(parseInt(parsed.count) || 10, 1), 20)
    const keyword = (parsed.keyword || '').replace(/[%,]/g, '').trim()
    const pitch = parsed.pitch || `${BRAND.services}`

    // STEP 2 — find matching leads (with or without emails)
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('leads')
      .select('id, company_name, industry, website, email, address, google_rating, status')
      .limit(count * 3)

    if (keyword) {
      query = query.or(`industry.ilike.%${keyword}%,company_name.ilike.%${keyword}%`)
    }

    const { data: allLeads, error: leadsErr } = await query
    if (leadsErr) {
      return NextResponse.json({ error: leadsErr.message }, { status: 500 })
    }

    if (!allLeads || allLeads.length === 0) {
      return NextResponse.json({
        message: `No leads matching "${keyword}" found in your CRM. Try the Find Leads button on the Leads page first to pull some in from Google.`,
        drafts_created: 0,
      })
    }

    // STEP 2.2 — never draft for a company we've already contacted or queued.
    // Done before the email scraping below so we don't burn time on leads we'll skip.
    const { data: outbound, error: outboundErr } = await supabase
      .from('emails')
      .select('lead_id, status')
      .eq('direction', 'outbound')
      .in('lead_id', allLeads.map((l: any) => l.id))

    if (outboundErr) {
      return NextResponse.json({ error: outboundErr.message }, { status: 500 })
    }

    const sentLeadIds = new Set<string>()
    const draftedLeadIds = new Set<string>()
    for (const email of outbound ?? []) {
      if (!email.lead_id) continue
      if (email.status === 'draft') draftedLeadIds.add(String(email.lead_id))
      else sentLeadIds.add(String(email.lead_id))
    }

    let skippedContacted = 0
    let skippedDrafted = 0
    const eligibleLeads = allLeads.filter((lead: any) => {
      const id = String(lead.id)
      // A sent email (or a contacted status) outranks a pending draft, so a lead
      // with both is only counted once.
      if (sentLeadIds.has(id) || ALREADY_CONTACTED_STATUSES.has(lead.status)) {
        skippedContacted++
        return false
      }
      if (draftedLeadIds.has(id)) {
        skippedDrafted++
        return false
      }
      return true
    })

    const skipped = skipSummary(skippedContacted, skippedDrafted)

    if (eligibleLeads.length === 0) {
      return NextResponse.json({
        message: `Every lead matching "${keyword}" has already been contacted or has a draft waiting, so I didn't write anything new.${skipped}`,
        drafts_created: 0,
        skipped_contacted: skippedContacted,
        skipped_drafted: skippedDrafted,
      })
    }

    // STEP 2.5 — for leads missing an email, try to find one on their website
    const withEmail = eligibleLeads.filter((l: any) => l.email)
    const missingEmail = eligibleLeads.filter((l: any) => !l.email && l.website)

    let emailsFound = 0
    const toScrape = missingEmail.slice(0, 8) // keep within serverless time limits

    // scrape in parallel batches of 5
    for (let i = 0; i < toScrape.length; i += 5) {
      if (withEmail.length >= count) break
      const batch = toScrape.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(async (lead: any) => {
          const email = await findEmailForWebsite(lead.website)
          return { lead, email }
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.email) {
          const { lead, email } = r.value
          await supabase.from('leads').update({ email }).eq('id', lead.id)
          lead.email = email
          withEmail.push(lead)
          emailsFound++
        }
      }
    }

    const leads = withEmail.slice(0, count)

    if (leads.length === 0) {
      return NextResponse.json({
        message: `Found ${eligibleLeads.length} uncontacted lead(s) matching "${keyword}", but couldn't find email addresses on any of their websites. You can add emails manually (open a lead → edit) and ask me again.${skipped}`,
        drafts_created: 0,
        skipped_contacted: skippedContacted,
        skipped_drafted: skippedDrafted,
      })
    }

    // STEP 3 — generate all drafts in a single AI call
    const leadList = leads.map((l: any, i: number) =>
      `${i + 1}. id: ${l.id} | business: ${l.company_name} | industry: ${l.industry || 'unknown'} | website: ${l.website || 'none'} | location: ${l.address || 'unknown'}`
    ).join('\n')

    const draftSystem = `You are a professional cold email writer for ${BRAND.companyFullName}, a ${BRAND.agencyType}. You write short, personalised, non-spammy outreach emails. Respond ONLY with valid JSON, no markdown.`

    const draftPrompt = `Write a personalised cold outreach email for EACH of these leads.

What we are pitching: ${pitch}

Leads:
${leadList}

Rules for every email:
- Subject: 2-5 words, specific to that business, sentence case, no spam trigger words
- Open with a specific observation about THEIR business (never "I hope this finds you well", never "My name is")
- Under 110 words. 2-3 short paragraphs. Conversational Australian English.
- Focus on ONE way our offer helps their specific type of business, and the cost of not fixing it
- End with a soft interest question like "Worth a quick look?" — do NOT ask for a meeting
- Sign off from ${BRAND.companyFullName}
- Vary the wording between emails so they don't look copy-pasted

Return ONLY valid JSON in exactly this format:
{"drafts": [{"lead_id": "<id>", "subject": "...", "body": "..."}]}`

    const draftResult = parseJson(await callClaude(draftSystem, draftPrompt, 8000))
    const drafts = Array.isArray(draftResult.drafts) ? draftResult.drafts : []

    if (drafts.length === 0) {
      return NextResponse.json({ message: 'The AI did not return any drafts. Try rephrasing your instruction.', drafts_created: 0 })
    }

    // STEP 4 — save drafts (status='draft') for review
    const { data: settings } = await supabase.from('settings').select('gmail_email').limit(1).maybeSingle()
    const fromEmail = (settings as any)?.gmail_email || ''

    const leadById = new Map(leads.map((l: any) => [String(l.id), l]))
    const rows = drafts
      .filter((d: any) => leadById.has(String(d.lead_id)) && d.subject && d.body)
      .map((d: any) => {
        const lead = leadById.get(String(d.lead_id))!
        return {
          lead_id: lead.id,
          direction: 'outbound',
          from_email: fromEmail,
          from_name: BRAND.emailSenderName,
          to_email: lead.email,
          subject: String(d.subject).slice(0, 200),
          body: String(d.body).slice(0, 5000),
          status: 'draft',
          created_at: new Date().toISOString(),
        }
      })

    const { data: inserted, error: insertErr } = await supabase
      .from('emails')
      .insert(rows)
      .select('id')

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Drafted ${inserted?.length ?? 0} email(s) for leads matching "${keyword}"${emailsFound > 0 ? ` (found ${emailsFound} email address${emailsFound === 1 ? '' : 'es'} on their websites automatically)` : ''}.${skipped} Review them below — edit anything you like, then send one by one.`,
      drafts_created: inserted?.length ?? 0,
      skipped_contacted: skippedContacted,
      skipped_drafted: skippedDrafted,
    })
  } catch (err: any) {
    console.error('Assistant error:', err)
    return NextResponse.json({ error: err.message || 'Assistant failed' }, { status: 500 })
  }
}
