'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBadge, statusConfig } from '@/components/leads/StatusBadge'
import { LeadDrawer } from '@/components/leads/LeadDrawer'
import {
  Search, Plus, Download, Trash2, Mail, Star,
  ChevronDown, Globe, Phone, Building2, ArrowUpDown,
  Upload, Sparkles, Loader2, X, CheckSquare, Square
} from 'lucide-react'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/types'

const ALL_STATUSES: LeadStatus[] = [
  'new', 'ready_to_contact', 'email_sent', 'replied',
  'meeting_booked', 'proposal_sent', 'won', 'lost', 'archived'
]

type SortField = 'company_name' | 'website_score' | 'google_rating' | 'date_added' | 'status'

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--muted))]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color: textColor }}>{score}</span>
    </div>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('date_added')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [finding, setFinding] = useState(false)
  const [findIndustry, setFindIndustry] = useState('')
  const [findLocation, setFindLocation] = useState('')
  const [findLimit, setFindLimit] = useState(20)
  const [findResult, setFindResult] = useState<{ found: number; inserted: number } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLead, setNewLead] = useState({
    company_name: '', industry: '', website: '', email: '', phone: '', address: '', contact_name: '', notes: '',
  })
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch leads from Supabase via API
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('limit', '200')
      const res = await fetch(`/api/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const t = setTimeout(fetchLeads, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchLeads])

  // Client-side sort only (data already filtered from API)
  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, sortField, sortDir])

  function handleSort(field: SortField) {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map(l => l.id)))
  }

  async function handleBulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} lead(s)?`)) return
    await fetch('/api/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setSelected(new Set())
    fetchLeads()
  }

  async function handleExport() {
    const ids = selected.size > 0 ? [...selected].join(',') : ''
    const url = `/api/leads/export${ids ? `?ids=${ids}` : ''}`
    window.open(url, '_blank')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/leads/import', { method: 'POST', body: form })
      const data = await res.json()
      setImportResult({ inserted: data.inserted, skipped: data.skipped })
      fetchLeads()
    } catch (err) {
      console.error(err)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleFindLeads() {
    if (!findIndustry.trim() || !findLocation.trim()) return
    setFinding(true)
    setFindResult(null)
    try {
      const res = await fetch('/api/leads/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: findIndustry, location: findLocation, limit: findLimit }),
      })
      const data = await res.json()
      if (res.ok) {
        setFindResult({ found: data.found, inserted: data.inserted })
        fetchLeads()
      } else {
        alert('Find failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to find leads: ' + String(err))
    } finally {
      setFinding(false)
    }
  }

  async function handleAddLead() {
    if (!newLead.company_name.trim()) {
      alert('Company name is required')
      return
    }
    setAdding(true)
    try {
      const payload: any = { status: 'new', date_added: new Date().toISOString() }
      Object.entries(newLead).forEach(([k, v]) => {
        payload[k] = v.trim() || null
      })
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setAddOpen(false)
        setNewLead({ company_name: '', industry: '', website: '', email: '', phone: '', address: '', contact_name: '', notes: '' })
        fetchLeads()
      } else {
        alert('Failed to add lead: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to add lead: ' + String(err))
    } finally {
      setAdding(false)
    }
  }

  function handleLeadUpdate(updated: Lead) {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    setSelectedLead(updated)
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    leads.forEach(l => { counts[l.status] = (counts[l.status] ?? 0) + 1 })
    return counts
  }, [leads])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Leads"
        subtitle={`${leads.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <button
              onClick={() => { setFindOpen(true); setFindResult(null) }}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <Search className="w-4 h-4" /> Find Leads
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Import result banner */}
        {importResult && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <p className="text-sm text-emerald-400">
              ✓ Imported {importResult.inserted} leads · {importResult.skipped} duplicates skipped
            </p>
            <button onClick={() => setImportResult(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Search + filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search leads…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            />
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
            <Download className="w-4 h-4" /> Export {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors',
              statusFilter === 'all' ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]'
            )}
          >
            All <span className="ml-1 opacity-70">{leads.length}</span>
          </button>
          {ALL_STATUSES.map(s => {
            const cfg = statusConfig[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors',
                  statusFilter === s ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]'
                )}
              >
                {cfg.label} {statusCounts[s] ? <span className="ml-1 opacity-70">{statusCounts[s]}</span> : null}
              </button>
            )
          })}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]">
            <span className="text-sm font-medium text-[hsl(var(--primary))]">{selected.size} selected</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--primary))] text-white rounded-lg hover:opacity-90 transition-opacity">
              <Mail className="w-3.5 h-3.5" /> Bulk Email
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}

        {/* Table */}
        <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)]">
                  <th className="w-10 p-3">
                    <button onClick={toggleAll} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                      {selected.size === sorted.length && sorted.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-[hsl(var(--muted-foreground))]">
                    <button onClick={() => handleSort('company_name')} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
                      Company <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-[hsl(var(--muted-foreground))] hidden md:table-cell">Contact</th>
                  <th className="text-left p-3 font-medium text-[hsl(var(--muted-foreground))]">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-[hsl(var(--muted-foreground))] hidden lg:table-cell">
                    <button onClick={() => handleSort('website_score')} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
                      Score <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-[hsl(var(--muted-foreground))] hidden lg:table-cell">
                    <button onClick={() => handleSort('google_rating')} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
                      Rating <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-[hsl(var(--muted-foreground))] hidden xl:table-cell">
                    <button onClick={() => handleSort('date_added')} className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
                      Added <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="w-10 p-3" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Loading leads…</p>
                    </td>
                  </tr>
                )}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                      <Building2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium mb-1">No leads found</p>
                      <p className="text-xs">Import a CSV or add leads manually</p>
                    </td>
                  </tr>
                )}
                {!loading && sorted.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      'border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--accent)/0.5)] cursor-pointer transition-colors',
                      selected.has(lead.id) && 'bg-[hsl(var(--primary)/0.05)]'
                    )}
                  >
                    <td className="p-3" onClick={e => { e.stopPropagation(); toggleSelect(lead.id) }}>
                      {selected.has(lead.id)
                        ? <CheckSquare className="w-4 h-4 text-[hsl(var(--primary))]" />
                        : <Square className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[hsl(var(--foreground))]">{lead.company_name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-2">
                        <span>{lead.industry}</span>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="text-[hsl(var(--primary))] hover:underline flex items-center gap-0.5">
                            <Globe className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {lead.contact_name && <div className="text-sm">{lead.contact_name}</div>}
                      {lead.email && <div className="text-xs text-[hsl(var(--muted-foreground))]">{lead.email}</div>}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <ScoreBar score={lead.website_score ?? null} />
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      {lead.google_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm">{lead.google_rating}</span>
                        </div>
                      ) : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                    </td>
                    <td className="p-3 text-xs text-[hsl(var(--muted-foreground))] hidden xl:table-cell">
                      {formatRelativeTime(lead.date_added)}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedLead(lead) }}
                        className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                        title="Generate AI email"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && sorted.length > 0 && (
            <div className="px-4 py-3 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
              Showing {sorted.length} leads
            </div>
          )}
        </div>
      </div>

      {/* Lead drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
        />
      )}

      {/* Find Leads modal */}
      {findOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !finding && setFindOpen(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Find Leads from Google</h2>
              <button onClick={() => !finding && setFindOpen(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5">Industry / Business type</label>
                <input
                  type="text"
                  value={findIndustry}
                  onChange={e => setFindIndustry(e.target.value)}
                  placeholder="e.g. plumbers, cafes, electricians"
                  className="w-full px-3 py-2.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5">Location</label>
                <input
                  type="text"
                  value={findLocation}
                  onChange={e => setFindLocation(e.target.value)}
                  placeholder="e.g. Sydney NSW, Melbourne"
                  className="w-full px-3 py-2.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5">How many leads</label>
                <select
                  value={findLimit}
                  onChange={e => setFindLimit(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                >
                  <option value={20}>20 leads</option>
                  <option value={40}>40 leads</option>
                  <option value={60}>60 leads</option>
                </select>
              </div>

              {findResult && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-emerald-400">Found {findResult.found} · added {findResult.inserted} new leads</p>
                </div>
              )}

              <button
                onClick={handleFindLeads}
                disabled={finding || !findIndustry.trim() || !findLocation.trim()}
                className="w-full py-2.5 px-4 bg-[hsl(var(--primary))] text-white text-sm font-medium rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {finding ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</> : <><Search className="w-4 h-4" /> Find Leads</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !adding && setAddOpen(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Add New Lead</h2>
              <button onClick={() => !adding && setAddOpen(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Company name *</label>
                <input type="text" value={newLead.company_name} onChange={e => setNewLead({ ...newLead, company_name: e.target.value })} placeholder="Acme Construction" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Industry</label>
                  <input type="text" value={newLead.industry} onChange={e => setNewLead({ ...newLead, industry: e.target.value })} placeholder="Builder" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Contact name</label>
                  <input type="text" value={newLead.contact_name} onChange={e => setNewLead({ ...newLead, contact_name: e.target.value })} placeholder="John Smith" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Website</label>
                <input type="text" value={newLead.website} onChange={e => setNewLead({ ...newLead, website: e.target.value })} placeholder="https://example.com.au" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Email</label>
                  <input type="email" value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} placeholder="info@example.com" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Phone</label>
                  <input type="text" value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} placeholder="02 1234 5678" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Address</label>
                <input type="text" value={newLead.address} onChange={e => setNewLead({ ...newLead, address: e.target.value })} placeholder="123 Main St, Sydney NSW" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Notes</label>
                <textarea value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Any notes about this lead…" rows={2} className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none" />
              </div>
            </div>

            <div className="p-5 border-t border-[hsl(var(--border))] flex gap-3">
              <button onClick={() => setAddOpen(false)} disabled={adding} className="flex-1 py-2.5 px-4 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleAddLead} disabled={adding || !newLead.company_name.trim()} className="flex-1 py-2.5 px-4 bg-[hsl(var(--primary))] text-white text-sm font-medium rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Plus className="w-4 h-4" /> Add Lead</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
