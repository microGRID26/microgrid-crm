'use client'

import { useMemo } from 'react'
import { fmt$, daysAgo, STAGE_LABELS, STAGE_ORDER } from '@/lib/utils'
import { MetricCard, PeriodBar, type AnalyticsData, STAGE_DAYS_REMAINING } from './shared'
import type { Project } from '@/types/database'

const ANNUAL_TARGET = 200

// ── Sub-components for new dense sections ───────────────────────────────────

function MonthlyProjectionTable({ active, funding, crewDemand }: {
  active: Project[];
  funding: Record<string, any>;
  crewDemand: { crewCount: number } | null;
}) {
  const rows = useMemo(() => {
    const now = new Date()
    let cumRevenue = 0
    return Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59)
      const label = start.toLocaleString('default', { month: 'short', year: '2-digit' })

      let expInstalls = 0, expRevenue = 0, m2Collections = 0, m3Collections = 0
      for (const p of active) {
        const daysRemaining = STAGE_DAYS_REMAINING[p.stage] ?? 60
        const estComplete = new Date(now.getTime() + daysRemaining * 86400000)
        const contract = Number(p.contract) || 0
        if (estComplete >= start && estComplete <= end) {
          expInstalls++
          expRevenue += contract
          const f = funding[p.id]
          m2Collections += Number(f?.m2_amount) || contract * 0.8
        }
        // M3 ~ 21 days after install
        const estPTO = new Date(now.getTime() + (daysRemaining + 21) * 86400000)
        if (estPTO >= start && estPTO <= end) {
          const f = funding[p.id]
          m3Collections += Number(f?.m3_amount) || contract * 0.1
        }
      }
      cumRevenue += expRevenue
      const crewNeeded = expInstalls > 0 ? Math.ceil(expInstalls / 8) : (crewDemand?.crewCount ?? 1)
      return { label, expInstalls, expRevenue, m2Collections, m3Collections, crewNeeded, cumRevenue }
    })
  }, [active, funding, crewDemand])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Monthly Projection — Next 6 Months</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-500 font-medium px-2 py-1.5">Month</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Exp. Installs</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Exp. Revenue</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">M2 Collections</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">M3 Collections</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Crew Needed</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Cumulative Rev</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-2 py-1.5 text-white font-medium">{r.label}</td>
                <td className="px-2 py-1.5 text-green-400 font-mono text-right font-bold">{r.expInstalls}</td>
                <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(r.expRevenue)}</td>
                <td className="px-2 py-1.5 text-amber-400 font-mono text-right">{fmt$(r.m2Collections)}</td>
                <td className="px-2 py-1.5 text-purple-400 font-mono text-right">{fmt$(r.m3Collections)}</td>
                <td className="px-2 py-1.5 text-blue-400 font-mono text-right">{r.crewNeeded}</td>
                <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(r.cumRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StageFlowRates({ projects }: { projects: Project[] }) {
  const stages = STAGE_ORDER.filter(s => s !== 'complete')
  const flowData = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)

    return stages.map(stage => {
      const inStage = projects.filter(p => p.stage === stage && p.disposition !== 'Cancelled' && p.disposition !== 'In Service')
      // Entering: projects that moved INTO this stage in last 30d (proxy: stage_date in last 30d and current stage matches)
      const entering = inStage.filter(p => p.stage_date && p.stage_date >= thirtyDaysAgoStr).length
      // Leaving: projects that were in this stage but moved on (proxy: projects in later stages with stage_date in last 30d)
      const stageIdx = STAGE_ORDER.indexOf(stage)
      const laterStages = STAGE_ORDER.slice(stageIdx + 1)
      const leaving = projects.filter(p =>
        laterStages.includes(p.stage) && p.stage_date && p.stage_date >= thirtyDaysAgoStr
      ).length
      const netFlow = entering - leaving
      const avgDays = inStage.length > 0
        ? Math.round(inStage.reduce((s, p) => s + (daysAgo(p.stage_date) || 0), 0) / inStage.length)
        : 0
      return {
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        current: inStage.length,
        entering,
        leaving,
        netFlow,
        avgDays,
      }
    })
  }, [projects])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Stage Flow Rates — Last 30 Days</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-500 font-medium px-2 py-1.5">Stage</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Current</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Entering/mo</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Leaving/mo</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Net Flow</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Days</th>
              <th className="text-left text-gray-500 font-medium px-2 py-1.5 w-24">Bottleneck?</th>
            </tr>
          </thead>
          <tbody>
            {flowData.map(r => {
              const isBottleneck = r.netFlow > 3 && r.avgDays > 14
              return (
                <tr key={r.stage} className={`border-b border-gray-700/50 ${isBottleneck ? 'bg-red-950/20' : ''}`}>
                  <td className="px-2 py-1.5 text-white font-medium">{r.label}</td>
                  <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{r.current}</td>
                  <td className="px-2 py-1.5 text-green-400 font-mono text-right">{r.entering}</td>
                  <td className="px-2 py-1.5 text-blue-400 font-mono text-right">{r.leaving}</td>
                  <td className={`px-2 py-1.5 font-mono text-right font-bold ${r.netFlow > 0 ? 'text-red-400' : r.netFlow < 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {r.netFlow > 0 ? '+' : ''}{r.netFlow}
                  </td>
                  <td className={`px-2 py-1.5 font-mono text-right ${r.avgDays > 20 ? 'text-red-400' : r.avgDays > 10 ? 'text-amber-400' : 'text-green-400'}`}>
                    {r.avgDays}d
                  </td>
                  <td className="px-2 py-1.5">
                    {isBottleneck ? (
                      <span className="text-[10px] text-red-400 font-medium">GROWING</span>
                    ) : r.netFlow > 0 ? (
                      <span className="text-[10px] text-amber-400">Watch</span>
                    ) : (
                      <span className="text-[10px] text-green-400">OK</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-gray-600">
        Positive net flow = more entering than leaving (stage is accumulating). Red &quot;GROWING&quot; = net flow &gt; 3 and avg days &gt; 14.
      </div>
    </div>
  )
}

function AnnualSummary({ projects, installsYTD, daysElapsed }: { projects: Project[]; installsYTD: number; daysElapsed: number }) {
  const summary = useMemo(() => {
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // YTD revenue collected
    const ytdCompleted = projects.filter(p => {
      const d = p.install_complete_date
      if (!d) return false
      return new Date(d + 'T00:00:00') >= yearStart && new Date(d + 'T00:00:00') <= now
    })
    const ytdRevenue = ytdCompleted.reduce((s, p) => s + (Number(p.contract) || 0), 0)

    // Projected year-end
    const projectedInstalls = daysElapsed > 0 ? Math.round((installsYTD / daysElapsed) * 365) : 0
    const avgContract = ytdCompleted.length > 0 ? ytdRevenue / ytdCompleted.length : 0
    const projectedRevenue = projectedInstalls * avgContract

    // Target comparison
    const targetRevenue = ANNUAL_TARGET * avgContract
    const installPct = Math.round((installsYTD / ANNUAL_TARGET) * 100)
    const revenuePct = targetRevenue > 0 ? Math.round((ytdRevenue / targetRevenue) * 100) : 0

    // YTD sales
    const ytdSales = projects.filter(p => {
      if (!p.sale_date) return false
      return new Date(p.sale_date + 'T00:00:00') >= yearStart && new Date(p.sale_date + 'T00:00:00') <= now
    }).length

    // YTD cancels
    const ytdCancels = projects.filter(p => {
      if (p.disposition !== 'Cancelled') return false
      const sd = p.stage_date ? new Date(p.stage_date + 'T00:00:00') : null
      return sd && sd >= yearStart && sd <= now
    }).length

    return { ytdRevenue, projectedInstalls, projectedRevenue, targetRevenue, installPct, revenuePct, ytdSales, ytdCancels, avgContract }
  }, [projects, installsYTD, daysElapsed])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Annual Summary — {new Date().getFullYear()}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 mb-1">YTD Installs</div>
          <div className="text-xl font-bold text-green-400 font-mono">{installsYTD}</div>
          <div className="text-[10px] text-gray-600">{summary.installPct}% of {ANNUAL_TARGET} target</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 mb-1">YTD Revenue</div>
          <div className="text-xl font-bold text-white font-mono">{fmt$(summary.ytdRevenue)}</div>
          <div className="text-[10px] text-gray-600">{summary.revenuePct}% of target</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 mb-1">Proj. Year-End Installs</div>
          <div className={`text-xl font-bold font-mono ${summary.projectedInstalls >= ANNUAL_TARGET ? 'text-green-400' : 'text-red-400'}`}>
            {summary.projectedInstalls}
          </div>
          <div className="text-[10px] text-gray-600">
            {summary.projectedInstalls >= ANNUAL_TARGET ? 'Meets target' : `${ANNUAL_TARGET - summary.projectedInstalls} short`}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 mb-1">Proj. Year-End Revenue</div>
          <div className="text-xl font-bold text-white font-mono">{fmt$(summary.projectedRevenue)}</div>
          <div className="text-[10px] text-gray-600">at {fmt$(summary.avgContract)} avg</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-500 font-medium px-2 py-1.5">Metric</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">YTD Actual</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Annual Target</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">Projected</th>
              <th className="text-right text-gray-500 font-medium px-2 py-1.5">% Complete</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700/50">
              <td className="px-2 py-1.5 text-white font-medium">Installs</td>
              <td className="px-2 py-1.5 text-green-400 font-mono text-right">{installsYTD}</td>
              <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{ANNUAL_TARGET}</td>
              <td className="px-2 py-1.5 text-blue-400 font-mono text-right">{summary.projectedInstalls}</td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <div className="w-16 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${summary.installPct >= 80 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(summary.installPct, 100)}%` }} />
                  </div>
                  <span className="text-gray-300 font-mono">{summary.installPct}%</span>
                </div>
              </td>
            </tr>
            <tr className="border-b border-gray-700/50">
              <td className="px-2 py-1.5 text-white font-medium">Revenue</td>
              <td className="px-2 py-1.5 text-green-400 font-mono text-right">{fmt$(summary.ytdRevenue)}</td>
              <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(summary.targetRevenue)}</td>
              <td className="px-2 py-1.5 text-blue-400 font-mono text-right">{fmt$(summary.projectedRevenue)}</td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <div className="w-16 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${summary.revenuePct >= 80 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(summary.revenuePct, 100)}%` }} />
                  </div>
                  <span className="text-gray-300 font-mono">{summary.revenuePct}%</span>
                </div>
              </td>
            </tr>
            <tr className="border-b border-gray-700/50">
              <td className="px-2 py-1.5 text-white font-medium">New Sales (YTD)</td>
              <td className="px-2 py-1.5 text-green-400 font-mono text-right">{summary.ytdSales}</td>
              <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{'\u2014'}</td>
              <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{'\u2014'}</td>
              <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{'\u2014'}</td>
            </tr>
            <tr className="border-b border-gray-700/50">
              <td className="px-2 py-1.5 text-white font-medium">Cancellations (YTD)</td>
              <td className="px-2 py-1.5 text-red-400 font-mono text-right">{summary.ytdCancels}</td>
              <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{'\u2014'}</td>
              <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{'\u2014'}</td>
              <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{'\u2014'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Forecasting({ data }: { data: AnalyticsData }) {
  const { projects, active, funding, rampSchedule, period } = data

  // ── Headline metrics ────────────────────────────────────────────────────────
  const headlines = useMemo(() => {
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const forecast = (maxDays: number) => {
      const qualifying = active.filter(p => (STAGE_DAYS_REMAINING[p.stage] ?? 60) <= maxDays)
      return {
        count: qualifying.length,
        value: qualifying.reduce((s, p) => s + (Number(p.contract) || 0), 0),
      }
    }

    const f30 = forecast(30)
    const f60 = forecast(60)
    const f90 = forecast(90)

    // On/Off Track: installs YTD vs linear projection
    const installsYTD = projects.filter(p => {
      const d = p.install_complete_date
      if (!d) return false
      const dt = new Date(d + 'T00:00:00')
      return dt >= yearStart && dt <= now
    }).length

    const daysElapsed = Math.max(1, Math.floor((now.getTime() - yearStart.getTime()) / 86400000))
    const expectedByNow = Math.round((ANNUAL_TARGET / 365) * daysElapsed)
    const onTrack = installsYTD >= expectedByNow
    const gap = expectedByNow - installsYTD

    return { f30, f60, f90, installsYTD, expectedByNow, onTrack, gap, daysElapsed }
  }, [projects, active])

  // ── Revenue Waterfall (6-month forward) ─────────────────────────────────────
  const waterfall = useMemo(() => {
    const now = new Date()
    const months: { label: string; start: Date; end: Date; value: number; count: number }[] = []

    for (let i = 0; i < 6; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59)
      months.push({
        label: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
        start, end, value: 0, count: 0,
      })
    }

    for (const p of active) {
      const daysRemaining = STAGE_DAYS_REMAINING[p.stage] ?? 60
      const estComplete = new Date(now.getTime() + daysRemaining * 86400000)
      for (const m of months) {
        if (estComplete >= m.start && estComplete <= m.end) {
          m.value += Number(p.contract) || 0
          m.count++
          break
        }
      }
    }

    const maxValue = Math.max(...months.map(m => m.value), 1)
    return { months, maxValue }
  }, [active])

  // ── Cash Flow Timeline (M1/M2/M3 stacked) ──────────────────────────────────
  const cashFlow = useMemo(() => {
    const now = new Date()
    const months: { label: string; start: Date; end: Date; m1: number; m2: number; m3: number }[] = []

    for (let i = 0; i < 6; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59)
      months.push({
        label: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
        start, end, m1: 0, m2: 0, m3: 0,
      })
    }

    for (const p of active) {
      const contract = Number(p.contract) || 0
      if (contract === 0) continue
      const f = funding[p.id]

      // M1 at sale (for projects entering pipeline — use sale_date if recent, else skip)
      const saleDate = p.sale_date ? new Date(p.sale_date + 'T00:00:00') : null
      if (saleDate) {
        for (const m of months) {
          if (saleDate >= m.start && saleDate <= m.end) {
            m.m1 += Number(f?.m1_amount) || contract * 0.1
            break
          }
        }
      }

      // M2 at install_complete (use waterfall projected date)
      const daysRemaining = STAGE_DAYS_REMAINING[p.stage] ?? 60
      const estInstall = new Date(now.getTime() + daysRemaining * 86400000)
      for (const m of months) {
        if (estInstall >= m.start && estInstall <= m.end) {
          m.m2 += Number(f?.m2_amount) || contract * 0.8
          break
        }
      }

      // M3 at PTO (~21 days after install)
      const estPTO = p.pto_date
        ? new Date(p.pto_date + 'T00:00:00')
        : new Date(estInstall.getTime() + 21 * 86400000)
      for (const m of months) {
        if (estPTO >= m.start && estPTO <= m.end) {
          m.m3 += Number(f?.m3_amount) || contract * 0.1
          break
        }
      }
    }

    const maxValue = Math.max(...months.map(m => m.m1 + m.m2 + m.m3), 1)
    return { months, maxValue }
  }, [active, funding])

  // ── On-Track Gauge ──────────────────────────────────────────────────────────
  const gauge = useMemo(() => {
    const { installsYTD, daysElapsed } = headlines
    const projected = Math.round((installsYTD / daysElapsed) * 365)
    const pctOfTarget = Math.min(Math.round((installsYTD / ANNUAL_TARGET) * 100), 100)
    const status: 'green' | 'amber' | 'red' =
      projected >= ANNUAL_TARGET ? 'green'
        : projected >= ANNUAL_TARGET * 0.9 ? 'amber'
          : 'red'
    return { projected, pctOfTarget, status }
  }, [headlines])

  // ── Crew Demand Curve ───────────────────────────────────────────────────────
  const crewDemand = useMemo(() => {
    if (!rampSchedule || rampSchedule.length === 0) return null

    const uniqueCrews = new Set(rampSchedule.map(r => r.crew_name).filter(Boolean))
    const installCapacity = uniqueCrews.size * 2 // 2 installs per crew per week

    // Sales inflow: trailing 4 weeks
    const now = new Date()
    const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000)
    const recentSales = projects.filter(p => {
      if (!p.sale_date) return false
      const d = new Date(p.sale_date + 'T00:00:00')
      return d >= fourWeeksAgo && d <= now
    }).length
    const salesPerWeek = Math.round((recentSales / 4) * 10) / 10

    // Avg cycle time from sale to install
    const withInstall = projects.filter(p => p.sale_date && p.install_complete_date)
    const avgCycleWeeks = withInstall.length > 0
      ? Math.round(withInstall.reduce((s, p) => {
        const sale = new Date(p.sale_date! + 'T00:00:00').getTime()
        const inst = new Date(p.install_complete_date! + 'T00:00:00').getTime()
        return s + (inst - sale) / (7 * 86400000)
      }, 0) / withInstall.length)
      : 8

    const pipelineInstallsPerWeek = salesPerWeek // after cycle time, sales become installs
    const arrivalMonth = new Date(now.getTime() + avgCycleWeeks * 7 * 86400000)
      .toLocaleString('default', { month: 'long' })

    const crewsNeeded = pipelineInstallsPerWeek > 0
      ? Math.ceil(pipelineInstallsPerWeek / 2)
      : uniqueCrews.size

    const needMoreBy = crewsNeeded > uniqueCrews.size
      ? arrivalMonth : null

    return {
      crewCount: uniqueCrews.size,
      installCapacity,
      salesPerWeek,
      pipelineInstallsPerWeek,
      avgCycleWeeks,
      arrivalMonth,
      crewsNeeded,
      needMoreBy,
    }
  }, [projects, rampSchedule])

  // ── Scenario Modeling ───────────────────────────────────────────────────────
  const scenarios = useMemo(() => {
    const now = new Date()
    const yearEnd = new Date(now.getFullYear(), 11, 31)
    const daysRemaining = Math.max(1, Math.floor((yearEnd.getTime() - now.getTime()) / 86400000))
    const { installsYTD, daysElapsed } = headlines

    // Current pace: installs per day
    const pacePerDay = daysElapsed > 0 ? installsYTD / daysElapsed : 0

    const buildScenario = (label: string, multiplier: number) => {
      const adjustedPace = pacePerDay * multiplier
      const additionalInstalls = Math.round(adjustedPace * daysRemaining)
      const totalInstalls = installsYTD + additionalInstalls
      // avg contract value from active projects
      const avgContract = active.length > 0
        ? active.reduce((s, p) => s + (Number(p.contract) || 0), 0) / active.length
        : 0
      const projectedRevenue = totalInstalls * avgContract
      const crewsNeeded = adjustedPace > 0 ? Math.ceil((adjustedPace * 7) / 2) : 0
      return { label, multiplier, totalInstalls, projectedRevenue, crewsNeeded }
    }

    return [
      buildScenario('Conservative', 0.8),
      buildScenario('Base', 1.0),
      buildScenario('Aggressive', 1.2),
    ]
  }, [headlines, active])

  // ── Pipeline Risk Analysis ──────────────────────────────────────────────────
  const pipelineRisk = useMemo(() => {
    // Projects blocked > 30 days
    const now = new Date()
    const atRisk = active.filter(p => {
      if (!p.blocker) return false
      const stageDate = p.stage_date ? new Date(p.stage_date + 'T00:00:00') : null
      if (!stageDate) return false
      const daysBlocked = Math.floor((now.getTime() - stageDate.getTime()) / 86400000)
      return daysBlocked > 30
    })
    const atRiskValue = atRisk.reduce((s, p) => s + (Number(p.contract) || 0), 0)

    // Historical cancel rate
    const cancelled = projects.filter(p => p.disposition === 'Cancelled')
    const totalEver = projects.length
    const cancelRate = totalEver > 0 ? Math.round((cancelled.length / totalEver) * 100) : 0

    return { atRisk, atRiskValue, cancelRate, cancelledCount: cancelled.length, totalEver }
  }, [active, projects])

  // ── Permit Bottleneck Forecast ──────────────────────────────────────────────
  const permitForecast = useMemo(() => {
    const now = new Date()
    const permitProjects = active.filter(p => p.stage === 'permit')
    const count = permitProjects.length

    // Avg days in permit
    const avgDaysInPermit = count > 0
      ? Math.round(permitProjects.reduce((s, p) => s + daysAgo(p.stage_date), 0) / count)
      : 0

    // Permit velocity: projects that left permit stage this month vs last month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    // Projects currently in install/inspection/complete that were in permit recently
    const postPermit = projects.filter(p =>
      ['install', 'inspection', 'complete'].includes(p.stage)
    )

    const exitedThisMonth = postPermit.filter(p => {
      // Approximate: projects in install+ whose stage_date is this month
      if (!p.stage_date) return false
      const d = new Date(p.stage_date + 'T00:00:00')
      return d >= thisMonthStart && d <= now && p.stage === 'install'
    }).length

    const exitedLastMonth = postPermit.filter(p => {
      if (!p.stage_date) return false
      const d = new Date(p.stage_date + 'T00:00:00')
      return d >= lastMonthStart && d <= lastMonthEnd && p.stage === 'install'
    }).length

    // At current velocity, when does backlog clear?
    const velocityPerWeek = exitedThisMonth > 0
      ? Math.round((exitedThisMonth / Math.max(1, now.getDate())) * 7 * 10) / 10
      : exitedLastMonth > 0
        ? Math.round((exitedLastMonth / 30) * 7 * 10) / 10
        : 0

    const weeksToClear = velocityPerWeek > 0 ? Math.ceil(count / velocityPerWeek) : 0
    const clearDate = weeksToClear > 0
      ? new Date(now.getTime() + weeksToClear * 7 * 86400000)
      : null

    const trending = exitedThisMonth > 0 && exitedLastMonth > 0
      ? exitedThisMonth > exitedLastMonth ? 'improving' : exitedThisMonth < exitedLastMonth ? 'worsening' : 'stable'
      : 'insufficient_data'

    return { count, avgDaysInPermit, velocityPerWeek, weeksToClear, clearDate, trending, exitedThisMonth, exitedLastMonth }
  }, [active, projects])

  // ── Cash Collection DSO ─────────────────────────────────────────────────────
  const dso = useMemo(() => {
    let m2Days: number[] = []
    let m3Days: number[] = []

    for (const p of projects) {
      const f = funding[p.id]
      if (!f) continue

      // M2 DSO: days from install_complete_date to m2_funded_date
      if (p.install_complete_date && f.m2_funded_date) {
        const eligible = new Date(p.install_complete_date + 'T00:00:00').getTime()
        const funded = new Date(f.m2_funded_date + 'T00:00:00').getTime()
        const days = Math.round((funded - eligible) / 86400000)
        if (days >= 0 && days < 365) m2Days.push(days)
      }

      // M3 DSO: days from pto_date to m3_funded_date
      if (p.pto_date && f.m3_funded_date) {
        const eligible = new Date(p.pto_date + 'T00:00:00').getTime()
        const funded = new Date(f.m3_funded_date + 'T00:00:00').getTime()
        const days = Math.round((funded - eligible) / 86400000)
        if (days >= 0 && days < 365) m3Days.push(days)
      }
    }

    const avgM2 = m2Days.length > 0 ? Math.round(m2Days.reduce((s, d) => s + d, 0) / m2Days.length) : 0
    const avgM3 = m3Days.length > 0 ? Math.round(m3Days.reduce((s, d) => s + d, 0) / m3Days.length) : 0

    const m2Status: 'green' | 'amber' | 'red' = avgM2 > 45 ? 'red' : avgM2 > 30 ? 'amber' : 'green'
    const m3Status: 'green' | 'amber' | 'red' = avgM3 > 45 ? 'red' : avgM3 > 30 ? 'amber' : 'green'

    return { avgM2, avgM3, m2Count: m2Days.length, m3Count: m3Days.length, m2Status, m3Status }
  }, [projects, funding])

  // ── Bar color helpers ───────────────────────────────────────────────────────
  const waterfallColor = (i: number) =>
    i < 2 ? '#22c55e' : i < 4 ? '#3b82f6' : '#a855f7'

  const gaugeColor =
    gauge.status === 'green' ? 'bg-green-500'
      : gauge.status === 'amber' ? 'bg-amber-500'
        : 'bg-red-500'

  const gaugeTextColor =
    gauge.status === 'green' ? 'text-green-400'
      : gauge.status === 'amber' ? 'text-amber-400'
        : 'text-red-400'

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (active.length === 0 && projects.length === 0) {
    return (
      <div className="max-w-6xl space-y-8">
        {data.onPeriodChange && <PeriodBar period={period} onPeriodChange={data.onPeriodChange} />}
        <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
          <div className="text-gray-500 text-sm">No project data available for forecasting.</div>
          <div className="text-gray-600 text-xs mt-2">Forecasts require active projects with contract values and stage assignments.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-8">
      {data.onPeriodChange && <PeriodBar period={period} onPeriodChange={data.onPeriodChange} />}

      {/* Hero: 4 headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="30-Day Forecast"
          value={fmt$(headlines.f30.value)}
          sub={`${headlines.f30.count} projects`}
          color="text-green-400"
          formula={`SUM of contract values for active projects where estimated days-to-completion <= 30.\n\nStage estimates:\n${Object.entries(STAGE_DAYS_REMAINING).filter(([, d]) => d <= 30).map(([s, d]) => `  ${STAGE_LABELS[s] ?? s}: ${d} days`).join('\n')}\n\nOnly projects in stages with <= 30 days remaining qualify.`}
        />
        <MetricCard
          label="60-Day Forecast"
          value={fmt$(headlines.f60.value)}
          sub={`${headlines.f60.count} projects`}
          color="text-blue-400"
          formula={`SUM of contract values for active projects where estimated days-to-completion <= 60.\n\nStage estimates:\n${Object.entries(STAGE_DAYS_REMAINING).filter(([, d]) => d <= 60).map(([s, d]) => `  ${STAGE_LABELS[s] ?? s}: ${d} days`).join('\n')}\n\nIncludes all 30-day forecast projects plus earlier stages.`}
        />
        <MetricCard
          label="90-Day Forecast"
          value={fmt$(headlines.f90.value)}
          sub={`${headlines.f90.count} projects`}
          color="text-purple-400"
          formula={`SUM of contract values for active projects where estimated days-to-completion <= 90.\n\nStage estimates:\n${Object.entries(STAGE_DAYS_REMAINING).map(([s, d]) => `  ${STAGE_LABELS[s] ?? s}: ${d} days`).join('\n')}\n\nIncludes virtually all active projects except very early evaluation.`}
        />
        <MetricCard
          label="On/Off Track"
          value={headlines.onTrack ? 'On Track' : `Off Track`}
          sub={headlines.onTrack
            ? `${headlines.installsYTD} installs YTD (expected ${headlines.expectedByNow})`
            : `${headlines.gap} behind — ${headlines.installsYTD} actual vs ${headlines.expectedByNow} expected`}
          color={headlines.onTrack ? 'text-green-400' : 'text-red-400'}
          formula={`Compares actual installs YTD vs linear projection.\n\nActual installs YTD: ${headlines.installsYTD} (projects with install_complete_date this year)\nDays elapsed: ${headlines.daysElapsed}\nExpected by now: (${ANNUAL_TARGET} target / 365) x ${headlines.daysElapsed} days = ${headlines.expectedByNow}\n\nOn Track if actual >= expected.`}
        />
      </div>

      {/* Scenario Modeling */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Scenario Modeling — Year-End Projections</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((s, i) => {
            const borderColor = i === 0 ? 'border-amber-900/40' : i === 1 ? 'border-blue-900/40' : 'border-green-900/40'
            const bgColor = i === 0 ? 'bg-amber-950/20' : i === 1 ? 'bg-blue-950/20' : 'bg-green-950/20'
            const textColor = i === 0 ? 'text-amber-400' : i === 1 ? 'text-blue-400' : 'text-green-400'
            const paceLabel = i === 0 ? 'Current pace -20%' : i === 1 ? 'Current pace' : 'Current pace +20%'
            const meetsTarget = s.totalInstalls >= ANNUAL_TARGET
            return (
              <div key={s.label} className={`rounded-lg p-4 border ${borderColor} ${bgColor}`}>
                <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textColor}`}>{s.label}</div>
                <div className="text-[10px] text-gray-500 mb-3">{paceLabel}</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Projected Installs</div>
                    <div className="text-xl font-bold font-mono text-white">{s.totalInstalls}</div>
                    <div className={`text-[10px] ${meetsTarget ? 'text-green-400' : 'text-red-400'}`}>
                      {meetsTarget ? `Meets ${ANNUAL_TARGET} target` : `${ANNUAL_TARGET - s.totalInstalls} short of ${ANNUAL_TARGET} target`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Projected Revenue</div>
                    <div className="text-lg font-bold font-mono text-white">{fmt$(s.projectedRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Crews Needed</div>
                    <div className="text-lg font-bold font-mono text-white">{s.crewsNeeded}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline Risk Analysis */}
      <div className={`rounded-xl p-5 border ${
        pipelineRisk.atRiskValue > 500000
          ? 'bg-red-950/20 border-red-900/30'
          : pipelineRisk.atRisk.length > 0
            ? 'bg-amber-950/20 border-amber-900/30'
            : 'bg-gray-800 border-gray-700'
      }`}>
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Pipeline Risk Analysis</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">At-Risk Projects</div>
            <div className={`text-2xl font-bold font-mono ${pipelineRisk.atRisk.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {pipelineRisk.atRisk.length}
            </div>
            <div className="text-[10px] text-gray-600">Blocked &gt; 30 days</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">Revenue at Risk</div>
            <div className={`text-2xl font-bold font-mono ${pipelineRisk.atRiskValue > 500000 ? 'text-red-400' : pipelineRisk.atRiskValue > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {fmt$(pipelineRisk.atRiskValue)}
            </div>
            <div className="text-[10px] text-gray-600">Contract value exposed</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">Historical Cancel Rate</div>
            <div className="text-2xl font-bold font-mono text-white">{pipelineRisk.cancelRate}%</div>
            <div className="text-[10px] text-gray-600">{pipelineRisk.cancelledCount} of {pipelineRisk.totalEver} total</div>
          </div>
        </div>
        {pipelineRisk.atRisk.length > 0 && (
          <div className="mt-3 text-sm text-gray-300">
            <span className={pipelineRisk.atRiskValue > 500000 ? 'text-red-400 font-medium' : 'text-amber-400'}>
              {pipelineRisk.atRisk.length} project{pipelineRisk.atRisk.length !== 1 ? 's' : ''} at risk of cancellation
            </span>
            , representing {fmt$(pipelineRisk.atRiskValue)} in potential lost revenue.
            {pipelineRisk.cancelRate > 10 && (
              <span className="text-red-400"> Historical cancel rate of {pipelineRisk.cancelRate}% suggests elevated attrition risk.</span>
            )}
          </div>
        )}
      </div>

      {/* Permit Bottleneck Forecast */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Permit Bottleneck Forecast</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">In Permit</div>
            <div className="text-xl font-bold text-amber-400 font-mono">{permitForecast.count}</div>
            <div className="text-[10px] text-gray-600">projects</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Avg Days in Permit</div>
            <div className={`text-xl font-bold font-mono ${permitForecast.avgDaysInPermit > 30 ? 'text-red-400' : permitForecast.avgDaysInPermit > 20 ? 'text-amber-400' : 'text-green-400'}`}>
              {permitForecast.avgDaysInPermit}
            </div>
            <div className="text-[10px] text-gray-600">days</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Permit Velocity</div>
            <div className="text-xl font-bold text-blue-400 font-mono">{permitForecast.velocityPerWeek}</div>
            <div className="text-[10px] text-gray-600">exits/week</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Backlog Clears</div>
            <div className="text-xl font-bold text-white font-mono">
              {permitForecast.clearDate
                ? permitForecast.clearDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '--'
              }
            </div>
            <div className="text-[10px] text-gray-600">
              {permitForecast.weeksToClear > 0 ? `~${permitForecast.weeksToClear} weeks` : 'N/A'}
            </div>
          </div>
        </div>
        {permitForecast.trending !== 'insufficient_data' && (
          <div className={`text-sm px-3 py-2 rounded-lg ${
            permitForecast.trending === 'worsening' ? 'bg-red-950/30 text-red-400'
              : permitForecast.trending === 'improving' ? 'bg-green-950/30 text-green-400'
                : 'bg-gray-900 text-gray-400'
          }`}>
            {permitForecast.trending === 'worsening' && (
              <>Permit throughput declining: {permitForecast.exitedThisMonth} exits this month vs {permitForecast.exitedLastMonth} last month. Bottleneck may be growing.</>
            )}
            {permitForecast.trending === 'improving' && (
              <>Permit throughput improving: {permitForecast.exitedThisMonth} exits this month vs {permitForecast.exitedLastMonth} last month.</>
            )}
            {permitForecast.trending === 'stable' && (
              <>Permit throughput stable at ~{permitForecast.exitedThisMonth} exits/month.</>
            )}
          </div>
        )}
      </div>

      {/* Cash Collection DSO */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Cash Collection — Days Sales Outstanding</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-lg p-4 border ${
            dso.m2Status === 'red' ? 'bg-red-950/20 border-red-900/30'
              : dso.m2Status === 'amber' ? 'bg-amber-950/20 border-amber-900/30'
                : 'bg-gray-900 border-gray-700'
          }`}>
            <div className="text-xs text-gray-500 mb-2">M2 DSO — Install to Funded</div>
            <div className="flex items-end gap-2">
              <div className={`text-3xl font-bold font-mono ${
                dso.m2Status === 'red' ? 'text-red-400' : dso.m2Status === 'amber' ? 'text-amber-400' : 'text-green-400'
              }`}>
                {dso.m2Count > 0 ? dso.avgM2 : '--'}
              </div>
              <div className="text-sm text-gray-500 mb-1">days avg</div>
            </div>
            <div className="text-[10px] text-gray-600 mt-1">Based on {dso.m2Count} funded milestones</div>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  dso.m2Status === 'red' ? 'bg-red-500' : dso.m2Status === 'amber' ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((dso.avgM2 / 60) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>0d</span>
              <span className="text-amber-500">30d</span>
              <span className="text-red-500">45d</span>
              <span>60d</span>
            </div>
          </div>
          <div className={`rounded-lg p-4 border ${
            dso.m3Status === 'red' ? 'bg-red-950/20 border-red-900/30'
              : dso.m3Status === 'amber' ? 'bg-amber-950/20 border-amber-900/30'
                : 'bg-gray-900 border-gray-700'
          }`}>
            <div className="text-xs text-gray-500 mb-2">M3 DSO — PTO to Funded</div>
            <div className="flex items-end gap-2">
              <div className={`text-3xl font-bold font-mono ${
                dso.m3Status === 'red' ? 'text-red-400' : dso.m3Status === 'amber' ? 'text-amber-400' : 'text-green-400'
              }`}>
                {dso.m3Count > 0 ? dso.avgM3 : '--'}
              </div>
              <div className="text-sm text-gray-500 mb-1">days avg</div>
            </div>
            <div className="text-[10px] text-gray-600 mt-1">Based on {dso.m3Count} funded milestones</div>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  dso.m3Status === 'red' ? 'bg-red-500' : dso.m3Status === 'amber' ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((dso.avgM3 / 60) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>0d</span>
              <span className="text-amber-500">30d</span>
              <span className="text-red-500">45d</span>
              <span>60d</span>
            </div>
          </div>
        </div>
        <div className="mt-3 text-[10px] text-gray-600">
          DSO = avg days from milestone eligibility to funded_date. Green &lt; 30d, Amber 30-45d, Red &gt; 45d.
        </div>
      </div>

      {/* Revenue Waterfall */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Revenue Waterfall — 6-Month Forward</div>
          <button
            className="text-gray-600 hover:text-gray-400 transition-colors group relative"
            aria-label="How revenue waterfall is calculated"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="hidden group-hover:block absolute z-50 top-full left-0 mt-1 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl max-w-xs">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Projection Model</div>
              <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                {`For each active project, estimated completion = today + STAGE_DAYS_REMAINING[stage].\n\nProjects are bucketed by their estimated completion month.\nBar shows SUM(contract) for that month.\n\nGreen = months 1-2, Blue = months 3-4, Purple = months 5-6.`}
              </div>
            </div>
          </button>
        </div>
        {waterfall.months.every(m => m.value === 0) ? (
          <div className="text-xs text-gray-500 text-center py-8">No active projects to forecast.</div>
        ) : (
          <div className="flex items-end gap-3 h-48">
            {waterfall.months.map((m, i) => {
              const pct = Math.max((m.value / waterfall.maxValue) * 100, 4)
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs font-mono text-gray-300">{fmt$(m.value)}</div>
                  <div className="w-full flex items-end justify-center" style={{ height: '140px' }}>
                    <div
                      className="w-full max-w-16 rounded-t-lg transition-all"
                      style={{
                        height: `${pct}%`,
                        backgroundColor: waterfallColor(i),
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500">{m.label}</div>
                  <div className="text-[10px] text-gray-600">{m.count} proj</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cash Flow Timeline */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Cash Flow Timeline — M1 / M2 / M3 by Month</div>
        {cashFlow.months.every(m => m.m1 + m.m2 + m.m3 === 0) ? (
          <div className="text-xs text-gray-500 text-center py-8">No cash flow data to project.</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-400" /><span className="text-[10px] text-gray-500">M1 (Contract)</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-400" /><span className="text-[10px] text-gray-500">M2 (Install)</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-purple-400" /><span className="text-[10px] text-gray-500">M3 (PTO)</span></div>
            </div>
            <div className="flex items-end gap-3 h-48">
              {cashFlow.months.map((m) => {
                const total = m.m1 + m.m2 + m.m3
                const pctM1 = total > 0 ? (m.m1 / cashFlow.maxValue) * 100 : 0
                const pctM2 = total > 0 ? (m.m2 / cashFlow.maxValue) * 100 : 0
                const pctM3 = total > 0 ? (m.m3 / cashFlow.maxValue) * 100 : 0
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs font-mono text-gray-300">{fmt$(total)}</div>
                    <div className="w-full flex items-end justify-center" style={{ height: '140px' }}>
                      <div className="w-full max-w-16 flex flex-col-reverse">
                        {pctM1 > 0 && (
                          <div className="w-full rounded-t-none" style={{ height: `${Math.max(pctM1, 2)}px`, backgroundColor: '#60a5fa', minHeight: pctM1 > 0 ? '2px' : '0' }} />
                        )}
                        {pctM2 > 0 && (
                          <div className="w-full" style={{ height: `${Math.max(pctM2, 2)}px`, backgroundColor: '#fbbf24', minHeight: pctM2 > 0 ? '2px' : '0' }} />
                        )}
                        {pctM3 > 0 && (
                          <div className="w-full rounded-t-lg" style={{ height: `${Math.max(pctM3, 2)}px`, backgroundColor: '#c084fc', minHeight: pctM3 > 0 ? '2px' : '0' }} />
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500">{m.label}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* On-Track Gauge */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Annual Install Target</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              <span className="font-bold text-white">{headlines.installsYTD}</span> of <span className="font-bold text-white">{ANNUAL_TARGET}</span> installs completed
            </div>
            <div className={`text-sm font-bold ${gaugeTextColor}`}>
              Projected: {gauge.projected}
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${gaugeColor}`}
              style={{ width: `${gauge.pctOfTarget}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{gauge.pctOfTarget}% of annual target</span>
            <span className={gaugeTextColor}>
              {gauge.status === 'green' && 'On pace to exceed target'}
              {gauge.status === 'amber' && 'Within 10% of target pace'}
              {gauge.status === 'red' && 'Below target pace'}
            </span>
          </div>
        </div>
      </div>

      {/* Crew Demand Curve */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Crew Demand Curve</div>
        {!crewDemand ? (
          <div className="text-xs text-gray-500 text-center py-8">
            No crew data — capacity planning requires ramp-up schedule
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Active Crews</div>
                <div className="text-xl font-bold text-white font-mono">{crewDemand.crewCount}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Capacity</div>
                <div className="text-xl font-bold text-green-400 font-mono">{crewDemand.installCapacity}/wk</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Sales Inflow</div>
                <div className="text-xl font-bold text-blue-400 font-mono">{crewDemand.salesPerWeek}/wk</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Avg Cycle</div>
                <div className="text-xl font-bold text-amber-400 font-mono">{crewDemand.avgCycleWeeks} wks</div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 leading-relaxed">
              Current capacity: <span className="text-white font-medium">{crewDemand.installCapacity} installs/week</span> ({crewDemand.crewCount} crews x 2/week).
              Pipeline delivers: <span className="text-white font-medium">{crewDemand.salesPerWeek} installs/week</span> by <span className="text-white font-medium">{crewDemand.arrivalMonth}</span> (avg {crewDemand.avgCycleWeeks}-week cycle time).
              {crewDemand.needMoreBy ? (
                <span className="text-amber-400 font-medium"> Need crew #{crewDemand.crewsNeeded} by {crewDemand.needMoreBy}.</span>
              ) : (
                <span className="text-green-400 font-medium"> Current crew count is sufficient for projected demand.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Monthly Projection Table ───────────────────────────────────────── */}
      <MonthlyProjectionTable active={active} funding={funding} crewDemand={crewDemand} />

      {/* ── Stage Flow Rates ───────────────────────────────────────────────── */}
      <StageFlowRates projects={projects} />

      {/* ── Annual Summary ─────────────────────────────────────────────────── */}
      <AnnualSummary projects={projects} installsYTD={headlines.installsYTD} daysElapsed={headlines.daysElapsed} />
    </div>
  )
}
