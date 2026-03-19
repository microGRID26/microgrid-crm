'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
  existingIds: string[]
  pms: string[]
}

function nextProjectId(existingIds: string[]): string {
  const nums = existingIds
    .map(id => parseInt((id || '').replace('PROJ-', '')) || 0)
    .filter(n => n > 0)
  const max = nums.length > 0 ? Math.max(...nums) : 30312
  return `PROJ-${max + 1}`
}

export function NewProjectModal({ onClose, onCreated, existingIds, pms }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    sale_date: new Date().toISOString().slice(0, 10),
    stage: 'evaluation',
    pm: '',
    disposition: 'Sale',
    contract: '',
    systemkw: '',
    financier: '',
    ahj: '',
    utility: '',
    advisor: '',
    consultant: '',
    dealer: '',
    financing_type: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.name.trim()) { setError('Customer name is required'); return }
    setSaving(true)
    setError(null)

    const id = nextProjectId(existingIds)
    const today = new Date().toISOString().slice(0, 10)

    const project = {
      id,
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      sale_date: form.sale_date || today,
      stage: form.stage,
      stage_date: today,
      pm: form.pm || null,
      disposition: form.disposition,
      contract: form.contract ? Number(form.contract) : null,
      systemkw: form.systemkw ? Number(form.systemkw) : null,
      financier: form.financier.trim() || null,
      ahj: form.ahj.trim() || null,
      utility: form.utility.trim() || null,
      advisor: form.advisor.trim() || null,
      consultant: form.consultant.trim() || null,
      dealer: form.dealer.trim() || null,
      financing_type: form.financing_type.trim() || null,
      created_at: new Date().toISOString(),
    }

    const { error: err } = await (supabase as any).from('projects').insert(project)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // Insert initial stage history
    const { error: histErr } = await (supabase as any).from('stage_history').insert({
      project_id: id,
      stage: form.stage,
      entered: today,
    })

    if (histErr) {
      setError('Project created but stage history failed: ' + histErr.message)
    }

    setSaving(false)
    onCreated(id)
  }

  const inputCls = "w-full bg-gray-800 text-white text-xs rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 focus:outline-none placeholder-gray-500"
  const labelCls = "text-xs text-gray-400 mb-1 block"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">New Project</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              ID: <span className="text-green-400 font-mono">{nextProjectId(existingIds)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">

            {/* Customer */}
            <div className="col-span-2">
              <label className={labelCls}>Customer Name *</label>
              <input className={inputCls} placeholder="First Last" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Street Address</label>
              <input className={inputCls} placeholder="123 Main St" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>City</label>
              <input className={inputCls} placeholder="Austin" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} placeholder="(555) 555-5555" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" placeholder="customer@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Sale Date</label>
              <input className={inputCls} type="date" value={form.sale_date} onChange={e => set('sale_date', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Stage</label>
              <select className={inputCls} value={form.stage} onChange={e => set('stage', e.target.value)}>
                {['evaluation','survey','design','permit','install','inspection','complete'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>PM</label>
              <select className={inputCls} value={form.pm} onChange={e => set('pm', e.target.value)}>
                <option value="">Select PM...</option>
                {pms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Disposition</label>
              <select className={inputCls} value={form.disposition} onChange={e => set('disposition', e.target.value)}>
                <option>Sale</option>
                <option>Loyalty</option>
                <option>Cancelled</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Contract Value ($)</label>
              <input className={inputCls} type="number" placeholder="75000" value={form.contract} onChange={e => set('contract', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>System Size (kW)</label>
              <input className={inputCls} type="number" step="0.001" placeholder="18.00" value={form.systemkw} onChange={e => set('systemkw', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Financier</label>
              <input className={inputCls} placeholder="Edge" value={form.financier} onChange={e => set('financier', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Financing Type</label>
              <select className={inputCls} value={form.financing_type} onChange={e => set('financing_type', e.target.value)}>
                <option value="">Select...</option>
                <option>Loan</option>
                <option>TPO (Lease, PPA)</option>
                <option>Cash</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>AHJ</label>
              <input className={inputCls} placeholder="City name or County" value={form.ahj} onChange={e => set('ahj', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Utility Company</label>
              <input className={inputCls} placeholder="Oncor" value={form.utility} onChange={e => set('utility', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Energy Advisor</label>
              <input className={inputCls} placeholder="Full name" value={form.advisor} onChange={e => set('advisor', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Energy Consultant</label>
              <input className={inputCls} placeholder="Full name" value={form.consultant} onChange={e => set('consultant', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Dealer</label>
              <input className={inputCls} placeholder="Dealer / partner name" value={form.dealer} onChange={e => set('dealer', e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="mt-4 text-xs text-red-400 bg-red-950 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="text-xs px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="text-xs px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
