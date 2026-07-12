import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'

export const maxDuration = 60

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

    // STEP 2 — find matching leads that have an email address
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('leads')
      .select('id, company_name, industry, website, email, address, google_rating')
      .not('email', 'is', null)
      .neq('email', '')
      .limit(count)

    if (keyword) {
      query = query.or(`industry.ilike.%${keyword}%,company_name.ilike.%${keyword}%`)
    }

    const { data: leads, error: leadsErr } = await query
    if (leadsErr) {
      return NextResponse.json({ error: leadsErr.message }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        message: `No leads matching "${keyword}" with an email address were found. Tip: leads found via Google usually have no email — add emails to leads first (open a lead → edit), then ask me again.`,
        drafts_created: 0,
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
      message: `Drafted ${inserted?.length ?? 0} email(s) for leads matching "${keyword}". Review them below — edit anything you like, then send one by one.`,
      drafts_created: inserted?.length ?? 0,
    })
  } catch (err: any) {
    console.error('Assistant error:', err)
    return NextResponse.json({ error: err.message || 'Assistant failed' }, { status: 500 })
  }
}
