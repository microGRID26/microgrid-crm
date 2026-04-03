'use client'

import { useMemo } from 'react'
import { fmt$, daysAgo, STAGE_LABELS } from '@/lib/utils'
import { MetricCard, PeriodBar, type AnalyticsData, STAGE_DAYS_REMAINING } from './shared'

const ANNUAL_TARGET = 200

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
    </div>
  )
}
