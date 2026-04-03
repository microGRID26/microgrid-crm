'use client'

import { useMemo, useState } from 'react'
import { fmt$, daysAgo } from '@/lib/utils'
import {
  MetricCard, PeriodBar, ExportButton, downloadCSV, SortHeader, useSortable, ProjectListModal,
  inRange, PERIOD_LABELS, type AnalyticsData,
} from './shared'
import type { Project } from '@/types/database'

// ── Types ────────────────────────────────────────────────────────────────────

interface DealerRow {
  dealer: string
  totalSales: number
  periodSales: number
  avgDeal: number
  avgKw: number
  avgCycleDays: number
  conversionPct: number
  totalValue: number
}

interface RepRow {
  name: string
  dealsSold: number
  totalValue: number
  avgDeal: number
  activePipeline: number
}

// ── Component ────────────────────────────────────────────────────────────────

export function Dealers({ data }: { data: AnalyticsData }) {
  const { projects, period } = data
  const [drillDown, setDrillDown] = useState<{ title: string; projects: Project[] } | null>(null)

  // ── Headline metrics ─────────────────────────────────────────────────────
  const headline = useMemo(() => {
    const now = new Date()
    const d28 = new Date(now); d28.setDate(d28.getDate() - 28)
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90)

    // Sales velocity: deals in last 28 days / 4 weeks
    const last28Sales = projects.filter(p => {
      if (!p.sale_date) return false
      const sd = new Date(p.sale_date + 'T00:00:00')
      return sd >= d28 && sd <= now
    })
    const velocity = last28Sales.length / 4

    // Avg deal size: mean contract for projects sold in period
    const periodSales = projects.filter(p => inRange(p.sale_date, period))
    const avgDealContracts = periodSales.filter(p => Number(p.contract) > 0)
    const avgDeal = avgDealContracts.length > 0
      ? Math.round(avgDealContracts.reduce((s, p) => s + (Number(p.contract) || 0), 0) / avgDealContracts.length)
      : 0

    // Pipeline value: SUM(contract) for all active
    const active = projects.filter(p => p.stage !== 'complete' && p.disposition !== 'Cancelled' && p.disposition !== 'In Service')
    const pipelineValue = active.reduce((s, p) => s + (Number(p.contract) || 0), 0)

    // Conversion rate: reached install stage / all with sale_date in trailing 90 days
    const trail90 = projects.filter(p => {
      if (!p.sale_date) return false
      const sd = new Date(p.sale_date + 'T00:00:00')
      return sd >= d90 && sd <= now
    })
    const reachedInstall = trail90.filter(p =>
      p.stage === 'install' || p.stage === 'inspection' || p.stage === 'complete' || p.install_complete_date
    )
    const conversionRate = trail90.length > 0 ? Math.round((reachedInstall.length / trail90.length) * 100) : 0

    return { velocity, avgDeal, pipelineValue, conversionRate, periodSales, last28Sales, active, reachedInstall, trail90 }
  }, [projects, period])

  // ── Sales Trend (6 months) ───────────────────────────────────────────────
  const salesTrend = useMemo(() => {
    const now = new Date()
    const months: { label: string; month: number; year: number; count: number; value: number; projects: Project[] }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.getMonth(); const y = d.getFullYear()
      const ps = projects.filter(p => {
        if (!p.sale_date) return false
        const sd = new Date(p.sale_date + 'T00:00:00')
        return sd.getMonth() === m && sd.getFullYear() === y
      })
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        month: m, year: y, count: ps.length,
        value: ps.reduce((s, p) => s + (Number(p.contract) || 0), 0),
        projects: ps,
      })
    }
    const maxCount = Math.max(...months.map(m => m.count), 1)
    return { months, maxCount }
  }, [projects])

  // ── Deal Size Distribution ───────────────────────────────────────────────
  const dealBuckets = useMemo(() => {
    const buckets = [
      { label: '$0-20K', min: 0, max: 20000, projects: [] as Project[], kwTotal: 0 },
      { label: '$20-40K', min: 20000, max: 40000, projects: [] as Project[], kwTotal: 0 },
      { label: '$40-60K', min: 40000, max: 60000, projects: [] as Project[], kwTotal: 0 },
      { label: '$60-80K', min: 60000, max: 80000, projects: [] as Project[], kwTotal: 0 },
      { label: '$80K+', min: 80000, max: Infinity, projects: [] as Project[], kwTotal: 0 },
    ]
    projects.forEach(p => {
      const c = Number(p.contract) || 0
      const bucket = buckets.find(b => c >= b.min && c < b.max) ?? buckets[buckets.length - 1]
      bucket.projects.push(p)
      bucket.kwTotal += Number(p.systemkw) || 0
    })
    const maxBucket = Math.max(...buckets.map(b => b.projects.length), 1)
    return { buckets, maxBucket }
  }, [projects])

  // ── Dealer Performance ───────────────────────────────────────────────────
  const dealerRows = useMemo(() => {
    const dealerMap = new Map<string, Project[]>()
    projects.forEach(p => {
      const d = p.dealer || 'Unknown'
      const arr = dealerMap.get(d) || []
      arr.push(p)
      dealerMap.set(d, arr)
    })

    const rows: DealerRow[] = [...dealerMap.entries()].map(([dealer, ps]) => {
      const periodPs = ps.filter(p => inRange(p.sale_date, period))
      const totalValue = ps.reduce((s, p) => s + (Number(p.contract) || 0), 0)
      const avgDeal = ps.length > 0 ? Math.round(totalValue / ps.length) : 0
      const avgKw = ps.length > 0 ? Math.round((ps.reduce((s, p) => s + (Number(p.systemkw) || 0), 0) / ps.length) * 100) / 100 : 0

      // Avg cycle days (sale to install)
      const withInstall = ps.filter(p => p.sale_date && p.install_complete_date)
      const avgCycleDays = withInstall.length > 0
        ? Math.round(withInstall.reduce((s, p) => {
            const sale = new Date(p.sale_date! + 'T00:00:00').getTime()
            const inst = new Date(p.install_complete_date! + 'T00:00:00').getTime()
            return s + (inst - sale) / 86400000
          }, 0) / withInstall.length)
        : 0

      // Conversion: reached install / all with sale_date
      const withSale = ps.filter(p => p.sale_date)
      const reachedInstall = withSale.filter(p =>
        p.stage === 'install' || p.stage === 'inspection' || p.stage === 'complete' || p.install_complete_date
      )
      const conversionPct = withSale.length > 0 ? Math.round((reachedInstall.length / withSale.length) * 100) : 0

      return { dealer, totalSales: ps.length, periodSales: periodPs.length, avgDeal, avgKw, avgCycleDays, conversionPct, totalValue }
    })

    return rows
  }, [projects, period])

  const { sorted: sortedDealers, sortKey, sortDir, toggleSort } = useSortable<DealerRow>(dealerRows, 'totalSales')

  // Top performer threshold: top 25%
  const topThreshold = useMemo(() => {
    const vals = dealerRows.map(d => d.totalSales).sort((a, b) => b - a)
    return vals[Math.floor(vals.length * 0.25)] ?? 1
  }, [dealerRows])

  // ── Consultant/Rep Leaderboard ───────────────────────────────────────────
  const repRows = useMemo(() => {
    const repMap = new Map<string, Project[]>()
    projects.forEach(p => {
      const c = p.consultant
      if (c) {
        const arr = repMap.get(c) || []
        arr.push(p)
        repMap.set(c, arr)
      }
    })

    // Try to match salesReps for display names
    const repNameMap = new Map<string, string>()
    data.salesReps?.forEach(r => {
      const full = `${r.first_name} ${r.last_name}`.trim()
      if (full) repNameMap.set(full.toLowerCase(), full)
    })

    const rows: RepRow[] = [...repMap.entries()].map(([consultant, ps]) => {
      const displayName = repNameMap.get(consultant.toLowerCase()) || consultant
      const periodPs = ps.filter(p => inRange(p.sale_date, period))
      const totalValue = ps.reduce((s, p) => s + (Number(p.contract) || 0), 0)
      const avgDeal = ps.length > 0 ? Math.round(totalValue / ps.length) : 0
      const activePs = ps.filter(p => p.stage !== 'complete' && p.disposition !== 'Cancelled')
      const activePipeline = activePs.reduce((s, p) => s + (Number(p.contract) || 0), 0)
      return { name: displayName, dealsSold: periodPs.length, totalValue, avgDeal, activePipeline }
    }).sort((a, b) => b.dealsSold - a.dealsSold)

    return rows
  }, [projects, period, data.salesReps])

  // ── Deal Cycle Analysis by Dealer ────────────────────────────────────────
  const cycleByDealer = useMemo(() => {
    return dealerRows
      .filter(d => d.avgCycleDays > 0)
      .sort((a, b) => a.avgCycleDays - b.avgCycleDays)
      .slice(0, 20)
  }, [dealerRows])
  const maxCycleDays = Math.max(...cycleByDealer.map(d => d.avgCycleDays), 1)

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Dealer', 'Total Sales', `Period Sales (${PERIOD_LABELS[period]})`, 'Avg Deal $', 'Avg kW', 'Avg Cycle Days', 'Conversion %', 'Total Value']
    const rows = sortedDealers.map(d => [d.dealer, d.totalSales, d.periodSales, d.avgDeal, d.avgKw, d.avgCycleDays, d.conversionPct + '%', d.totalValue])
    downloadCSV(`sales-analytics-${period}.csv`, headers, rows)
  }

  // ── Drill-down helpers ───────────────────────────────────────────────────
  const drillDealer = (dealer: string, label: string) => {
    const ps = projects.filter(p => (p.dealer || 'Unknown') === dealer)
    setDrillDown({ title: `${dealer} — ${label}`, projects: ps })
  }

  const drillBucket = (bucket: typeof dealBuckets.buckets[0]) => {
    setDrillDown({ title: `Deal Size: ${bucket.label}`, projects: bucket.projects })
  }

  // ── Velocity color ───────────────────────────────────────────────────────
  const velocityColor = headline.velocity > 5 ? 'text-green-400' : headline.velocity > 2 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}
        <ExportButton onClick={handleExport} />
      </div>

      {/* ── 4 Headline MetricCards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Sales Velocity"
          value={`${headline.velocity.toFixed(1)}/wk`}
          sub={`${headline.last28Sales.length} deals in 28 days`}
          color={velocityColor}
          onClick={() => setDrillDown({ title: 'Sales — Last 28 Days', projects: headline.last28Sales })}
          formula="Count of projects with sale_date in last 28 days, divided by 4 weeks. Green if >5/wk, amber if >2/wk, red if <2/wk."
        />
        <MetricCard
          label="Avg Deal Size"
          value={fmt$(headline.avgDeal)}
          sub={`${headline.periodSales.length} deals in period`}
          onClick={() => setDrillDown({ title: `Sales — ${PERIOD_LABELS[period]}`, projects: headline.periodSales })}
          formula={`Mean contract value for projects with sale_date falling in the selected period (${PERIOD_LABELS[period]}). Only includes projects with contract > $0.`}
        />
        <MetricCard
          label="Pipeline Value"
          value={fmt$(headline.pipelineValue)}
          sub={`${headline.active.length} active projects`}
          color="text-blue-400"
          onClick={() => setDrillDown({ title: 'Active Pipeline', projects: headline.active })}
          formula="SUM of contract values for all active projects (excluding completed, cancelled, and in-service)."
        />
        <MetricCard
          label="Conversion Rate"
          value={`${headline.conversionRate}%`}
          sub={`${headline.reachedInstall.length}/${headline.trail90.length} (90d)`}
          color={headline.conversionRate >= 70 ? 'text-green-400' : headline.conversionRate >= 40 ? 'text-amber-400' : 'text-red-400'}
          onClick={() => setDrillDown({ title: 'Trailing 90-Day Sales', projects: headline.trail90 })}
          formula="Projects that reached install stage (or later) divided by all projects with sale_date in trailing 90 days, times 100%. Measures how effectively new sales convert to installations."
        />
      </div>

      {/* ── Sales Trend (6 months) ─────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Sales Trend — Last 6 Months</div>
        <div className="flex items-end gap-2 h-48">
          {salesTrend.months.map(m => {
            const pct = (m.count / salesTrend.maxCount) * 100
            return (
              <div
                key={`${m.year}-${m.month}`}
                className="flex-1 flex flex-col items-center justify-end gap-1 cursor-pointer group"
                onClick={() => setDrillDown({ title: `Sales — ${m.label}`, projects: m.projects })}
              >
                <div className="text-xs font-bold text-white font-mono">{m.count}</div>
                <div
                  className="w-full bg-green-600 rounded-t-md group-hover:bg-green-500 transition-colors min-h-[4px]"
                  style={{ height: `${Math.max(pct, 3)}%` }}
                />
                <div className="text-[10px] text-gray-500 font-mono">{fmt$(m.value)}</div>
                <div className="text-[10px] text-gray-400">{m.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Deal Size Distribution ─────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Deal Size Distribution</div>
        <div className="space-y-3">
          {dealBuckets.buckets.map(b => {
            const pct = (b.projects.length / dealBuckets.maxBucket) * 100
            const avgKw = b.projects.length > 0
              ? (b.kwTotal / b.projects.length).toFixed(1)
              : '0'
            return (
              <div key={b.label} className="flex items-center gap-3 cursor-pointer group" onClick={() => drillBucket(b)}>
                <div className="text-xs text-gray-400 w-16 flex-shrink-0 font-mono">{b.label}</div>
                <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden relative">
                  <div
                    className="h-full bg-blue-600 group-hover:bg-blue-500 rounded-full transition-all flex items-center px-2"
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  >
                    {pct > 20 && <span className="text-[10px] text-white font-bold">{b.projects.length}</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-300 font-mono w-10 text-right">{b.projects.length}</div>
                <div className="text-xs text-gray-500 font-mono w-20 text-right">{avgKw} kW avg</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Dealer Performance Table ───────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Dealer Performance</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-700">
                <SortHeader label="Dealer" field={'dealer' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Total Sales" field={'totalSales' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label={`Period Sales`} field={'periodSales' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Avg Deal $" field={'avgDeal' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Avg kW" field={'avgKw' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Avg Cycle Days" field={'avgCycleDays' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Conversion %" field={'conversionPct' as keyof DealerRow} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedDealers.slice(0, 25).map(d => {
                const isTop = d.totalSales >= topThreshold && d.totalSales > 1
                const rowBg = isTop ? 'bg-green-950/20' : ''
                return (
                  <tr
                    key={d.dealer}
                    className={`border-b border-gray-800 hover:bg-gray-700/30 cursor-pointer ${rowBg}`}
                    onClick={() => drillDealer(d.dealer, 'All Projects')}
                  >
                    <td className="px-3 py-2 text-white font-medium truncate max-w-[200px]">
                      {d.dealer}
                      {isTop && <span className="ml-1 text-[10px] text-green-500">TOP</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{d.totalSales}</td>
                    <td className="px-3 py-2 text-green-400 font-mono">{d.periodSales}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{fmt$(d.avgDeal)}</td>
                    <td className="px-3 py-2 text-blue-400 font-mono">{d.avgKw > 0 ? `${d.avgKw} kW` : '\u2014'}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className={d.avgCycleDays > 0 ? (d.avgCycleDays < 45 ? 'text-green-400' : d.avgCycleDays < 60 ? 'text-amber-400' : 'text-red-400') : 'text-gray-600'}>
                        {d.avgCycleDays > 0 ? `${d.avgCycleDays}d` : '\u2014'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <span className={d.conversionPct >= 70 ? 'text-green-400' : d.conversionPct >= 40 ? 'text-amber-400' : 'text-red-400'}>
                        {d.conversionPct}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Consultant/Rep Leaderboard ─────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Sales Rep Leaderboard — {PERIOD_LABELS[period]}</div>
        {repRows.length === 0 ? (
          <div className="text-xs text-gray-500">No consultant data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium px-3 py-2">#</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2">Rep Name</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2">Deals (Period)</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2">Total Value</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2">Avg Deal</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2">Active Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {repRows.slice(0, 20).map((r, i) => (
                  <tr
                    key={r.name}
                    className="border-b border-gray-800 hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => {
                      const ps = projects.filter(p => p.consultant === r.name)
                      setDrillDown({ title: `${r.name} — All Projects`, projects: ps })
                    }}
                  >
                    <td className="px-3 py-2 text-gray-500 font-mono">{i + 1}</td>
                    <td className="px-3 py-2 text-white font-medium">
                      {r.name}
                      {i === 0 && r.dealsSold > 0 && <span className="ml-1 text-[10px] text-amber-400">MVP</span>}
                    </td>
                    <td className="px-3 py-2 text-green-400 font-mono font-bold">{r.dealsSold}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{fmt$(r.totalValue)}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{fmt$(r.avgDeal)}</td>
                    <td className="px-3 py-2 text-blue-400 font-mono">{fmt$(r.activePipeline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Deal Cycle Analysis by Dealer ──────────────────────────────────── */}
      {cycleByDealer.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Deal Cycle Analysis — Avg Days Sale to Install</div>
          <div className="space-y-2">
            {cycleByDealer.map(d => {
              const pct = (d.avgCycleDays / maxCycleDays) * 100
              const color = d.avgCycleDays < 45 ? 'bg-green-600' : d.avgCycleDays < 60 ? 'bg-amber-600' : 'bg-red-600'
              const textColor = d.avgCycleDays < 45 ? 'text-green-400' : d.avgCycleDays < 60 ? 'text-amber-400' : 'text-red-400'
              return (
                <div
                  key={d.dealer}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => drillDealer(d.dealer, 'Cycle Analysis')}
                >
                  <div className="text-xs text-gray-400 w-36 flex-shrink-0 truncate">{d.dealer}</div>
                  <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full ${color} group-hover:opacity-80 rounded-full transition-all`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                  <div className={`text-xs font-mono w-12 text-right font-bold ${textColor}`}>{d.avgCycleDays}d</div>
                  <div className="text-xs text-gray-600 font-mono w-16 text-right">{d.totalSales} deals</div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" /> &lt;45 days</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-600" /> 45-60 days</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> &gt;60 days</span>
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {drillDown && <ProjectListModal title={drillDown.title} projects={drillDown.projects} onClose={() => setDrillDown(null)} />}
    </div>
  )
}
