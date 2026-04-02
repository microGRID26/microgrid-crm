'use client'

import { useState, useEffect, useMemo } from 'react'
import { Nav } from '@/components/Nav'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg } from '@/lib/hooks'
import { db } from '@/lib/db'
import { fmt$, fmtDate, daysAgo, cn } from '@/lib/utils'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import { loadProjectById } from '@/lib/api'
import type { Project } from '@/types/database'

// ── Period helpers ───────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_qtr' | 'last_qtr' | 'this_year'

function getPeriodRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const iso = (dt: Date) => dt.toISOString().slice(0, 10)
  const today = iso(now)

  switch (period) {
    case 'today': return { start: today, end: today }
    case 'yesterday': { const y2 = new Date(y, m, d - 1); return { start: iso(y2), end: iso(y2) } }
    case 'this_week': { const dow = now.getDay(); const mon = new Date(y, m, d - (dow === 0 ? 6 : dow - 1)); return { start: iso(mon), end: today } }
    case 'last_week': { const dow = now.getDay(); const mon = new Date(y, m, d - (dow === 0 ? 6 : dow - 1) - 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { start: iso(mon), end: iso(sun) } }
    case 'this_month': return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: today }
    case 'last_month': { const lm = new Date(y, m - 1, 1); const end = new Date(y, m, 0); return { start: iso(lm), end: iso(end) } }
    case 'this_qtr': { const qm = Math.floor(m / 3) * 3; return { start: `${y}-${String(qm + 1).padStart(2, '0')}-01`, end: today } }
    case 'last_qtr': { const qm = Math.floor(m / 3) * 3 - 3; const qy = qm < 0 ? y - 1 : y; const qmAdj = qm < 0 ? qm + 12 : qm; const end = new Date(qy, qmAdj + 3, 0); return { start: `${qy}-${String(qmAdj + 1).padStart(2, '0')}-01`, end: iso(end) } }
    case 'this_year': return { start: `${y}-01-01`, end: today }
    default: return { start: today, end: today }
  }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_qtr', label: 'This Qtr' },
  { key: 'last_qtr', label: 'Last Qtr' },
  { key: 'this_year', label: 'This Year' },
]

// ── Types ───────────────────────────────────────────────────────────────────

