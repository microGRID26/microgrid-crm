'use client'

import { useEffect, useState, useCallback } from 'react'
import { fmt$ } from '@/lib/utils'
import {
  loadCommissionRates,
  updateCommissionRate,
  addCommissionRate,
  deleteCommissionRate,
  DEFAULT_ROLES,
} from '@/lib/api'
import { Input, Modal, SaveBtn, SearchBar } from './shared'
import type { CommissionRate } from '@/types/database'

// Build a lookup map from the DEFAULT_ROLES array
const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_ROLES.map(r => [r.key, r.label])
)

export function CommissionRatesManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [rates, setRates] = useState<CommissionRate[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<CommissionRate | null>(null)
  const [draft, setDraft] = useState<Partial<CommissionRate>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await loadCommissionRates(undefined, false) // Include inactive rates for admin management
      setRates(data)
    } catch (err) {
      console.error('Failed to load commission rates:', err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? rates.filter(r =>
        r.label.toLowerCase().includes(search.toLowerCase()) ||
        r.role_key.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : rates

  const openEdit = (r: CommissionRate) => { setEditing(r); setDraft({ ...r }) }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await updateCommissionRate(editing.id, {
        role_key: draft.role_key,
        label: draft.label,
        rate_type: draft.rate_type,
        rate: draft.rate,
        description: draft.description,
        active: draft.active,
        sort_order: draft.sort_order,
      })
      setEditing(null)
      setToast('Rate saved')
      load()
    } catch {
      setToast('Save failed')
    }
    setSaving(false)
    setTimeout(() => setToast(''), 2500)
  }

  const createNew = async () => {
    if (!draft.role_key?.trim() || !draft.label?.trim()) return
    setSaving(true)
    try {
      await addCommissionRate({
        role_key: draft.role_key ?? '',
        label: draft.label ?? '',
        rate_type: draft.rate_type ?? 'per_watt',
        rate: draft.rate ?? 0,
        description: draft.description ?? null,
        active: draft.active ?? true,
        sort_order: draft.sort_order ?? 0,
        org_id: null,
      })
      setShowNew(false)
      setDraft({})
      setToast('Rate created')
      load()
    } catch {
      setToast('Create failed')
    }
    setSaving(false)
    setTimeout(() => setToast(''), 2500)
  }

  const formatRate = (r: CommissionRate) => {
    if (r.rate_type === 'per_watt') return `$${r.rate}/W`
    if (r.rate_type === 'percentage') return `${r.rate}%`
    return fmt$(r.rate)
  }

  return (
    <div className="flex flex-col h-full">
      {toast && <div className="fixed bottom-5 right-5 bg-green-700 text-white text-xs px-4 py-2 rounded-md shadow-lg z-[200]">{toast}</div>}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Commission Rates</h2>
          <p className="text-xs text-gray-500 mt-0.5">{rates.length} rate records</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-64"><SearchBar value={search} onChange={setSearch} placeholder="Search rates..." /></div>
          <button onClick={() => { setShowNew(true); setDraft({ active: true, rate_type: 'per_watt', sort_order: 0 }) }}
            className="px-3 py-1.5 text-xs bg-green-700 text-white rounded-md hover:bg-green-600">+ New Rate</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
            <tr>
              {['Role', 'Label', 'Type', 'Rate', 'Description', 'Active', 'Order'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-gray-400 font-medium">{h}</th>
              ))}
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-900/20'}`} onClick={() => openEdit(r)}>
                <td className="px-3 py-2 text-white font-medium">{ROLE_LABELS[r.role_key] ?? r.role_key}</td>
                <td className="px-3 py-2 text-gray-300">{r.label}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                    r.rate_type === 'per_watt' ? 'bg-blue-900/40 text-blue-400 border border-blue-800' :
                    r.rate_type === 'percentage' ? 'bg-amber-900/40 text-amber-400 border border-amber-800' :
                    'bg-green-900/40 text-green-400 border border-green-800'
                  }`}>
                    {r.rate_type === 'per_watt' ? 'Per Watt' : r.rate_type === 'percentage' ? 'Percentage' : 'Flat Fee'}
                  </span>
                </td>
                <td className="px-3 py-2 text-white font-mono">{formatRate(r)}</td>
                <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{r.description || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${r.active ? 'bg-green-400' : 'bg-gray-600'}`} />
                </td>
                <td className="px-3 py-2 text-gray-500">{r.sort_order}</td>
                <td className="px-3 py-2">
                  <button className="text-gray-500 hover:text-blue-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-600 text-sm">No commission rates found</td></tr>}
          </tbody>
        </table>
      </div>

      {(editing || showNew) && (
        <Modal title={editing ? `Edit Rate — ${editing.label}` : 'New Commission Rate'} onClose={() => { setEditing(null); setShowNew(false) }}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Role Key" value={draft.role_key ?? ''} onChange={v => setDraft(d => ({ ...d, role_key: v }))} />
            <Input label="Label" value={draft.label ?? ''} onChange={v => setDraft(d => ({ ...d, label: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-medium">Rate Type</label>
              <select value={draft.rate_type ?? 'per_watt'} onChange={e => setDraft(d => ({ ...d, rate_type: e.target.value as CommissionRate['rate_type'] }))}
                className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="per_watt">Per Watt ($/W)</option>
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Fee ($)</option>
              </select>
            </div>
            <Input label={`Rate ${draft.rate_type === 'per_watt' ? '($/W)' : draft.rate_type === 'percentage' ? '(%)' : '($)'}`}
              type="number" value={String(draft.rate ?? '')} onChange={v => setDraft(d => ({ ...d, rate: parseFloat(v) || 0 }))} />
          </div>
          <Input label="Description" value={draft.description ?? ''} onChange={v => setDraft(d => ({ ...d, description: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sort Order" type="number" value={String(draft.sort_order ?? 0)} onChange={v => setDraft(d => ({ ...d, sort_order: parseInt(v) || 0 }))} />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={draft.active ?? true} onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500" />
                Active
              </label>
            </div>
          </div>
          <div className="flex justify-between pt-2">
            {editing && isSuperAdmin ? (
              <button onClick={async () => {
                if (!confirm(`DELETE rate "${editing.label}"?`)) return
                try {
                  await deleteCommissionRate(editing.id)
                  setEditing(null); setToast('Rate deleted'); setTimeout(() => setToast(''), 2500); load()
                } catch {
                  setToast('Delete failed'); setTimeout(() => setToast(''), 2500)
                }
              }} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md">Delete</button>
            ) : <div />}
            <div className="flex gap-2">
              <button onClick={() => { setEditing(null); setShowNew(false) }} className="px-4 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-md">Cancel</button>
              <SaveBtn onClick={editing ? save : createNew} saving={saving} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
