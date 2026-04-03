'use client'

import { useMemo, useState } from 'react'
import { fmt$ } from '@/lib/utils'
import { MetricCard, PeriodBar, ExportButton, downloadCSV, ProjectListModal, type AnalyticsData, type RampScheduleRow, useSortable, SortHeader } from './shared'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Get Monday of the week containing a given date */
function getMonday(d: Date): string {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  return dt.toISOString().slice(0, 10)
}

/** Get Monday N weeks ago */
function getMondayWeeksAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return getMonday(d)
}

/** Format a Monday date as "MMM D" */
function fmtWeek(monday: string): string {
  const d = new Date(monday + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Crew scorecard row type ─────────────────────────────────────────────────

interface CrewRow {
  crew: string
  thisWeek: number
  mtd: number
  completionPct: number
  avgDrive: number
  totalMiles: number
}

// ── Crew colors for chart ───────────────────────────────────────────────────

const CREW_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#f97316', '#14b8a6', '#e11d48', '#a855f7',
]

// ── Component ───────────────────────────────────────────────────────────────

export function CrewPerformance({ data }: { data: AnalyticsData }) {
  const { rampSchedule, workOrders, projects } = data
  const [drillDown, setDrillDown] = useState<{ title: string; projects: typeof projects } | null>(null)

  const currentMonday = getMonday(new Date())
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)

  const metrics = useMemo(() => {
    if (!rampSchedule.length) return null

    // 1. Installs This Week
    const completedThisWeek = rampSchedule.filter(
      r => r.status === 'completed' && r.scheduled_week === currentMonday
    )

    // 2. Completion Rate (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10)
    const recent = rampSchedule.filter(r =>
      r.scheduled_week >= thirtyDaysAgoStr &&
      (r.status === 'completed' || r.status === 'cancelled')
    )
    const recentCompleted = recent.filter(r => r.status === 'completed').length
    const completionRate = recent.length > 0 ? Math.round((recentCompleted / recent.length) * 100) : 0

    // 3. Avg Time on Site (install work orders)
    const installWOs = workOrders.filter(
      wo => wo.type?.toLowerCase().includes('install') && wo.time_on_site_minutes != null && wo.time_on_site_minutes > 0
    )
    const avgTimeOnSite = installWOs.length > 0
      ? installWOs.reduce((s, wo) => s + (wo.time_on_site_minutes ?? 0), 0) / installWOs.length / 60
      : 0

    // 4. Crew Utilization (last 4 weeks)
    const uniqueCrews = [...new Set(rampSchedule.map(r => r.crew_name).filter(Boolean))]
    const fourWeeksAgoStr = getMondayWeeksAgo(4)
    const last4Weeks = rampSchedule.filter(
      r => r.status === 'completed' && r.scheduled_week >= fourWeeksAgoStr && r.scheduled_week < currentMonday
    )
    const crewWeeklyAvg = uniqueCrews.length > 0 && last4Weeks.length > 0
      ? (last4Weeks.length / uniqueCrews.length / 4)
      : 0
    const utilization = Math.round((crewWeeklyAvg / 2) * 100)

    // 5. Capacity Forecast
    const fourWeeksAgoDate = new Date()
    fourWeeksAgoDate.setDate(fourWeeksAgoDate.getDate() - 28)
    const fourWeeksAgoDateStr = fourWeeksAgoDate.toISOString().slice(0, 10)
    const recentSales = projects.filter(p => p.sale_date && p.sale_date >= fourWeeksAgoDateStr)
    const salesPerWeek = Math.round(recentSales.length / 4 * 10) / 10
    const crewCapacity = uniqueCrews.length * 2
    let capacityForecast: string
    let capacityColor: string
    if (salesPerWeek > crewCapacity && crewCapacity > 0) {
      const surplus = salesPerWeek - crewCapacity
      const weeksUntilNeeded = Math.round(crewCapacity / surplus)
      const needDate = new Date()
      needDate.setDate(needDate.getDate() + weeksUntilNeeded * 7)
      const needMonth = needDate.toLocaleDateString('en-US', { month: 'long' })
      capacityForecast = `Need crew #${uniqueCrews.length + 1} by ${needMonth}`
      capacityColor = 'text-red-400'
    } else {
      capacityForecast = 'Capacity OK'
      capacityColor = 'text-green-400'
    }

    // ── Crew Scorecard ────────────────────────────────────────────────────

    const crewRows: CrewRow[] = uniqueCrews.map(crew => {
      const crewEntries = rampSchedule.filter(r => r.crew_name === crew)
      const thisWeek = crewEntries.filter(r => r.status === 'completed' && r.scheduled_week === currentMonday).length
      const mtd = crewEntries.filter(r => r.status === 'completed' && r.scheduled_week >= monthStartStr).length
      const crewRecent = crewEntries.filter(r =>
        r.scheduled_week >= thirtyDaysAgoStr &&
        (r.status === 'completed' || r.status === 'cancelled')
      )
      const crewCompleted = crewRecent.filter(r => r.status === 'completed').length
      const pct = crewRecent.length > 0 ? Math.round((crewCompleted / crewRecent.length) * 100) : 0
      const drives = crewEntries.filter(r => r.drive_minutes != null && r.drive_minutes > 0)
      const avgDrive = drives.length > 0
        ? Math.round(drives.reduce((s, r) => s + (r.drive_minutes ?? 0), 0) / drives.length)
        : 0
      const totalMiles = Math.round(crewEntries.reduce((s, r) => s + (r.distance_miles ?? 0), 0))
      return { crew: crew!, thisWeek, mtd, completionPct: pct, avgDrive, totalMiles }
    })

    // ── 8-Week Trend ──────────────────────────────────────────────────────

    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const monday = getMondayWeeksAgo(7 - i)
      const weekEntries = rampSchedule.filter(r => r.status === 'completed' && r.scheduled_week === monday)
      const byCrew: Record<string, number> = {}
      for (const r of weekEntries) {
        const name = r.crew_name ?? 'Unassigned'
        byCrew[name] = (byCrew[name] ?? 0) + 1
      }
      return { monday, label: fmtWeek(monday), total: weekEntries.length, byCrew }
    })
    const maxWeekTotal = Math.max(...weeklyTrend.map(w => w.total), 1)

    // ── Capacity Planning ─────────────────────────────────────────────────

    // Average cycle time (sale to install)
    const withInstall = projects.filter(p => p.sale_date && p.install_complete_date)
    const avgCycle = withInstall.length > 0
      ? Math.round(withInstall.reduce((s, p) => {
          const sale = new Date(p.sale_date! + 'T00:00:00').getTime()
          const inst = new Date(p.install_complete_date! + 'T00:00:00').getTime()
          return s + (inst - sale) / 86400000
        }, 0) / withInstall.length)
      : 0

    // Pipeline feed rate
    const pipelineFeedRate = avgCycle > 0
      ? Math.round(projects.filter(p => p.stage === 'install' || p.stage === 'inspection').length / (avgCycle / 7) * 10) / 10
      : 0

    const demandExceedsCapacity = salesPerWeek > crewCapacity

    return {
      completedThisWeek,
      completionRate,
      recentCompleted,
      recentTotal: recent.length,
      avgTimeOnSite,
      installWOCount: installWOs.length,
      utilization,
      crewWeeklyAvg: Math.round(crewWeeklyAvg * 10) / 10,
      capacityForecast,
      capacityColor,
      uniqueCrews,
      salesPerWeek,
      crewCapacity,
      crewRows,
      weeklyTrend,
      maxWeekTotal,
      avgCycle,
      pipelineFeedRate,
      demandExceedsCapacity,
    }
  }, [rampSchedule, workOrders, projects, currentMonday, monthStartStr])

  // Sortable table for crew scorecard
  const { sorted: sortedCrews, sortKey, sortDir, toggleSort } = useSortable<CrewRow>(
    metrics?.crewRows ?? [], 'thisWeek', 'desc'
  )

  const handleExport = () => {
    if (!metrics) return
    const headers = ['Crew', 'This Week', 'MTD', 'Completion %', 'Avg Drive (min)', 'Total Miles']
    const rows = (metrics.crewRows).map(r => [
      r.crew, r.thisWeek, r.mtd, `${r.completionPct}%`, r.avgDrive, r.totalMiles,
    ])
    downloadCSV('crew-performance.csv', headers, rows)
  }

  // ── Empty state ─────────────────────────────────────────────────────────

  if (!metrics) {
    return (
      <div className="max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}
        </div>
        <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
          <div className="text-gray-400 text-sm mb-2">No crew schedule data yet</div>
          <div className="text-gray-600 text-xs">Crew performance metrics will appear once ramp schedule entries are created.</div>
        </div>
      </div>
    )
  }

  // ── Crew color map ──────────────────────────────────────────────────────

  const crewColorMap: Record<string, string> = {}
  metrics.uniqueCrews.forEach((c, i) => {
    crewColorMap[c!] = CREW_COLORS[i % CREW_COLORS.length]
  })

  // ── Drill-down helpers ──────────────────────────────────────────────────

  const projectsForIds = (ids: string[]) => {
    const set = new Set(ids)
    return projects.filter(p => set.has(p.id))
  }

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}
        <ExportButton onClick={handleExport} />
      </div>

      {/* 5 Headline MetricCards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="Installs This Week"
          value={String(metrics.completedThisWeek.length)}
          sub={`Week of ${fmtWeek(currentMonday)}`}
          color="text-green-400"
          onClick={() => setDrillDown({
            title: 'Installs This Week',
            projects: projectsForIds(metrics.completedThisWeek.map(r => r.project_id)),
          })}
          formula={`Count of ramp_schedule entries where status='completed' and scheduled_week='${currentMonday}' (current week's Monday).`}
        />
        <MetricCard
          label="Completion Rate"
          value={`${metrics.completionRate}%`}
          sub={`${metrics.recentCompleted}/${metrics.recentTotal} last 30d`}
          color={metrics.completionRate >= 90 ? 'text-green-400' : metrics.completionRate >= 75 ? 'text-amber-400' : 'text-red-400'}
          formula={`Completed installs / (completed + cancelled) over the last 30 days.\n${metrics.recentCompleted} completed out of ${metrics.recentTotal} total = ${metrics.completionRate}%.`}
        />
        <MetricCard
          label="Avg Time on Site"
          value={metrics.installWOCount > 0 ? `${metrics.avgTimeOnSite.toFixed(1)} hrs` : '--'}
          sub={`${metrics.installWOCount} work orders`}
          color="text-blue-400"
          formula={`Mean time_on_site_minutes from work orders where type includes 'install', converted to hours.\n${metrics.installWOCount} qualifying work orders.`}
        />
        <MetricCard
          label="Crew Utilization"
          value={`${metrics.utilization}%`}
          sub={`${metrics.crewWeeklyAvg}/crew/wk vs 2 target`}
          color={metrics.utilization >= 80 ? 'text-green-400' : metrics.utilization >= 60 ? 'text-amber-400' : 'text-red-400'}
          formula={`Avg completed installs per crew per week (last 4 weeks) / target of 2 installs per crew per week.\n${metrics.crewWeeklyAvg} actual avg / 2 target = ${metrics.utilization}%.`}
        />
        <MetricCard
          label="Capacity Forecast"
          value={metrics.capacityForecast}
          sub={`${metrics.salesPerWeek} sales/wk vs ${metrics.crewCapacity} capacity`}
          color={metrics.capacityColor}
          formula={`Sales rate: projects with sale_date in last 28 days / 4 = ${metrics.salesPerWeek}/wk.\nCrew capacity: ${metrics.uniqueCrews.length} crews x 2 installs/wk = ${metrics.crewCapacity}/wk.\n${metrics.demandExceedsCapacity ? 'Demand exceeds capacity — additional crew needed.' : 'Current capacity meets demand.'}`}
        />
      </div>

      {/* Crew Weekly Scorecard */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Crew Weekly Scorecard</div>
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <SortHeader<keyof CrewRow> label="Crew" field="crew" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader<keyof CrewRow> label="This Week" field="thisWeek" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader<keyof CrewRow> label="MTD" field="mtd" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader<keyof CrewRow> label="Completion %" field="completionPct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader<keyof CrewRow> label="Avg Drive (min)" field="avgDrive" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader<keyof CrewRow> label="Total Miles" field="totalMiles" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedCrews.map(r => (
                <tr key={r.crew} className="border-b border-gray-800 hover:bg-gray-750">
                  <td className="px-3 py-2 text-white font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: crewColorMap[r.crew] }} />
                      {r.crew}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.thisWeek}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.mtd}</td>
                  <td className="px-3 py-2">
                    <span className={`font-mono ${r.completionPct >= 90 ? 'text-green-400' : r.completionPct >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                      {r.completionPct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.avgDrive || '--'}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.totalMiles || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8-Week Trend Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">8-Week Install Trend by Crew</div>
          <div className="flex items-center gap-3 flex-wrap">
            {metrics.uniqueCrews.map(c => (
              <div key={c} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: crewColorMap[c!] }} />
                <span className="text-[10px] text-gray-400">{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {metrics.weeklyTrend.map(w => {
            const targetPerCrewPerWeek = 2
            const targetTotal = metrics.uniqueCrews.length * targetPerCrewPerWeek
            const barPct = metrics.maxWeekTotal > 0 ? (w.total / metrics.maxWeekTotal) * 100 : 0
            const targetPct = metrics.maxWeekTotal > 0 ? Math.min((targetTotal / metrics.maxWeekTotal) * 100, 100) : 0

            return (
              <div key={w.monday} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-400 text-right flex-shrink-0">{w.label}</div>
                <div className="flex-1 h-6 bg-gray-700/50 rounded relative overflow-hidden">
                  {/* Stacked crew bars */}
                  <div className="flex h-full" style={{ width: `${Math.max(barPct, w.total > 0 ? 4 : 0)}%` }}>
                    {metrics.uniqueCrews.map(c => {
                      const count = w.byCrew[c!] ?? 0
                      if (count === 0) return null
                      const segPct = w.total > 0 ? (count / w.total) * 100 : 0
                      return (
                        <div
                          key={c}
                          className="h-full"
                          style={{ width: `${segPct}%`, backgroundColor: crewColorMap[c!] }}
                          title={`${c}: ${count}`}
                        />
                      )
                    })}
                  </div>
                  {/* Target line */}
                  {targetPct > 0 && targetPct <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-400/50"
                      style={{ left: `${targetPct}%` }}
                      title={`Target: ${targetTotal} installs/week (${targetPerCrewPerWeek}/crew)`}
                    />
                  )}
                </div>
                <div className="w-8 text-xs text-gray-300 font-mono text-right">{w.total}</div>
              </div>
            )
          })}
          <div className="flex items-center gap-2 mt-2 ml-20">
            <div className="w-4 border-t-2 border-dashed border-gray-400/50" />
            <span className="text-[10px] text-gray-500">Target: 2 installs/crew/week</span>
          </div>
        </div>
      </div>

      {/* Capacity Planning */}
      <div className={`rounded-xl p-5 border ${
        metrics.demandExceedsCapacity
          ? 'bg-red-950/20 border-red-900/30'
          : metrics.utilization >= 80
            ? 'bg-amber-950/20 border-amber-900/30'
            : 'bg-gray-800 border-gray-700'
      }`}>
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Capacity Planning</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${metrics.demandExceedsCapacity ? 'bg-red-400' : 'bg-green-400'}`} />
              <span className="text-sm text-gray-300">
                Current sales rate: <span className="font-mono text-white">{metrics.salesPerWeek}</span> deals/week (trailing 4 weeks)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm text-gray-300">
                Current crew capacity: <span className="font-mono text-white">{metrics.uniqueCrews.length}</span> crews x 2 = <span className="font-mono text-white">{metrics.crewCapacity}</span> installs/week
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-sm text-gray-300">
                Avg cycle time: <span className="font-mono text-white">{metrics.avgCycle}</span>d (sale to install)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className={`text-center px-6 py-4 rounded-lg ${
              metrics.demandExceedsCapacity ? 'bg-red-900/30' : 'bg-green-900/20'
            }`}>
              <div className={`text-lg font-bold font-mono ${metrics.capacityColor}`}>
                {metrics.capacityForecast}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.demandExceedsCapacity
                  ? `${metrics.salesPerWeek} deals/wk exceeds ${metrics.crewCapacity} install capacity`
                  : 'Install capacity meets current sales demand'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drill-down modal */}
      {drillDown && <ProjectListModal title={drillDown.title} projects={drillDown.projects} onClose={() => setDrillDown(null)} />}
    </div>
  )
}
