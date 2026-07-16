import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'
import { describeUpstream, failSupabase, failure, failWith } from '@/lib/api-error'

function stripHtml(html: string): string {
  // Remove scripts and styles
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // Keep some structural hints then strip tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

export async function POST(request: NextRequest) {
  try {
    const { lead_id } = await request.json()

    if (!lead_id) {
      return failWith({ error: 'lead_id is required', stage: 'load', status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, company_name, industry, website')
      .eq('id', lead_id)
      .single()

    if (leadErr || !lead) {
      return failWith({
        error: 'Lead not found',
        stage: 'load',
        upstreamError: describeUpstream(leadErr),
        status: 404,
      })
    }

    const website = (lead as any).website
    if (!website) {
      return failWith({
        error: 'This lead has no website to analyze',
        stage: 'load',
        status: 400,
      })
    }

    // Normalise URL
    let url = website.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    // Fetch the website HTML
    let html = ''
    let fetchFailed = false
    try {
      const siteRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRMAnalyzer/1.0)' },
        signal: AbortSignal.timeout(15000),
      })
      html = await siteRes.text()
    } catch {
      fetchFailed = true
    }

    const pageText = fetchFailed ? '' : stripHtml(html).slice(0, 6000)
    const hasViewport = /<meta[^>]+viewport/i.test(html)
    const hasHttps = url.startsWith('https://')
    const htmlLength = html.length

    const systemPrompt = `You are a web design and conversion expert analyzing small business websites for ${BRAND.companyFullName}, a ${BRAND.agencyType}. You provide honest, specific, actionable analysis that can be used as sales talking points. Always respond with valid JSON only, no markdown.`

    const userPrompt = `Analyze this business website for a web design sales pitch.

**Business:** ${(lead as any).company_name}
**Industry:** ${(lead as any).industry || 'Unknown'}
**Website URL:** ${url}
**Has HTTPS:** ${hasHttps}
**Has mobile viewport tag:** ${hasViewport}
**Page HTML size:** ${htmlLength} bytes
${fetchFailed ? '**NOTE: The website could not be loaded — it may be down, very slow, or blocking access. Factor this into scores.**' : ''}

**Website text content (extracted):**
${pageText || '(could not extract content)'}

Analyze the site and score it. Be honest and specific — these scores become sales talking points, so identify real problems.

Return ONLY valid JSON in exactly this format (no markdown, no backticks):
{
  "overall_score": <0-100>,
  "design_score": <0-100>,
  "speed_score": <0-100>,
  "seo_score": <0-100>,
  "mobile_score": <0-100>,
  "trust_score": <0-100>,
  "cta_score": <0-100>,
  "ai_summary": "<2-3 sentence honest summary of the site's biggest problems and opportunities>",
  "issues": ["<specific issue 1>", "<specific issue 2>", "<specific issue 3>", "<specific issue 4>"],
  "improvements": ["<actionable improvement 1>", "<improvement 2>", "<improvement 3>"],
  "estimated_conversion_increase": <realistic percentage number, e.g. 25>
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    // Read as text first — an error response is not guaranteed to be JSON, and
    // .json() would throw over the top of the real upstream error.
    const aiRaw = await aiRes.text()
    let aiData: any = null
    try {
      aiData = JSON.parse(aiRaw)
    } catch {
      aiData = null
    }

    if (!aiRes.ok) {
      console.error('Anthropic API error:', aiRes.status, aiRaw.slice(0, 500))
      return failWith({
        error: 'The AI service rejected the analysis request',
        stage: 'analyze',
        upstreamStatus: aiRes.status,
        upstreamError: describeUpstream(aiData ?? aiRaw),
        status: aiRes.status === 401 || aiRes.status === 429 ? aiRes.status : 500,
      })
    }

    const text = aiData?.content?.[0]?.text || ''

    let analysis: any
    try {
      analysis = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch (err) {
      console.error('Failed to parse AI analysis:', text.slice(0, 500))
      return failWith({
        error: 'The AI returned a malformed analysis',
        stage: 'analyze',
        upstreamStatus: aiRes.status,
        upstreamError: `${err instanceof Error ? err.message : String(err)} — received: ${String(text).slice(0, 300)}`,
      })
    }

    // Remove any existing analysis for this lead, then insert the fresh one
    await supabase.from('website_analyses').delete().eq('lead_id', lead_id)

    const { data: saved, error: saveErr } = await supabase
      .from('website_analyses')
      .insert([{
        lead_id,
        overall_score: analysis.overall_score,
        design_score: analysis.design_score,
        speed_score: analysis.speed_score,
        seo_score: analysis.seo_score,
        mobile_score: analysis.mobile_score,
        trust_score: analysis.trust_score,
        cta_score: analysis.cta_score,
        ai_summary: analysis.ai_summary,
        issues: analysis.issues,
        improvements: analysis.improvements,
        estimated_conversion_increase: analysis.estimated_conversion_increase,
      }])
      .select()
      .single()

    if (saveErr) {
      console.error('Save analysis error:', saveErr)
      return failSupabase('save', saveErr, 'Analysis ran but could not be saved')
    }

    return NextResponse.json({ success: true, analysis: saved })
  } catch (err) {
    console.error('Analyze error:', err)
    return failure(err, 'analyze', 'Server error during analysis')
  }
}
