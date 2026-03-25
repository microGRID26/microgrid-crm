'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Nav } from '@/components/Nav'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { daysAgo, fmt$, fmtDate, cn, STAGE_LABELS, STAGE_ORDER, SLA_THRESHOLDS } from '@/lib/utils'
import { useSupabaseQuery } from '@/lib/hooks'
import type { Project, Schedule } from '@/types/database'

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getSLA(p: Project) {
  const t = SLA_THRESHOLDS[p.stage] ?? { target: 3, risk: 5, crit: 7 }
  const days = daysAgo(p.stage_date)
  let status: 'ok' | 'warn' | 'risk' | 'crit' = 'ok'
  if (days >= t.crit) status = 'crit'
  else if (days >= t.risk) status = 'risk'
  else if (days >= t.target) status = 'warn'
  return { days, status }
}

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface TaskStateRow {
  project_id: string
  task_id: string
  status: string
  reason: string | null
  started_date: string | null
}

interface ScheduleRow {
  id: string
  project_id: string
  crew_id: string
  job_type: string
  date: string
  time: string | null
  status: string
}

interface CrewRow {
  id: string
  name: string
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()

  // Compute date range for schedule (today to +7 days)
  const { todayStr, nextWeekStr } = useMemo(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    return {
      todayStr: today.toISOString().slice(0, 10),
      nextWeekStr: nextWeek.toISOString().slice(0, 10),
    }
  }, [])

  const isReady = !userLoading && !!currentUser?.id

  // Projects filtered by PM via useSupabaseQuery
  const { data: projects, loading: projLoading } = useSupabaseQuery('projects', {
    select: 'id, name, city, pm, pm_id, stage, stage_date, sale_date, contract, blocker, financier, disposition, install_complete_date',
    filters: currentUser?.id ? { pm_id: currentUser.id } : undefined,
    enabled: isReady,
  })

  // Task states via useSupabaseQuery
  const { data: taskStates, loading: taskLoading } = useSupabaseQuery('task_state', {
    select: 'project_id, task_id, status, reason, started_date',
    limit: 50000,
    enabled: isReady,
  })

  // Schedule for next 7 days — manual query since we need gte+lte on same field
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])
  const [schedLoading, setSchedLoading] = useState(true)
  const supabase = createClient()

  const loadSchedule = useCallback(async () => {
    const { data } = await supabase.from('schedule')
      .select('id, project_id, crew_id, job_type, date, time, status')
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true })
    if (data) setScheduleRows(data as ScheduleRow[])
    setSchedLoading(false)
  }, [todayStr, nextWeekStr])

  useEffect(() => {
    if (isReady) loadSchedule()
  }, [isReady, loadSchedule])

  // Crews via useSupabaseQuery
  const { data: crews, loading: crewLoading } = useSupabaseQuery('crews', {
    select: 'id, name',
    filters: { active: 'TRUE' },
    enabled: isReady,
  })

  const loading = projLoading || taskLoading || schedLoading || crewLoading

  // ── Derived data ────────────────────────────────────────────────────────────

  // Active projects (exclude Cancelled and In Service)
  const activeProjects = useMemo(() =>
    projects.filter(p => p.disposition !== 'Cancelled' && p.disposition !== 'In Service'),
    [projects]
  )

  // Pipeline projects (also exclude Loyalty and complete stage)
  const pipelineProjects = useMemo(() =>
    activeProjects.filter(p => p.disposition !== 'Loyalty' && p.stage !== 'complete'),
    [activeProjects]
  )

  // Portfolio value
  const portfolioValue = useMemo(() =>
    activeProjects.reduce((sum, p) => sum + (p.contract ?? 0), 0),
    [activeProjects]
  )

  // Blocked count
  const blockedCount = useMemo(() =>
    pipelineProjects.filter(p => !!p.blocker).length,
    [pipelineProjects]
  )

  // At Risk + Critical count
  const atRiskCritCount = useMemo(() =>
    pipelineProjects.filter(p => {
      const sla = getSLA(p)
      return sla.status === 'risk' || sla.status === 'crit'
    }).length,
    [pipelineProjects]
  )

  // Installs this month
  const installsThisMonth = useMemo(() => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd = nextMonth.toISOString().slice(0, 10)
    return activeProjects.filter(p => {
      const d = p.install_complete_date
      return d && d >= monthStart && d < monthEnd
    }).length
  }, [activeProjects])

  // Project ID set for filtering task_state and schedule
  const myProjectIds = useMemo(() =>
    new Set(projects.map(p => p.id)),
    [projects]
  )

  // Project name map
  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>()
    projects.forEach(p => m.set(p.id, p.name ?? p.id))
    return m
  }, [projects])

  // Crew name map
  const crewNameMap = useMemo(() => {
    const m = new Map<string, string>()
    crews.forEach(c => m.set(c.id, c.name))
    return m
  }, [crews])

  // Stuck tasks
  const stuckTasks = useMemo(() => {
    return taskStates
      .filter(ts =>
        myProjectIds.has(ts.project_id) &&
        (ts.status === 'Pending Resolution' || ts.status === 'Revision Required')
      )
      .map(ts => {
        const daysStuck = ts.started_date ? daysAgo(ts.started_date) : 0
        return {
          projectId: ts.project_id,
          projectName: projectNameMap.get(ts.project_id) ?? ts.project_id,
          taskId: ts.task_id,
          status: ts.status,
          reason: ts.reason ?? '',
          daysStuck,
        }
      })
      .sort((a, b) => b.daysStuck - a.daysStuck)
  }, [taskStates, myProjectIds, projectNameMap])

  // Pipeline stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STAGE_ORDER) counts[s] = 0
    for (const p of activeProjects) {
      if (p.disposition !== 'Loyalty') {
        counts[p.stage] = (counts[p.stage] ?? 0) + 1
      }
    }
    return counts
  }, [activeProjects])

  const maxStageCount = useMemo(() =>
    Math.max(1, ...Object.values(stageCounts)),
    [stageCounts]
  )

  // Upcoming schedule (only my projects)
  const upcomingSchedule = useMemo(() =>
    scheduleRows
      .filter(s => myProjectIds.has(s.project_id) && s.status !== 'cancelled')
      .map(s => ({
        ...s,
        projectName: projectNameMap.get(s.project_id) ?? s.project_id,
        crewName: crewNameMap.get(s.crew_id) ?? '—',
      })),
    [scheduleRows, myProjectIds, projectNameMap, crewNameMap]
  )

  // ── Loading state ───────────────────────────────────────────────────────────
  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Nav active="Dashboard" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-gray-400 text-sm">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Nav active="Dashboard" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-gray-400 text-sm">Unable to load user profile.</div>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Nav active="Dashboard" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Your portfolio at a glance</p>
        </div>

        {/* Section 1: Portfolio Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Active Projects" value={String(activeProjects.filter(p => p.stage !== 'complete').length)} />
          <StatCard label="Portfolio Value" value={fmt$(portfolioValue)} />
          <StatCard
            label="Blocked"
            value={String(blockedCount)}
            accent={blockedCount > 0 ? 'red' : undefined}
          />
          <StatCard
            label="At Risk / Critical"
            value={String(atRiskCritCount)}
            accent={atRiskCritCount > 0 ? 'amber' : undefined}
          />
          <StatCard label="Installs This Month" value={String(installsThisMonth)} />
        </div>

        {/* Section 2 + 3: Stuck Tasks & Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 2: Stuck Tasks */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
              Stuck Tasks
              {stuckTasks.length > 0 && (
                <span className="ml-2 text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded">
                  {stuckTasks.length}
                </span>
              )}
            </h2>
            {stuckTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No stuck tasks. You&apos;re all clear.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {stuckTasks.map((t, i) => (
                  <div key={`${t.projectId}-${t.taskId}-${i}`}
                    className="bg-gray-900 rounded p-3 border border-gray-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {t.projectName}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{t.taskId}</div>
                      </div>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded whitespace-nowrap',
                        t.status === 'Pending Resolution'
                          ? 'bg-amber-900 text-amber-300'
                          : 'bg-red-900 text-red-300'
                      )}>
                        {t.status === 'Pending Resolution' ? 'Pending' : 'Revision'}
                      </span>
                    </div>
                    {t.reason && (
                      <div className="text-xs text-gray-400 mt-1 italic">{t.reason}</div>
                    )}
                    {t.daysStuck > 0 && (
                      <div className="text-xs text-gray-500 mt-1">{t.daysStuck}d stuck</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: My Pipeline */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
              My Pipeline
              <span className="ml-2 text-xs text-gray-500 font-normal normal-case">
                {pipelineProjects.length} active
              </span>
            </h2>
            <div className="space-y-3">
              {STAGE_ORDER.map(stage => {
                const count = stageCounts[stage] ?? 0
                const pct = (count / maxStageCount) * 100
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-400 text-right shrink-0">
                      {STAGE_LABELS[stage]}
                    </div>
                    <div className="flex-1 bg-gray-900 rounded-full h-5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          stage === 'complete' ? 'bg-green-600' : 'bg-green-700'
                        )}
                        style={{ width: `${Math.max(count > 0 ? 4 : 0, pct)}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs text-gray-300 text-right tabular-nums">
                      {count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Section 4: Upcoming Schedule */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            Upcoming Schedule
            <span className="ml-2 text-xs text-gray-500 font-normal normal-case">next 7 days</span>
          </h2>
          {upcomingSchedule.length === 0 ? (
            <p className="text-sm text-gray-500">No scheduled jobs in the next 7 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-left py-2 pr-4">Project</th>
                    <th className="text-left py-2">Crew</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingSchedule.map(s => (
                    <tr key={s.id} className="border-b border-gray-700/50 hover:bg-gray-750">
                      <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="py-2 pr-4">
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded capitalize',
                          s.job_type === 'install' ? 'bg-blue-900 text-blue-300' :
                          s.job_type === 'survey' ? 'bg-purple-900 text-purple-300' :
                          s.job_type === 'inspection' ? 'bg-cyan-900 text-cyan-300' :
                          s.job_type === 'service' ? 'bg-orange-900 text-orange-300' :
                          'bg-gray-700 text-gray-300'
                        )}>
                          {s.job_type}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-white">{s.projectName}</td>
                      <td className="py-2 text-gray-400">{s.crewName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stat Card Component ───────────────────────────────────────────────────────
function StatCard({ label, value, accent }: {
  label: string
  value: string
  accent?: 'red' | 'amber'
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={cn(
        'text-2xl font-bold mt-1',
        accent === 'red' ? 'text-red-400' :
        accent === 'amber' ? 'text-amber-400' :
        'text-white'
      )}>
        {value}
      </div>
    </div>
  )
}
