'use client'

import { fmt$ } from '@/lib/utils'
import { MetricCard, PeriodBar, type AnalyticsData } from './shared'

// ── Mock Data ───────────────────────────────────────────────────────────────

const COST_BREAKDOWN = [
  { category: 'Solar Crew Labor', avgCost: 2100, pctTotal: 25, trend: '—' as const },
  { category: 'Electrical Labor', avgCost: 1400, pctTotal: 17, trend: 'up' as const },
  { category: 'Modules', avgCost: 2800, pctTotal: 33, trend: 'down' as const },
  { category: 'Inverter', avgCost: 800, pctTotal: 9, trend: '—' as const },
  { category: 'Racking & BOS', avgCost: 500, pctTotal: 6, trend: '—' as const },
  { category: 'Permit Fees', avgCost: 350, pctTotal: 4, trend: '—' as const },
  { category: 'Engineering', avgCost: 300, pctTotal: 4, trend: '—' as const },
  { category: 'Travel/Other', avgCost: 200, pctTotal: 2, trend: 'up' as const },
]

const MARGIN_BY_SIZE = [
  { label: '< 8 kW', margin: 22, color: '#22c55e', note: 'Smaller systems, fixed costs spread thin' },
  { label: '8-12 kW', margin: 18, color: '#3b82f6', note: 'Sweet spot for volume' },
  { label: '12-16 kW', margin: 15, color: '#f59e0b', note: 'More labor, more materials' },
  { label: '16+ kW', margin: 12, color: '#ec4899', note: 'Complex, multi-day installs' },
]

const COST_TREND = [
  { month: 'Nov', cost: 7800 },
  { month: 'Dec', cost: 7950 },
  { month: 'Jan', cost: 8100 },
  { month: 'Feb', cost: 8200 },
  { month: 'Mar', cost: 8350 },
  { month: 'Apr', cost: 8450 },
]

const TOP_COST_DRIVERS = [
  { item: 'Module cost per watt', value: '$0.38', trend: 'down' as const, detail: 'Panel pricing declining globally' },
  { item: 'Crew labor per install', value: '$3,500', trend: 'up' as const, detail: 'Wage inflation + overtime' },
  { item: 'Permit avg cost', value: '$350', trend: 'stable' as const, detail: 'Varies by AHJ' },
  { item: 'Travel cost per install', value: '$180', trend: 'up' as const, detail: 'Fuel + vehicle maintenance' },
  { item: 'Rework cost per incident', value: '$1,200', trend: 'stable' as const, detail: 'Avg service call + crew time' },
]

const MARGIN_BY_DEALER = [
  { dealer: 'Online Lead', margin: 23, color: '#22c55e' },
  { dealer: 'Sunrun Partners', margin: 21, color: '#3b82f6' },
  { dealer: 'Direct Sales', margin: 19, color: '#8b5cf6' },
  { dealer: 'Tesla Referral', margin: 16, color: '#f59e0b' },
  { dealer: 'Dealer Network A', margin: 14, color: '#ec4899' },
]

const ROADMAP_PHASES = [
  { phase: 'Phase 1', title: 'Crew Rates + Auto-Capture', status: 'next' as const, items: ['Configure hourly rates per crew', 'Auto-capture labor hours from work order completion', 'Calculate labor cost per install'] },
  { phase: 'Phase 2', title: 'Material Cost Integration', status: 'planned' as const, items: ['Pull material costs from equipment/inventory tables', 'Link BOM to individual projects', 'Track cost per watt for modules'] },
  { phase: 'Phase 3', title: 'Full P&L per Project', status: 'planned' as const, items: ['Complete cost rollup per project', 'Real-time margin calculation', 'Margin alerts when below threshold'] },
  { phase: 'Phase 4', title: 'Historical Trending + Budget vs Actual', status: 'future' as const, items: ['6-month rolling cost trends', 'Budget targets by category', 'Variance analysis and alerts'] },
]

