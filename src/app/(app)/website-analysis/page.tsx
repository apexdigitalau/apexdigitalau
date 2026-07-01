'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { ScoreRing } from '@/components/common/ScoreRing'
import {
  Globe, Sparkles, Mail, ChevronDown, ChevronUp, Loader2,
  AlertTriangle, CheckCircle, TrendingUp, RefreshCw, Search, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Analysis {
  id: string
  lead_id: string
  overall_score: number
  design_score: number
  speed_score: number
  seo_score: number
  mobile_score: number
  trust_score: number
  cta_score: number
  content_score?: number
  ai_summary: string
  issues: string[]
  improvements: string[]
  estimated_conversion_increase: number
  created_at: string
  leads?: {
    company_name: string
    website: string
    industry: string
  }
}

const CATEGORIES = [
  { key: 'design_score', label: 'Design' },
  { key: 'speed_score', label: 'Speed' },
  { key: 'seo_score', label: 'SEO' },
  { key: 'mobile_score', label: 'Mobile' },
  { key: 'trust_score', label: 'Trust' },
  { key: 'cta_score', label: 'CTA' },
] as const

const MOCK_ANALYSES: Analysis[] = [
  {
    id: '1', lead_id: '1', overall_score: 42, design_score: 35, speed_score: 40, seo_score: 52, mobile_score: 28, trust_score: 55, cta_score: 38, ai_summary: 'Smith & Sons Plumbing has a severely outdated website that is actively costing them customers. The site has no mobile optimisation, slow load times, and lacks any trust signals like reviews or certifications. The call-to-action is buried below the fold.',
    issues: ['No mobile responsive design', 'Page load time >5 seconds', 'No SSL certificate visible', 'No customer reviews displayed', 'CTA only visible after scrolling', 'No Google Maps embed'],
    improvements: ['Add mobile-responsive design — estimated +40% mobile traffic', 'Implement SSL and display trust badges', 'Add Google Reviews widget', 'Place click-to-call button in header', 'Add before/after project gallery'],
    estimated_conversion_increase: 180, created_at: '2024-01-15T00:00:00Z',
    leads: { company_name: 'Smith & Sons Plumbing', website: 'https://smithsons.com.au', industry: 'Plumbing' }
  },
  {
    id: '2', lead_id: '3', overall_score: 35, design_score: 40, speed_score: 28, seo_score: 38, mobile_score: 45, trust_score: 30, cta_score: 32, ai_summary: 'Coastal Cafe & Bakery\'s site looks decent on mobile but suffers from very slow load times due to unoptimised images. No online ordering capability is a critical missed opportunity.',
    issues: ['Images not optimised (avg 2.4MB each)', 'No online ordering or menu PDF', 'No booking system for events', 'Limited social proof', 'Google My Business not linked'],
    improvements: ['Compress and convert images to WebP format', 'Integrate online ordering (e.g. Square or custom)', 'Add event booking calendar', 'Embed Instagram feed for social proof'],
    estimated_conversion_increase: 220, created_at: '2024-01-13T00:00:00Z',
    leads: { company_name: 'Coastal Cafe & Bakery', website: 'https://coastalcafe.com.au', industry: 'Food & Beverage' }
  },
  {
    id: '3', lead_id: '8', overall_score: 29, design_score: 22, speed_score: 31, seo_score: 28, mobile_score: 25, trust_score: 38, cta_score: 30, ai_summary: 'Quantum Real Estate has one of the weakest websites in their market. The design is from 2015, property listings are difficult to browse, and there is no lead capture form.',
    issues: ['Outdated design aesthetic', 'No property search/filter functionality', 'No lead capture or email signup', 'Very slow on mobile (6.2s load)', 'No virtual tour integration', 'Missing team photos and bios'],
    improvements: ['Complete redesign with modern property portal layout', 'Add property search with filters', 'Implement lead capture with instant valuation tool', 'Add virtual tour embeds', 'Add team bios for trust'],
    estimated_conversion_increase: 310, created_at: '2024-01-08T00:00:00Z',
    leads: { company_name: 'Quantum Real Estate', website: 'https://quantumre.com.au', industry: 'Real Estate' }
  },
]

function AnalysisCard({ analysis, expanded, onToggle, onEmail }: {
  analysis: Analysis
  expanded: boolean
  onToggle: () => void
  onEmail: () => void
}) {
  const score = analysis.overall_score

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden hover:border-[hsl(var(--primary)/0.3)] transition-colors">
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-4">
          {/* Overall score */}
          <ScoreRing score={score} size={80} strokeWidth={7} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-[hsl(var(--foreground))]">
                  {analysis.leads?.company_name ?? 'Unknown'}
                </h3>
                {analysis.leads?.website && (
                  <a
                    href={analysis.leads.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Globe className="w-3 h-3" />
                    {analysis.leads.website.replace('https://', '')}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs text-emerald-400 font-medium">+{analysis.estimated_conversion_increase}%</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">conv. lift</p>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
              </div>
            </div>

            {/* Category rings */}
            <div className="flex items-center gap-3 flex-wrap">
              {CATEGORIES.map(cat => (
                <div key={cat.key} className="flex flex-col items-center gap-1">
                  <ScoreRing score={analysis[cat.key]} size={40} strokeWidth={4} showLabel={false} />
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{cat.label}</span>
                  <span className="text-[10px] font-medium">{analysis[cat.key]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI summary */}
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-4 leading-relaxed line-clamp-2">
          {analysis.ai_summary}
        </p>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] p-5 space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{analysis.ai_summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Issues ({analysis.issues?.length ?? 0})
              </h4>
              <ul className="space-y-1.5">
                {(analysis.issues ?? []).map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">×</span>
                    <span className="text-[hsl(var(--foreground)/0.8)]">{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Improvements ({analysis.improvements?.length ?? 0})
              </h4>
              <ul className="space-y-1.5">
                {(analysis.improvements ?? []).map((imp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-[hsl(var(--foreground)/0.8)]">{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={e => { e.stopPropagation(); onEmail() }}
              className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--primary))] text-white text-sm rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate Email
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-[hsl(var(--border))] text-sm rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Re-analyse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WebsiteAnalysisPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  async function loadAnalyses() {
    try {
      const res = await fetch('/api/website-analysis')
      if (res.ok) {
        const data = await res.json()
        setAnalyses(data.analyses ?? [])
      } else {
        setAnalyses([])
      }
    } catch {
      setAnalyses([])
    } finally {
      setLoading(false)
    }
  }

  async function openPicker() {
    setPickerOpen(true)
    try {
      const res = await fetch('/api/leads')
      if (res.ok) {
        const data = await res.json()
        const withSites = (data.leads ?? []).filter((l: any) => l.website)
        setLeads(withSites)
      }
    } catch {
      setLeads([])
    }
  }

  async function analyzeLeadFromPicker(leadId: string) {
    setAnalyzingId(leadId)
    try {
      const res = await fetch('/api/website-analysis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      const data = await res.json()
      if (res.ok) {
        await loadAnalyses()
        setPickerOpen(false)
        setLeadSearch('')
      } else {
        alert('Analysis failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to analyze: ' + String(err))
    } finally {
      setAnalyzingId(null)
    }
  }

  useEffect(() => {
    loadAnalyses()
  }, [])

  const filtered = analyses.filter(a =>
    !search ||
    a.leads?.company_name.toLowerCase().includes(search.toLowerCase()) ||
    a.leads?.industry?.toLowerCase().includes(search.toLowerCase())
  )

  const avgScore = analyses.length
    ? Math.round(analyses.reduce((s, a) => s + a.overall_score, 0) / analyses.length)
    : 0

  const poorCount = analyses.filter(a => a.overall_score < 50).length

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Website Analysis"
        subtitle={`${analyses.length} analysed`}
        actions={
          <button onClick={openPicker} className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
            <Globe className="w-4 h-4" /> Analyse New Site
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Sites Analysed', value: analyses.length, icon: Globe, color: 'text-[hsl(var(--primary))]', bg: 'bg-[hsl(var(--primary)/0.1)]' },
            { label: 'Avg Score', value: `${avgScore}/100`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'Poor (<50)', value: poorCount, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
            { label: 'Emails Generated', value: 0, icon: Mail, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '…' : s.value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search businesses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        {/* Analysis cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 && (
              <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
                <Globe className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No analyses yet</p>
                <p className="text-xs mt-1">n8n will populate this as leads are scraped</p>
              </div>
            )}
            {filtered.map(a => (
              <AnalysisCard
                key={a.id}
                analysis={a}
                expanded={expanded === a.id}
                onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                onEmail={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lead picker modal for analysing a new site */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !analyzingId && setPickerOpen(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <div>
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Analyse a Website</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Pick a lead with a website to run an AI analysis</p>
              </div>
              <button onClick={() => !analyzingId && setPickerOpen(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-[hsl(var(--border))]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="Search leads…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {leads.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">No leads with websites found. Add leads first.</p>
              ) : (
                leads
                  .filter(l => !leadSearch || l.company_name?.toLowerCase().includes(leadSearch.toLowerCase()))
                  .map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{l.company_name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{l.website}</p>
                      </div>
                      <button
                        onClick={() => analyzeLeadFromPicker(l.id)}
                        disabled={analyzingId !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {analyzingId === l.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</> : <><Sparkles className="w-3.5 h-3.5" /> Analyse</>}
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
