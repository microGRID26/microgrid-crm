'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Nav } from '@/components/Nav'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg } from '@/lib/hooks'
import { fmt$, fmtDate } from '@/lib/utils'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import {
  loadCommissionRecords,
  loadEarningsSummary,
  loadUsers,
  loadProjectById,
  COMMISSION_STATUS_BADGE,
  COMMISSION_STATUS_LABELS,
  DEFAULT_ROLES,
} from '@/lib/api'
import type { CommissionRecord } from '@/types/database'
import type { Project } from '@/types/database'
import type { EarningsSummary } from '@/lib/api'
import { DollarSign, TrendingUp, Clock, CheckCircle, Trophy, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'earnings' | 'leaderboard'
type Period = 'month' | 'quarter' | 'year' | 'all'
type LeaderboardMetric = 'commission' | 'deals' | 'kw'
type SortCol = 'project_id' | 'user_name' | 'system_watts' | 'role_key' | 'solar_commission' | 'adder_commission' | 'referral_commission' | 'total_commission' | 'status' | 'created_at'

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_ROLES.map(r => [r.key, r.label])
)

const PERIOD_LABELS: Record<Period, string> = {
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  all: 'All Time',
}

function getPeriodRange(period: Period): { from?: string; to?: string } {
  if (period === 'all') return {}
  const now = new Date()
  let start: Date
  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) * 3
    start = new Date(now.getFullYear(), q, 1)
  } else {
    start = new Date(now.getFullYear(), 0, 1)
  }
  return { from: start.toISOString() }
}

// ── Leaderboard entry type ──────────────────────────────────────────────────

interface LeaderboardEntry {
  userId: string | null
  userName: string
  deals: number
  totalKw: number
  totalCommission: number
  avgPerDeal: number
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const { orgId } = useOrg()

  const [tab, setTab] = useState<Tab>('earnings')
  const [period, setPeriod] = useState<Period>('month')
  const [viewUserId, setViewUserId] = useState<string | null>(null) // admin override
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [monthSummary, setMonthSummary] = useState<EarningsSummary | null>(null)
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [allRecords, setAllRecords] = useState<CommissionRecord[]>([]) // for leaderboard
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Expandable row
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  // Leaderboard state
  const [lbPeriod, setLbPeriod] = useState<Period>('month')
  const [lbMetric, setLbMetric] = useState<LeaderboardMetric>('commission')

  // ProjectPanel
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [panelProject, setPanelProject] = useState<Project | null>(null)

  // Load project for ProjectPanel when openProject changes
  useEffect(() => {
    if (!openProject) { setPanelProject(null); return }
    loadProjectById(openProject).then(p => { if (p) setPanelProject(p) })
  }, [openProject])

  // Monthly trend data (last 6 months)
  const [monthlyTrend, setMonthlyTrend] = useState<{ label: string; amount: number }[]>([])

