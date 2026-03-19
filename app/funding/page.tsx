'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Nav } from '@/components/Nav'
import { fmt$, fmtDate, STAGE_LABELS } from '@/lib/utils'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import type { Project, ProjectFunding, NonfundedCode } from '@/types/database'

type MilestoneKey = 'm1' | 'm2' | 'm3'
type FundingFilter = 'all' | 'eligible' | 'funded' | 'nonfunded' | 'submitted' | 'rejected'
type FundingStatus = 'Not Submitted' | 'Submitted' | 'Funded' | 'Rejected' | 'Complete'

const FUNDING_STATUSES: FundingStatus[] = ['Not Submitted', 'Submitted', 'Funded', 'Rejected', 'Complete']

interface FundingRow {
  project: Project
  funding: ProjectFunding | null
  milestone: MilestoneKey
  amount: number | null
  funded_date: string | null
  cb: number | null
  cb_credit: number | null
  nf1: string | null
  nf2: string | null
  nf3: string | null
  notes: string | null
  status: string | null
  isEligible: boolean
  isFunded: boolean
  isNonfunded: boolean
  daysWaiting: number | null
}

function getMilestoneData(f: ProjectFunding | null, ms: MilestoneKey) {
  if (!f) return { amount: null, funded_date: null, cb: null, cb_credit: null, nf1: null, nf2: null, nf3: null, notes: null, status: null }
  return {
    amount:      ms === 'm1' ? f.m1_amount : ms === 'm2' ? f.m2_amount : f.m3_amount,
    funded_date: ms === 'm1' ? f.m1_funded_date : ms === 'm2' ? f.m2_funded_date : f.m3_funded_date,
    cb:          ms === 'm1' ? f.m1_cb : ms === 'm2' ? f.m2_cb : null,
    cb_credit:   ms === 'm1' ? f.m1_cb_credit : ms === 'm2' ? f.m2_cb_credit : null,
    nf1:         f.nonfunded_code_1,
    nf2:         f.nonfunded_code_2,
    nf3:         f.nonfunded_code_3,
    notes:       ms === 'm1' ? f.m1_notes : ms === 'm2' ? f.m2_notes : f.m3_notes,
    status:      ms === 'm1' ? f.m1_status : ms === 'm2' ? f.m2_status : f.m3_status,
  }
}

function isEligible(p: Project, ms: MilestoneKey): boolean {
  if (ms === 'm1') return true
  if (ms === 'm2') return !!p.install_complete_date
  if (ms === 'm3') return !!p.pto_date
  return false
}

const MS_LABELS: Record<MilestoneKey, string> = { m1: 'M1', m2: 'M2', m3: 'M3' }
const MS_FULL: Record<MilestoneKey, string> = { m1: 'Milestone 1', m2: 'Milestone 2 (Install)', m3: 'Milestone 3 (PTO)' }

// ── Inline Editable Cell ──────────────────────────────────────────────────────

