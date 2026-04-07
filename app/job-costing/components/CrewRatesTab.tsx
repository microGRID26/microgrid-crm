'use client'

import { useState } from 'react'
import { fmt$, fmtDate } from '@/lib/utils'
import { addCrewRate, updateCrewRate } from '@/lib/api'
import type { CrewRate } from '@/lib/api'
import { Plus, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'

interface Props {
  rates: CrewRate[]
  orgId: string | null
  onRefresh: () => void
}

export function CrewRatesTab({ rates, orgId, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add form state
  const [crewName, setCrewName] = useState('')
  const [role, setRole] = useState('installer')
  const [hourlyRate, setHourlyRate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))

  const resetForm = () => {
    setCrewName('')
    setRole('installer')
    setHourlyRate('')
    setEffectiveDate(new Date().toISOString().slice(0, 10))
    setShowAdd(false)
  }

  const handleAdd = async () => {
    if (!crewName.trim() || !hourlyRate) return
    setSaving(true)
    const result = await addCrewRate({
      crew_id: crypto.randomUUID(),
      crew_name: crewName.trim(),
      role,
      hourly_rate: parseFloat(hourlyRate),
      effective_date: effectiveDate,
      org_id: orgId ?? undefined,
    })
    setSaving(false)
    if (result) {
      resetForm()
      onRefresh()
    }
  }

  const handleToggle = async (rate: CrewRate) => {
    await updateCrewRate(rate.id, { active: !rate.active })
    onRefresh()
  }

  const ROLES = ['installer', 'electrician', 'lead', 'foreman', 'laborer', 'inspector', 'roofer', 'other']

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Crew Rate
        </button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Crew Name</label>
              <input value={crewName} onChange={e => setCrewName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Alpha Crew" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none">
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Hourly Rate</label>
              <input type="number" step="0.01" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="$0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Effective Date</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !crewName.trim() || !hourlyRate}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={resetForm}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Crew Name</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Role</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Hourly Rate</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">Effective Date</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-center">Status</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No crew rates configured yet.</td></tr>
            )}
            {rates.map(rate => (
              <tr key={rate.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-4 py-2.5 text-white font-medium">{rate.crew_name || '—'}</td>
                <td className="px-4 py-2.5 text-gray-300 capitalize">{rate.role}</td>
                <td className="px-4 py-2.5 text-green-400 text-right font-mono">{fmt$(rate.hourly_rate)}</td>
                <td className="px-4 py-2.5 text-gray-400">{fmtDate(rate.effective_date)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rate.active ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {rate.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button onClick={() => handleToggle(rate)} title={rate.active ? 'Deactivate' : 'Activate'}
                    className="text-gray-400 hover:text-white transition-colors">
                    {rate.active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
