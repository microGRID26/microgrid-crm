'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Nav } from '@/components/Nav'
import { cn, fmt$, fmtDate } from '@/lib/utils'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg } from '@/lib/hooks'
import {
  loadProjectCostSummaries, loadCrewRates,
  loadLaborCosts, loadMaterialCosts, loadOverheadCosts,
} from '@/lib/api'
import type { ProjectCostSummary, CrewRate, JobCostLabor, JobCostMaterial, JobCostOverhead } from '@/lib/api'
import { CrewRatesTab } from './components/CrewRatesTab'
import { AddCostsTab } from './components/AddCostsTab'
import {
  DollarSign, Users, PlusCircle, TrendingUp, ChevronDown, ChevronRight,
  BarChart3, Wrench, Package, Receipt,
} from 'lucide-react'

type Tab = 'pnl' | 'crew' | 'add'

export default function JobCostingPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const { orgId, loading: orgLoading } = useOrg()

  const [activeTab, setActiveTab] = useState<Tab>('pnl')
  const [summaries, setSummaries] = useState<ProjectCostSummary[]>([])
  const [crewRates, setCrewRates] = useState<CrewRate[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Detail data for expanded row
  const [detailLabor, setDetailLabor] = useState<JobCostLabor[]>([])
  const [detailMaterials, setDetailMaterials] = useState<JobCostMaterial[]>([])
  const [detailOverhead, setDetailOverhead] = useState<JobCostOverhead[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadPnl = useCallback(async () => {
    setLoading(true)
    const data = await loadProjectCostSummaries(orgId ?? undefined)
    setSummaries(data)
    setLoading(false)
  }, [orgId])

  const loadRates = useCallback(async () => {
    const data = await loadCrewRates(orgId ?? undefined)
    setCrewRates(data)
  }, [orgId])

  useEffect(() => {
    if (orgLoading || userLoading) return
    loadPnl()
    loadRates()
  }, [orgLoading, userLoading, loadPnl, loadRates])

  // Expand row -> load detail
  const toggleExpand = useCallback(async (pid: string) => {
    if (expandedId === pid) { setExpandedId(null); return }
    setExpandedId(pid)
    setDetailLoading(true)
    const [labor, mats, oh] = await Promise.all([
      loadLaborCosts(pid),
      loadMaterialCosts(pid),
      loadOverheadCosts(pid),
    ])
    setDetailLabor(labor)
    setDetailMaterials(mats)
    setDetailOverhead(oh)
    setDetailLoading(false)
  }, [expandedId])

  // ── Summary cards ─────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const totalRev = summaries.reduce((s, p) => s + p.contract, 0)
    const totalCost = summaries.reduce((s, p) => s + p.total_cost, 0)
    const avgMargin = summaries.length > 0
      ? summaries.reduce((s, p) => s + p.margin_pct, 0) / summaries.length : 0
    const avgCpw = summaries.length > 0
      ? summaries.filter(p => p.cost_per_watt > 0).reduce((s, p) => s + p.cost_per_watt, 0) /
        (summaries.filter(p => p.cost_per_watt > 0).length || 1) : 0
    return { totalRev, totalCost, avgMargin: Math.round(avgMargin * 10) / 10, avgCpw: Math.round(avgCpw * 100) / 100 }
  }, [summaries])

  // ── Margin color helper ───────────────────────────────────────────────────

  const marginColor = (pct: number) => {
    if (pct >= 20) return 'text-green-400'
    if (pct >= 10) return 'text-amber-400'
    return 'text-red-400'
  }

  const marginBg = (pct: number) => {
    if (pct >= 20) return 'bg-green-900/20'
    if (pct >= 10) return 'bg-amber-900/20'
    return 'bg-red-900/20'
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (userLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  const isAdmin = currentUser?.isAdmin ?? false
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Nav active="Job Costing" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-white mb-2">Access Restricted</h1>
            <p className="text-sm text-gray-500">Admin role required to view job costing.</p>
            <a href="/command" className="inline-block mt-4 text-xs text-blue-400 hover:text-blue-300">
              Back to Command Center
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Nav active="Job Costing" />

      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto w-full">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Job Costing
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Track labor, materials, and overhead costs per project</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {([
            { key: 'pnl' as Tab, label: 'Project P&L', icon: BarChart3 },
            { key: 'crew' as Tab, label: 'Crew Rates', icon: Users },
            { key: 'add' as Tab, label: 'Add Costs', icon: PlusCircle },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'border-b-2 border-green-400 text-green-400'
                  : 'text-gray-400 hover:text-white'
              }`}>
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: Project P&L ── */}
        {activeTab === 'pnl' && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Total Revenue" value={fmt$(totals.totalRev)} icon={DollarSign} color="text-green-400" />
              <SummaryCard label="Total Cost" value={fmt$(totals.totalCost)} icon={TrendingUp} color="text-red-400" />
              <SummaryCard label="Avg Margin" value={`${totals.avgMargin}%`} icon={BarChart3} color={marginColor(totals.avgMargin)} />
              <SummaryCard label="Avg Cost/Watt" value={`$${totals.avgCpw}`} icon={DollarSign} color="text-blue-400" />
            </div>

            {/* P&L table */}
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg overflow-hidden">
              {loading ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">Loading cost data...</div>
              ) : summaries.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">No cost data yet. Add costs in the "Add Costs" tab.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-left">
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase w-8"></th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Project</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Contract</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Labor</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Materials</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Overhead</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Total Cost</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Margin</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Margin %</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">$/Watt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map(p => (
                        <>
                          <tr key={p.project_id}
                            onClick={() => toggleExpand(p.project_id)}
                            className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer">
                            <td className="px-4 py-2.5 text-gray-500">
                              {expandedId === p.project_id
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="px-4 py-2.5 text-white font-medium max-w-[200px] truncate">{p.project_name}</td>
                            <td className="px-4 py-2.5 text-gray-300 text-right font-mono">{fmt$(p.contract)}</td>
                            <td className="px-4 py-2.5 text-blue-400 text-right font-mono">{fmt$(p.labor_cost)}</td>
                            <td className="px-4 py-2.5 text-amber-400 text-right font-mono">{fmt$(p.material_cost)}</td>
                            <td className="px-4 py-2.5 text-purple-400 text-right font-mono">{fmt$(p.overhead_cost)}</td>
                            <td className="px-4 py-2.5 text-red-300 text-right font-mono">{fmt$(p.total_cost)}</td>
                            <td className={cn('px-4 py-2.5 text-right font-mono', marginColor(p.margin_pct))}>{fmt$(p.margin)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium', marginBg(p.margin_pct), marginColor(p.margin_pct))}>
                                {p.margin_pct}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-300 text-right font-mono">${p.cost_per_watt}</td>
                          </tr>

                          {/* Expanded detail */}
                          {expandedId === p.project_id && (
                            <tr key={`${p.project_id}-detail`}>
                              <td colSpan={10} className="bg-gray-900/50 px-6 py-4">
                                {detailLoading ? (
                                  <p className="text-xs text-gray-500">Loading line items...</p>
                                ) : (
                                  <div className="space-y-4">
                                    {/* Labor detail */}
                                    {detailLabor.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1 mb-1.5">
                                          <Wrench className="w-3 h-3" /> Labor ({detailLabor.length})
                                        </h4>
                                        <div className="space-y-1">
                                          {detailLabor.map(e => (
                                            <div key={e.id} className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/40 rounded px-3 py-1">
                                              <span>{fmtDate(e.work_date)} &middot; {e.worker_name || 'Unnamed'} &middot; {e.hours}h @ {fmt$(e.hourly_rate)}/hr &middot; {e.category}</span>
                                              <span className="text-blue-400 font-mono">{fmt$(e.total_cost)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Materials detail */}
                                    {detailMaterials.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-1.5">
                                          <Package className="w-3 h-3" /> Materials ({detailMaterials.length})
                                        </h4>
                                        <div className="space-y-1">
                                          {detailMaterials.map(e => (
                                            <div key={e.id} className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/40 rounded px-3 py-1">
                                              <span>{e.material_name} &middot; {e.quantity} x {fmt$(e.unit_cost)} &middot; {e.vendor || 'No vendor'}{e.po_number ? ` &middot; PO: ${e.po_number}` : ''}</span>
                                              <span className="text-amber-400 font-mono">{fmt$(e.total_cost)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Overhead detail */}
                                    {detailOverhead.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-purple-400 flex items-center gap-1 mb-1.5">
                                          <Receipt className="w-3 h-3" /> Overhead ({detailOverhead.length})
                                        </h4>
                                        <div className="space-y-1">
                                          {detailOverhead.map(e => (
                                            <div key={e.id} className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/40 rounded px-3 py-1">
                                              <span>{e.category.replace('_', ' ')} &middot; {e.description || 'No desc'} &middot; {e.vendor || 'No vendor'}</span>
                                              <span className="text-purple-400 font-mono">{fmt$(e.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {detailLabor.length === 0 && detailMaterials.length === 0 && detailOverhead.length === 0 && (
                                      <p className="text-xs text-gray-500">No line items found.</p>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: Crew Rates ── */}
        {activeTab === 'crew' && (
          <CrewRatesTab rates={crewRates} orgId={orgId} onRefresh={loadRates} />
        )}

        {/* ── TAB 3: Add Costs ── */}
        {activeTab === 'add' && (
          <AddCostsTab orgId={orgId} onCostAdded={loadPnl} />
        )}
      </div>
    </div>
  )
}

// ── Summary card helper ──────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string
}) {
  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
    </div>
  )
}
