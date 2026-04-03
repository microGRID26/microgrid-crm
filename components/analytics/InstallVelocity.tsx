'use client'

import { useMemo, useState } from 'react'
import { fmt$, daysAgo, STAGE_LABELS } from '@/lib/utils'
import { MetricCard, PeriodBar, inRange, ProjectListModal, ExportButton, downloadCSV, PERIOD_LABELS, type AnalyticsData } from './shared'

export function InstallVelocity({ data }: { data: AnalyticsData }) {
  const { projects, active, funding, taskMap, period } = data
  const [drillDown, setDrillDown] = useState<{ title: string; projects: typeof projects } | null>(null)

  const metrics = useMemo(() => {
    // Installs this period
    const installs = projects.filter(p => inRange(p.install_complete_date ?? (p.stage === 'complete' ? p.stage_date : null), period))

    // Ready to install = sched_install task is "Ready To Start"
    // This means the project passed all pre-install gates (permits, equipment, etc)
    const readyToInstall = active.filter(p => {
      const tasks = taskMap[p.id]
      return tasks?.sched_install === 'Ready To Start'
    })
    // Blocked/stuck installs = in install stage but sched_install is Pending Resolution or Revision Required
    const blockedInstall = active.filter(p => {
      const tasks = taskMap[p.id]
      const status = tasks?.sched_install
      return p.stage === 'install' && (status === 'Pending Resolution' || status === 'Revision Required' || p.blocker)
    })
    // In progress = sched_install is In Progress or Scheduled
    const inProgressInstall = active.filter(p => {
      const tasks = taskMap[p.id]
      return tasks?.sched_install === 'In Progress' || tasks?.sched_install === 'Scheduled'
    })

    // Backlog: all projects in stages before install
    const preInstall = active.filter(p => ['evaluation', 'survey', 'design', 'permit'].includes(p.stage))

    // Cycle times
    const withDates = projects.filter(p => p.sale_date && p.install_complete_date)
    const saleToInstall = withDates.length > 0
      ? Math.round(withDates.reduce((s, p) => {
          return s + (new Date(p.install_complete_date! + 'T00:00:00').getTime() - new Date(p.sale_date! + 'T00:00:00').getTime()) / 86400000
        }, 0) / withDates.length)
      : 0

    const withPTO = projects.filter(p => p.install_complete_date && p.pto_date)
    const installToPTO = withPTO.length > 0
      ? Math.round(withPTO.reduce((s, p) => {
          return s + (new Date(p.pto_date! + 'T00:00:00').getTime() - new Date(p.install_complete_date! + 'T00:00:00').getTime()) / 86400000
        }, 0) / withPTO.length)
      : 0

    // Weekly install rate (last 4 weeks)
    const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const recentInstalls = projects.filter(p => {
      const d = p.install_complete_date ?? (p.stage === 'complete' ? p.stage_date : null)
      if (!d) return false
      return new Date(d + 'T00:00:00') >= fourWeeksAgo
    })
    const installsPerWeek = Math.round(recentInstalls.length / 4 * 10) / 10

    // Backlog weeks: how many weeks to clear current install-ready at current rate
    const backlogWeeks = installsPerWeek > 0 ? Math.round(readyToInstall.length / installsPerWeek * 10) / 10 : 0

    // Monthly trend (last 6 months)
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const mps = projects.filter(p => {
        const cd = p.install_complete_date ?? (p.stage === 'complete' ? p.stage_date : null)
        if (!cd) return false
        const dt = new Date(cd + 'T00:00:00')
        return !isNaN(dt.getTime()) && dt >= start && dt <= end
      })
      return {
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        count: mps.length,
        value: mps.reduce((s, p) => s + (Number(p.contract) || 0), 0),
        projects: mps,
      }
    })
    const maxMonth = Math.max(...months.map(m => m.count), 1)

    // Bottleneck: which pre-install stage has the most projects
    const stageBacklog = ['evaluation', 'survey', 'design', 'permit'].map(stage => ({
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count: active.filter(p => p.stage === stage).length,
      blocked: active.filter(p => p.stage === stage && p.blocker).length,
      avgDays: (() => {
        const ps = active.filter(p => p.stage === stage)
        return ps.length > 0 ? Math.round(ps.reduce((s, p) => s + daysAgo(p.stage_date), 0) / ps.length) : 0
      })(),
    })).filter(s => s.count > 0)

    return {
      installs, readyToInstall, blockedInstall, inProgressInstall, preInstall,
      saleToInstall, installToPTO, installsPerWeek, backlogWeeks,
      months, maxMonth, stageBacklog,
    }
  }, [projects, active, taskMap, period])

  const handleExport = () => {
    const headers = ['Metric', 'Value']
    const rows = [
      ['Installs This Period', metrics.installs.length],
      ['Install Rate (per week)', metrics.installsPerWeek],
      ['Ready to Install', metrics.readyToInstall.length],
      ['Blocked Installs', metrics.blockedInstall.length],
      ['Pre-Install Backlog', metrics.preInstall.length],
      ['Backlog Weeks', metrics.backlogWeeks],
      ['Avg Sale→Install', `${metrics.saleToInstall}d`],
      ['Avg Install→PTO', `${metrics.installToPTO}d`],
    ] as (string | number)[][]
    downloadCSV(`install-velocity-${period}.csv`, headers, rows)
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}
        <ExportButton onClick={handleExport} />
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label={`Installs (${PERIOD_LABELS[period]})`} value={String(metrics.installs.length)}
          sub={fmt$(metrics.installs.reduce((s, p) => s + (Number(p.contract) || 0), 0))} color="text-green-400"
          onClick={() => setDrillDown({ title: 'Installs This Period', projects: metrics.installs })}
          formula="Projects where install_complete_date (or stage_date for completed projects) falls within the selected time period." />
        <MetricCard label="Install Rate" value={`${metrics.installsPerWeek}/wk`} sub="Last 4 weeks avg" color="text-blue-400"
          formula="Count of installs completed in the last 28 days ÷ 4 weeks. This is a rolling average, not a snapshot." />
        <MetricCard label="Ready to Schedule" value={String(metrics.readyToInstall.length)}
          sub="sched_install = Ready To Start" color="text-amber-400"
          onClick={() => setDrillDown({ title: 'Ready to Schedule (sched_install Ready)', projects: metrics.readyToInstall })}
          formula="Projects where the 'Schedule Installation' task has status 'Ready To Start' in the task_state table. This means all prerequisite tasks (permits, equipment, etc.) are complete." />
        <MetricCard label="Scheduled / In Progress" value={String(metrics.inProgressInstall.length)}
          sub={metrics.blockedInstall.length > 0 ? `${metrics.blockedInstall.length} stuck` : 'None stuck'} color="text-blue-400"
          onClick={() => setDrillDown({ title: 'Install Scheduled/In Progress', projects: metrics.inProgressInstall })}
          formula="Projects where sched_install task is 'In Progress' or 'Scheduled'. These are actively being worked or have a date set." />
        <MetricCard label="Backlog" value={`${metrics.backlogWeeks} wks`}
          sub={`${metrics.preInstall.length} pre-install projects`} color={metrics.backlogWeeks > 12 ? 'text-red-400' : 'text-gray-300'}
          formula={`Ready to Schedule (${metrics.readyToInstall.length}) ÷ Install Rate (${metrics.installsPerWeek}/wk) = ${metrics.backlogWeeks} weeks to clear.\n\nPre-install: ${metrics.preInstall.length} projects in evaluation, survey, design, or permit stages.`} />
      </div>

      {/* Cycle times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 font-semibold mb-2">Sale → Install</div>
          <div className={`text-4xl font-bold font-mono ${metrics.saleToInstall > 60 ? 'text-red-400' : metrics.saleToInstall > 45 ? 'text-amber-400' : 'text-green-400'}`}>
            {metrics.saleToInstall}<span className="text-lg text-gray-500 ml-1">days</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">Target: &lt;45 days</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 font-semibold mb-2">Install → PTO</div>
          <div className={`text-4xl font-bold font-mono ${metrics.installToPTO > 30 ? 'text-red-400' : metrics.installToPTO > 21 ? 'text-amber-400' : 'text-green-400'}`}>
            {metrics.installToPTO}<span className="text-lg text-gray-500 ml-1">days</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">Target: &lt;21 days</div>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Monthly Installs — 6 Month Trend</div>
        <div className="flex items-end gap-2 h-40">
          {metrics.months.map(m => (
            <div key={m.label} className={`flex-1 flex flex-col items-center gap-1 ${m.count > 0 ? 'cursor-pointer' : ''}`}
              onClick={() => m.count > 0 && setDrillDown({ title: `Installs — ${m.label}`, projects: m.projects })}>
              <div className="w-full bg-gray-700 rounded-t relative" style={{ height: `${Math.max((m.count / metrics.maxMonth) * 100, m.count > 0 ? 8 : 2)}%` }}>
                <div className={`absolute inset-0 rounded-t bg-green-600 ${m.count > 0 ? 'hover:bg-green-500' : ''} transition-colors`} />
                {m.count > 0 && <div className="absolute -top-5 inset-x-0 text-center text-xs font-bold text-white">{m.count}</div>}
              </div>
              <div className="text-[10px] text-gray-500">{m.label}</div>
              <div className="text-[10px] text-gray-600 font-mono">{fmt$(m.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-install bottleneck */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Pre-Install Backlog — Where Projects Are Waiting</div>
        <div className="space-y-3">
          {metrics.stageBacklog.map(s => (
            <div key={s.stage} className="flex items-center gap-4">
              <div className="w-20 text-xs text-gray-400 text-right flex-shrink-0">{s.label}</div>
              <div className="flex-1 bg-gray-700 rounded-full h-6 relative overflow-hidden">
                <div className="bg-amber-600/80 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                  style={{ width: `${Math.max(s.count / Math.max(...metrics.stageBacklog.map(x => x.count), 1) * 100, 10)}%` }}>
                  <span className="text-xs text-white font-bold">{s.count}</span>
                </div>
              </div>
              <div className="w-24 text-right flex-shrink-0">
                <div className="text-xs text-gray-500">avg {s.avgDays}d</div>
                {s.blocked > 0 && <div className="text-[10px] text-red-400">{s.blocked} blocked</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Install by City */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Installs by City — Top 8</div>
        <InstallByCity installs={metrics.installs} />
      </div>

      {/* Install by Financier */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Installs by Financier</div>
        <InstallByFinancier installs={metrics.installs} allProjects={projects} />
      </div>

      {/* Weekly Install Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Weekly Install History — Last 8 Weeks</div>
        <WeeklyInstallTable projects={projects} workOrders={data.workOrders} />
      </div>

      {/* Inspection Pipeline */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Inspection Pipeline</div>
        <InspectionPipeline active={active} projects={projects} />
      </div>

      {drillDown && <ProjectListModal title={drillDown.title} projects={drillDown.projects} onClose={() => setDrillDown(null)} />}
    </div>
  )
}

// ── Install by City sub-component ──────────────────────────────────────────

function InstallByCity({ installs }: { installs: { city: string | null; contract: number | null }[] }) {
  const cities = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    installs.forEach(p => {
      const c = p.city || 'Unknown'
      if (!map[c]) map[c] = { count: 0, value: 0 }
      map[c].count++
      map[c].value += Number(p.contract) || 0
    })
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 8)
  }, [installs])

  if (cities.length === 0) return <div className="text-xs text-gray-600">No installs this period</div>

  const max = cities[0]?.[1].count ?? 1
  return (
    <div className="space-y-1">
      {cities.map(([city, d]) => (
        <div key={city} className="flex items-center gap-3">
          <div className="w-28 text-xs text-gray-400 text-right truncate flex-shrink-0">{city}</div>
          <div className="flex-1 bg-gray-700/30 rounded-full h-4 overflow-hidden">
            <div className="h-full bg-green-600/50 rounded-full flex items-center px-2"
              style={{ width: `${Math.max((d.count / max) * 100, 8)}%` }}>
              <span className="text-[10px] text-white font-bold">{d.count}</span>
            </div>
          </div>
          <div className="w-16 text-[10px] text-gray-500 font-mono text-right">{fmt$(d.value)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Install by Financier sub-component ─────────────────────────────────────

function InstallByFinancier({ installs, allProjects }: {
  installs: { id: string; financier: string | null; contract: number | null; sale_date: string | null; install_complete_date: string | null }[]
  allProjects: { id: string; financier: string | null; sale_date: string | null; install_complete_date: string | null; contract: number | null }[]
}) {
  const financiers = useMemo(() => {
    const map: Record<string, { count: number; value: number; cycleDaysTotal: number; cycleDaysCount: number }> = {}
    installs.forEach(p => {
      const f = p.financier || 'Unknown'
      if (!map[f]) map[f] = { count: 0, value: 0, cycleDaysTotal: 0, cycleDaysCount: 0 }
      map[f].count++
      map[f].value += Number(p.contract) || 0
      if (p.sale_date && p.install_complete_date) {
        const days = (new Date(p.install_complete_date + 'T00:00:00').getTime() - new Date(p.sale_date + 'T00:00:00').getTime()) / 86400000
        map[f].cycleDaysTotal += days
        map[f].cycleDaysCount++
      }
    })
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d, avgCycle: d.cycleDaysCount > 0 ? Math.round(d.cycleDaysTotal / d.cycleDaysCount) : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [installs])

  if (financiers.length === 0) return <div className="text-xs text-gray-600">No installs this period</div>

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-700">
          <th className="text-left text-gray-500 font-medium px-2 py-1">Financier</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Count</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Value</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Avg Cycle</th>
        </tr>
      </thead>
      <tbody>
        {financiers.map(f => (
          <tr key={f.name} className="border-b border-gray-800">
            <td className="px-2 py-1.5 text-gray-300 truncate max-w-[180px]">{f.name}</td>
            <td className="px-2 py-1.5 text-white font-mono text-right">{f.count}</td>
            <td className="px-2 py-1.5 text-gray-400 font-mono text-right">{fmt$(f.value)}</td>
            <td className={`px-2 py-1.5 font-mono text-right ${f.avgCycle > 60 ? 'text-red-400' : f.avgCycle > 45 ? 'text-amber-400' : 'text-green-400'}`}>{f.avgCycle}d</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Weekly Install Table sub-component ─────────────────────────────────────

function WeeklyInstallTable({ projects, workOrders }: {
  projects: { id: string; install_complete_date: string | null; stage: string; stage_date: string | null; contract: number | null }[]
  workOrders: { project_id: string; time_on_site_minutes?: number; completed_at?: string }[]
}) {
  const weeks = useMemo(() => {
    const woMap: Record<string, number[]> = {}
    workOrders.forEach(wo => {
      if (wo.time_on_site_minutes && wo.completed_at) {
        if (!woMap[wo.project_id]) woMap[wo.project_id] = []
        woMap[wo.project_id].push(wo.time_on_site_minutes)
      }
    })

    return Array.from({ length: 8 }, (_, i) => {
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() - (i * 7))
      weekEnd.setHours(23, 59, 59, 999)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)
      weekStart.setHours(0, 0, 0, 0)

      const wkInstalls = projects.filter(p => {
        const d = p.install_complete_date ?? (p.stage === 'complete' ? p.stage_date : null)
        if (!d) return false
        const dt = new Date(d + 'T00:00:00')
        return dt >= weekStart && dt <= weekEnd
      })

      const value = wkInstalls.reduce((s, p) => s + (Number(p.contract) || 0), 0)
      let avgTos = 0
      let tosCount = 0
      wkInstalls.forEach(p => {
        const mins = woMap[p.id]
        if (mins) { mins.forEach(m => { avgTos += m; tosCount++ }) }
      })

      return {
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        count: wkInstalls.length,
        value,
        avgTos: tosCount > 0 ? Math.round(avgTos / tosCount) : 0,
      }
    }).reverse()
  }, [projects, workOrders])

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-700">
          <th className="text-left text-gray-500 font-medium px-2 py-1">Week</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Installs</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Value</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Avg TOS</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map(w => (
          <tr key={w.label} className="border-b border-gray-800">
            <td className="px-2 py-1.5 text-gray-400">{w.label}</td>
            <td className={`px-2 py-1.5 font-mono text-right ${w.count > 0 ? 'text-green-400' : 'text-gray-600'}`}>{w.count}</td>
            <td className="px-2 py-1.5 text-gray-400 font-mono text-right">{fmt$(w.value)}</td>
            <td className="px-2 py-1.5 text-gray-500 font-mono text-right">{w.avgTos > 0 ? `${w.avgTos}m` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Inspection Pipeline sub-component ──────────────────────────────────────

function InspectionPipeline({ active, projects }: {
  active: { id: string; stage: string; stage_date: string | null; pto_date: string | null }[]
  projects: { id: string; stage: string; pto_date: string | null; install_complete_date: string | null }[]
}) {
  const stats = useMemo(() => {
    const inInspection = active.filter(p => p.stage === 'inspection')
    const avgDays = inInspection.length > 0
      ? Math.round(inInspection.reduce((s, p) => s + daysAgo(p.stage_date), 0) / inInspection.length)
      : 0

    // PTO rate: projects that reached PTO / those that entered inspection (ever)
    const enteredInspection = projects.filter(p =>
      p.stage === 'inspection' || p.stage === 'complete' || p.pto_date
    )
    const reachedPTO = projects.filter(p => p.pto_date)
    const ptoRate = enteredInspection.length > 0
      ? Math.round((reachedPTO.length / enteredInspection.length) * 100)
      : 0

    return { count: inInspection.length, avgDays, ptoRate }
  }, [active, projects])

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">In Inspection</div>
        <div className="text-xl font-bold font-mono text-cyan-400">{stats.count}</div>
      </div>
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">Avg Days</div>
        <div className={`text-xl font-bold font-mono ${stats.avgDays > 21 ? 'text-red-400' : 'text-green-400'}`}>{stats.avgDays}d</div>
      </div>
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">PTO Rate</div>
        <div className={`text-xl font-bold font-mono ${stats.ptoRate >= 80 ? 'text-green-400' : 'text-amber-400'}`}>{stats.ptoRate}%</div>
      </div>
    </div>
  )
}
