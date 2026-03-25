'use client'

import { useEffect, useState, useMemo } from 'react'
import { Nav } from '@/components/Nav'
import { daysAgo, fmt$, STAGE_LABELS, STAGE_ORDER, SLA_THRESHOLDS } from '@/lib/utils'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import { NewProjectModal } from '@/components/project/NewProjectModal'
import { useSupabaseQuery, useServerFilter } from '@/lib/hooks'
import type { Project } from '@/types/database'

const PROJECT_COLUMNS = 'id, name, city, address, pm, pm_id, stage, stage_date, sale_date, contract, blocker, systemkw, financier, ahj, disposition'

const SEARCH_FIELDS = ['name', 'id', 'city', 'address']

const DROPDOWN_CONFIG = {
  pm: 'pm_id|pm',
  financier: 'financier',
  ahj: 'ahj',
}

function getSLA(p: Project) {
  const t = SLA_THRESHOLDS[p.stage] ?? { target: 3, risk: 5, crit: 7 }
  const days = daysAgo(p.stage_date)
  let status: 'ok' | 'warn' | 'risk' | 'crit' = 'ok'
  if (days >= t.crit) status = 'crit'
  else if (days >= t.risk) status = 'risk'
  else if (days >= t.target) status = 'warn'
  return { days, status, pct: Math.min(100, Math.round(days / t.crit * 100)) }
}

const AGE_COLOR: Record<string, string> = {
  crit: '#ef4444',
  risk: '#f59e0b',
  warn: '#eab308',
  ok:   '#22c55e',
}

