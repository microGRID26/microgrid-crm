'use client'

/** Inline forms for adding test plans + cases without leaving /testing. */
import { useState, useCallback } from 'react'
import { Plus, Loader2, ChevronDown, ChevronUp, Beaker, FileText } from 'lucide-react'

interface PlanOption { id: string; name: string }

interface Props {
  plans: PlanOption[]
  onCreated: () => void
  onToast: (message: string, type: 'success' | 'error') => void
}

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
const ROLE_FILTERS = ['all', 'manager', 'admin'] as const

export default function QAEditor({ plans, onCreated, onToast }: Props) {
  const [planOpen, setPlanOpen] = useState(false)
  const [caseOpen, setCaseOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [planName, setPlanName] = useState('')
  const [planDesc, setPlanDesc] = useState('')
  const [planRole, setPlanRole] = useState<typeof ROLE_FILTERS[number]>('all')
  const [planSort, setPlanSort] = useState<string>('')

  const [caseTitle, setCaseTitle] = useState('')
  const [casePlanId, setCasePlanId] = useState<string>('')
  const [casePriority, setCasePriority] = useState<typeof PRIORITIES[number]>('medium')
  const [caseInstructions, setCaseInstructions] = useState('')
  const [caseExpected, setCaseExpected] = useState('')
  const [casePageUrl, setCasePageUrl] = useState('')
  const [caseSort, setCaseSort] = useState<string>('')

  const submitPlan = useCallback(async () => {
    if (!planName.trim()) { onToast('Plan name required', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/qa-plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: planName.trim(),
          description: planDesc.trim() || undefined,
          role_filter: planRole,
          sort_order: planSort ? Number(planSort) : undefined,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        onToast(error || 'Failed to create plan', 'error')
        return
      }
      onToast('Plan created', 'success')
      setPlanName(''); setPlanDesc(''); setPlanSort('')
      setPlanOpen(false)
      onCreated()
    } finally {
      setBusy(false)
    }
  }, [planName, planDesc, planRole, planSort, onCreated, onToast])

  const submitCase = useCallback(async () => {
    if (!caseTitle.trim()) { onToast('Case title required', 'error'); return }
    if (!casePlanId) { onToast('Pick a plan', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/qa-cases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan_id: casePlanId,
          title: caseTitle.trim(),
          instructions: caseInstructions.trim() || undefined,
          expected_result: caseExpected.trim() || undefined,
          page_url: casePageUrl.trim() || undefined,
          priority: casePriority,
          sort_order: caseSort ? Number(caseSort) : undefined,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        onToast(error || 'Failed to create case', 'error')
        return
      }
      onToast('Case created', 'success')
      setCaseTitle(''); setCaseInstructions(''); setCaseExpected(''); setCasePageUrl(''); setCaseSort('')
      setCaseOpen(false)
      onCreated()
    } finally {
      setBusy(false)
    }
  }, [casePlanId, caseTitle, caseInstructions, caseExpected, casePageUrl, casePriority, caseSort, onCreated, onToast])

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
        <Plus className="w-4 h-4 text-violet-400" />
        <h2 className="font-bold text-white text-sm">Add to QA suite</h2>
        <span className="text-xs text-gray-500 ml-auto">{plans.length} plans</span>
      </div>

      <div className="divide-y divide-gray-800">
        {/* New Plan */}
        <div>
          <button
            onClick={() => setPlanOpen(!planOpen)}
            className="w-full flex items-center gap-2 px-6 py-3 hover:bg-gray-800/40 transition-colors text-left"
          >
            <Beaker className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-200">New Plan</span>
            <span className="text-xs text-gray-500">— a group of related cases</span>
            {planOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500 ml-auto" />}
          </button>
          {planOpen && (
            <div className="px-6 pb-4 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Name</label>
                <input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value.slice(0, 200))}
                  placeholder="e.g. Funding & Finance"
                  className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Description (optional)</label>
                <textarea
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value.slice(0, 1000))}
                  rows={2}
                  placeholder="One sentence describing what this plan covers"
                  className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Audience</label>
                  <select
                    value={planRole}
                    onChange={(e) => setPlanRole(e.target.value as typeof ROLE_FILTERS[number])}
                    className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1"
                  >
                    <option value="all">Everyone</option>
                    <option value="manager">Managers + Admins</option>
                    <option value="admin">Admins only</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Sort order</label>
                  <input
                    type="number"
                    value={planSort}
                    onChange={(e) => setPlanSort(e.target.value)}
                    placeholder="999"
                    className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={submitPlan}
                  disabled={busy}
                  className="px-4 h-9 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create plan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Case */}
        <div>
          <button
            onClick={() => setCaseOpen(!caseOpen)}
            className="w-full flex items-center gap-2 px-6 py-3 hover:bg-gray-800/40 transition-colors text-left"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-200">New Case</span>
            <span className="text-xs text-gray-500">— a single test (~3 min)</span>
            {caseOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500 ml-auto" />}
          </button>
          {caseOpen && (
            <div className="px-6 pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Title</label>
                  <input
                    value={caseTitle}
                    onChange={(e) => setCaseTitle(e.target.value.slice(0, 200))}
                    placeholder="e.g. Schedule a survey"
                    className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Priority</label>
                  <select
                    value={casePriority}
                    onChange={(e) => setCasePriority(e.target.value as typeof PRIORITIES[number])}
                    className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Plan</label>
                  <select
                    value={casePlanId}
                    onChange={(e) => setCasePlanId(e.target.value)}
                    className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1"
                  >
                    <option value="">— pick a plan —</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Page URL (optional)</label>
                  <input
                    value={casePageUrl}
                    onChange={(e) => setCasePageUrl(e.target.value.slice(0, 500))}
                    placeholder="/command"
                    className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Instructions</label>
                <textarea
                  value={caseInstructions}
                  onChange={(e) => setCaseInstructions(e.target.value.slice(0, 4000))}
                  rows={3}
                  placeholder="Step-by-step what the tester should do"
                  className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Expected result</label>
                <textarea
                  value={caseExpected}
                  onChange={(e) => setCaseExpected(e.target.value.slice(0, 2000))}
                  rows={2}
                  placeholder="What should happen if it works"
                  className="w-full text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500 block">Sort order</label>
                  <input
                    type="number"
                    value={caseSort}
                    onChange={(e) => setCaseSort(e.target.value)}
                    placeholder="999"
                    className="w-24 text-sm bg-gray-800 text-white border border-gray-700 rounded-md px-3 py-2 mt-1"
                  />
                </div>
                <button
                  onClick={submitCase}
                  disabled={busy || !casePlanId || !caseTitle.trim()}
                  className={`px-4 h-9 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
                    busy || !casePlanId || !caseTitle.trim()
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-violet-500 hover:bg-violet-400 text-white'
                  }`}
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create case
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
