'use client'

import { fmt$ } from '@/lib/utils'
import { MetricCard, PeriodBar, type AnalyticsData } from './shared'

// Mock cost breakdown data — tables don't exist yet
const COST_BREAKDOWN = [
  { category: 'Solar Crew Labor', avgCost: 2100, pctTotal: 25, trend: '—' },
  { category: 'Electrical Labor', avgCost: 1400, pctTotal: 17, trend: '↑' },
  { category: 'Modules', avgCost: 2800, pctTotal: 33, trend: '↓' },
  { category: 'Inverter', avgCost: 800, pctTotal: 9, trend: '—' },
  { category: 'Racking & BOS', avgCost: 500, pctTotal: 6, trend: '—' },
  { category: 'Permit Fees', avgCost: 350, pctTotal: 4, trend: '—' },
  { category: 'Engineering', avgCost: 300, pctTotal: 4, trend: '—' },
  { category: 'Travel/Other', avgCost: 200, pctTotal: 2, trend: '—' },
]

const PREREQUISITES = [
  'Crew hourly rates (Admin > Crew Config)',
  'Material pricing (Inventory > Equipment)',
  'Auto-capture from work order completion',
]

export function JobCosting({ data }: { data: AnalyticsData }) {
  return (
    <div className="max-w-6xl space-y-8">
      {data.onPeriodChange && <PeriodBar period={data.period} onPeriodChange={data.onPeriodChange} />}

      {/* Coming Soon Banner */}
      <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-5">
        <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Job Costing — Coming Soon</div>
        <div className="text-sm text-gray-300">
          Track labor, materials, and overhead costs per project. Connect crew rates to work orders for automatic cost calculation.
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
            {COST_BREAKDOWN.map(row => (
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
                <td className="py-2.5 text-sm text-center text-gray-400">{row.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* What's Needed */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">What&apos;s Needed</div>
        <ul className="space-y-2">
          {PREREQUISITES.map(item => (
            <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