// ── Mock Data for New Dense Sections ────────────────────────────────────────

const PROFITABILITY_BUCKETS = [
  { label: '<10% Margin', count: 12, pct: 8, avgRevenue: 32000, avgCost: 29500, color: 'text-red-400', barColor: 'bg-red-500' },
  { label: '10-15% Margin', count: 28, pct: 19, avgRevenue: 38000, avgCost: 33500, color: 'text-amber-400', barColor: 'bg-amber-500' },
  { label: '15-20% Margin', count: 52, pct: 35, avgRevenue: 42000, avgCost: 35700, color: 'text-yellow-400', barColor: 'bg-yellow-500' },
  { label: '20-25% Margin', count: 38, pct: 26, avgRevenue: 48000, avgCost: 38400, color: 'text-green-400', barColor: 'bg-green-500' },
  { label: '>25% Margin', count: 18, pct: 12, avgRevenue: 55000, avgCost: 40150, color: 'text-emerald-400', barColor: 'bg-emerald-500' },
]

const COST_PER_WATT = [
  { category: 'Labor', ours: 0.42, industry: 0.45 },
  { category: 'Materials', ours: 0.68, industry: 0.62 },
  { category: 'Permits', ours: 0.04, industry: 0.05 },
  { category: 'Overhead', ours: 0.12, industry: 0.15 },
  { category: 'Total', ours: 1.26, industry: 1.27 },
]

const CREW_COSTS = [
  { crew: 'Crew Alpha', avgHrs: 14, avgLabor: 3200, avgTotal: 8100, margin: 21 },
  { crew: 'Crew Bravo', avgHrs: 16, avgLabor: 3600, avgTotal: 8800, margin: 17 },
  { crew: 'Crew Charlie', avgHrs: 12, avgLabor: 2900, avgTotal: 7600, margin: 24 },
  { crew: 'Crew Delta', avgHrs: 18, avgLabor: 4100, avgTotal: 9400, margin: 13 },
]

// ── Component ───────────────────────────────────────────────────────────────

