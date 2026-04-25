'use client'

import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/Nav'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { db } from '@/lib/db'
import { fmt$ } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

// Row shape pulled from v_edge_portfolio
interface PortfolioRow {
  id: string
  name: string | null
  address: string | null
  city: string | null
  state: string | null
  utility: string | null
  ahj: string | null
  financier: string | null
  financing_type: string | null
  disposition: string | null
  stage: string | null
  pm: string | null
  contract: string | null
  system_size_kw: number | null
  battery_qty_num: number | null
  battery_kwh_per_unit: number | null
  total_battery_kwh: number | null
  energy_community: boolean | null
  domestic_content: boolean | null
  signed_edge_contract: boolean | null
}

type TriState = 'all' | 'yes' | 'no'

function YN({ v }: { v: boolean | null }) {
  if (v === true)  return <span className="text-emerald-400">Y</span>
  if (v === false) return <span className="text-gray-500">N</span>
  return <span className="text-gray-600">—</span>
}

function triFilter(value: boolean | null, state: TriState): boolean {
  if (state === 'all') return true
  if (state === 'yes') return value === true
  return value === false
}

function TriToggle({ label, value, onChange }: {
  label: string; value: TriState; onChange: (v: TriState) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      {(['all', 'yes', 'no'] as TriState[]).map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={
            'px-2 py-0.5 text-xs rounded border ' +
            (value === s
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
              : 'border-gray-700 text-gray-400 hover:border-gray-500')
          }
        >
          {s === 'all' ? 'All' : s === 'yes' ? 'Y' : 'N'}
        </button>
      ))}
    </div>
  )
}

const ROW_LIMIT = 5000