export default function PipelinePage() {
  const [selected, setSelected] = useState<Project | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [sort, setSort] = useState<'name' | 'sla' | 'contract' | 'cycle'>('sla')

  // Server filter hook — manages filter state, dropdowns, and query building
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    dropdowns,
    buildQueryFilters,
    buildSearchOr,
  } = useServerFilter([] as Record<string, unknown>[], {
    searchFields: SEARCH_FIELDS,
    extractDropdowns: DROPDOWN_CONFIG,
  })

  // Merge disposition exclusion with dynamic filters
  const queryFilters = useMemo(() => ({
    disposition: { not_in: ['In Service', 'Loyalty', 'Cancelled'] as (string | number)[] },
    ...buildQueryFilters(),
  }), [buildQueryFilters])

  const searchOr = useMemo(() => buildSearchOr(), [buildSearchOr])

  // Main query using the hook
  const { data: projects, loading, refresh } = useSupabaseQuery('projects', {
    select: PROJECT_COLUMNS,
    filters: queryFilters,
    or: searchOr,
    limit: 2000,
    // Pagination wired but not active (no UI yet) — pass page: 1 to enable when ready
  })

  // Feed loaded data back into useServerFilter for dropdown extraction
  // Note: useServerFilter was initialized with [] — we need to re-create with actual data
  // Hook gap: useServerFilter takes data at init but we need it reactive.
  // Workaround: use a second instance that receives the data for dropdown extraction only.
  const {
    dropdowns: extractedDropdowns,
  } = useServerFilter(projects as unknown as Record<string, unknown>[], {
    extractDropdowns: DROPDOWN_CONFIG,
  })

  // Use extracted dropdowns (from data) for the select options
  const pms = extractedDropdowns.pm ?? []
  const financiers = extractedDropdowns.financier ?? []
  const ahjs = extractedDropdowns.ahj ?? []

  // Auto-open project from URL params (e.g., /pipeline?open=PROJ-28517&tab=notes)
  const [initialTab, setInitialTab] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || projects.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const openId = params.get('open')
    const searchQ = params.get('search')
    const tab = params.get('tab')
    if (openId) {
      const proj = (projects as unknown as Project[]).find(p => p.id === openId)
      if (proj) { setSelected(proj); if (tab) setInitialTab(tab) }
    }
    if (searchQ && !search) setSearch(searchQ)
  }, [projects])

  // Cast for rendering (hook returns Row type, we need Project)
  const filtered = projects as unknown as Project[]

  // Sort within each column
  function sortedCards(cards: Project[]) {
    return [...cards].sort((a, b) => {
      if (sort === 'sla') return getSLA(b).days - getSLA(a).days
      if (sort === 'contract') return (Number(b.contract) || 0) - (Number(a.contract) || 0)
      if (sort === 'cycle') return (daysAgo(b.sale_date) || 0) - (daysAgo(a.sale_date) || 0)
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
  }

  const totalContract = useMemo(() => filtered.reduce((s, p) => s + (Number(p.contract) || 0), 0), [filtered])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-green-400 text-sm animate-pulse">Loading pipeline...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Nav active="Pipeline" onNewProject={() => setShowNewProject(true)} right={<>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="text-xs bg-gray-800 text-gray-200 border border-gray-700 rounded-md px-3 py-1.5 w-40 focus:outline-none focus:border-green-500 placeholder-gray-500"
          />
          <span className="text-xs text-gray-500">{filtered.length} projects · {fmt$(totalContract)}</span>
        </>} />

      {/* Filter bar */}
      <div className="bg-gray-950 border-b border-gray-800 flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap">
        <select value={filterValues.pm ?? 'all'} onChange={e => setFilter('pm', e.target.value)}
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5">
          <option value="all">All PMs</option>
          {pms.map(pm => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
        </select>
        <select value={filterValues.financier ?? 'all'} onChange={e => setFilter('financier', e.target.value)}
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5">
          <option value="all">All Financiers</option>
          {financiers.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={filterValues.ahj ?? 'all'} onChange={e => setFilter('ahj', e.target.value)}
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5">
          <option value="all">All AHJs</option>
          {ahjs.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort:</span>
          {(['sla','name','contract','cycle'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${sort === s ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
              {s === 'sla' ? 'Days' : s === 'contract' ? '$' : s === 'cycle' ? 'Cycle' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-0 h-full w-full">
          {STAGE_ORDER.map(stageId => {
            const cards = sortedCards(filtered.filter(p => p.stage === stageId))
            const colContract = cards.reduce((s, p) => s + (Number(p.contract) || 0), 0)
            const blocked = cards.filter(p => p.blocker).length
            const crit = cards.filter(p => !p.blocker && getSLA(p).status === 'crit').length

            return (
              <div key={stageId} className="flex flex-col border-r border-gray-800 flex-1 min-w-[180px]">
                {/* Column header */}
                <div className="bg-gray-950 border-b border-gray-800 px-3 py-2.5 sticky top-0 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{STAGE_LABELS[stageId]}</span>
                    <span className="text-xs text-gray-400 font-mono">{cards.length}</span>
                  </div>
                  <div className="text-xs text-gray-500">{fmt$(colContract)}</div>
                  {(blocked > 0 || crit > 0) && (
                    <div className="flex gap-1 mt-1">
                      {blocked > 0 && <span className="text-xs bg-red-950 text-red-400 px-1.5 rounded">{blocked} blocked</span>}
                      {crit > 0 && <span className="text-xs bg-red-950 text-red-400 px-1.5 rounded">{crit} critical</span>}
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {cards.map(p => {
                    const sla = getSLA(p)
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className={`bg-gray-800 rounded-lg p-2.5 cursor-pointer hover:bg-gray-700 border transition-colors ${
                          p.blocker ? 'border-l-2 border-l-red-500 border-gray-700' :
                          sla.status === 'crit' ? 'border-l-2 border-l-red-500 border-gray-700' :
                          sla.status === 'risk' ? 'border-l-2 border-l-amber-500 border-gray-700' :
                          selected?.id === p.id ? 'border-green-600' : 'border-gray-700'
                        }`}
                      >
                        {/* Name */}
                        <div className="text-xs font-medium text-white truncate mb-0.5">{p.name}</div>
                        {/* ID */}
                        <div className="text-xs text-gray-500 mb-1">{p.id}</div>
                        {/* kW + contract */}
                        <div className="text-xs text-gray-400 mb-1.5">
                          {p.systemkw && <span>{p.systemkw} kW · </span>}
                          <span>{fmt$(p.contract)}</span>
                        </div>
                        {/* Financier */}
                        {p.financier && <div className="text-xs text-gray-500 truncate mb-1.5">{p.financier}</div>}
                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{p.pm}</span>
                          <span className={`text-xs font-mono font-bold ${
                            p.blocker ? 'text-red-400' :
                            sla.status === 'crit' ? 'text-red-400' :
                            sla.status === 'risk' ? 'text-amber-400' :
                            sla.status === 'warn' ? 'text-yellow-400' : 'text-gray-400'
                          }`}>{sla.days}d</span>
                        </div>
                        {/* SLA progress bar */}
                        <div className="mt-1.5 h-0.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${sla.pct}%`, backgroundColor: AGE_COLOR[sla.status] }}
                          />
                        </div>
                        {/* Blocker */}
                        {p.blocker && (
                          <div className="mt-1.5 text-xs text-red-400 truncate">🚫 {p.blocker}</div>
                        )}
                      </div>
                    )
                  })}
                  {cards.length === 0 && (
                    <div className="text-xs text-gray-700 text-center py-4">Empty</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Project Panel */}
      {selected && (
        <ProjectPanel
          project={selected}
          onClose={() => { setSelected(null); setInitialTab(null) }}
          onProjectUpdated={refresh}
          initialTab={initialTab as any}
        />
      )}
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={() => { setShowNewProject(false); refresh() }}
          existingIds={filtered.map(p => p.id)}
          pms={pms.map(pm => ({ id: pm.value, name: pm.label }))}
        />
      )}
    </div>
  )
}
