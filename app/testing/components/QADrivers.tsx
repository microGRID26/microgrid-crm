'use client'

/**
 * QADrivers — Daily Drivers admin view, mounted as a sub-tab inside
 * the existing /testing admin panel. Shows the qa_runs feed with KPIs,
 * per-tester streaks, filters, expand-to-view notes + screenshots.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Beaker, CheckCircle2, XCircle, Ban, SkipForward, Clock,
  Users, Flame, BarChart3, Loader2, AlertTriangle, Smartphone,
  Monitor, Tablet, Camera, Calendar,
} from 'lucide-react'

interface UserRow { id: string; name: string; email: string; role: string }
interface QARunRow {
  id: string
  tester_id: string
  test_case_id: string
  status: string
  star_rating: number | null
  notes: string | null
  screenshot_url: string | null
  device_type: string | null
  viewport_width: number | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}
interface CaseRow { id: string; title: string; plan_id: string; priority: string }
interface PlanRow { id: string; name: string }

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pass:      { label: 'Pass',      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: CheckCircle2 },
  fail:      { label: 'Fail',      cls: 'bg-red-500/15 text-red-400 border-red-500/30',             Icon: XCircle },
  blocked:   { label: 'Blocked',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       Icon: Ban },
  skipped:   { label: 'Skipped',   cls: 'bg-gray-700 text-gray-400 border-gray-600',                Icon: SkipForward },
  abandoned: { label: 'Abandoned', cls: 'bg-gray-700 text-gray-500 border-gray-600',                Icon: Clock },
  started:   { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',        Icon: Loader2 },
}

const DEVICE_ICON: Record<string, typeof Monitor> = { desktop: Monitor, tablet: Tablet, mobile: Smartphone }

function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  return `${min}m ${sec % 60}s`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function QADrivers() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [runs, setRuns] = useState<QARunRow[]>([])
  const [cases, setCases] = useState<CaseRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterTester, setFilterTester] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [signedScreenshots, setSignedScreenshots] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    const [runsRes, casesRes, plansRes, usersRes] = await Promise.all([
      supabase.from('qa_runs').select('*').order('started_at', { ascending: false }).limit(200),
      supabase.from('test_cases').select('id, title, plan_id, priority'),
      supabase.from('test_plans').select('id, name'),
      supabase.from('users').select('id, name, email, role'),
    ])
    setRuns((runsRes.data ?? []) as QARunRow[])
    setCases((casesRes.data ?? []) as CaseRow[])
    setPlans((plansRes.data ?? []) as PlanRow[])
    setUsers((usersRes.data ?? []) as UserRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Lazy signed URL when a row is expanded
  useEffect(() => {
    if (!expanded) return
    const run = runs.find((r) => r.id === expanded)
    if (!run?.screenshot_url) return
    if (signedScreenshots.has(run.screenshot_url)) return
    let cancelled = false
    supabase.storage.from('recordings').createSignedUrl(run.screenshot_url, 3600).then(({ data }) => {
      if (cancelled || !data?.signedUrl) return
      setSignedScreenshots((prev) => {
        const next = new Map(prev)
        next.set(run.screenshot_url!, data.signedUrl)
        return next
      })
    })
    return () => { cancelled = true }
  }, [expanded, runs, signedScreenshots, supabase])

  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])
  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const kpis = useMemo(() => {
    const fourteenDaysAgo = Date.now() - 14 * 86400000
    const recentTerminal = runs.filter((r) => {
      const ts = new Date(r.started_at).getTime()
      return ts >= fourteenDaysAgo && r.status !== 'started'
    })
    const uniqueCases = new Set(recentTerminal.map((r) => r.test_case_id))
    const totalCases = cases.length || 1
    const coveragePct = Math.round((uniqueCases.size / totalCases) * 100)
    const passCount = recentTerminal.filter((r) => r.status === 'pass').length
    const failCount = recentTerminal.filter((r) => r.status === 'fail').length

    const streaks = new Map<string, number>()
    const seenTesters = new Set(runs.map((r) => r.tester_id))
    for (const testerId of seenTesters) {
      const days = new Set<string>()
      for (const r of runs) {
        if (r.tester_id !== testerId || r.status === 'started') continue
        days.add(new Date(r.started_at).toISOString().slice(0, 10))
      }
      let streak = 0
      const cursor = new Date()
      cursor.setUTCHours(0, 0, 0, 0)
      if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1)
      while (days.has(cursor.toISOString().slice(0, 10))) {
        streak += 1
        cursor.setUTCDate(cursor.getUTCDate() - 1)
      }
      streaks.set(testerId, streak)
    }

    return { coveragePct, uniqueCases: uniqueCases.size, totalCases, passCount, failCount, streaks, activeTesters: seenTesters.size }
  }, [runs, cases])

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterTester !== 'all' && r.tester_id !== filterTester) return false
      return true
    })
  }, [runs, filterStatus, filterTester])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '14-Day Coverage', value: `${kpis.coveragePct}%`, sub: `${kpis.uniqueCases} / ${kpis.totalCases}`, Icon: BarChart3, color: 'text-violet-400', bg: 'bg-violet-500/15' },
          { label: 'Passes (14d)', value: kpis.passCount, sub: 'terminal runs', Icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
          { label: 'Fails (14d)', value: kpis.failCount, sub: 'needs attention', Icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/15' },
          { label: 'Active Testers', value: kpis.activeTesters, sub: 'with runs', Icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/15' },
        ].map((k) => (
          <div key={k.label} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-2 ${k.bg}`}>
              <k.Icon className={`w-3.5 h-3.5 ${k.color}`} />
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Streaks */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-500" />
          <h2 className="font-bold text-white text-sm">Tester Streaks</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {Array.from(kpis.streaks.entries()).map(([testerId, streak]) => {
            const u = userMap.get(testerId)
            const totalRuns = runs.filter((r) => r.tester_id === testerId && r.status !== 'started').length
            return (
              <div key={testerId} className="flex items-center gap-3 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{u?.name ?? '(unknown)'}</p>
                  <p className="text-[11px] text-gray-500">{u?.email ?? testerId}</p>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'text-amber-500' : 'text-gray-600'}`} />
                  <span className={`font-bold tabular-nums ${streak > 0 ? 'text-amber-400' : 'text-gray-500'}`}>{streak}</span>
                  <span className="text-gray-500">day{streak === 1 ? '' : 's'}</span>
                </div>
                <span className="text-xs text-gray-400 font-medium tabular-nums w-20 text-right">
                  {totalRuns} runs
                </span>
              </div>
            )
          })}
          {kpis.streaks.size === 0 && (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No runs yet — assign cases to testers to get started.</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs bg-gray-800 text-gray-200 border border-gray-700 rounded-md px-2.5 py-1.5"
        >
          <option value="all">All statuses</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="blocked">Blocked</option>
          <option value="skipped">Skipped</option>
          <option value="abandoned">Abandoned</option>
          <option value="started">In progress</option>
        </select>
        <select
          value={filterTester}
          onChange={(e) => setFilterTester(e.target.value)}
          className="text-xs bg-gray-800 text-gray-200 border border-gray-700 rounded-md px-2.5 py-1.5"
        >
          <option value="all">All testers</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="text-xs text-gray-500 ml-auto">{filteredRuns.length} of {runs.length} runs</span>
      </div>

      {/* Run feed */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <Beaker className="w-4 h-4 text-violet-400" />
          <h2 className="font-bold text-white text-sm">Daily Driver Runs</h2>
        </div>
        {filteredRuns.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">No runs match the filters.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredRuns.map((run) => {
              const c = caseMap.get(run.test_case_id)
              const plan = c ? planMap.get(c.plan_id) : null
              const u = userMap.get(run.tester_id)
              const meta = STATUS_META[run.status] ?? STATUS_META.skipped
              const DeviceIcon = run.device_type ? DEVICE_ICON[run.device_type] ?? Monitor : Monitor
              const isOpen = expanded === run.id
              return (
                <div key={run.id} className="px-6 py-3">
                  <button onClick={() => setExpanded(isOpen ? null : run.id)} className="w-full flex items-center gap-3 text-left">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.cls}`}>
                      <meta.Icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c?.title ?? 'Unknown case'}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {plan?.name ?? '—'} &middot; {u?.name ?? '—'} &middot; {relativeTime(run.started_at)}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><DeviceIcon className="w-3 h-3" />{run.device_type ?? 'unknown'}</span>
                      <span className="tabular-nums">{formatDuration(run.duration_ms)}</span>
                      {run.star_rating && <span>{'★'.repeat(run.star_rating)}</span>}
                      {run.screenshot_url && <Camera className="w-3 h-3 text-violet-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-3 ml-2 pl-4 border-l-2 border-violet-500/30 space-y-2">
                      {run.notes && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Notes</p>
                          <p className="text-xs text-gray-300 whitespace-pre-line">{run.notes}</p>
                        </div>
                      )}
                      {run.screenshot_url && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Screenshot</p>
                          {signedScreenshots.has(run.screenshot_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={signedScreenshots.get(run.screenshot_url)!} alt="QA screenshot" className="max-w-md rounded-md border border-gray-800" />
                          ) : (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-4 text-[11px] text-gray-500">
                        <span><Calendar className="w-3 h-3 inline mr-1" />{new Date(run.started_at).toLocaleString()}</span>
                        {run.viewport_width && <span>{run.viewport_width}px viewport</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
