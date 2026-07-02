import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'

interface WebsiteAnalysis {
  overall_score: number
  design_score: number
  speed_score: number
  seo_score: number
  mobile_score: number
  trust_score: number
  cta_score: number
  ai_summary: string
  issues: string[]
  improvements: string[]
  estimated_conversion_increase: number
}

interface LeadWithAnalysis {
  id: string
  company_name: string
  industry: string | null
  website: string | null
  contact_name: string | null
  google_rating: number | null
  notes: string | null
  website_analyses: WebsiteAnalysis[]
}

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json()

  // Fetch lead with analysis using explicit type
  const { data, error: leadError } = await getSupabaseAdmin()
    .from('leads')
    .select(`
      id, company_name, industry, website, contact_name, google_rating, notes,
      website_analyses (
        overall_score, design_score, speed_score, seo_score,
        mobile_score, trust_score, cta_score, ai_summary,
        issues, improvements, estimated_conversion_increase
      )
    `)
    .eq('id', lead_id)
    .single()

  if (leadError || !data) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const lead = data as unknown as LeadWithAnalysis

  // Fetch settings
  const { data: settings } = await getSupabaseAdmin()
    .from('settings')
    .select('default_prompt, company_name, email_signature')
    .single()

  const analysis = lead.website_analyses?.[0]
  const systemPrompt = (settings as any)?.default_prompt || `You are a professional cold email writer for a ${BRAND.agencyType} called ${BRAND.companyFullName}.`

  const userPrompt = `
Write a personalised cold email for this lead:

**Company:** ${lead.company_name}
**Industry:** ${lead.industry || 'Unknown'}
**Website:** ${lead.website || 'Unknown'}
**Contact:** ${lead.contact_name || 'Business Owner'}
**Google Rating:** ${lead.google_rating || 'Unknown'}
**Notes:** ${lead.notes || 'None'}

${analysis ? `**Website Analysis Results:**
- Overall Score: ${analysis.overall_score}/100
- Design: ${analysis.design_score}/100, Speed: ${analysis.speed_score}/100, SEO: ${analysis.seo_score}/100
- Mobile: ${analysis.mobile_score}/100, Trust: ${analysis.trust_score}/100
- Summary: ${analysis.ai_summary}
- Top Issues: ${(analysis.issues || []).slice(0, 3).join(', ')}
- Estimated conversion increase if fixed: +${analysis.estimated_conversion_increase}%` : ''}

Requirements — follow these cold email best practices strictly:

SUBJECT LINE:
- 2-5 words, specific to THEM (e.g. their business name or their website issue)
- Lowercase or sentence case feels personal; avoid Title Case and clickbait
- No spam trigger words: free, guarantee, limited time, act now, deal

OPENING LINE:
- Start with a specific, genuine observation about THEIR business or website (never about us)
- NEVER open with "I hope this email finds you well", "My name is", or "I'm reaching out"

BODY:
- Under 120 words total. Short sentences. 2-3 short paragraphs.
- Focus on ONE specific problem from their website analysis and the business cost of it (lost calls, lost jobs, customers choosing competitors)
- Write at a 5th-grade reading level, conversational Australian English
- Sell the conversation, not the service — no feature lists, no pricing
- No exaggerated claims, no excessive punctuation, no ALL CAPS

CTA:
- One soft, interest-based question to close (e.g. "Worth a quick look?" or "Open to seeing what I found?")
- Do NOT ask for a meeting/call in the first email

SIGN-OFF:
- Sign off from ${BRAND.companyFullName}

Return ONLY valid JSON with this exact format (no markdown, no backticks):
{"subject": "...", "body": "..."}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const aiData = await response.json()
    const text = aiData.content?.[0]?.text || ''

    let parsed: { subject: string; body: string }
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Save the template
    const { data: template } = await getSupabaseAdmin()
      .from('email_templates')
      .insert([{
        lead_id,
        subject: parsed.subject,
        body: parsed.body,
        ai_generated: true,
      }])
      .select()
      .single()

    return NextResponse.json({ ...parsed, template_id: (template as any)?.id })
  } catch {
    return NextResponse.json({ error: 'AI service error' }, { status: 500 })
  }
}