function EditableCell({ value, onSave, type = 'text', placeholder = '—', className = '' }: {
  value: string | number | null
  onSave: (val: string | null) => Promise<void>
  type?: 'text' | 'number' | 'date' | 'currency'
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(value != null ? String(value) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const save = async () => {
    const newVal = draft.trim() || null
    const oldVal = value != null ? String(value) : null
    if (newVal === oldVal) { setEditing(false); return }
    setSaving(true)
    await onSave(newVal)
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => { setEditing(false) }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === 'currency' || type === 'number' ? 'number' : type}
        step={type === 'currency' ? '0.01' : undefined}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        className={`bg-gray-700 text-white text-xs rounded px-2 py-1 border border-green-500 focus:outline-none w-full ${className}`}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  const display = type === 'currency' && value ? fmt$(Number(value))
    : type === 'date' && value ? fmtDate(String(value))
    : value ?? placeholder

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer hover:bg-gray-700 hover:text-white rounded px-1 py-0.5 -mx-1 transition-colors ${saving ? 'opacity-50' : ''} ${className}`}
      title="Click to edit"
    >
      {display}
    </span>
  )
}

// ── Status Dropdown ───────────────────────────────────────────────────────────

function StatusSelect({ value, onSave }: { value: string | null; onSave: (val: string | null) => Promise<void> }) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const val = e.target.value || null
    setSaving(true)
    await onSave(val)
    setSaving(false)
  }

  const color = value === 'Funded' || value === 'Complete' ? 'text-green-400'
    : value === 'Submitted' ? 'text-blue-400'
    : value === 'Rejected' ? 'text-red-400'
    : 'text-gray-400'

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      onClick={e => e.stopPropagation()}
      disabled={saving}
      className={`bg-transparent border-0 text-xs cursor-pointer focus:outline-none ${color} ${saving ? 'opacity-50' : ''}`}
    >
      <option value="">—</option>
      {FUNDING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

// ── NF Code Picker ────────────────────────────────────────────────────────────

function NfCodePicker({ value, onSave, codes, slot }: {
  value: string | null
  onSave: (val: string | null) => Promise<void>
  codes: NonfundedCode[]
  slot: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = query.trim()
    ? codes.filter(c => c.code.toLowerCase().includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase()) || c.master_code.toLowerCase().includes(query.toLowerCase()))
    : codes

  // Group by master_code
  const groups: Record<string, NonfundedCode[]> = {}
  filtered.forEach(c => { (groups[c.master_code] ??= []).push(c) })

  const select = async (code: string | null) => {
    setSaving(true)
    await onSave(code)
    setSaving(false)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative inline-block" ref={ref}>
      {value ? (
        <span className="inline-flex items-center gap-1">
          <span
            className="bg-red-900/50 text-red-300 text-xs px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-800"
            onClick={e => { e.stopPropagation(); setOpen(!open) }}
            title={codes.find(c => c.code === value)?.description ?? value}
          >
            {value}
          </span>
          <button
            onClick={e => { e.stopPropagation(); select(null) }}
            className="text-gray-600 hover:text-red-400 text-xs"
            title="Remove code"
          >x</button>
        </span>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); setOpen(!open) }}
          className="text-gray-600 hover:text-gray-300 text-xs"
          title={`Add NF code ${slot}`}
        >+</button>
      )}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search codes..."
            autoFocus
            className="w-full bg-gray-900 text-white text-xs px-3 py-2 border-b border-gray-700 focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-850 uppercase tracking-wider sticky top-0 bg-gray-900">{group}</div>
                {items.map(c => (
                  <button
                    key={c.code}
                    onClick={() => select(c.code)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors flex items-start gap-2"
                  >
                    <span className="text-amber-400 font-mono font-bold flex-shrink-0 w-12">{c.code}</span>
                    <span className="text-gray-300">{c.description}</span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 text-xs">No codes match "{query}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FundingPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [funding, setFunding] = useState<Record<string, ProjectFunding>>({})
  const [nfCodes, setNfCodes] = useState<NonfundedCode[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [msFilter, setMsFilter] = useState<MilestoneKey | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FundingFilter>('eligible')
  const [financierFilter, setFinancierFilter] = useState('all')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    const [projRes, fundRes, nfRes] = await Promise.all([
      supabase.from('projects').select('*'),
      (supabase as any).from('project_funding').select('*'),
      (supabase as any).from('nonfunded_codes').select('*').order('master_code').order('code'),
    ])
    if (projRes.data) setProjects(projRes.data as Project[])
    if (fundRes.data) {
      const map: Record<string, ProjectFunding> = {}
      fundRes.data.forEach((f: any) => { map[f.project_id] = f })
      setFunding(map)
    }
    if (nfRes.data) setNfCodes(nfRes.data as NonfundedCode[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  // ── Save a single funding field ──────────────────────────────────────────────
  const saveFundingField = async (projectId: string, field: string, value: string | number | null) => {
    const update: Record<string, any> = { [field]: value }
    const { error } = await (supabase as any).from('project_funding').upsert(
      { project_id: projectId, ...update },
      { onConflict: 'project_id' }
    )
    if (error) {
      showToast('Save failed: ' + error.message)
      return
    }
    // Optimistic update
    setFunding(prev => {
      const existing = prev[projectId] ?? { project_id: projectId } as any
      return { ...prev, [projectId]: { ...existing, ...update } }
    })
  }

  // Helper to get the correct field name for a milestone
  const msField = (ms: MilestoneKey, field: string) => `${ms}_${field}`
  const nfField = (slot: number) => `nonfunded_code_${slot}`

  const financiers = [...new Set(projects.map(p => p.financier).filter(Boolean))].sort() as string[]
  const milestones: MilestoneKey[] = msFilter === 'all' ? ['m1', 'm2', 'm3'] : [msFilter]

  // Build rows
  const rows: FundingRow[] = []
  projects.forEach(p => {
    if (financierFilter !== 'all' && p.financier !== financierFilter) return
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!p.name?.toLowerCase().includes(q) && !p.id?.toLowerCase().includes(q) && !p.city?.toLowerCase().includes(q)) return
    }
    milestones.forEach(ms => {
      const f = funding[p.id] ?? null
      const data = getMilestoneData(f, ms)
      const eligible = isEligible(p, ms)
      const funded = !!data.funded_date
      const nonfunded = !funded && !!data.nf1
      let daysWaiting: number | null = null
      if (eligible && !funded) {
        const triggerDate = ms === 'm2' ? p.install_complete_date : ms === 'm3' ? p.pto_date : p.sale_date
        if (triggerDate) {
          const d = new Date(triggerDate + 'T00:00:00')
          if (!isNaN(d.getTime())) daysWaiting = Math.floor((Date.now() - d.getTime()) / 86400000)
        }
      }
      const row: FundingRow = {
        project: p, funding: f, milestone: ms,
        ...data,
        isEligible: eligible, isFunded: funded, isNonfunded: nonfunded,
        daysWaiting,
      }
      if (statusFilter === 'eligible' && (!eligible || funded)) return
      if (statusFilter === 'funded' && !funded) return
      if (statusFilter === 'nonfunded' && !nonfunded) return
      if (statusFilter === 'submitted' && data.status !== 'Submitted') return
      if (statusFilter === 'rejected' && data.status !== 'Rejected') return
      rows.push(row)
    })
  })

  rows.sort((a, b) => {
    if (a.isFunded !== b.isFunded) return a.isFunded ? 1 : -1
    return (a.project.financier ?? '').localeCompare(b.project.financier ?? '')
  })

  const totalEligible = rows.filter(r => r.isEligible && !r.isFunded).length
  const totalFunded = rows.filter(r => r.isFunded).length
  const totalAmount = rows.filter(r => r.isFunded).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const pendingAmount = rows.filter(r => r.isEligible && !r.isFunded).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalSubmitted = rows.filter(r => r.status === 'Submitted').length
  const totalRejected = rows.filter(r => r.status === 'Rejected').length

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-green-400 text-sm animate-pulse">Loading funding...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Nav active="Funding" />

      {/* Stats bar */}
      <div className="bg-gray-900 border-b border-gray-800 flex items-center gap-6 px-6 py-3 flex-shrink-0 flex-wrap">
        <div><div className="text-xs text-gray-500">Eligible</div><div className="text-xl font-bold text-amber-400 font-mono">{totalEligible}</div></div>
        {totalSubmitted > 0 && <div><div className="text-xs text-gray-500">Submitted</div><div className="text-xl font-bold text-blue-400 font-mono">{totalSubmitted}</div></div>}
        <div><div className="text-xs text-gray-500">Funded</div><div className="text-xl font-bold text-green-400 font-mono">{totalFunded}</div></div>
        {totalRejected > 0 && <div><div className="text-xs text-gray-500">Rejected</div><div className="text-xl font-bold text-red-400 font-mono">{totalRejected}</div></div>}
        <div><div className="text-xs text-gray-500">Total Funded</div><div className="text-xl font-bold text-white font-mono">{fmt$(totalAmount)}</div></div>
        {pendingAmount > 0 && <div><div className="text-xs text-gray-500">Pending</div><div className="text-xl font-bold text-amber-400 font-mono">{fmt$(pendingAmount)}</div></div>}
        <span className="ml-auto text-xs text-gray-500">{rows.length} rows</span>
      </div>

      {/* Filters */}
      <div className="bg-gray-950 border-b border-gray-800 flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap">
        <select value={msFilter} onChange={e => setMsFilter(e.target.value as any)}
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5">
          <option value="all">All Milestones</option>
          {(['m1','m2','m3'] as MilestoneKey[]).map(ms => <option key={ms} value={ms}>{MS_FULL[ms]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as FundingFilter)}
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5">
          <option value="all">All Statuses</option>
          <option value="eligible">Eligible (unfunded)</option>
          <option value="submitted">Submitted</option>
          <option value="funded">Funded</option>
          <option value="rejected">Rejected</option>
          <option value="nonfunded">Nonfunded (has NF code)</option>
        </select>
        <select value={financierFilter} onChange={e => setFinancierFilter(e.target.value)}
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5">
          <option value="all">All Financiers</option>
          {financiers.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-2 py-1.5 w-48"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-gray-950 sticky top-0 z-10">
            <tr>
              {['MS','Project','Financier','AHJ','Stage','Install','PTO','Contract','Amount','Funded Date','Days','CB','CB Credit','Status','NF Codes','Notes'].map(h => (
                <th key={h} className="text-left text-xs text-gray-400 font-medium px-2 py-2 border-b border-gray-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pid = row.project.id
              const ms = row.milestone
              return (
                <tr key={`${pid}-${ms}`}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                  {/* MS Badge */}
                  <td className="px-2 py-2">
                    <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                      row.status === 'Funded' || row.status === 'Complete' ? 'bg-green-900 text-green-300' :
                      row.status === 'Rejected' || row.isNonfunded ? 'bg-red-900 text-red-300' :
                      row.status === 'Submitted' ? 'bg-blue-900 text-blue-300' :
                      row.isEligible ? 'bg-amber-900 text-amber-300' :
                      'bg-gray-800 text-gray-500'
                    }`}>{MS_LABELS[ms]}</span>
                  </td>
                  {/* Project (click to open panel) */}
                  <td className="px-2 py-2 max-w-[180px] cursor-pointer" onClick={() => setSelectedProject(row.project)}>
                    <div className="font-medium text-green-400 hover:text-green-300 truncate">{row.project.name}</div>
                    <div className="text-gray-500 truncate">{pid} · {row.project.city}</div>
                  </td>
                  {/* Financier */}
                  <td className="px-2 py-2 text-gray-300 whitespace-nowrap">{row.project.financier ?? '—'}</td>
                  {/* AHJ */}
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{row.project.ahj ?? '—'}</td>
                  {/* Stage */}
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{STAGE_LABELS[row.project.stage]}</td>
                  {/* Install Date */}
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{fmtDate(row.project.install_complete_date) || '—'}</td>
                  {/* PTO */}
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{fmtDate(row.project.pto_date) || '—'}</td>
                  {/* Contract */}
                  <td className="px-2 py-2 text-gray-300 font-mono whitespace-nowrap">{row.project.contract ? fmt$(Number(row.project.contract)) : '—'}</td>
                  {/* Amount (editable) */}
                  <td className="px-2 py-2 font-mono">
                    <EditableCell
                      value={row.amount}
                      type="currency"
                      onSave={async val => saveFundingField(pid, msField(ms, 'amount'), val ? Number(val) : null)}
                    />
                  </td>
                  {/* Funded Date (editable) */}
                  <td className="px-2 py-2">
                    <EditableCell
                      value={row.funded_date}
                      type="date"
                      onSave={async val => saveFundingField(pid, msField(ms, 'funded_date'), val)}
                    />
                  </td>
                  {/* Days Waiting */}
                  <td className="px-2 py-2 font-mono">
                    {row.daysWaiting !== null
                      ? <span className={row.daysWaiting >= 30 ? 'text-red-400' : row.daysWaiting >= 14 ? 'text-amber-400' : 'text-gray-300'}>{row.daysWaiting}d</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  {/* CB (editable) */}
                  <td className="px-2 py-2 font-mono">
                    {ms !== 'm3' ? (
                      <EditableCell
                        value={row.cb}
                        type="currency"
                        onSave={async val => saveFundingField(pid, msField(ms, 'cb'), val ? Number(val) : null)}
                      />
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  {/* CB Credit (editable) */}
                  <td className="px-2 py-2 font-mono">
                    {ms !== 'm3' ? (
                      <EditableCell
                        value={row.cb_credit}
                        type="currency"
                        onSave={async val => saveFundingField(pid, msField(ms, 'cb_credit'), val ? Number(val) : null)}
                      />
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  {/* Status (editable dropdown) */}
                  <td className="px-2 py-2">
                    <StatusSelect
                      value={row.status}
                      onSave={async val => saveFundingField(pid, msField(ms, 'status'), val)}
                    />
                  </td>
                  {/* NF Codes (editable picker) */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <NfCodePicker value={row.nf1} codes={nfCodes} slot={1}
                        onSave={async val => saveFundingField(pid, nfField(1), val)} />
                      <NfCodePicker value={row.nf2} codes={nfCodes} slot={2}
                        onSave={async val => saveFundingField(pid, nfField(2), val)} />
                      <NfCodePicker value={row.nf3} codes={nfCodes} slot={3}
                        onSave={async val => saveFundingField(pid, nfField(3), val)} />
                    </div>
                  </td>
                  {/* Notes (editable) */}
                  <td className="px-2 py-2 max-w-[200px]">
                    <EditableCell
                      value={row.notes}
                      type="text"
                      placeholder="Add note..."
                      className="text-gray-400"
                      onSave={async val => saveFundingField(pid, msField(ms, 'notes'), val)}
                    />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={16} className="text-center py-12 text-gray-500">No funding rows match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-green-700 text-white text-xs px-4 py-2 rounded-md shadow-lg z-[200]">
          {toast}
        </div>
      )}

      {selectedProject && (
        <ProjectPanel project={selectedProject} onClose={() => setSelectedProject(null)} onProjectUpdated={loadData} />
      )}
    </div>
  )
}