interface OpsProject {
  id: string
  name: string
  stage: string
  disposition: string | null
  sale_date: string | null
  install_complete_date: string | null
  pto_date: string | null
  contract: number | null
  systemkw: number | null
  financier: string | null
  utility: string | null
  ahj: string | null
  city: string | null
  pm: string | null
  consultant: string | null
  blocker: string | null
  battery: string | null
  energy_community: boolean | null
  module: string | null
  module_qty: number | null
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function OpsPage() {
  const { user, loading: authLoading } = useCurrentUser()
  const isManager = user?.isManager ?? false
  const { orgId } = useOrg()

  const [projects, setProjects] = useState<OpsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('this_month')
  const [panelProject, setPanelProject] = useState<Project | null>(null)

  // Load all projects
  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = db().from('projects')
        .select('id, name, stage, disposition, sale_date, install_complete_date, pto_date, contract, systemkw, financier, utility, ahj, city, pm, consultant, blocker, battery, energy_community, module, module_qty')
        .limit(5000)
      if (orgId) q = q.eq('org_id', orgId)
      const { data } = await q
      setProjects((data ?? []) as OpsProject[])
      setLoading(false)
    }
    load()
  }, [orgId])

  const { start, end } = getPeriodRange(period)

  // Categorize projects by milestone within period
  const sold = useMemo(() => projects.filter(p =>
    p.sale_date && p.sale_date >= start && p.sale_date <= end &&
    p.disposition !== 'Cancelled'
  ), [projects, start, end])

  const scheduled = useMemo(() => projects.filter(p =>
    (p.stage === 'install' || p.stage === 'inspection' || p.stage === 'complete') &&
    p.disposition !== 'Cancelled' && p.disposition !== 'In Service'
  ), [projects])

  const installed = useMemo(() => projects.filter(p =>
    p.install_complete_date && p.install_complete_date >= start && p.install_complete_date <= end
  ), [projects, start, end])

  const cancelled = useMemo(() => projects.filter(p =>
    p.disposition === 'Cancelled' && p.sale_date && p.sale_date >= start && p.sale_date <= end
  ), [projects, start, end])

  // Aggregate helpers
  const sum = (arr: OpsProject[], fn: (p: OpsProject) => number) => arr.reduce((s, p) => s + fn(p), 0)
  const avg = (arr: OpsProject[], fn: (p: OpsProject) => number) => arr.length > 0 ? sum(arr, fn) / arr.length : 0
  const countWith = (arr: OpsProject[], fn: (p: OpsProject) => boolean) => arr.filter(fn).length
  const pct = (n: number, d: number) => d > 0 ? `${Math.round(n / d * 100)}%` : '0%'

  // Cycle time helpers
  const avgDaysBetween = (arr: OpsProject[], from: (p: OpsProject) => string | null, to: (p: OpsProject) => string | null) => {
    const valid = arr.filter(p => from(p) && to(p)).map(p => {
      const d1 = new Date(from(p)!).getTime()
      const d2 = new Date(to(p)!).getTime()
      return Math.round((d2 - d1) / 86400000)
    }).filter(d => d >= 0 && d < 365)
    return valid.length > 0 ? Math.round(valid.reduce((s, d) => s + d, 0) / valid.length) : 0
  }

  // Breakdowns
  const breakdownBy = (arr: OpsProject[], field: keyof OpsProject) => {
    const map: Record<string, OpsProject[]> = {}
    for (const p of arr) {
      const key = (p[field] as string) ?? 'Unknown'
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }

  const openProject = async (id: string) => {
    const p = await loadProjectById(id)
    if (p) setPanelProject(p)
  }

  if (authLoading) return <div className="min-h-screen bg-gray-950"><Nav active="Ops" /></div>
  if (!isManager) return <div className="min-h-screen bg-gray-950"><Nav active="Ops" /><div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">Not authorized.</div></div>

  const MetricCard = ({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) => (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className={cn('text-lg md:text-xl font-bold', color)}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )

  const totalSold = sold.length
  const totalInstalled = installed.length
  const totalScheduled = scheduled.length
  const totalCancelled = cancelled.length
  const cancelPct = sold.length + cancelled.length > 0 ? pct(totalCancelled, totalSold + totalCancelled) : '0%'

  const saleToInstall = avgDaysBetween(installed, p => p.sale_date, p => p.install_complete_date)
  const saleToPTO = avgDaysBetween(projects.filter(p => p.pto_date), p => p.sale_date, p => p.pto_date)
  const installToPTO = avgDaysBetween(projects.filter(p => p.pto_date && p.install_complete_date), p => p.install_complete_date, p => p.pto_date)

  const utilityBreakdown = breakdownBy(sold, 'utility')
  const ecBreakdown = breakdownBy(sold, 'energy_community' as keyof OpsProject)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Nav active="Ops" />
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 space-y-4">

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-bold text-gray-400 mr-2">Operations Dashboard</h1>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                period === p.key ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Row 1: Sold metrics */}
            <div>
              <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider mb-2">Sold ({start} to {end})</div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <MetricCard label="Total Sales" value={totalSold} color="text-yellow-400" />
                <MetricCard label="Batteries Sold" value={countWith(sold, p => !!p.battery)} />
                <MetricCard label="Total kW Sold" value={`${Math.round(sum(sold, p => Number(p.systemkw) || 0))}`} />
                <MetricCard label="Total Value Sold" value={fmt$(sum(sold, p => Number(p.contract) || 0))} color="text-green-400" />
                <MetricCard label="Avg Value Sold" value={fmt$(avg(sold, p => Number(p.contract) || 0))} />
                <MetricCard label="Avg kW Sold" value={`${(avg(sold, p => Number(p.systemkw) || 0)).toFixed(1)}`} />
              </div>
            </div>

            {/* Row 2: Scheduled metrics */}
            <div>
              <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider mb-2">Scheduled (In Pipeline)</div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <MetricCard label="Total Scheduled" value={totalScheduled} color="text-teal-400" />
                <MetricCard label="Batteries" value={countWith(scheduled, p => !!p.battery)} />
                <MetricCard label="Total kW" value={`${Math.round(sum(scheduled, p => Number(p.systemkw) || 0))}`} />
                <MetricCard label="Total Value" value={fmt$(sum(scheduled, p => Number(p.contract) || 0))} color="text-green-400" />
                <MetricCard label="Avg Value" value={fmt$(avg(scheduled, p => Number(p.contract) || 0))} />
                <MetricCard label="Avg kW" value={`${(avg(scheduled, p => Number(p.systemkw) || 0)).toFixed(1)}`} />
              </div>
            </div>

            {/* Row 3: Installed metrics */}
            <div>
              <div className="text-[10px] text-green-400 font-bold uppercase tracking-wider mb-2">Installed ({start} to {end})</div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <MetricCard label="Total Installs" value={totalInstalled} color="text-green-400" />
                <MetricCard label="Batteries" value={countWith(installed, p => !!p.battery)} />
                <MetricCard label="Total kW" value={`${Math.round(sum(installed, p => Number(p.systemkw) || 0))}`} />
                <MetricCard label="Total Value" value={fmt$(sum(installed, p => Number(p.contract) || 0))} color="text-green-400" />
                <MetricCard label="Avg Value" value={fmt$(avg(installed, p => Number(p.contract) || 0))} />
                <MetricCard label="Avg kW" value={`${(avg(installed, p => Number(p.systemkw) || 0)).toFixed(1)}`} />
              </div>
            </div>

            {/* KPIs + Breakdowns row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* KPIs */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-3">Key Metrics</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Cancels</span>
                    <span className="text-lg font-bold text-red-400">{totalCancelled}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Cancel %</span>
                    <span className="text-lg font-bold text-red-400">{cancelPct}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                    <span className="text-xs text-gray-400">Sale to Install</span>
                    <span className="text-lg font-bold text-white">{saleToInstall}d</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Sale to PTO</span>
                    <span className="text-lg font-bold text-white">{saleToPTO}d</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Install to PTO</span>
                    <span className="text-lg font-bold text-white">{installToPTO}d</span>
                  </div>
                </div>
              </div>

              {/* Utility breakdown */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-3">By Utility</div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                  {utilityBreakdown.slice(0, 15).map(([name, projs]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-gray-300 truncate mr-2">{name}</span>
                      <span className="text-white font-medium flex-shrink-0">{projs.length} · {pct(projs.length, sold.length)}</span>
                    </div>
                  ))}
                  {utilityBreakdown.length === 0 && <div className="text-gray-600 text-xs">No data</div>}
                </div>
              </div>

              {/* Energy Community breakdown */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-3">Energy Community</div>
                <div className="space-y-2">
                  {[
                    { label: 'Yes', count: countWith(sold, p => p.energy_community === true) },
                    { label: 'No', count: countWith(sold, p => !p.energy_community) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-gray-300">{row.label}</span>
                      <span className="text-white font-medium">{row.count} · {pct(row.count, sold.length)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Consultant */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-3">By Consultant</div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                  {breakdownBy(sold, 'consultant').slice(0, 15).map(([name, projs]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-gray-300 truncate mr-2">{name}</span>
                      <span className="text-white font-medium flex-shrink-0">{projs.length} · {fmt$(sum(projs, p => Number(p.contract) || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Project list */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Sales in Period ({sold.length})</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-500">
                      <th className="text-left px-3 py-2 font-medium">ID</th>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Value</th>
                      <th className="text-left px-3 py-2 font-medium">kW</th>
                      <th className="text-left px-3 py-2 font-medium">EC</th>
                      <th className="text-left px-3 py-2 font-medium">Consultant</th>
                      <th className="text-left px-3 py-2 font-medium">Financier</th>
                      <th className="text-left px-3 py-2 font-medium">Sale Date</th>
                      <th className="text-left px-3 py-2 font-medium">Install Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sold.slice(0, 100).map(p => (
                      <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer" onClick={() => openProject(p.id)}>
                        <td className="px-3 py-2 text-green-400 font-medium">{p.id}</td>
                        <td className="px-3 py-2 text-white truncate max-w-40">{p.name}</td>
                        <td className="px-3 py-2">{fmt$(Number(p.contract) || 0)}</td>
                        <td className="px-3 py-2">{p.systemkw ?? '—'}</td>
                        <td className="px-3 py-2">{p.energy_community ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2 text-gray-400 truncate max-w-28">{p.consultant ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{p.financier ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{fmtDate(p.sale_date)}</td>
                        <td className="px-3 py-2 text-gray-400">{fmtDate(p.install_complete_date)}</td>
                      </tr>
                    ))}
                    {sold.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-600">No sales in this period</td></tr>
                    )}
                  </tbody>
                  {sold.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-600 font-medium text-gray-300">
                        <td className="px-3 py-2">{sold.length}</td>
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-green-400">{fmt$(sum(sold, p => Number(p.contract) || 0))}</td>
                        <td className="px-3 py-2">{Math.round(sum(sold, p => Number(p.systemkw) || 0))}</td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {panelProject && (
        <ProjectPanel project={panelProject} onClose={() => setPanelProject(null)} onProjectUpdated={() => {}} />
      )}
    </div>
  )
}
