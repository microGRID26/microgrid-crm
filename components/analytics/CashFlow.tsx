'use client'

import { useMemo, useState } from 'react'
import { fmt$, daysAgo } from '@/lib/utils'
import { MetricCard, PeriodBar, inRange, ProjectListModal, ExportButton, downloadCSV, type AnalyticsData } from './shared'

export function CashFlow({ data }: { data: AnalyticsData }) {
  const { projects, funding, period } = data
  const [drillDown, setDrillDown] = useState<{ title: string; projects: typeof projects } | null>(null)

  const metrics = useMemo(() => {
    // M1/M2/M3 collectable (eligible, not funded, not submitted)
    const m1Ready: typeof projects = []
    const m2Ready: typeof projects = []
    const m3Ready: typeof projects = []
    const m2Submitted: typeof projects = []
    const m3Submitted: typeof projects = []
    const m2Funded: typeof projects = []
    const m3Funded: typeof projects = []
    const m2Stale: typeof projects = [] // submitted > 30 days ago
    const m3Stale: typeof projects = []

    for (const p of projects) {
      const f = funding[p.id]
      // M1
      if (p.sale_date && (!f || (f.m1_status !== 'Funded' && f.m1_status !== 'Submitted'))) m1Ready.push(p)
      // M2
      if (p.install_complete_date && f) {
        if (f.m2_status === 'Funded') { if (inRange(f.m2_funded_date, period)) m2Funded.push(p) }
        else if (f.m2_status === 'Submitted') { m2Submitted.push(p); if (daysAgo(p.install_complete_date) > 30) m2Stale.push(p) }
        else m2Ready.push(p)
      }
      // M3
      if (p.pto_date && f) {
        if (f.m3_status === 'Funded') { if (inRange(f.m3_funded_date, period)) m3Funded.push(p) }
        else if (f.m3_status === 'Submitted') { m3Submitted.push(p); if (daysAgo(p.pto_date) > 30) m3Stale.push(p) }
        else m3Ready.push(p)
      }
    }

    const sum = (ps: typeof projects, field: 'm1_amount' | 'm2_amount' | 'm3_amount') =>
      ps.reduce((s, p) => s + (Number(funding[p.id]?.[field]) || 0), 0)

    return {
      m1Ready, m2Ready, m3Ready,
      m2Submitted, m3Submitted,
      m2Funded, m3Funded,
      m2Stale, m3Stale,
      m1ReadyAmt: sum(m1Ready, 'm1_amount'),
      m2ReadyAmt: sum(m2Ready, 'm2_amount'),
      m3ReadyAmt: sum(m3Ready, 'm3_amount'),
      m2SubmittedAmt: sum(m2Submitted, 'm2_amount'),
      m3SubmittedAmt: sum(m3Submitted, 'm3_amount'),
      m2FundedAmt: sum(m2Funded, 'm2_amount'),
      m3FundedAmt: sum(m3Funded, 'm3_amount'),
      m2StaleAmt: sum(m2Stale, 'm2_amount'),
      m3StaleAmt: sum(m3Stale, 'm3_amount'),
    }
  }, [projects, funding, period])

  const totalCollectable = metrics.m1ReadyAmt + metrics.m2ReadyAmt + metrics.m3ReadyAmt
  const totalSubmitted = metrics.m2SubmittedAmt + metrics.m3SubmittedAmt
  const totalFunded = metrics.m2FundedAmt + metrics.m3FundedAmt
  const totalStale = metrics.m2StaleAmt + metrics.m3StaleAmt

  const handleExport = () => {
    const headers = ['Category', 'Milestone', 'Projects', 'Amount']
    const rows = [
      ['Collectable', 'M1', metrics.m1Ready.length, metrics.m1ReadyAmt],
      ['Collectable', 'M2', metrics.m2Ready.length, metrics.m2ReadyAmt],
      ['Collectable', 'M3', metrics.m3Ready.length, metrics.m3ReadyAmt],
      ['Submitted', 'M2', metrics.m2Submitted.length, metrics.m2SubmittedAmt],
      ['Submitted', 'M3', metrics.m3Submitted.length, metrics.m3SubmittedAmt],
      ['Stale (>30d)', 'M2', metrics.m2Stale.length, metrics.m2StaleAmt],
      ['Stale (>30d)', 'M3', metrics.m3Stale.length, metrics.m3StaleAmt],
      ['Funded', 'M2', metrics.m2Funded.length, metrics.m2FundedAmt],
      ['Funded', 'M3', metrics.m3Funded.length, metrics.m3FundedAmt],
    ] as (string | number)[][]
    downloadCSV(`cash-flow-${period}.csv`, headers, rows)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} onCustomDateChange={data.onCustomDateChange} />}
        <ExportButton onClick={handleExport} />
      </div>

      {/* Top-line: cash position */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Collectable Now" value={fmt$(totalCollectable)} sub={`${metrics.m1Ready.length + metrics.m2Ready.length + metrics.m3Ready.length} milestones`} color="text-green-400" />
        <MetricCard label="Submitted, Waiting" value={fmt$(totalSubmitted)} sub={`${metrics.m2Submitted.length + metrics.m3Submitted.length} pending`} color="text-blue-400" />
        <MetricCard label="Funded This Period" value={fmt$(totalFunded)} sub={`${metrics.m2Funded.length + metrics.m3Funded.length} payments`} color="text-emerald-400" />
        {totalStale > 0 && (
          <MetricCard label="Stale (>30 days)" value={fmt$(totalStale)} sub={`${metrics.m2Stale.length + metrics.m3Stale.length} overdue`} color="text-red-400"
            onClick={() => setDrillDown({ title: 'Stale Submissions (>30 days)', projects: [...metrics.m2Stale, ...metrics.m3Stale] })} />
        )}
      </div>

      {/* Waterfall: Collectable → Submitted → Funded */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Cash Flow Pipeline</div>
        <div className="grid grid-cols-3 gap-6">
          {/* Collectable */}
          <div>
            <div className="text-xs text-green-400 font-semibold mb-3 uppercase tracking-wider">Ready to Collect</div>
            {[
              { label: 'M1 — Contract', amount: metrics.m1ReadyAmt, count: metrics.m1Ready.length, color: 'text-blue-400', projects: metrics.m1Ready },
              { label: 'M2 — Install', amount: metrics.m2ReadyAmt, count: metrics.m2Ready.length, color: 'text-amber-400', projects: metrics.m2Ready },
              { label: 'M3 — PTO', amount: metrics.m3ReadyAmt, count: metrics.m3Ready.length, color: 'text-purple-400', projects: metrics.m3Ready },
            ].map(m => (
              <div key={m.label} onClick={() => m.count > 0 && setDrillDown({ title: `${m.label} — Ready to Collect`, projects: m.projects })}
                className={`flex items-center justify-between py-2 border-b border-gray-700/50 ${m.count > 0 ? 'cursor-pointer hover:bg-gray-700/30' : ''}`}>
                <div>
                  <div className={`text-xs font-medium ${m.color}`}>{m.label}</div>
                  <div className="text-[10px] text-gray-600">{m.count} projects</div>
                </div>
                <div className="text-sm font-bold text-white font-mono">{fmt$(m.amount)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1">
              <div className="text-xs text-green-400 font-semibold">Total</div>
              <div className="text-lg font-bold text-green-400 font-mono">{fmt$(totalCollectable)}</div>
            </div>
          </div>

          {/* Submitted */}
          <div>
            <div className="text-xs text-blue-400 font-semibold mb-3 uppercase tracking-wider">Submitted, Waiting</div>
            {[
              { label: 'M2 Submitted', amount: metrics.m2SubmittedAmt, count: metrics.m2Submitted.length, stale: metrics.m2Stale.length, projects: metrics.m2Submitted },
              { label: 'M3 Submitted', amount: metrics.m3SubmittedAmt, count: metrics.m3Submitted.length, stale: metrics.m3Stale.length, projects: metrics.m3Submitted },
            ].map(m => (
              <div key={m.label} onClick={() => m.count > 0 && setDrillDown({ title: `${m.label} — Awaiting Payment`, projects: m.projects })}
                className={`flex items-center justify-between py-2 border-b border-gray-700/50 ${m.count > 0 ? 'cursor-pointer hover:bg-gray-700/30' : ''}`}>
                <div>
                  <div className="text-xs font-medium text-blue-400">{m.label}</div>
                  <div className="text-[10px] text-gray-600">{m.count} pending{m.stale > 0 && <span className="text-red-400 ml-1">({m.stale} stale)</span>}</div>
                </div>
                <div className="text-sm font-bold text-white font-mono">{fmt$(m.amount)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1">
              <div className="text-xs text-blue-400 font-semibold">Total</div>
              <div className="text-lg font-bold text-blue-400 font-mono">{fmt$(totalSubmitted)}</div>
            </div>
          </div>

          {/* Funded */}
          <div>
            <div className="text-xs text-emerald-400 font-semibold mb-3 uppercase tracking-wider">Funded This Period</div>
            {[
              { label: 'M2 Funded', amount: metrics.m2FundedAmt, count: metrics.m2Funded.length, projects: metrics.m2Funded },
              { label: 'M3 Funded', amount: metrics.m3FundedAmt, count: metrics.m3Funded.length, projects: metrics.m3Funded },
            ].map(m => (
              <div key={m.label} onClick={() => m.count > 0 && setDrillDown({ title: `${m.label}`, projects: m.projects })}
                className={`flex items-center justify-between py-2 border-b border-gray-700/50 ${m.count > 0 ? 'cursor-pointer hover:bg-gray-700/30' : ''}`}>
                <div>
                  <div className="text-xs font-medium text-emerald-400">{m.label}</div>
                  <div className="text-[10px] text-gray-600">{m.count} payments</div>
                </div>
                <div className="text-sm font-bold text-white font-mono">{fmt$(m.amount)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1">
              <div className="text-xs text-emerald-400 font-semibold">Total</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">{fmt$(totalFunded)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Aging Analysis — Submitted but Unfunded</div>
        <AgingTable label="M2" projects={metrics.m2Submitted} funding={funding} milestone="m2" />
        <div className="mt-4" />
        <AgingTable label="M3" projects={metrics.m3Submitted} funding={funding} milestone="m3" />
      </div>

      {/* Collection Efficiency */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Collection Efficiency</div>
        <CollectionMetrics projects={projects} funding={funding} />
      </div>

      {/* Nonfunded Codes Analysis */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Nonfunded Codes — Top Denial Reasons</div>
        <NonfundedCodes projects={projects} funding={funding} />
      </div>

      {drillDown && <ProjectListModal title={drillDown.title} projects={drillDown.projects} onClose={() => setDrillDown(null)} />}
    </div>
  )
}

// ── Aging Table sub-component ──────────────────────────────────────────────

function AgingTable({ label, projects: submitted, funding, milestone }: {
  label: string
  projects: { id: string; install_complete_date?: string | null; pto_date?: string | null }[]
  funding: Record<string, { m2_amount?: number | null; m3_amount?: number | null; m2_funded_date?: string | null; m3_funded_date?: string | null }>
  milestone: 'm2' | 'm3'
}) {
  const buckets = useMemo(() => {
    const dateField = milestone === 'm2' ? 'install_complete_date' : 'pto_date'
    const amtField = milestone === 'm2' ? 'm2_amount' : 'm3_amount'
    const ranges = [
      { label: '0-15d', min: 0, max: 15, color: 'text-green-400' },
      { label: '15-30d', min: 15, max: 30, color: 'text-amber-400' },
      { label: '30-45d', min: 30, max: 45, color: 'text-orange-400' },
      { label: '45d+', min: 45, max: Infinity, color: 'text-red-400' },
    ]
    return ranges.map(r => {
      const ps = submitted.filter(p => {
        const d = daysAgo((p as Record<string, string | null>)[dateField] as string | null)
        return d >= r.min && d < r.max
      })
      const amt = ps.reduce((s, p) => s + (Number(funding[p.id]?.[amtField]) || 0), 0)
      return { ...r, count: ps.length, amount: amt }
    })
  }, [submitted, funding, milestone])

  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">{label} Submitted — Waiting for Payment</div>
      <div className="grid grid-cols-4 gap-2">
        {buckets.map(b => (
          <div key={b.label} className="bg-gray-900/50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">{b.label}</div>
            <div className={`text-sm font-bold font-mono ${b.color}`}>{b.count}</div>
            <div className="text-[10px] text-gray-600 font-mono">{fmt$(b.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Collection Efficiency sub-component ────────────────────────────────────

function CollectionMetrics({ projects, funding }: {
  projects: { id: string; install_complete_date?: string | null; pto_date?: string | null }[]
  funding: Record<string, { m2_amount?: number | null; m3_amount?: number | null; m2_status?: string | null; m3_status?: string | null; m2_funded_date?: string | null; m3_funded_date?: string | null }>
}) {
  const stats = useMemo(() => {
    let m2Eligible = 0, m2Funded = 0, m2DaysTotal = 0, m2DaysCount = 0
    let m3Eligible = 0, m3Funded = 0, m3DaysTotal = 0, m3DaysCount = 0

    for (const p of projects) {
      const f = funding[p.id]
      if (!f) continue
      // M2: eligible = has install_complete_date
      if (p.install_complete_date) {
        m2Eligible++
        if (f.m2_status === 'Funded') {
          m2Funded++
          if (f.m2_funded_date) {
            const eligible = new Date(p.install_complete_date + 'T00:00:00').getTime()
            const funded = new Date(f.m2_funded_date + 'T00:00:00').getTime()
            if (funded >= eligible) { m2DaysTotal += (funded - eligible) / 86400000; m2DaysCount++ }
          }
        }
      }
      // M3: eligible = has pto_date
      if (p.pto_date) {
        m3Eligible++
        if (f.m3_status === 'Funded') {
          m3Funded++
          if (f.m3_funded_date) {
            const eligible = new Date(p.pto_date + 'T00:00:00').getTime()
            const funded = new Date(f.m3_funded_date + 'T00:00:00').getTime()
            if (funded >= eligible) { m3DaysTotal += (funded - eligible) / 86400000; m3DaysCount++ }
          }
        }
      }
    }

    const m2Rate = m2Eligible > 0 ? Math.round((m2Funded / m2Eligible) * 100) : 0
    const m3Rate = m3Eligible > 0 ? Math.round((m3Funded / m3Eligible) * 100) : 0
    const m2AvgDays = m2DaysCount > 0 ? Math.round(m2DaysTotal / m2DaysCount) : 0
    const m3AvgDays = m3DaysCount > 0 ? Math.round(m3DaysTotal / m3DaysCount) : 0

    return { m2Rate, m3Rate, m2AvgDays, m3AvgDays }
  }, [projects, funding])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">M2 Collection Rate</div>
        <div className={`text-xl font-bold font-mono ${stats.m2Rate >= 80 ? 'text-green-400' : stats.m2Rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{stats.m2Rate}%</div>
      </div>
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">M3 Collection Rate</div>
        <div className={`text-xl font-bold font-mono ${stats.m3Rate >= 80 ? 'text-green-400' : stats.m3Rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{stats.m3Rate}%</div>
      </div>
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">Avg Days to M2</div>
        <div className={`text-xl font-bold font-mono ${stats.m2AvgDays > 30 ? 'text-red-400' : 'text-blue-400'}`}>{stats.m2AvgDays}d</div>
      </div>
      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-500 uppercase">Avg Days to M3</div>
        <div className={`text-xl font-bold font-mono ${stats.m3AvgDays > 30 ? 'text-red-400' : 'text-blue-400'}`}>{stats.m3AvgDays}d</div>
      </div>
    </div>
  )
}

// ── Nonfunded Codes sub-component ──────────────────────────────────────────

function NonfundedCodes({ projects, funding }: {
  projects: { id: string; contract?: number | null }[]
  funding: Record<string, { nonfunded_code_1?: string | null; nonfunded_code_2?: string | null; nonfunded_code_3?: string | null }>
}) {
  const codes = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    for (const p of projects) {
      const f = funding[p.id]
      if (!f) continue
      const pVal = Number(p.contract) || 0
      for (const code of [f.nonfunded_code_1, f.nonfunded_code_2, f.nonfunded_code_3]) {
        if (code) {
          if (!map[code]) map[code] = { count: 0, value: 0 }
          map[code].count++
          map[code].value += pVal
        }
      }
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  }, [projects, funding])

  if (codes.length === 0) return <div className="text-xs text-gray-600">No nonfunded codes recorded</div>

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-700">
          <th className="text-left text-gray-500 font-medium px-2 py-1">Code</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Projects</th>
          <th className="text-right text-gray-500 font-medium px-2 py-1">Contract Value</th>
        </tr>
      </thead>
      <tbody>
        {codes.map(([code, d]) => (
          <tr key={code} className="border-b border-gray-800">
            <td className="px-2 py-1.5 text-gray-300">{code}</td>
            <td className="px-2 py-1.5 text-red-400 font-mono text-right">{d.count}</td>
            <td className="px-2 py-1.5 text-gray-400 font-mono text-right">{fmt$(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
