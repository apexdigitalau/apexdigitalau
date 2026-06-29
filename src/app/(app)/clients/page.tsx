'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, Globe, Mail, Phone, DollarSign, Calendar,
  CheckCircle, Clock, PauseCircle, XCircle, Loader2,
  Building2, Search, FileText
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

const MOCK_CLIENTS: Client[] = [
  { id: '1', company_name: 'Sydney Law Group', contact_name: 'James Morrison', email: 'james@sydneylawgroup.com.au', phone: '02 8888 7777', website: 'https://sydneylawgroup.com.au', project_status: 'active', project_value: 8500, project_start: '2024-01-20', project_end: '2024-03-01', notes: 'New site + SEO package', created_at: '2024-01-15T00:00:00Z' },
  { id: '2', company_name: 'Green Gardens Landscaping', contact_name: 'Tom Green', email: 'tom@greengardens.com.au', phone: '03 4444 5555', website: 'https://greengardens.com.au', project_status: 'active', project_value: 5200, project_start: '2024-01-18', project_end: '2024-02-28', notes: 'Full rebrand + ecomm', created_at: '2024-01-12T00:00:00Z' },
  { id: '3', company_name: 'Blue Sky Accounting', contact_name: 'Sarah Blue', email: 'sarah@bluesky.com.au', phone: '07 3333 2222', website: 'https://blueskaccounting.com.au', project_status: 'completed', project_value: 6800, project_start: '2023-11-01', project_end: '2023-12-20', notes: 'New website delivered on time', created_at: '2023-10-25T00:00:00Z' },
  { id: '4', company_name: 'Perth Fitness Studio', contact_name: 'Jake Perry', email: 'jake@perthfitness.com.au', phone: '08 9999 1111', website: 'https://perthfitness.com.au', project_status: 'paused', project_value: 3900, project_start: '2024-01-05', project_end: null, notes: 'On hold — client travelling', created_at: '2024-01-03T00:00:00Z' },
]

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Client['project_status'] | 'all'>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/clients')
        if (res.ok) {
          const data = await res.json()
          setClients(data.clients?.length ? data.clients : MOCK_CLIENTS)
        } else {
          setClients(MOCK_CLIENTS)
        }
      } catch {
        setClients(MOCK_CLIENTS)
      } finally {
        setLoading(false)
      }
    }
    load()
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
          <button className="flex items-center gap-2 px-3 py-2 text-sm bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
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
                    ? 'bg-[hsl(var(--primary))] text-white'
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
    </div>
  )
}