  // Load data
  const loadData = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)

    const uid = viewUserId ?? currentUser.id

    // Load all-time summary
    const allTimeSummary = await loadEarningsSummary(uid, orgId)
    setSummary(allTimeSummary)

    // Load current month summary
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const mSummary = await loadEarningsSummary(uid, orgId, { from: monthStart })
    setMonthSummary(mSummary)

    // Load recent records for table (period-filtered)
    const range = getPeriodRange(period)
    const recs = await loadCommissionRecords({
      userId: uid,
      orgId,
      dateFrom: range.from,
      dateTo: range.to,
    })
    setRecords(recs)

    // Load all records for leaderboard (no user filter)
    const lbRange = getPeriodRange(lbPeriod)
    const allRecs = await loadCommissionRecords({
      orgId,
      dateFrom: lbRange.from,
      dateTo: lbRange.to,
    })
    setAllRecords(allRecs)

    // Load users for admin dropdown + leaderboard names
    const { data: usersData } = await loadUsers()
    setUsers(usersData)

    // Build monthly trend (last 6 months) — single query covers entire range
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const trendRecs = await loadCommissionRecords({
      userId: uid,
      orgId,
      dateFrom: trendStart.toISOString(),
    })
    const trend: { label: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const mStart = d.getTime()
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime()
      const monthTotal = trendRecs
        .filter(r => {
          if (r.status === 'cancelled') return false
          const t = new Date(r.created_at).getTime()
          return t >= mStart && t <= mEnd
        })
        .reduce((sum, r) => sum + (r.total_commission ?? 0), 0)
      trend.push({ label, amount: Math.round(monthTotal * 100) / 100 })
    }
    setMonthlyTrend(trend)

    setLoading(false)
  }, [currentUser, viewUserId, orgId, period, lbPeriod])

  useEffect(() => {
    if (!userLoading && currentUser) loadData()
  }, [userLoading, currentUser, loadData])

  // Refresh leaderboard when its period changes
  useEffect(() => {
    if (!currentUser || loading) return
    const lbRange = getPeriodRange(lbPeriod)
    loadCommissionRecords({
      orgId,
      dateFrom: lbRange.from,
      dateTo: lbRange.to,
    }).then(setAllRecords)
  }, [lbPeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    loadData().finally(() => setTimeout(() => setRefreshing(false), 400))
  }, [loadData])

  // Sort records
  const sortedRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return sorted.slice(0, 20)
  }, [records, sortCol, sortAsc])

  // Build leaderboard
  const leaderboard = useMemo((): LeaderboardEntry[] => {
    const map = new Map<string, LeaderboardEntry>()

    for (const r of allRecords) {
      if (r.status === 'cancelled') continue
      const key = r.user_name ?? r.user_id ?? 'Unknown'
      const existing = map.get(key) ?? {
        userId: r.user_id,
        userName: r.user_name ?? 'Unknown',
        deals: 0,
        totalKw: 0,
        totalCommission: 0,
        avgPerDeal: 0,
      }
      existing.deals += 1
      existing.totalKw += (r.system_watts ?? 0) / 1000
      existing.totalCommission += r.total_commission ?? 0
      map.set(key, existing)
    }

    const entries = Array.from(map.values()).map(e => ({
      ...e,
      totalKw: Math.round(e.totalKw * 100) / 100,
      totalCommission: Math.round(e.totalCommission * 100) / 100,
      avgPerDeal: e.deals > 0 ? Math.round((e.totalCommission / e.deals) * 100) / 100 : 0,
    }))

    // Sort by selected metric
    if (lbMetric === 'commission') entries.sort((a, b) => b.totalCommission - a.totalCommission)
    else if (lbMetric === 'deals') entries.sort((a, b) => b.deals - a.deals)
    else entries.sort((a, b) => b.totalKw - a.totalKw)

    return entries
  }, [allRecords, lbMetric])

  // Leaderboard summary cards
  const lbSummary = useMemo(() => {
    const topEarner = leaderboard[0]
    const totalEarnings = leaderboard.reduce((s, e) => s + e.totalCommission, 0)
    const totalDeals = leaderboard.reduce((s, e) => s + e.deals, 0)
    const avgCommission = leaderboard.length > 0 ? totalEarnings / leaderboard.length : 0
    return { topEarner, totalEarnings, totalDeals, avgCommission }
  }, [leaderboard])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
  }

  const SortIcon = ({ col }: { col: SortCol }) => (
    sortCol === col
      ? sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
      : null
  )

  // Loading state
  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-green-400 text-sm animate-pulse">Loading earnings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Nav active="Earnings" />

      {/* Filter bar */}
      <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex flex-wrap items-center gap-2">
        <button onClick={handleRefresh} disabled={refreshing}
          className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-md px-2 py-1.5 transition-colors disabled:opacity-50 flex items-center gap-1"
          title="Refresh data" aria-label="Refresh earnings data">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Period pills */}
        {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([k, v]) => (
          <button key={k} onClick={() => setPeriod(k)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              period === k ? 'bg-green-700 text-white' : 'text-gray-400 hover:text-white border border-gray-700'
            }`}>
            {v}
          </button>
        ))}

        {/* Admin: user dropdown */}
        {currentUser?.isAdmin && (
          <select
            value={viewUserId ?? ''}
            onChange={e => setViewUserId(e.target.value || null)}
            className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5 ml-auto"
            aria-label="View earnings for user"
          >
            <option value="">My Earnings</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-gray-950 border-b border-gray-800 flex px-4 flex-shrink-0" role="tablist" aria-label="Earnings tabs">
        {([['earnings', 'My Earnings'], ['leaderboard', 'Leaderboard']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            role="tab" aria-selected={tab === t}
            className={`text-xs px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
              tab === t ? 'border-green-400 text-green-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {tab === 'earnings' && (
          <MyEarningsTab
            summary={summary}
            monthSummary={monthSummary}
            records={sortedRecords}
            monthlyTrend={monthlyTrend}
            toggleSort={toggleSort}
            SortIcon={SortIcon}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            setOpenProject={setOpenProject}
          />
        )}
        {tab === 'leaderboard' && (
          <LeaderboardTab
            leaderboard={leaderboard}
            summary={lbSummary}
            period={lbPeriod}
            setPeriod={setLbPeriod}
            metric={lbMetric}
            setMetric={setLbMetric}
            currentUserId={currentUser?.id ?? null}
          />
        )}
      </div>

      {/* ProjectPanel */}
      {panelProject && (
        <ProjectPanel
          project={panelProject}
          onClose={() => { setOpenProject(null); setPanelProject(null) }}
          onProjectUpdated={loadData}
        />
      )}
    </div>
  )
}