export function JobCosting({ data }: { data: AnalyticsData }) {
  const maxMarginSize = Math.max(...MARGIN_BY_SIZE.map(m => m.margin))
  const maxDealerMargin = Math.max(...MARGIN_BY_DEALER.map(m => m.margin))
  const maxCost = Math.max(...COST_TREND.map(c => c.cost))
  const minCost = Math.min(...COST_TREND.map(c => c.cost))
  const costRange = maxCost - minCost || 1

  const trendIcon = (t: 'up' | 'down' | 'stable' | '—') => {
    if (t === 'up') return { symbol: '\u2191', color: 'text-red-400', label: 'Trending up' }
    if (t === 'down') return { symbol: '\u2193', color: 'text-green-400', label: 'Trending down' }
    if (t === 'stable') return { symbol: '\u2014', color: 'text-gray-500', label: 'Stable' }
    return { symbol: '\u2014', color: 'text-gray-600', label: 'No data' }
  }

  return (
    <div className="max-w-6xl space-y-8">
      {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}

      {/* Mock Data Banner */}
      <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Preview Mode — Mock Data</span>
        </div>
        <div className="text-sm text-gray-300 mt-1">
          This dashboard shows realistic sample data. Actual cost tracking will activate when crew rates and material costs are configured.
        </div>
      </div>

      {/* 4 Headline MetricCards (mock data) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Avg Job Cost" value={fmt$(8450)} sub="Labor + materials + permits per install"
          formula="Average total cost per completed install, including crew labor, materials, permits, engineering, and overhead. Placeholder — requires cost tables." />
        <MetricCard label="Labor %" value="42%" sub="Crew labor as % of total job cost" color="text-blue-400"
          formula="(Solar crew labor + electrical labor) / total job cost. Placeholder — requires crew rate configuration." />
        <MetricCard label="Materials %" value="48%" sub="Equipment + materials as % of total job cost" color="text-purple-400"
          formula="(Modules + inverter + racking + BOS) / total job cost. Placeholder — requires material pricing in equipment table." />
        <MetricCard label="Avg Margin" value="18%" sub="(Contract - Total Cost) / Contract" color="text-green-400"
          formula="(Average contract value - average job cost) / average contract value. Placeholder — requires cost tables to calculate actual margin." />
      </div>

      {/* Margin Analysis by System Size */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Margin Analysis by System Size</div>
        <div className="space-y-3">
          {MARGIN_BY_SIZE.map(s => {
            const pct = (s.margin / maxMarginSize) * 100
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-300 text-right flex-shrink-0 font-mono">{s.label}</div>
                <div className="flex-1 h-8 bg-gray-700/50 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded flex items-center px-3"
                    style={{ width: `${Math.max(pct, 15)}%`, backgroundColor: s.color, opacity: 0.25 }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 justify-between">
                    <span className="text-xs font-bold font-mono text-white">{s.margin}%</span>
                    <span className="text-[10px] text-gray-400 hidden sm:inline">{s.note}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-[10px] text-gray-600">
          Margin = (Contract Value - Total Job Cost) / Contract Value. Smaller systems have higher margin due to lower absolute cost with similar contract pricing.
        </div>
      </div>

      {/* Cost Trend (6-month mock) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Cost Per Install — 6-Month Trend</div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-red-400">Materials +8%</span>
            <span className="text-amber-400">Labor +3%</span>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40">
          {COST_TREND.map((c, i) => {
            const normalizedPct = ((c.cost - minCost) / costRange) * 60 + 30 // 30-90% range
            const isLatest = i === COST_TREND.length - 1
            return (
              <div key={c.month} className="flex-1 flex flex-col items-center gap-1">
                <div className={`text-xs font-mono ${isLatest ? 'text-white font-bold' : 'text-gray-400'}`}>
                  {fmt$(c.cost)}
                </div>
                <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                  <div
                    className={`w-full max-w-14 rounded-t-lg transition-all ${isLatest ? 'ring-1 ring-amber-500/50' : ''}`}
                    style={{
                      height: `${normalizedPct}%`,
                      backgroundColor: isLatest ? '#f59e0b' : '#6b7280',
                      opacity: isLatest ? 0.85 : 0.5,
                    }}
                  />
                </div>
                <div className="text-[10px] text-gray-500">{c.month}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-amber-500 opacity-85" />
          <span className="text-[10px] text-gray-500">Current month</span>
          <div className="w-3 h-3 rounded-sm bg-gray-500 opacity-50 ml-2" />
          <span className="text-[10px] text-gray-500">Prior months</span>
        </div>
        <div className="mt-2 text-xs text-amber-400/80 bg-amber-950/20 rounded-lg px-3 py-2 border border-amber-900/20">
          Cost per install has risen {fmt$(COST_TREND[COST_TREND.length - 1].cost - COST_TREND[0].cost)} (+{Math.round(((COST_TREND[COST_TREND.length - 1].cost - COST_TREND[0].cost) / COST_TREND[0].cost) * 100)}%) over 6 months, driven primarily by material and labor increases.
        </div>
      </div>

      {/* Top Cost Drivers */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Top Cost Drivers</div>
        <div className="space-y-0.5">
          {TOP_COST_DRIVERS.map(d => {
            const t = trendIcon(d.trend)
            return (
              <div key={d.item} className="flex items-center gap-3 py-2.5 border-b border-gray-700/50 last:border-0">
                <div className="flex-1">
                  <div className="text-sm text-gray-300">{d.item}</div>
                  <div className="text-[10px] text-gray-600">{d.detail}</div>
                </div>
                <div className="text-sm font-mono text-white font-bold w-20 text-right">{d.value}</div>
                <div className={`w-16 text-right ${t.color}`}>
                  <span className="text-sm font-bold" title={t.label}>{t.symbol}</span>
                  <span className="text-[10px] ml-1">{d.trend === 'up' ? 'Up' : d.trend === 'down' ? 'Down' : 'Flat'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost Breakdown Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Cost Breakdown by Category</div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs text-gray-500 font-medium pb-2">Category</th>
              <th className="text-right text-xs text-gray-500 font-medium pb-2">Avg Cost</th>
              <th className="text-right text-xs text-gray-500 font-medium pb-2">% of Total</th>
              <th className="text-right text-xs text-gray-500 font-medium pb-2">Trend</th>
            </tr>
          </thead>
          <tbody>
            {COST_BREAKDOWN.map(row => {
              const t = trendIcon(row.trend)
              return (
                <tr key={row.category} className="border-b border-gray-700/50">
                  <td className="py-2.5 text-sm text-gray-300">{row.category}</td>
                  <td className="py-2.5 text-sm text-white font-mono text-right">{fmt$(row.avgCost)}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-700/50 rounded-full h-1.5">
                        <div className="bg-green-500/60 h-1.5 rounded-full" style={{ width: `${row.pctTotal}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 font-mono w-8 text-right">{row.pctTotal}%</span>
                    </div>
                  </td>
                  <td className={`py-2.5 text-sm text-center ${t.color}`}>{t.symbol}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600">
              <td className="py-2.5 text-sm text-white font-semibold">Total</td>
              <td className="py-2.5 text-sm text-white font-mono text-right font-bold">
                {fmt$(COST_BREAKDOWN.reduce((s, r) => s + r.avgCost, 0))}
              </td>
              <td className="py-2.5 text-right">
                <span className="text-xs text-gray-400 font-mono">100%</span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Margin by Dealer */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Margin by Dealer Channel</div>
        <div className="space-y-2.5">
          {MARGIN_BY_DEALER.map(d => {
            const pct = (d.margin / maxDealerMargin) * 100
            const isHigh = d.margin >= 20
            const isLow = d.margin < 16
            return (
              <div key={d.dealer} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-300 text-right flex-shrink-0 truncate">{d.dealer}</div>
                <div className="flex-1 h-7 bg-gray-700/50 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max(pct, 12)}%`,
                      backgroundColor: d.color,
                      opacity: 0.3,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className={`text-xs font-bold font-mono ${isHigh ? 'text-green-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
                      {d.margin}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-[10px] text-gray-600">
          Margin varies by acquisition channel. Online leads and direct sales yield higher margins due to lower acquisition costs.
        </div>
      </div>

      {/* ── Project Profitability Distribution (mock) ──────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Project Profitability Distribution</div>
        <div className="text-[10px] text-amber-500/70 mb-3">Simulated data — requires cost tracking tables</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-500 font-medium px-2 py-1.5">Margin Bucket</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Projects</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">% of Total</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Revenue</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Cost</th>
                <th className="text-left text-gray-500 font-medium px-2 py-1.5 w-28">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {PROFITABILITY_BUCKETS.map(b => (
                <tr key={b.label} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className={`px-2 py-1.5 font-medium ${b.color}`}>{b.label}</td>
                  <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{b.count}</td>
                  <td className="px-2 py-1.5 text-gray-400 font-mono text-right">{b.pct}%</td>
                  <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(b.avgRevenue)}</td>
                  <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(b.avgCost)}</td>
                  <td className="px-2 py-1.5">
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${b.barColor}`} style={{ width: `${Math.max(b.pct, 3)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cost per Watt Analysis (mock) ──────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Cost per Watt Analysis</div>
        <div className="text-[10px] text-amber-500/70 mb-3">Simulated data — requires cost tracking tables</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-500 font-medium px-2 py-1.5">Category</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">$/Watt</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Industry Avg</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Delta</th>
                <th className="text-left text-gray-500 font-medium px-2 py-1.5 w-32">Comparison</th>
              </tr>
            </thead>
            <tbody>
              {COST_PER_WATT.map(c => {
                const delta = c.ours - c.industry
                const deltaColor = delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-gray-500'
                const barPct = Math.round((c.ours / COST_PER_WATT[COST_PER_WATT.length - 1].ours) * 100)
                const isTotal = c.category === 'Total'
                return (
                  <tr key={c.category} className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${isTotal ? 'border-t border-gray-600' : ''}`}>
                    <td className={`px-2 py-1.5 font-medium ${isTotal ? 'text-white font-bold' : 'text-white'}`}>{c.category}</td>
                    <td className="px-2 py-1.5 text-gray-300 font-mono text-right">${c.ours.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-gray-400 font-mono text-right">${c.industry.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 font-mono text-right font-bold ${deltaColor}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden relative">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Crew Cost Comparison (mock) ────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Crew Cost Comparison</div>
        <div className="text-[10px] text-amber-500/70 mb-3">Simulated data — requires crew rate configuration</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-500 font-medium px-2 py-1.5">Crew</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Labor Hrs</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Labor Cost</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Total Cost</th>
                <th className="text-right text-gray-500 font-medium px-2 py-1.5">Avg Margin</th>
                <th className="text-left text-gray-500 font-medium px-2 py-1.5 w-24">Rating</th>
              </tr>
            </thead>
            <tbody>
              {CREW_COSTS.map(c => {
                const marginColor = c.margin >= 20 ? 'text-green-400' : c.margin >= 15 ? 'text-amber-400' : 'text-red-400'
                const rating = c.margin >= 20 ? 'Excellent' : c.margin >= 15 ? 'Good' : 'Below Target'
                const ratingColor = c.margin >= 20 ? 'text-green-400' : c.margin >= 15 ? 'text-amber-400' : 'text-red-400'
                return (
                  <tr key={c.crew} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-2 py-1.5 text-white font-medium">{c.crew}</td>
                    <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{c.avgHrs}h</td>
                    <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(c.avgLabor)}</td>
                    <td className="px-2 py-1.5 text-gray-300 font-mono text-right">{fmt$(c.avgTotal)}</td>
                    <td className={`px-2 py-1.5 font-mono text-right font-bold ${marginColor}`}>{c.margin}%</td>
                    <td className={`px-2 py-1.5 font-medium ${ratingColor}`}>{rating}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* What This Will Track — Roadmap */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-4">Job Costing Roadmap</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROADMAP_PHASES.map(phase => {
            const statusColor = phase.status === 'next' ? 'border-green-900/40 bg-green-950/20'
              : phase.status === 'planned' ? 'border-blue-900/40 bg-blue-950/10'
                : 'border-gray-700 bg-gray-900/50'
            const badgeColor = phase.status === 'next' ? 'bg-green-900/50 text-green-400'
              : phase.status === 'planned' ? 'bg-blue-900/50 text-blue-400'
                : 'bg-gray-700 text-gray-400'
            const badgeText = phase.status === 'next' ? 'Up Next'
              : phase.status === 'planned' ? 'Planned'
                : 'Future'
            return (
              <div key={phase.phase} className={`rounded-lg p-4 border ${statusColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500 font-mono">{phase.phase}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badgeText}</span>
                </div>
                <div className="text-sm text-white font-medium mb-2">{phase.title}</div>
                <ul className="space-y-1">
                  {phase.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${
                        phase.status === 'next' ? 'bg-green-500' : phase.status === 'planned' ? 'bg-blue-500' : 'bg-gray-600'
                      }`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <div className="mt-4 text-xs text-gray-500 bg-gray-900 rounded-lg px-4 py-3 border border-gray-700">
          Job costing will replace mock data with real calculations as each phase activates. Phase 1 requires crew rate configuration in Admin.
          All phases build on each other — each unlocks progressively richer cost visibility.
        </div>
      </div>
    </div>
  )
}
