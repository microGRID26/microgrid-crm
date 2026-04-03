'use client'

import { useMemo, useState } from 'react'
import { fmt$, daysAgo, STAGE_LABELS, STAGE_ORDER, SLA_THRESHOLDS } from '@/lib/utils'
import {
  MetricCard, MiniBar, PeriodBar, ProjectListModal, ExportButton, downloadCSV,
  STAGE_DAYS_REMAINING, type AnalyticsData,
} from './shared'

export function PipelineHealth({ data }: { data: AnalyticsData }) {
  const { projects, active } = data
  const [drillDown, setDrillDown] = useState<{ title: string; projects: typeof projects } | null>(null)

  // Stage distribution — single filter pass per stage
  const stageDist = useMemo(() => STAGE_ORDER.filter(s => s !== 'complete').map(s => {
    const stageProjects = active.filter(p => p.stage === s)
    return {
      stage: s,
      label: STAGE_LABELS[s],
      count: stageProjects.length,
      value: stageProjects.reduce((sum, p) => sum + (Number(p.contract) || 0), 0),
    }
  }), [active])
  const maxStageCount = useMemo(() => Math.max(...stageDist.map(s => s.count), 1), [stageDist])

  // Forecast buckets
  const next30 = useMemo(() => active.filter(p => (STAGE_DAYS_REMAINING[p.stage] ?? 60) <= 30), [active])
  const next60 = useMemo(() => active.filter(p => { const d = STAGE_DAYS_REMAINING[p.stage] ?? 60; return d > 30 && d <= 60 }), [active])
  const next90 = useMemo(() => active.filter(p => { const d = STAGE_DAYS_REMAINING[p.stage] ?? 60; return d > 60 && d <= 90 }), [active])

  // SLA buckets
  const slaGroups = useMemo(() => {
    const crit = active.filter(p => {
      const t = SLA_THRESHOLDS[p.stage] ?? { crit: 7, risk: 5 }
      return daysAgo(p.stage_date) >= t.crit
    })
    const risk = active.filter(p => {
      const t = SLA_THRESHOLDS[p.stage] ?? { crit: 7, risk: 5 }
      const d = daysAgo(p.stage_date)
      return d >= t.risk && d < t.crit
    })
    const ok = active.filter(p => {
      const t = SLA_THRESHOLDS[p.stage] ?? { crit: 7, risk: 5 }
      return daysAgo(p.stage_date) < t.risk
    })
    return { crit, risk, ok }
  }, [active])

  const blocked = useMemo(() => active.filter(p => p.blocker), [active])
  const aging90 = useMemo(() => projects.filter(p => p.stage !== 'complete' && (daysAgo(p.sale_date) || 0) >= 90), [projects])
  const aging120 = useMemo(() => projects.filter(p => p.stage !== 'complete' && (daysAgo(p.sale_date) || 0) >= 120), [projects])

  const handleExport = () => {
    const headers = ['Stage', 'Count', 'Value']
    const rows = [
      ...stageDist.map(s => [s.label, s.count, s.value]),
      ['Forecast 30d', next30.length, next30.reduce((s, p) => s + (Number(p.contract) || 0), 0)],
      ['Forecast 31-60d', next60.length, next60.reduce((s, p) => s + (Number(p.contract) || 0), 0)],
      ['Forecast 61-90d', next90.length, next90.reduce((s, p) => s + (Number(p.contract) || 0), 0)],
      ['Critical SLA', slaGroups.crit.length, ''],
      ['At Risk SLA', slaGroups.risk.length, ''],
      ['On Track SLA', slaGroups.ok.length, ''],
      ['Blocked', blocked.length, ''],
      ['90+ day cycle', aging90.length, ''],
      ['120+ day cycle', aging120.length, ''],
    ] as (string | number | null)[][]
    downloadCSV('pipeline-health.csv', headers, rows)
  }

  // Conversion funnel: what % of projects advance from each stage
  const funnel = useMemo(() => {
    const stageIdx: Record<string, number> = {}
    STAGE_ORDER.forEach((s, i) => { stageIdx[s] = i })
    const stages = STAGE_ORDER.filter(s => s !== 'complete')
    return stages.map((stage, i) => {
      const inStageOrBeyond = projects.filter(p => (stageIdx[p.stage] ?? 0) >= i)
      const advanced = projects.filter(p => (stageIdx[p.stage] ?? 0) > i)
      const rate = inStageOrBeyond.length > 0 ? Math.round((advanced.length / inStageOrBeyond.length) * 100) : 0
      return { stage, label: STAGE_LABELS[stage], entered: inStageOrBeyond.length, advanced: advanced.length, rate }
    })
  }, [projects])

  // Stage velocity: avg days in stage + bottleneck
  const stageVelocity = useMemo(() => {
    const stages = STAGE_ORDER.filter(s => s !== 'complete')
    const result = stages.map(stage => {
      const inStage = active.filter(p => p.stage === stage)
      const avgDays = inStage.length > 0 ? Math.round(inStage.reduce((s, p) => s + daysAgo(p.stage_date), 0) / inStage.length) : 0
      const blockedCount = inStage.filter(p => p.blocker).length
      return { stage, label: STAGE_LABELS[stage], count: inStage.length, avgDays, blockedCount }
    }).filter(s => s.count > 0)
    return result
  }, [active])
  const bottleneck = useMemo(() => stageVelocity.reduce((worst, s) => s.avgDays > worst.avgDays ? s : worst, stageVelocity[0] ?? { stage: '', label: '', avgDays: 0, count: 0, blockedCount: 0 }), [stageVelocity])

  const STAGE_COLORS: Record<string, string> = {
    evaluation: '#3b82f6', survey: '#8b5cf6', design: '#ec4899',
    permit: '#f59e0b', install: '#f97316', inspection: '#06b6d4',
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">{data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}<ExportButton onClick={handleExport} /></div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active Projects" value={String(active.length)} sub={fmt$(active.reduce((s, p) => s + (Number(p.contract) || 0), 0))}
          formula="All non-complete, non-cancelled, non-in-service projects" />
        <MetricCard label="Bottleneck" value={bottleneck?.label ?? '—'} sub={`avg ${bottleneck?.avgDays ?? 0}d · ${bottleneck?.blockedCount ?? 0} blocked`} color="text-amber-400"
          formula={`The stage with the longest average days-in-stage. Currently ${bottleneck?.label} at ${bottleneck?.avgDays}d avg with ${bottleneck?.count} projects.`} />
        <MetricCard label="Blocked" value={String(blocked.length)} color={blocked.length > 10 ? 'text-red-400' : 'text-amber-400'}
          sub={fmt$(blocked.reduce((s, p) => s + (Number(p.contract) || 0), 0))}
          onClick={() => setDrillDown({ title: 'Blocked Projects', projects: blocked })}
          formula="Projects with a blocker field set. These cannot advance until the blocker is resolved." />
        <MetricCard label="SLA Critical" value={String(slaGroups.crit.length)} color="text-red-400"
          onClick={() => setDrillDown({ title: 'SLA Critical', projects: slaGroups.crit })}
          formula="Projects that have exceeded the critical SLA threshold for their current stage (e.g., >45 days in permitting)." />
      </div>

      {/* Conversion Funnel */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Conversion Funnel</div>
        <div className="space-y-1">
          {funnel.map((f, i) => (
            <div key={f.stage} className="flex items-center gap-3">
              <div className="w-20 text-right text-xs font-medium" style={{ color: STAGE_COLORS[f.stage] ?? '#6b7280' }}>{f.label}</div>
              <div className="flex-1 h-8 bg-gray-700/30 rounded overflow-hidden">
                <div className="h-full rounded flex items-center px-3 justify-between transition-all"
                  style={{ width: `${Math.max(f.rate, 5)}%`, backgroundColor: `${STAGE_COLORS[f.stage] ?? '#6b7280'}25`, borderLeft: `3px solid ${STAGE_COLORS[f.stage] ?? '#6b7280'}` }}>
                  <span className="text-xs font-bold text-white">{f.entered}</span>
                  {f.rate > 0 && <span className="text-[10px] text-gray-400">{f.rate}% advance</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-2">Shows what % of projects that entered each stage have advanced beyond it. Based on all active + complete projects.</p>
      </div>

      {/* Stage Velocity */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Stage Velocity — Avg Days in Stage</div>
        <div className="space-y-2">
          {stageVelocity.map(s => (
            <div key={s.stage} className="flex items-center gap-3">
              <div className="w-20 text-right text-xs font-medium" style={{ color: STAGE_COLORS[s.stage] }}>{s.label}</div>
              <div className="flex-1 bg-gray-700/30 rounded-full h-5 relative overflow-hidden">
                <div className={`h-5 rounded-full flex items-center px-2 transition-all ${s.stage === bottleneck?.stage ? 'bg-amber-600/60' : 'bg-gray-600/60'}`}
                  style={{ width: `${Math.min(Math.max(s.avgDays / 60 * 100, 8), 100)}%` }}>
                  <span className="text-[10px] text-white font-bold">{s.avgDays}d</span>
                </div>
              </div>
              <div className="w-20 text-right text-xs text-gray-500">
                {s.count} projects
                {s.blockedCount > 0 && <span className="text-red-400 ml-1">({s.blockedCount} blocked)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Original Stage Distribution */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Stage Distribution by Value</div>
        {stageDist.map(s => (
          <MiniBar key={s.stage} label={s.label} count={s.count} value={s.value} max={maxStageCount} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-3">90-Day Forecast</div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'Forecast: Next 30 Days', projects: next30 })}>
              <span className="text-gray-400">Next 30 days</span>
              <span className="text-green-400 font-mono">{next30.length} · {fmt$(next30.reduce((s, p) => s + (Number(p.contract) || 0), 0))}</span>
            </div>
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'Forecast: 31-60 Days', projects: next60 })}>
              <span className="text-gray-400">31-60 days</span>
              <span className="text-gray-300 font-mono">{next60.length} · {fmt$(next60.reduce((s, p) => s + (Number(p.contract) || 0), 0))}</span>
            </div>
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'Forecast: 61-90 Days', projects: next90 })}>
              <span className="text-gray-400">61-90 days</span>
              <span className="text-gray-500 font-mono">{next90.length} · {fmt$(next90.reduce((s, p) => s + (Number(p.contract) || 0), 0))}</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-3">SLA Health</div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'SLA Critical', projects: slaGroups.crit })}>
              <span className="text-red-400">Critical</span>
              <span className="text-gray-300 font-mono">{slaGroups.crit.length}</span>
            </div>
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'SLA At Risk', projects: slaGroups.risk })}>
              <span className="text-amber-400">At Risk</span>
              <span className="text-gray-300 font-mono">{slaGroups.risk.length}</span>
            </div>
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'SLA On Track', projects: slaGroups.ok })}>
              <span className="text-green-400">On Track</span>
              <span className="text-gray-300 font-mono">{slaGroups.ok.length}</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-3">Blocked / Aging</div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: 'Blocked Projects', projects: blocked })}>
              <span className="text-red-400">Blocked</span>
              <span className="text-gray-300 font-mono">{blocked.length}</span>
            </div>
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: '90+ Day Cycle', projects: aging90 })}>
              <span className="text-amber-400">90+ day cycle</span>
              <span className="text-gray-300 font-mono">{aging90.length}</span>
            </div>
            <div className="flex justify-between text-xs cursor-pointer hover:bg-gray-700/30 rounded px-1 -mx-1"
              onClick={() => setDrillDown({ title: '120+ Day Cycle', projects: aging120 })}>
              <span className="text-amber-400">120+ day cycle</span>
              <span className="text-gray-300 font-mono">{aging120.length}</span>
            </div>
          </div>
        </div>
      </div>

      {drillDown && <ProjectListModal title={drillDown.title} projects={drillDown.projects} onClose={() => setDrillDown(null)} />}
    </div>
  )
}
