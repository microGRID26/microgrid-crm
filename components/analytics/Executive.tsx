'use client'

import { useMemo } from 'react'
import { fmt$, daysAgo, STAGE_LABELS, SLA_THRESHOLDS } from '@/lib/utils'
import { MetricCard, PeriodBar, inRange, STAGE_DAYS_REMAINING, type AnalyticsData } from './shared'

export function Executive({ data }: { data: AnalyticsData }) {
  const { projects, active, complete, funding, period, rampSchedule } = data

  // Period metrics
  const metrics = useMemo(() => {
    const sales = projects.filter(p => inRange(p.sale_date, period))
    const installs = projects.filter(p => inRange(p.install_complete_date ?? (p.stage === 'complete' ? p.stage_date : null), period))
    const cancelled = projects.filter(p => p.disposition === 'Cancelled' && inRange(p.stage_date, period))
    const m2Funded = projects.filter(p => { const f = funding[p.id]; return f && inRange(f.m2_funded_date, period) })
    const m3Funded = projects.filter(p => { const f = funding[p.id]; return f && inRange(f.m3_funded_date, period) })

    const totalPortfolio = active.reduce((s, p) => s + (Number(p.contract) || 0), 0)
    const m2Val = m2Funded.reduce((s, p) => { const f = funding[p.id]; return s + (Number(f?.m2_amount) || 0) }, 0)
    const m3Val = m3Funded.reduce((s, p) => { const f = funding[p.id]; return s + (Number(f?.m3_amount) || 0) }, 0)

    // Cash collectable now
    let m1Collectable = 0, m2Collectable = 0, m3Collectable = 0
    let m1Count = 0, m2Count = 0, m3Count = 0
    for (const p of projects) {
      const f = funding[p.id]
      if (p.sale_date && (!f || f.m1_status !== 'Funded') && f?.m1_status !== 'Submitted') { m1Collectable += Number(f?.m1_amount ?? 0); m1Count++ }
      if (p.install_complete_date && f && f.m2_status !== 'Funded' && f.m2_status !== 'Submitted') { m2Collectable += Number(f.m2_amount ?? 0); m2Count++ }
      if (p.pto_date && f && f.m3_status !== 'Funded' && f.m3_status !== 'Submitted') { m3Collectable += Number(f.m3_amount ?? 0); m3Count++ }
    }

    // Revenue collected this period
    const revenueCollected = m2Val + m3Val

    // Avg cycle time (sale to install for completed installs)
    const withInstall = projects.filter(p => p.sale_date && p.install_complete_date)
    const avgCycle = withInstall.length > 0
      ? Math.round(withInstall.reduce((s, p) => {
          const sale = new Date(p.sale_date! + 'T00:00:00').getTime()
          const inst = new Date(p.install_complete_date! + 'T00:00:00').getTime()
          return s + (inst - sale) / 86400000
        }, 0) / withInstall.length)
      : 0

    // Blocked projects + value at risk
    const blocked = active.filter(p => p.blocker)
    const atRisk = blocked.reduce((s, p) => s + (Number(p.contract) || 0), 0)

    // Forecast
    const next30 = active.filter(p => (STAGE_DAYS_REMAINING[p.stage] ?? 60) <= 30)
    const next30Value = next30.reduce((s, p) => s + (Number(p.contract) || 0), 0)
    const next90 = active.filter(p => (STAGE_DAYS_REMAINING[p.stage] ?? 60) <= 90)
    const next90Value = next90.reduce((s, p) => s + (Number(p.contract) || 0), 0)

    // Pipeline by stage
    const stageBreakdown = ['evaluation', 'survey', 'design', 'permit', 'install', 'inspection', 'complete'].map(stage => {
      const ps = projects.filter(p => p.stage === stage)
      return {
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        count: ps.length,
        value: ps.reduce((s, p) => s + (Number(p.contract) || 0), 0),
        blockedCount: ps.filter(p => p.blocker).length,
        avgDays: ps.length > 0 ? Math.round(ps.reduce((s, p) => s + daysAgo(p.stage_date), 0) / ps.length) : 0,
      }
    }).filter(s => s.count > 0)
    const maxStageCount = Math.max(...stageBreakdown.map(s => s.count), 1)

    // Key metrics summary
    const cancelRate = sales.length > 0 ? Math.round((cancelled.length / sales.length) * 100) : 0
    const avgDealSize = sales.length > 0 ? Math.round(sales.reduce((s, p) => s + (Number(p.contract) || 0), 0) / sales.length) : 0
    const avgKw = sales.length > 0 ? Math.round(sales.reduce((s, p) => s + (Number(p.systemkw) || 0), 0) / sales.length * 10) / 10 : 0
    const totalBatteries = sales.reduce((s, p) => s + (Number(p.battery_qty) || 0), 0)
    const avgCycleDays = avgCycle

    // Top performers
    const dealerCounts: Record<string, number> = {}
    sales.forEach(p => { if (p.dealer) dealerCounts[p.dealer] = (dealerCounts[p.dealer] ?? 0) + 1 })
    const topDealer = Object.entries(dealerCounts).sort((a, b) => b[1] - a[1])[0] ?? null

    const pmInstallCounts: Record<string, number> = {}
    installs.forEach(p => { if (p.pm) pmInstallCounts[p.pm] = (pmInstallCounts[p.pm] ?? 0) + 1 })
    const topPM = Object.entries(pmInstallCounts).sort((a, b) => b[1] - a[1])[0] ?? null

    const crewCompletions: Record<string, number> = {}
    if (rampSchedule) {
      rampSchedule.filter(r => r.status === 'completed' || r.completed_at).forEach(r => {
        if (r.crew_name) crewCompletions[r.crew_name] = (crewCompletions[r.crew_name] ?? 0) + 1
      })
    }
    const topCrew = Object.entries(crewCompletions).sort((a, b) => b[1] - a[1])[0] ?? null

    // Portfolio health
    const onTrack = active.filter(p => {
      const t = SLA_THRESHOLDS[p.stage] ?? { crit: 7, risk: 5 }
      return daysAgo(p.stage_date) < t.risk
    })
    const blockedPct = active.length > 0 ? Math.round((blocked.length / active.length) * 100) : 0
    const aging90 = active.filter(p => (daysAgo(p.sale_date) || 0) >= 90)
    const agingPct = active.length > 0 ? Math.round((aging90.length / active.length) * 100) : 0
    const onTrackPct = active.length > 0 ? Math.round((onTrack.length / active.length) * 100) : 0

    return {
      sales, installs, cancelled, totalPortfolio,
      revenueCollected, m2Val, m3Val,
      cashCollectable: m1Collectable + m2Collectable + m3Collectable,
      m1Collectable, m2Collectable, m3Collectable,
      m1Count, m2Count, m3Count,
      avgCycle, blocked, atRisk,
      next30, next30Value, next90, next90Value,
      stageBreakdown, maxStageCount,
      // New: key metrics
      cancelRate, avgDealSize, avgKw, totalBatteries, avgCycleDays,
      // New: top performers
      topDealer, topPM, topCrew,
      // New: portfolio health
      onTrackPct, blockedPct, agingPct,
    }
  }, [projects, active, funding, period, rampSchedule])

  const STAGE_COLORS: Record<string, string> = {
    evaluation: '#3b82f6', survey: '#8b5cf6', design: '#ec4899',
    permit: '#f59e0b', install: '#f97316', inspection: '#06b6d4', complete: '#22c55e',
  }

  return (
    <div className="space-y-8">
      {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} onCustomDateChange={data.onCustomDateChange} />}

      {/* Hero: 5 headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Portfolio" value={fmt$(metrics.totalPortfolio)} sub={`${active.length} active projects`}
          formula="SUM of contract values for all active projects (non-cancelled, non-in-service, non-loyalty). Excludes completed projects." />
        <MetricCard label="Cash Collectable" value={fmt$(metrics.cashCollectable)} sub={`${metrics.m1Count + metrics.m2Count + metrics.m3Count} milestones`} color="text-green-400"
          formula={`M1: Projects with sale_date, M1 not yet funded or submitted (${metrics.m1Count} × ${fmt$(metrics.m1Collectable)})\nM2: Projects with install complete, M2 not funded/submitted (${metrics.m2Count} × ${fmt$(metrics.m2Collectable)})\nM3: Projects with PTO date, M3 not funded/submitted (${metrics.m3Count} × ${fmt$(metrics.m3Collectable)})`} />
        <MetricCard label="Revenue Collected" value={fmt$(metrics.revenueCollected)} sub="M2 + M3 this period" color="text-blue-400"
          formula={`SUM of M2 amounts where m2_funded_date falls in selected period (${fmt$(metrics.m2Val)})\n+ SUM of M3 amounts where m3_funded_date falls in selected period (${fmt$(metrics.m3Val)})\n\nOnly counts milestones actually marked as funded with a date in the period.`} />
        <MetricCard label="Avg Cycle Time" value={`${metrics.avgCycle}d`} sub="Sale → Install" color={metrics.avgCycle > 60 ? 'text-amber-400' : 'text-green-400'}
          formula="Average days between sale_date and install_complete_date for all projects that have both dates. Projects still in progress are excluded. Target: <45 days." />
        <MetricCard label="90-Day Forecast" value={fmt$(metrics.next90Value)} sub={`${metrics.next90.length} projects`} color="text-purple-400"
          formula={`Projects where estimated days-to-completion ≤ 90 based on stage:\n• Evaluation: 56 days remaining\n• Survey: 50 days\n• Design: 44 days\n• Permit: 31 days\n• Install: 10 days\n• Inspection: 17 days\n\nSUM of contract values for qualifying projects.`} />
      </div>

      {/* Cash collectable breakdown */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Cash Collectable Now</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">M1 — Contract Signed</div>
            <div className="text-2xl font-bold text-blue-400 font-mono">{fmt$(metrics.m1Collectable)}</div>
            <div className="text-xs text-gray-600">{metrics.m1Count} projects</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">M2 — Install Complete</div>
            <div className="text-2xl font-bold text-amber-400 font-mono">{fmt$(metrics.m2Collectable)}</div>
            <div className="text-xs text-gray-600">{metrics.m2Count} projects</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">M3 — PTO Received</div>
            <div className="text-2xl font-bold text-purple-400 font-mono">{fmt$(metrics.m3Collectable)}</div>
            <div className="text-xs text-gray-600">{metrics.m3Count} projects</div>
          </div>
        </div>
      </div>

      {/* Risk + bottleneck */}
      {metrics.blocked.length > 0 && (
        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">Revenue at Risk</div>
            <div className="text-2xl font-bold text-red-400 font-mono">{fmt$(metrics.atRisk)}</div>
          </div>
          <div className="text-sm text-gray-300">{metrics.blocked.length} projects blocked — {fmt$(metrics.atRisk)} in contract value waiting on resolution</div>
        </div>
      )}

      {/* Key Metrics Summary Row */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Key Metrics Summary</div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {[
            { label: 'Sales', value: String(metrics.sales.length), color: 'text-green-400' },
            { label: 'Installs', value: String(metrics.installs.length), color: 'text-blue-400' },
            { label: 'Cancelled', value: String(metrics.cancelled.length), color: 'text-red-400' },
            { label: 'Cancel Rate', value: `${metrics.cancelRate}%`, color: metrics.cancelRate > 15 ? 'text-red-400' : 'text-gray-300' },
            { label: 'Avg Deal', value: fmt$(metrics.avgDealSize), color: 'text-white' },
            { label: 'Avg kW', value: `${metrics.avgKw}`, color: 'text-white' },
            { label: 'Batteries', value: String(metrics.totalBatteries), color: 'text-purple-400' },
            { label: 'Avg Cycle', value: `${metrics.avgCycleDays}d`, color: metrics.avgCycleDays > 60 ? 'text-amber-400' : 'text-green-400' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{m.label}</div>
              <div className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Top Dealer (Sales)</div>
          {metrics.topDealer ? (
            <>
              <div className="text-sm font-bold text-white truncate">{metrics.topDealer[0]}</div>
              <div className="text-xs text-green-400 font-mono">{metrics.topDealer[1]} sales</div>
            </>
          ) : <div className="text-xs text-gray-600">No data</div>}
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Top PM (Installs)</div>
          {metrics.topPM ? (
            <>
              <div className="text-sm font-bold text-white truncate">{metrics.topPM[0]}</div>
              <div className="text-xs text-blue-400 font-mono">{metrics.topPM[1]} installs</div>
            </>
          ) : <div className="text-xs text-gray-600">No data</div>}
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Top Crew (Completions)</div>
          {metrics.topCrew ? (
            <>
              <div className="text-sm font-bold text-white truncate">{metrics.topCrew[0]}</div>
              <div className="text-xs text-amber-400 font-mono">{metrics.topCrew[1]} completed</div>
            </>
          ) : <div className="text-xs text-gray-600">No data</div>}
        </div>
      </div>

      {/* Portfolio Health */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Portfolio Health</div>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-green-400">On Track (within SLA)</span>
              <span className="text-xs text-gray-400 font-mono">{metrics.onTrackPct}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${metrics.onTrackPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-red-400">Blocked</span>
              <span className="text-xs text-gray-400 font-mono">{metrics.blockedPct}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${metrics.blockedPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-400">Aging (&gt;90d cycle)</span>
              <span className="text-xs text-gray-400 font-mono">{metrics.agingPct}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${metrics.agingPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Pipeline by Stage</div>
        <div className="space-y-2">
          {metrics.stageBreakdown.map(s => (
            <div key={s.stage} className="flex items-center gap-3">
              <div className="w-24 text-right flex-shrink-0">
                <div className="text-xs font-medium" style={{ color: STAGE_COLORS[s.stage] }}>{s.label}</div>
              </div>
              <div className="flex-1">
                <div className="h-8 rounded-lg bg-gray-700/50 overflow-hidden">
                  <div className="h-full rounded-lg flex items-center justify-between px-3"
                    style={{ width: `${Math.max((s.count / metrics.maxStageCount) * 100, 12)}%`, backgroundColor: `${STAGE_COLORS[s.stage]}15`, borderLeft: `3px solid ${STAGE_COLORS[s.stage]}` }}>
                    <span className="text-xs font-bold text-white">{s.count}</span>
                    <span className="text-xs text-gray-400 font-mono hidden sm:inline">{fmt$(s.value)}</span>
                  </div>
                </div>
              </div>
              <div className="w-20 text-right flex-shrink-0">
                <div className="text-xs text-gray-500">avg {s.avgDays}d</div>
                {s.blockedCount > 0 && <div className="text-[10px] text-red-400">{s.blockedCount} blocked</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