// ── My Earnings Tab ──────────────────────────────────────────────────────────

function MyEarningsTab({
  summary,
  monthSummary,
  records,
  monthlyTrend,
  toggleSort,
  SortIcon,
  expandedId,
  setExpandedId,
  setOpenProject,
}: {
  summary: EarningsSummary | null
  monthSummary: EarningsSummary | null
  records: CommissionRecord[]
  monthlyTrend: { label: string; amount: number }[]
  toggleSort: (col: SortCol) => void
  SortIcon: React.FC<{ col: SortCol }>
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setOpenProject: (id: string | null) => void
}) {
  const maxTrend = Math.max(...monthlyTrend.map(m => m.amount), 1)

  return (
    <div className="space-y-6">
      {/* Hero Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroCard
          label="Total Earned"
          value={fmt$(summary?.totalEarned ?? 0)}
          icon={<DollarSign className="w-6 h-6" />}
          accent="green"
          subtitle="All time"
        />
        <HeroCard
          label="This Month"
          value={fmt$(monthSummary?.totalEarned ?? 0)}
          icon={<TrendingUp className="w-6 h-6" />}
          accent="blue"
          subtitle={`${(monthSummary?.byRole ?? []).reduce((s, r) => s + r.count, 0)} deals`}
        />
        <HeroCard
          label="Pending"
          value={fmt$(summary?.totalPending ?? 0)}
          icon={<Clock className="w-6 h-6" />}
          accent="amber"
          subtitle="Awaiting approval"
        />
        <HeroCard
          label="Paid"
          value={fmt$(summary?.totalPaid ?? 0)}
          icon={<CheckCircle className="w-6 h-6" />}
          accent="emerald"
          subtitle="In your pocket"
        />
      </div>

      {/* Earnings Trend Chart (last 6 months) */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          Earnings Trend (Last 6 Months)
        </h3>
        <div className="flex items-end gap-3 h-40">
          {monthlyTrend.map((m, i) => {
            const pct = maxTrend > 0 ? (m.amount / maxTrend) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-green-400 font-medium">
                  {m.amount > 0 ? fmt$(m.amount) : ''}
                </span>
                <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                  <div
                    className="w-full max-w-[48px] rounded-t-md transition-all duration-500"
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      background: `linear-gradient(to top, #065f46, #10b981)`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Goal Tracker Placeholder */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          Monthly Goal
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-900 rounded-full h-4 overflow-hidden">
            {(() => {
              const monthDeals = (monthSummary?.byRole ?? []).reduce((s, r) => s + r.count, 0)
              const goal = 10 // placeholder goal
              const pct = Math.min((monthDeals / goal) * 100, 100)
              return (
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100
                      ? 'linear-gradient(to right, #10b981, #34d399)'
                      : 'linear-gradient(to right, #065f46, #10b981)',
                  }}
                />
              )
            })()}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {(monthSummary?.byRole ?? []).reduce((s, r) => s + r.count, 0)} / 10 deals
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">Goal tracking coming soon -- this is a preview.</p>
      </div>

      {/* Recent Deals Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Recent Deals
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700/50">
                {[
                  { col: 'project_id' as SortCol, label: 'Project' },
                  { col: 'system_watts' as SortCol, label: 'kW' },
                  { col: 'role_key' as SortCol, label: 'Role' },
                  { col: 'solar_commission' as SortCol, label: 'Solar $' },
                  { col: 'adder_commission' as SortCol, label: 'Adder $' },
                  { col: 'referral_commission' as SortCol, label: 'Referral $' },
                  { col: 'total_commission' as SortCol, label: 'Total' },
                  { col: 'status' as SortCol, label: 'Status' },
                  { col: 'created_at' as SortCol, label: 'Date' },
                ].map(({ col, label }) => (
                  <th key={col} className="px-3 py-2 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort(col)}>
                    {label}<SortIcon col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No commission records found for this period.</td></tr>
              )}
              {records.map(r => (
                <React.Fragment key={r.id}>
                  <tr
                    className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenProject(r.project_id) }}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {r.project_id}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-300">{r.system_watts ? ((r.system_watts / 1000).toFixed(1)) : '--'}</td>
                    <td className="px-3 py-2 text-gray-300">{ROLE_LABELS[r.role_key] ?? r.role_key}</td>
                    <td className="px-3 py-2 text-gray-300">{fmt$(r.solar_commission)}</td>
                    <td className="px-3 py-2 text-gray-300">{fmt$(r.adder_commission)}</td>
                    <td className="px-3 py-2 text-gray-300">{fmt$(r.referral_commission)}</td>
                    <td className="px-3 py-2 font-medium text-green-400">{fmt$(r.total_commission)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${COMMISSION_STATUS_BADGE[r.status]}`}>
                        {COMMISSION_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{fmtDate(r.created_at)}</td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-gray-850">
                      <td colSpan={9} className="px-4 py-3 bg-gray-900/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-gray-500">Rate</p>
                            <p className="text-gray-300">${r.rate}/watt</p>
                          </div>
                          <div>
                            <p className="text-gray-500">System Watts</p>
                            <p className="text-gray-300">{(r.system_watts ?? 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Adder Revenue</p>
                            <p className="text-gray-300">{fmt$(r.adder_revenue ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Referrals</p>
                            <p className="text-gray-300">{r.referral_count}</p>
                          </div>
                          {r.milestone && (
                            <div>
                              <p className="text-gray-500">Milestone</p>
                              <p className="text-gray-300">{r.milestone}</p>
                            </div>
                          )}
                          {r.paid_at && (
                            <div>
                              <p className="text-gray-500">Paid At</p>
                              <p className="text-gray-300">{fmtDate(r.paid_at)}</p>
                            </div>
                          )}
                          {r.notes && (
                            <div className="col-span-2">
                              <p className="text-gray-500">Notes</p>
                              <p className="text-gray-300">{r.notes}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Hero Stat Card ───────────────────────────────────────────────────────────

function HeroCard({ label, value, icon, accent, subtitle }: {
  label: string
  value: string
  icon: React.ReactNode
  accent: 'green' | 'blue' | 'amber' | 'emerald'
  subtitle?: string
}) {
  const colors = {
    green: { bg: 'bg-green-900/30', border: 'border-green-700/50', text: 'text-green-400', icon: 'text-green-500' },
    blue: { bg: 'bg-blue-900/30', border: 'border-blue-700/50', text: 'text-blue-400', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-900/30', border: 'border-amber-700/50', text: 'text-amber-400', icon: 'text-amber-500' },
    emerald: { bg: 'bg-emerald-900/30', border: 'border-emerald-700/50', text: 'text-emerald-400', icon: 'text-emerald-500' },
  }
  const c = colors[accent]

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 md:p-6`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <span className={c.icon}>{icon}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${c.text} tracking-tight`}>{value}</p>
      {subtitle && <p className="text-[10px] text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// ── Leaderboard Tab ──────────────────────────────────────────────────────────

function LeaderboardTab({
  leaderboard,
  summary,
  period,
  setPeriod,
  metric,
  setMetric,
  currentUserId,
}: {
  leaderboard: LeaderboardEntry[]
  summary: { topEarner: LeaderboardEntry | undefined; totalEarnings: number; totalDeals: number; avgCommission: number }
  period: Period
  setPeriod: (p: Period) => void
  metric: LeaderboardMetric
  setMetric: (m: LeaderboardMetric) => void
  currentUserId: string | null
}) {
  return (
    <div className="space-y-6">
      {/* Period + Metric selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['month', 'quarter', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                period === p ? 'bg-green-700 text-white' : 'text-gray-400 hover:text-white border border-gray-700'
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-gray-700" />
        <div className="flex gap-1">
          {([['commission', 'Total Commission'], ['deals', 'Deal Count'], ['kw', 'Total kW']] as [LeaderboardMetric, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setMetric(m)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                metric === m ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white border border-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-yellow-700/30 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Top Earner</p>
          <p className="text-sm font-semibold text-yellow-400">{summary.topEarner?.userName ?? '--'}</p>
          <p className="text-xs text-gray-500">{fmt$(summary.topEarner?.totalCommission ?? 0)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Avg Commission</p>
          <p className="text-lg font-bold text-white">{fmt$(summary.avgCommission)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Team Earnings</p>
          <p className="text-lg font-bold text-green-400">{fmt$(summary.totalEarnings)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Deals</p>
          <p className="text-lg font-bold text-white">{summary.totalDeals}</p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Rankings
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700/50">
                <th className="px-3 py-2 font-medium w-12">#</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium text-right">Deals</th>
                <th className="px-3 py-2 font-medium text-right">Total kW</th>
                <th className="px-3 py-2 font-medium text-right">Commission</th>
                <th className="px-3 py-2 font-medium text-right">Avg/Deal</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No data for this period.</td></tr>
              )}
              {leaderboard.map((entry, i) => {
                const rank = i + 1
                const isMe = entry.userId === currentUserId
                const rankBg = rank === 1
                  ? 'bg-yellow-900/20'
                  : rank === 2
                    ? 'bg-gray-700/20'
                    : rank === 3
                      ? 'bg-amber-900/20'
                      : ''
                const rankBorder = isMe ? 'border-l-2 border-l-green-400' : ''

                return (
                  <tr key={entry.userName} className={`border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors ${rankBg} ${rankBorder}`}>
                    <td className="px-3 py-2.5">
                      {rank === 1 && <span className="text-yellow-400 font-bold">1</span>}
                      {rank === 2 && <span className="text-gray-400 font-bold">2</span>}
                      {rank === 3 && <span className="text-amber-600 font-bold">3</span>}
                      {rank > 3 && <span className="text-gray-500">{rank}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-medium ${isMe ? 'text-green-400' : 'text-white'}`}>
                        {entry.userName}
                      </span>
                      {isMe && <span className="text-[10px] text-green-500 ml-1.5">(you)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{entry.deals}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{entry.totalKw.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-green-400">{fmt$(entry.totalCommission)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt$(entry.avgPerDeal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