export default function PortfolioPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const isFinance = currentUser?.isFinance === true
  const [rows, setRows] = useState<PortfolioRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [utilityDisplay, setUtilityDisplay] = useState<Map<string, string>>(new Map())

  // Filters
  const [search, setSearch] = useState('')
  const [signedEdge, setSignedEdge] = useState<TriState>('all')
  const [ec, setEc] = useState<TriState>('all')
  const [dc, setDc] = useState<TriState>('all')
  const [utilityFilter, setUtilityFilter] = useState<string>('')   // empty = all
  const [financierFilter, setFinancierFilter] = useState<string>('')
  const [stageFilter, setStageFilter] = useState<string>('')

  // Load rows from the view — ONLY after auth confirms finance role.
  // Without this gate, a non-finance user would still trigger the fetch and the
  // rows would land in DevTools / Network tab even though the UI hides them.
  useEffect(() => {
    if (!isFinance) return
    db()
      .from('v_edge_portfolio')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT)
      .then((res: { data: PortfolioRow[] | null; error: { message: string } | null }) => {
        if (res.error) { setError(res.error.message); return }
        setRows(res.data ?? [])
      })
  }, [isFinance])

  // Display-as map for utility (reference data, fine to load before auth resolves)
  useEffect(() => {
    db().from('utilities').select('name, display_name').then((res: { data: { name: string; display_name: string | null }[] | null }) => {
      const m = new Map<string, string>()
      res.data?.forEach(u => {
        m.set(u.name, u.display_name || u.name)
      })
      setUtilityDisplay(m)
    })
  }, [])

  // Distinct values for dropdowns (after rows load)
  const utilityOptions = useMemo(() => {
    const s = new Set<string>()
    rows?.forEach(r => { if (r.utility) s.add(r.utility) })
    return Array.from(s).sort()
  }, [rows])
  const financierOptions = useMemo(() => {
    const s = new Set<string>()
    rows?.forEach(r => { if (r.financier) s.add(r.financier) })
    return Array.from(s).sort()
  }, [rows])
  const stageOptions = useMemo(() => {
    const s = new Set<string>()
    rows?.forEach(r => { if (r.stage) s.add(r.stage) })
    return Array.from(s).sort()
  }, [rows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!rows) return []
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (!triFilter(r.signed_edge_contract, signedEdge)) return false
      if (!triFilter(r.energy_community, ec)) return false
      if (!triFilter(r.domestic_content, dc)) return false
      if (utilityFilter && r.utility !== utilityFilter) return false
      if (financierFilter && r.financier !== financierFilter) return false
      if (stageFilter && r.stage !== stageFilter) return false
      if (q) {
        const hay = `${r.id} ${r.name ?? ''} ${r.address ?? ''} ${r.city ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, signedEdge, ec, dc, utilityFilter, financierFilter, stageFilter])

  // Auth gate
  if (!userLoading && currentUser && !currentUser.isFinance) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Nav active="/portfolio" />
        <div className="p-8 max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Portfolio</h1>
          <p className="text-gray-400">You don&apos;t have permission to view this page. Finance role required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Nav active="/portfolio" />
      <div className="px-4 sm:px-6 py-4 max-w-[1600px] mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl font-semibold">EDGE Portfolio</h1>
          <span className="text-xs text-gray-500">
            {rows ? `${filteredRows.length} of ${rows.length} projects` : ''}
            {rows && rows.length === ROW_LIMIT && (
              <span className="ml-2 text-amber-400">
                (capped at {ROW_LIMIT.toLocaleString()} — older rows hidden)
              </span>
            )}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-3 p-3 bg-gray-900/60 border border-gray-800 rounded">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search id / name / address…"
            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white placeholder-gray-500 w-64"
          />
          <TriToggle label="Signed EDGE" value={signedEdge} onChange={setSignedEdge} />
          <TriToggle label="EC" value={ec} onChange={setEc} />
          <TriToggle label="DC" value={dc} onChange={setDc} />
          <select
            value={utilityFilter}
            onChange={e => setUtilityFilter(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">All utilities</option>
            {utilityOptions.map(u => (
              <option key={u} value={u}>{utilityDisplay.get(u) || u}</option>
            ))}
          </select>
          <select
            value={financierFilter}
            onChange={e => setFinancierFilter(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">All financiers</option>
            {financierOptions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">All stages</option>
            {stageOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => {
              setSearch(''); setSignedEdge('all'); setEc('all'); setDc('all')
              setUtilityFilter(''); setFinancierFilter(''); setStageFilter('')
            }}
            className="text-xs text-gray-400 hover:text-white"
          >
            Reset
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto border border-gray-800 rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900 sticky top-0">
              <tr className="text-left text-xs text-gray-400 border-b border-gray-800">
                <th className="px-3 py-2 whitespace-nowrap">Project</th>
                <th className="px-3 py-2 whitespace-nowrap">Customer / Address</th>
                <th className="px-3 py-2 whitespace-nowrap text-center">Signed EDGE</th>
                <th className="px-3 py-2 whitespace-nowrap text-center">EC</th>
                <th className="px-3 py-2 whitespace-nowrap text-center">DC</th>
                <th className="px-3 py-2 whitespace-nowrap text-right">kW</th>
                <th className="px-3 py-2 whitespace-nowrap text-right">Battery kWh</th>
                <th className="px-3 py-2 whitespace-nowrap">Utility</th>
                <th className="px-3 py-2 whitespace-nowrap">Stage</th>
                <th className="px-3 py-2 whitespace-nowrap">Financier</th>
                <th className="px-3 py-2 whitespace-nowrap text-right">Contract</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr><td colSpan={11} className="p-4 text-red-400 text-sm">{error}</td></tr>
              )}
              {!rows && !error && (
                <tr><td colSpan={11} className="p-6 text-center text-gray-400">
                  <Loader2 className="inline w-4 h-4 animate-spin mr-1" /> Loading…
                </td></tr>
              )}
              {rows && filteredRows.length === 0 && (
                <tr><td colSpan={11} className="p-6 text-center text-gray-500 text-sm">
                  No projects match these filters.
                </td></tr>
              )}
              {filteredRows.map(r => (
                <tr key={r.id} className="border-b border-gray-900 hover:bg-gray-900/40">
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <a href={`/projects/${r.id}`} className="text-sky-400 hover:underline font-mono text-xs">
                      {r.id}
                    </a>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="text-sm">{r.name ?? '—'}</div>
                    <div className="text-xs text-gray-500">
                      {[r.address, r.city, r.state].filter(Boolean).join(', ')}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center"><YN v={r.signed_edge_contract} /></td>
                  <td className="px-3 py-1.5 text-center"><YN v={r.energy_community} /></td>
                  <td className="px-3 py-1.5 text-center"><YN v={r.domestic_content} /></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.system_size_kw != null ? r.system_size_kw.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.total_battery_kwh != null ? r.total_battery_kwh.toFixed(0) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-300">
                    {r.utility ? (utilityDisplay.get(r.utility) || r.utility) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-300">{r.stage ?? '—'}</td>
                  <td className="px-3 py-1.5 text-xs text-gray-300">{r.financier ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-300">
                    {(() => {
                      if (!r.contract) return '—'
                      const m = r.contract.match(/-?\d+(?:\.\d+)?/)
                      const n = m ? Number(m[0]) : NaN
                      return Number.isFinite(n) ? fmt$(n) : '—'
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          FMV / ITC / Depreciation columns deferred until Paul confirms formulas (action #290).
        </p>
      </div>
    </div>
  )
}
