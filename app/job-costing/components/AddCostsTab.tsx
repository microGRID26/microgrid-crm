'use client'

import { useState, useCallback, useEffect } from 'react'
import { fmt$, fmtDate } from '@/lib/utils'
import {
  addLaborCost, addMaterialCost, addOverheadCost,
  deleteLaborCost, deleteMaterialCost, deleteOverheadCost,
  loadLaborCosts, loadMaterialCosts, loadOverheadCosts,
  searchProjects,
} from '@/lib/api'
import { LABOR_CATEGORIES, MATERIAL_CATEGORIES, OVERHEAD_CATEGORIES } from '@/lib/api/job-costing'
import type { JobCostLabor, JobCostMaterial, JobCostOverhead } from '@/lib/api'
import { Trash2, Search, Plus, Wrench, Package, Receipt } from 'lucide-react'

interface Props {
  orgId: string | null
  onCostAdded: () => void
}

type ProjectOption = { id: string; name: string }

export function AddCostsTab({ orgId, onCostAdded }: Props) {
  // Project search
  const [projectSearch, setProjectSearch] = useState('')
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Recent entries for selected project
  const [recentLabor, setRecentLabor] = useState<JobCostLabor[]>([])
  const [recentMaterials, setRecentMaterials] = useState<JobCostMaterial[]>([])
  const [recentOverhead, setRecentOverhead] = useState<JobCostOverhead[]>([])

  // Search projects
  useEffect(() => {
    if (projectSearch.length < 2) { setProjectOptions([]); return }
    const t = setTimeout(async () => {
      const results = await searchProjects(projectSearch, 8)
      setProjectOptions(results.map(p => ({ id: p.id, name: p.name })))
      setShowDropdown(true)
    }, 300)
    return () => clearTimeout(t)
  }, [projectSearch])

  // Load recent entries when project selected
  const loadRecent = useCallback(async (pid: string) => {
    const [labor, mats, oh] = await Promise.all([
      loadLaborCosts(pid),
      loadMaterialCosts(pid),
      loadOverheadCosts(pid),
    ])
    setRecentLabor(labor.slice(0, 5))
    setRecentMaterials(mats.slice(0, 5))
    setRecentOverhead(oh.slice(0, 5))
  }, [])

  const selectProject = (p: ProjectOption) => {
    setSelectedProject(p)
    setProjectSearch(p.name)
    setShowDropdown(false)
    loadRecent(p.id)
  }

  // ── Labor form ──
  const [lWorker, setLWorker] = useState('')
  const [lHours, setLHours] = useState('')
  const [lRate, setLRate] = useState('')
  const [lDate, setLDate] = useState(new Date().toISOString().slice(0, 10))
  const [lCategory, setLCategory] = useState<string>('install')
  const [lNotes, setLNotes] = useState('')
  const [lSaving, setLSaving] = useState(false)

  const handleAddLabor = async () => {
    if (!selectedProject || !lHours || !lRate) return
    setLSaving(true)
    await addLaborCost({
      project_id: selectedProject.id,
      worker_name: lWorker || null,
      hours: parseFloat(lHours),
      hourly_rate: parseFloat(lRate),
      work_date: lDate,
      category: lCategory,
      notes: lNotes || null,
      org_id: orgId,
    })
    setLSaving(false)
    setLWorker(''); setLHours(''); setLRate(''); setLNotes('')
    loadRecent(selectedProject.id)
    onCostAdded()
  }

  // ── Material form ──
  const [mName, setMName] = useState('')
  const [mCategory, setMCategory] = useState<string>('modules')
  const [mQty, setMQty] = useState('')
  const [mUnit, setMUnit] = useState('')
  const [mVendor, setMVendor] = useState('')
  const [mPO, setMPO] = useState('')
  const [mNotes, setMNotes] = useState('')
  const [mSaving, setMSaving] = useState(false)

  const handleAddMaterial = async () => {
    if (!selectedProject || !mName || !mQty || !mUnit) return
    setMSaving(true)
    await addMaterialCost({
      project_id: selectedProject.id,
      material_name: mName,
      category: mCategory,
      quantity: parseFloat(mQty),
      unit_cost: parseFloat(mUnit),
      vendor: mVendor || null,
      po_number: mPO || null,
      notes: mNotes || null,
      org_id: orgId,
    })
    setMSaving(false)
    setMName(''); setMQty(''); setMUnit(''); setMVendor(''); setMPO(''); setMNotes('')
    loadRecent(selectedProject.id)
    onCostAdded()
  }

  // ── Overhead form ──
  const [oCategory, setOCategory] = useState<string>('permits')
  const [oDesc, setODesc] = useState('')
  const [oAmount, setOAmount] = useState('')
  const [oVendor, setOVendor] = useState('')
  const [oNotes, setONotes] = useState('')
  const [oSaving, setOSaving] = useState(false)

  const handleAddOverhead = async () => {
    if (!selectedProject || !oAmount) return
    setOSaving(true)
    await addOverheadCost({
      project_id: selectedProject.id,
      category: oCategory,
      description: oDesc || null,
      amount: parseFloat(oAmount),
      vendor: oVendor || null,
      notes: oNotes || null,
      org_id: orgId,
    })
    setOSaving(false)
    setODesc(''); setOAmount(''); setOVendor(''); setONotes('')
    loadRecent(selectedProject.id)
    onCostAdded()
  }

  // Delete handlers
  const handleDeleteLabor = async (id: string) => {
    await deleteLaborCost(id)
    if (selectedProject) loadRecent(selectedProject.id)
    onCostAdded()
  }
  const handleDeleteMaterial = async (id: string) => {
    await deleteMaterialCost(id)
    if (selectedProject) loadRecent(selectedProject.id)
    onCostAdded()
  }
  const handleDeleteOverhead = async (id: string) => {
    await deleteOverheadCost(id)
    if (selectedProject) loadRecent(selectedProject.id)
    onCostAdded()
  }

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none'
  const labelCls = 'text-xs text-gray-400 block mb-1'

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div className="relative max-w-md">
        <label className={labelCls}>Select Project</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={projectSearch}
            onChange={e => { setProjectSearch(e.target.value); setSelectedProject(null) }}
            onFocus={() => projectOptions.length > 0 && setShowDropdown(true)}
            className={`${inputCls} pl-8`}
            placeholder="Search by project name or ID..."
          />
        </div>
        {showDropdown && projectOptions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {projectOptions.map(p => (
              <button key={p.id} onClick={() => selectProject(p)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-white truncate">
                {p.name} <span className="text-gray-500 text-xs ml-1">{p.id.slice(0, 8)}</span>
              </button>
            ))}
          </div>
        )}
        {selectedProject && (
          <p className="text-xs text-green-400 mt-1">Selected: {selectedProject.name}</p>
        )}
      </div>

      {!selectedProject && (
        <p className="text-sm text-gray-500">Select a project above to add cost entries.</p>
      )}

      {selectedProject && (
        <>
          {/* ── Labor Section ── */}
          <section className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" /> Labor Cost
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div><label className={labelCls}>Worker</label>
                <input value={lWorker} onChange={e => setLWorker(e.target.value)} className={inputCls} placeholder="Name" /></div>
              <div><label className={labelCls}>Hours</label>
                <input type="number" step="0.25" min="0" value={lHours} onChange={e => setLHours(e.target.value)} className={inputCls} placeholder="0" /></div>
              <div><label className={labelCls}>Rate ($/hr)</label>
                <input type="number" step="0.01" min="0" value={lRate} onChange={e => setLRate(e.target.value)} className={inputCls} placeholder="0.00" /></div>
              <div><label className={labelCls}>Date</label>
                <input type="date" value={lDate} onChange={e => setLDate(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Category</label>
                <select value={lCategory} onChange={e => setLCategory(e.target.value)} className={inputCls}>
                  {LABOR_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select></div>
              <div><label className={labelCls}>Notes</label>
                <input value={lNotes} onChange={e => setLNotes(e.target.value)} className={inputCls} placeholder="Optional" /></div>
            </div>
            <button onClick={handleAddLabor} disabled={lSaving || !lHours || !lRate}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> {lSaving ? 'Adding...' : 'Add Labor'}
            </button>
            {/* Recent */}
            {recentLabor.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Recent labor entries</p>
                <div className="space-y-1">
                  {recentLabor.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-1.5 text-xs">
                      <span className="text-gray-300">{e.worker_name || 'Unnamed'} &middot; {e.hours}h @ {fmt$(e.hourly_rate)}/hr &middot; {e.category} &middot; {fmtDate(e.work_date)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 font-mono">{fmt$(e.total_cost)}</span>
                        <button onClick={() => handleDeleteLabor(e.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Materials Section ── */}
          <section className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" /> Material Cost
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div><label className={labelCls}>Material</label>
                <input value={mName} onChange={e => setMName(e.target.value)} className={inputCls} placeholder="e.g. Q.Peak 400W" /></div>
              <div><label className={labelCls}>Category</label>
                <select value={mCategory} onChange={e => setMCategory(e.target.value)} className={inputCls}>
                  {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select></div>
              <div><label className={labelCls}>Qty</label>
                <input type="number" min="0" value={mQty} onChange={e => setMQty(e.target.value)} className={inputCls} placeholder="0" /></div>
              <div><label className={labelCls}>Unit Cost</label>
                <input type="number" step="0.01" min="0" value={mUnit} onChange={e => setMUnit(e.target.value)} className={inputCls} placeholder="$0.00" /></div>
              <div><label className={labelCls}>Vendor</label>
                <input value={mVendor} onChange={e => setMVendor(e.target.value)} className={inputCls} placeholder="Optional" /></div>
              <div><label className={labelCls}>PO #</label>
                <input value={mPO} onChange={e => setMPO(e.target.value)} className={inputCls} placeholder="Optional" /></div>
            </div>
            <div className="max-w-xs">
              <label className={labelCls}>Notes</label>
              <input value={mNotes} onChange={e => setMNotes(e.target.value)} className={inputCls} placeholder="Optional" />
            </div>
            <button onClick={handleAddMaterial} disabled={mSaving || !mName || !mQty || !mUnit}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> {mSaving ? 'Adding...' : 'Add Material'}
            </button>
            {recentMaterials.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Recent material entries</p>
                <div className="space-y-1">
                  {recentMaterials.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-1.5 text-xs">
                      <span className="text-gray-300">{e.material_name} &middot; {e.quantity} x {fmt$(e.unit_cost)} &middot; {e.vendor || 'No vendor'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-mono">{fmt$(e.total_cost)}</span>
                        <button onClick={() => handleDeleteMaterial(e.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Overhead Section ── */}
          <section className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-400" /> Overhead Cost
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div><label className={labelCls}>Category</label>
                <select value={oCategory} onChange={e => setOCategory(e.target.value)} className={inputCls}>
                  {OVERHEAD_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select></div>
              <div><label className={labelCls}>Description</label>
                <input value={oDesc} onChange={e => setODesc(e.target.value)} className={inputCls} placeholder="e.g. Permit fees" /></div>
              <div><label className={labelCls}>Amount</label>
                <input type="number" step="0.01" min="0" value={oAmount} onChange={e => setOAmount(e.target.value)} className={inputCls} placeholder="$0.00" /></div>
              <div><label className={labelCls}>Vendor</label>
                <input value={oVendor} onChange={e => setOVendor(e.target.value)} className={inputCls} placeholder="Optional" /></div>
              <div><label className={labelCls}>Notes</label>
                <input value={oNotes} onChange={e => setONotes(e.target.value)} className={inputCls} placeholder="Optional" /></div>
            </div>
            <button onClick={handleAddOverhead} disabled={oSaving || !oAmount}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> {oSaving ? 'Adding...' : 'Add Overhead'}
            </button>
            {recentOverhead.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Recent overhead entries</p>
                <div className="space-y-1">
                  {recentOverhead.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-1.5 text-xs">
                      <span className="text-gray-300">{e.category.replace('_', ' ')} &middot; {e.description || 'No desc'} &middot; {e.vendor || 'No vendor'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-purple-400 font-mono">{fmt$(e.amount)}</span>
                        <button onClick={() => handleDeleteOverhead(e.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
