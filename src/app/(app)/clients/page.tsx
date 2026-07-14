'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, Globe, Mail, Phone, DollarSign, Calendar,
  CheckCircle, Clock, PauseCircle, XCircle, Loader2,
  Building2, Search, FileText, X
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

interface Client {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  project_status: 'active' | 'completed' | 'paused' | 'cancelled'
  project_value: number | null
  project_start: string | null
  project_end: string | null
  notes: string | null
  created_at: string
}

const statusConfig = {
  active:    { label: 'Active',    icon: Clock,        color: 'text-blue-400 bg-blue-400/10' },
  completed: { label: 'Completed', icon: CheckCircle,  color: 'text-emerald-400 bg-emerald-400/10' },
  paused:    { label: 'Paused',    icon: PauseCircle,  color: 'text-amber-400 bg-amber-400/10' },
  cancelled: { label: 'Cancelled', icon: XCircle,      color: 'text-red-400 bg-red-400/10' },
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Client['project_status'] | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newClient, setNewClient] = useState({
    company_name: '', contact_name: '', email: '', phone: '', website: '',
    project_status: 'active', project_value: '', notes: '',
  })

  async function loadClients() {
    setLoading(true)
    try {
      const res = await fetch('/api/clients')
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients ?? [])
      } else {
        setClients([])
      }
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAddClient() {
    if (!newClient.company_name.trim()) {
      alert('Company name is required')
      return
    }
    setAdding(true)
    try {
      const payload: any = {
        company_name: newClient.company_name.trim(),
        contact_name: newClient.contact_name.trim() || null,
        email: newClient.email.trim() || null,
        phone: newClient.phone.trim() || null,
        website: newClient.website.trim() || null,
        project_status: newClient.project_status,
        project_value: newClient.project_value ? parseFloat(newClient.project_value) : null,
        notes: newClient.notes.trim() || null,
      }
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setAddOpen(false)
        setNewClient({ company_name: '', contact_name: '', email: '', phone: '', website: '', project_status: 'active', project_value: '', notes: '' })
        loadClients()
      } else {
        alert('Failed to add client: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to add client: ' + String(err))
    } finally {
      setAdding(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.project_status === filter
    return matchSearch && matchFilter
  })

  const totalRevenue = clients
    .filter(c => c.project_status === 'completed' || c.project_status === 'active')
    .reduce((s, c) => s + (c.project_value || 0), 0)

  const activeCount = clients.filter(c => c.project_status === 'active').length

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Clients"
        subtitle={`${clients.length} total · ${activeCount} active`}
        actions={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {[
            { label: 'Active Projects', value: activeCount, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Total Clients', value: clients.length, icon: Building2, color: 'text-[hsl(var(--primary))]', bg: 'bg-[hsl(var(--primary)/0.1)]' },
            { label: 'Revenue Pipeline', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
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

        {/* Search + filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'active', 'completed', 'paused', 'cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg capitalize transition-colors',
                  filter === s
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
                )}
              >
                {s === 'all' ? 'All' : statusConfig[s as keyof typeof statusConfig]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Client grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-[hsl(var(--muted-foreground))]">
                <Building2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No clients found</p>
              </div>
            )}
            {filtered.map(client => {
              const cfg = statusConfig[client.project_status]
              const Icon = cfg.icon
              return (
                <div key={client.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 hover:border-[hsl(var(--primary)/0.3)] transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-[hsl(var(--foreground))]">{client.company_name}</h3>
                      {client.contact_name && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{client.contact_name}</p>
                      )}
                    </div>
                    <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium', cfg.color)}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </a>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        {client.phone}
                      </div>
                    )}
                    {client.website && (
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[hsl(var(--primary))] hover:underline">
                        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{client.website.replace('https://', '')}</span>
                      </a>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                      {client.project_start && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(client.project_start)}
                        </span>
                      )}
                      {client.project_end && (
                        <span>→ {formatDate(client.project_end)}</span>
                      )}
                    </div>
                    {client.project_value && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
                        <DollarSign className="w-3.5 h-3.5" />
                        {formatCurrency(client.project_value).replace('A$', '')}
                      </span>
                    )}
                  </div>

                  {client.notes && (
                    <div className="mt-3 flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">{client.notes}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Client modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !adding && setAddOpen(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Add New Client</h2>
              <button onClick={() => !adding && setAddOpen(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Company name *</label>
                <input type="text" value={newClient.company_name} onChange={e => setNewClient({ ...newClient, company_name: e.target.value })} placeholder="Acme Construction" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Contact name</label>
                  <input type="text" value={newClient.contact_name} onChange={e => setNewClient({ ...newClient, contact_name: e.target.value })} placeholder="John Smith" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Project status</label>
                  <select value={newClient.project_status} onChange={e => setNewClient({ ...newClient, project_status: e.target.value })} className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Email</label>
                  <input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} placeholder="info@example.com" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Phone</label>
                  <input type="text" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} placeholder="02 1234 5678" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Website</label>
                  <input type="text" value={newClient.website} onChange={e => setNewClient({ ...newClient, website: e.target.value })} placeholder="https://example.com.au" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Project value ($)</label>
                  <input type="number" value={newClient.project_value} onChange={e => setNewClient({ ...newClient, project_value: e.target.value })} placeholder="5000" className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Notes</label>
                <textarea value={newClient.notes} onChange={e => setNewClient({ ...newClient, notes: e.target.value })} placeholder="Project details, scope, etc…" rows={2} className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none" />
              </div>
            </div>

            <div className="p-5 border-t border-[hsl(var(--border))] flex gap-3">
              <button onClick={() => setAddOpen(false)} disabled={adding} className="flex-1 py-2.5 px-4 text-sm border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleAddClient} disabled={adding || !newClient.company_name.trim()} className="flex-1 py-2.5 px-4 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Plus className="w-4 h-4" /> Add Client</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
