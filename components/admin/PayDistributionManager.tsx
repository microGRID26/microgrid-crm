'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { SaveBtn, Modal, Input } from './shared'
import {
  loadPayDistribution, updatePayDistribution, addPayDistribution, deletePayDistribution,
} from '@/lib/api'
import type { PayDistribution } from '@/lib/api'
import { useOrg } from '@/lib/hooks'
import { Pencil, Trash2, Plus, AlertTriangle, CheckCircle } from 'lucide-react'

export function PayDistributionManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { orgId } = useOrg()
  const [distribution, setDistribution] = useState<PayDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const [roleKey, setRoleKey] = useState('')
  const [label, setLabel] = useState('')
  const [percentage, setPercentage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await loadPayDistribution(orgId)
    setDistribution(data)
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const resetForm = () => { setRoleKey(''); setLabel(''); setPercentage('') }

  const startEdit = (d: PayDistribution) => {
    setEditingId(d.id)
    setRoleKey(d.role_key)
    setLabel(d.label)
    setPercentage(String(d.percentage))
    setShowAdd(false)
  }

  const handleSave = async () => {
    if (!roleKey.trim() || !label.trim()) return
    setSaving(true)
    if (editingId) {
      await updatePayDistribution(editingId, {
        label: label.trim(),
        percentage: parseFloat(percentage) || 0,
      })
    } else {
      await addPayDistribution({
        role_key: roleKey.trim().toLowerCase().replace(/\s+/g, '_'),
        label: label.trim(),
        percentage: parseFloat(percentage) || 0,
        sort_order: distribution.length + 1,
        active: true,
        org_id: orgId || undefined,
      })
    }
    setSaving(false)
    resetForm()
    setEditingId(null)
    setShowAdd(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this distribution role?')) return
    await deletePayDistribution(id)
    load()
  }

  const handleToggle = async (d: PayDistribution) => {
    await updatePayDistribution(d.id, { active: !d.active })
    load()
  }

  const active = distribution.filter(d => d.active)
  const totalPct = active.reduce((sum, d) => sum + Number(d.percentage), 0)
  const isBalanced = Math.abs(totalPct - 100) < 0.01

  if (loading) return <div className="text-gray-500 text-sm py-8 text-center">Loading distribution...</div>

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-4">
      {/* Sum validation banner */}
      {!isBalanced ? (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">
            Active percentages total <strong>{totalPct.toFixed(1)}%</strong> -- must sum to 100%.
          </p>
        </div>
      ) : (
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-xs text-green-300">Distribution totals <strong>100%</strong>.</p>
        </div>
      )}

      {/* Visual bar chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-white mb-3">Distribution Split</h3>
        <div className="space-y-2">
          {active.map(d => {
            const maxPct = Math.max(...active.map(d => Number(d.percentage)), 1)
            return (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-28 text-right truncate">{d.label}</span>
                <div className="flex-1 h-5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(Number(d.percentage) / maxPct) * 100}%`, minWidth: Number(d.percentage) > 0 ? '20px' : '0' }}
                  >
                    <span className="text-[10px] text-white font-medium">{Number(d.percentage)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="flex items-center justify-end">
        <button onClick={() => { setShowAdd(true); setEditingId(null); resetForm() }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded-md">
          <Plus className="w-3.5 h-3.5" /> Add Role
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-700 text-[10px] uppercase tracking-wider text-gray-400">
              <th className="px-3 py-2 font-medium">Role Key</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Percentage</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {distribution.map(d => (
              <tr key={d.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">{d.role_key}</td>
                <td className="px-3 py-2 text-gray-300">{d.label}</td>
                <td className="px-3 py-2">
                  <span className="text-white font-medium">{Number(d.percentage)}%</span>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => handleToggle(d)}
                    className={`w-3 h-3 rounded-full ${d.active ? 'bg-green-500' : 'bg-gray-600'}`}
                    title={d.active ? 'Active' : 'Inactive'} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(d)} className="text-gray-500 hover:text-white"><Pencil className="w-3 h-3" /></button>
                    {isSuperAdmin && <button onClick={() => handleDelete(d.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600">
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-xs text-gray-400 font-medium">Total</td>
              <td className="px-3 py-2">
                <span className={`text-xs font-bold ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPct.toFixed(1)}%
                </span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editingId) && (
        <Modal title={editingId ? 'Edit Distribution Role' : 'Add Distribution Role'} onClose={() => { setShowAdd(false); setEditingId(null); resetForm() }}>
          <Input label="Role Key *" value={roleKey} onChange={setRoleKey} />
          {editingId && <p className="text-[10px] text-gray-500">Role key cannot be changed after creation.</p>}
          <Input label="Display Label *" value={label} onChange={setLabel} />
          <Input label="Percentage" value={percentage} onChange={setPercentage} type="number" />
          <div className="flex justify-end pt-2">
            <SaveBtn onClick={handleSave} saving={saving} />
          </div>
        </Modal>
      )}
    </div>
  )
}
