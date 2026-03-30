'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Nav } from '@/components/Nav'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import { cn, fmtDate, daysAgo, escapeIlike } from '@/lib/utils'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg, useRealtimeSubscription } from '@/lib/hooks'
import {
  loadAssignments, loadAssignmentQueue, submitAssignment, updateAssignmentStatus, addDeliverable,
  ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_STATUS_BADGE, ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPES,
} from '@/lib/api/engineering'
import type { EngineeringAssignment, AssignmentStatus, AssignmentType } from '@/lib/api/engineering'
import type { Project } from '@/types/database'
import { loadProjectById } from '@/lib/api'
import { db } from '@/lib/db'
import {
  Ruler, Plus, ChevronDown, ChevronUp, X, Search, Download, CheckCircle, Play,
  Send, Clock, Eye, AlertTriangle, FileText,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-700 text-gray-300',
  normal: 'bg-blue-900 text-blue-300',
  high: 'bg-amber-900 text-amber-300',
  urgent: 'bg-red-900 text-red-300',
}

// ── Submit Assignment Modal (EPC action) ─────────────────────────────────────

function SubmitAssignmentModal({
  onClose,
  onSubmitted,
  orgId,
  userId,
  userName,
}: {
  onClose: () => void
  onSubmitted: () => void
  orgId: string
  userId: string
  userName: string
}) {
  const [projectSearch, setProjectSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; stage: string }[]>([])
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null)
  const [assignedOrg, setAssignedOrg] = useState('')
  const [engineeringOrgs, setEngineeringOrgs] = useState<{ id: string; name: string }[]>([])
  const [type, setType] = useState<string>('new_design')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Load engineering partner orgs
  useEffect(() => {
    async function load() {
      const supabase = db()
      const { data } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('org_type', 'engineering')
        .eq('active', true)
        .order('name')
      if (data) setEngineeringOrgs(data as { id: string; name: string }[])
    }
    load()
  }, [])

  // Search projects for autocomplete
  useEffect(() => {
    if (projectSearch.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      const supabase = db()
      const q = escapeIlike(projectSearch)
      const { data } = await supabase
        .from('projects')
        .select('id, name, stage')
        .or(`name.ilike.%${q}%,id.ilike.%${q}%`)
        .eq('org_id', orgId)
        .limit(10)
      setSearchResults((data ?? []) as { id: string; name: string; stage: string }[])
    }, 200)
    return () => clearTimeout(timer)
  }, [projectSearch, orgId])

  async function handleSubmit() {
    const pid = selectedProject?.id
    if (!pid || !assignedOrg) return
    setSaving(true)
    const result = await submitAssignment(pid, assignedOrg, orgId, type, userId, userName, {
      priority,
      due_date: dueDate || undefined,
      notes: notes || undefined,
    })
    setSaving(false)
    if (result) {
      onSubmitted()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Submit Engineering Assignment</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Project search */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Project *</label>
            {selectedProject ? (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-white text-sm">{selectedProject.id} — {selectedProject.name}</span>
                <button onClick={() => { setSelectedProject(null); setProjectSearch('') }} className="text-gray-400 hover:text-white ml-auto"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  placeholder="Search by name or PROJ-XXXXX"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-48 overflow-y-auto z-10">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProject({ id: p.id, name: p.name }); setSearchResults([]) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <span className="text-green-400">{p.id}</span> — {p.name} <span className="text-gray-500 text-xs">({p.stage})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Engineering Partner */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Engineering Partner *</label>
            <select
              value={assignedOrg}
              onChange={e => setAssignedOrg(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Select Partner --</option>
              {engineeringOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Assignment Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm">
                {ASSIGNMENT_TYPES.map(t => <option key={t} value={t}>{ASSIGNMENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm">
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Design requirements, special instructions..."
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedProject || !assignedOrg}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded Row Detail ──────────────────────────────────────────────────────

function AssignmentDetail({
  assignment,
  project,
  isEngineering,
  isPlatform,
  onStatusChange,
  onPriorityChange,
  onOpenProject,
}: {
  assignment: EngineeringAssignment
  project: { id: string; name: string; stage: string; pm: string | null; financier: string | null; systemkw: number | null; contract: number | null } | null
  isEngineering: boolean
  isPlatform: boolean
  onStatusChange: (status: AssignmentStatus) => void
  onPriorityChange: (priority: string) => void
  onOpenProject: (projectId: string) => void
}) {
  const deliverables = assignment.deliverables ?? []

  // Valid status transitions
  const getNextActions = (): { status: AssignmentStatus; label: string; icon: typeof Play; color: string }[] => {
    const s = assignment.status
    const actions: { status: AssignmentStatus; label: string; icon: typeof Play; color: string }[] = []

    if (isEngineering || isPlatform) {
      if (s === 'pending') actions.push({ status: 'assigned', label: 'Accept', icon: CheckCircle, color: 'bg-blue-600 hover:bg-blue-700' })
      if (s === 'assigned') actions.push({ status: 'in_progress', label: 'Start Work', icon: Play, color: 'bg-cyan-600 hover:bg-cyan-700' })
      if (s === 'in_progress') actions.push({ status: 'review', label: 'Submit for Review', icon: Send, color: 'bg-purple-600 hover:bg-purple-700' })
      if (s === 'revision_needed') actions.push({ status: 'in_progress', label: 'Resume Work', icon: Play, color: 'bg-cyan-600 hover:bg-cyan-700' })
    }

    if (!isEngineering || isPlatform) {
      if (s === 'review') actions.push({ status: 'complete', label: 'Approve & Complete', icon: CheckCircle, color: 'bg-green-600 hover:bg-green-700' })
      if (s === 'review') actions.push({ status: 'revision_needed', label: 'Request Revision', icon: AlertTriangle, color: 'bg-orange-600 hover:bg-orange-700' })
    }

    if (s !== 'complete' && s !== 'cancelled') {
      actions.push({ status: 'cancelled', label: 'Cancel', icon: X, color: 'bg-red-600 hover:bg-red-700' })
    }

    return actions
  }

  const actions = getNextActions()

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mt-2 space-y-3">
      {/* Project summary */}
      {project && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500">Stage</div>
            <div className="text-sm text-white capitalize">{project.stage}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">PM</div>
            <div className="text-sm text-white">{project.pm ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Financier</div>
            <div className="text-sm text-white">{project.financier ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">System</div>
            <div className="text-sm text-white">{project.systemkw ? `${project.systemkw} kW` : '—'}</div>
          </div>
        </div>
      )}

      {/* Assignment details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-gray-500">Created By</div>
          <div className="text-sm text-white">{assignment.created_by ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Assigned To</div>
          <div className="text-sm text-white">{assignment.assigned_to ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Started</div>
          <div className="text-sm text-white">{assignment.started_at ? fmtDate(assignment.started_at) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Revisions</div>
          <div className="text-sm text-white">{assignment.revision_count}</div>
        </div>
      </div>

      {/* Editable Priority */}
      {assignment.status !== 'complete' && assignment.status !== 'cancelled' && (
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">Priority</div>
          <select
            value={assignment.priority}
            onChange={e => onPriorityChange(e.target.value)}
            className="text-xs bg-gray-900 text-white border border-gray-700 rounded px-2 py-1"
          >
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      {assignment.notes && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Notes</div>
          <div className="text-sm text-gray-300 bg-gray-900 rounded p-2">{assignment.notes}</div>
        </div>
      )}

      {/* Deliverables */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Deliverables ({deliverables.length})</div>
        {deliverables.length === 0 ? (
          <div className="text-xs text-gray-600">No deliverables yet</div>
        ) : (
          <div className="space-y-1">
            {deliverables.map((d, i) => {
              const item = d as Record<string, unknown>
              const name = typeof item.name === 'string' ? item.name : `Deliverable ${i + 1}`
              const uploadedAt = typeof item.uploaded_at === 'string' ? item.uploaded_at : null
              return (
                <div key={i} className="flex items-center gap-2 bg-gray-900 rounded p-2 text-xs text-gray-300">
                  <FileText className="w-3 h-3 text-green-400 shrink-0" />
                  <span>{name}</span>
                  {uploadedAt && (
                    <span className="text-gray-600 ml-auto">{fmtDate(uploadedAt)}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
          {actions.map(a => {
            const Icon = a.icon
            return (
              <button
                key={a.status + a.label}
                onClick={() => {
                  if (a.status === 'cancelled' && !confirm('Cancel this assignment?')) return
                  onStatusChange(a.status)
                }}
                className={cn('px-3 py-1.5 text-xs text-white rounded-lg flex items-center gap-1', a.color)}
              >
                <Icon className="w-3 h-3" /> {a.label}
              </button>
            )
          })}
          <button
            onClick={() => onOpenProject(assignment.project_id)}
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg ml-auto"
          >
            Open Project
          </button>
        </div>
      )}
    </div>
  )
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string
  value: number
  color: string
  onClick: () => void
  active: boolean
}) {
  const activeMap: Record<string, string> = {
    gray: 'border-gray-700 ring-1 ring-gray-500/50',
    amber: 'border-amber-700 ring-1 ring-amber-500/50',
    blue: 'border-blue-700 ring-1 ring-blue-500/50',
    green: 'border-green-700 ring-1 ring-green-500/50',
    red: 'border-red-700 ring-1 ring-red-500/50',
    cyan: 'border-cyan-700 ring-1 ring-cyan-500/50',
    purple: 'border-purple-700 ring-1 ring-purple-500/50',
  }
  const textMap: Record<string, string> = {
    gray: 'text-white',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-gray-900 border rounded-xl px-4 py-3 text-left transition-colors',
        active ? activeMap[color] : 'border-gray-800 hover:border-gray-700'
      )}
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div className={cn('text-2xl font-bold', value > 0 ? textMap[color] : 'text-gray-500')}>{value}</div>
    </button>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EngineeringPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const { orgId, orgType, orgName, loading: orgLoading } = useOrg()
  const isEngineering = orgType === 'engineering'
  const isPlatform = orgType === 'platform'

  const [assignments, setAssignments] = useState<EngineeringAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | ''>('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [openProject, setOpenProject] = useState<Project | null>(null)
  const [sortCol, setSortCol] = useState<'created_at' | 'status' | 'due_date' | 'project_id'>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [orgMap, setOrgMap] = useState<Record<string, string>>({})
  const [projectMap, setProjectMap] = useState<Record<string, { id: string; name: string; stage: string; pm: string | null; financier: string | null; systemkw: number | null; contract: number | null }>>({})

  // Load assignments
  const loadData = useCallback(async () => {
    if (!orgId && !isPlatform) return
    setLoading(true)

    const data = (isEngineering || isPlatform)
      ? await loadAssignmentQueue(statusFilter || undefined)
      : await loadAssignments(orgId, statusFilter || undefined)
    setAssignments(data)

    // Load project details and org names in parallel
    const projectIds = [...new Set(data.map(r => r.project_id))]
    const allOrgIds = [...new Set([
      ...data.map(r => r.requesting_org),
      ...data.map(r => r.assigned_org),
    ])]
    const supabase = db()

    const [projectResult, orgResult] = await Promise.all([
      projectIds.length > 0
        ? supabase.from('projects').select('id, name, stage, pm, financier, systemkw, contract').in('id', projectIds).limit(500)
        : Promise.resolve({ data: null }),
      allOrgIds.length > 0
        ? supabase.from('organizations').select('id, name').in('id', allOrgIds)
        : Promise.resolve({ data: null }),
    ])

    if (projectResult.data) {
      const pMap: Record<string, typeof projectMap[string]> = {}
      for (const p of projectResult.data as typeof projectMap[string][]) {
        pMap[p.id] = p
      }
      setProjectMap(pMap)
    }

    if (orgResult.data) {
      const oMap: Record<string, string> = {}
      for (const o of orgResult.data as { id: string; name: string }[]) {
        oMap[o.id] = o.name
      }
      setOrgMap(oMap)
    }

    setLoading(false)
  }, [orgId, isEngineering, isPlatform, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  // Realtime subscription
  useRealtimeSubscription('engineering_assignments', {
    event: '*',
    onChange: loadData,
    debounceMs: 500,
  })

  // Status change handler
  async function handleStatusChange(assignment: EngineeringAssignment, newStatus: AssignmentStatus) {
    const result = await updateAssignmentStatus(assignment.id, newStatus)
    if (result) loadData()
  }

  // Priority change handler
  async function handlePriorityChange(assignment: EngineeringAssignment, newPriority: string) {
    const supabase = db()
    const { error } = await supabase
      .from('engineering_assignments')
      .update({ priority: newPriority })
      .eq('id', assignment.id)
    if (!error) loadData()
  }

  // Open project panel
  async function openProjectPanel(projectId: string) {
    const data = await loadProjectById(projectId)
    if (data) setOpenProject(data)
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...assignments]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => {
        const pName = projectMap[r.project_id]?.name?.toLowerCase() ?? ''
        return r.project_id.toLowerCase().includes(q) || pName.includes(q) || (r.assigned_to?.toLowerCase().includes(q))
      })
    }

    list.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortCol === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortCol === 'project_id') cmp = a.project_id.localeCompare(b.project_id)
      else if (sortCol === 'due_date') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
        cmp = da - db
      }
      return sortAsc ? cmp : -cmp
    })

    return list
  }, [assignments, search, sortCol, sortAsc, projectMap])

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { total: assignments.length, pending: 0, assigned: 0, in_progress: 0, review: 0, revision_needed: 0, complete: 0, cancelled: 0 }
    for (const r of assignments) {
      if (r.status in c) c[r.status]++
    }
    return c
  }, [assignments])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
  }

  // CSV Export
  function exportCSV() {
    const headers = ['Project ID', 'Project Name', 'Type', 'Status', 'Priority', 'Engineering Partner', 'EPC', 'Assigned To', 'Due Date', 'Created', 'Revisions', 'Notes']
    const rows = filtered.map(r => [
      r.project_id,
      projectMap[r.project_id]?.name ?? '',
      ASSIGNMENT_TYPE_LABELS[r.assignment_type] ?? r.assignment_type,
      ASSIGNMENT_STATUS_LABELS[r.status] ?? r.status,
      r.priority,
      orgMap[r.assigned_org] ?? '',
      orgMap[r.requesting_org] ?? '',
      r.assigned_to ?? '',
      r.due_date ?? '',
      r.created_at?.slice(0, 10) ?? '',
      String(r.revision_count),
      r.notes ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `engineering-assignments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function sortIcon(col: typeof sortCol) {
    return sortCol === col ? (sortAsc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />) : null
  }

  // Loading state
  if (userLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Nav active="Engineering" />
        <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
      </div>
    )
  }

  // Auth gate: require authenticated user
  if (!userLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Please sign in to view this page.</div>
      </div>
    )
  }

  // Role gate: Manager+
  if (currentUser && !currentUser.isManager) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">You don&apos;t have permission to view this page.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Nav active="Engineering" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Ruler className="w-6 h-6 text-green-400" />
              {isEngineering ? 'My Assignments' : 'Engineering Assignments'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {isEngineering
                ? 'Design assignments from EPC partners'
                : isPlatform
                  ? 'All engineering assignments across organizations'
                  : 'Track engineering work assigned to design partners'}
            </p>
          </div>
          {!isEngineering && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Submit Assignment
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isEngineering ? (
            <>
              <SummaryCard label="New" value={counts.pending} color="amber" onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')} active={statusFilter === 'pending'} />
              <SummaryCard label="In Progress" value={counts.in_progress + counts.assigned} color="cyan" onClick={() => setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress')} active={statusFilter === 'in_progress'} />
              <SummaryCard label="In Review" value={counts.review} color="purple" onClick={() => setStatusFilter(statusFilter === 'review' ? '' : 'review')} active={statusFilter === 'review'} />
              <SummaryCard label="Complete" value={counts.complete} color="green" onClick={() => setStatusFilter(statusFilter === 'complete' ? '' : 'complete')} active={statusFilter === 'complete'} />
            </>
          ) : (
            <>
              <SummaryCard label="Pending" value={counts.pending} color="amber" onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')} active={statusFilter === 'pending'} />
              <SummaryCard label="In Progress" value={counts.in_progress + counts.assigned} color="cyan" onClick={() => setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress')} active={statusFilter === 'in_progress'} />
              <SummaryCard label="In Review" value={counts.review} color="purple" onClick={() => setStatusFilter(statusFilter === 'review' ? '' : 'review')} active={statusFilter === 'review'} />
              <SummaryCard label="Complete" value={counts.complete} color="green" onClick={() => setStatusFilter(statusFilter === 'complete' ? '' : 'complete')} active={statusFilter === 'complete'} />
            </>
          )}
        </div>

        {/* Search + Export */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by project ID, name, or assignee..."
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={exportCSV} aria-label="Export engineering assignments to CSV"
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors shrink-0">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">Loading assignments...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Ruler className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-sm">{search || statusFilter ? 'No matching assignments' : 'No engineering assignments yet'}</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('project_id')}>
                    Project {sortIcon('project_id')}
                  </th>
                  <th className="px-4 py-3 text-gray-400 font-medium">
                    {isEngineering ? 'EPC' : 'Engineering Partner'}
                  </th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Type</th>
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('status')}>
                    Status {sortIcon('status')}
                  </th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Priority</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Assigned To</th>
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('due_date')}>
                    Due Date {sortIcon('due_date')}
                  </th>
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('created_at')}>
                    Created {sortIcon('created_at')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(assignment => {
                  const project = projectMap[assignment.project_id]
                  const isExpanded = expandedId === assignment.id
                  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && assignment.status !== 'complete' && assignment.status !== 'cancelled'

                  return (
                    <tr key={assignment.id} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-4 py-3" colSpan={8}>
                        <div className="flex items-center">
                          {/* Expand toggle */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                            className="text-gray-500 hover:text-white mr-2"
                            aria-label={isExpanded ? `Collapse details for ${assignment.project_id}` : `Expand details for ${assignment.project_id}`}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {/* Row content as grid to match headers */}
                          <div className="flex-1 grid grid-cols-8 items-center gap-4">
                            {/* Project */}
                            <button onClick={() => openProjectPanel(assignment.project_id)} className="text-left hover:text-green-400 text-green-400">
                              <div className="font-medium">{assignment.project_id}</div>
                              {project && <div className="text-xs text-gray-500 truncate">{project.name}</div>}
                            </button>

                            {/* Partner / EPC */}
                            <div className="text-gray-300 text-xs truncate">
                              {isEngineering
                                ? orgMap[assignment.requesting_org] ?? '—'
                                : orgMap[assignment.assigned_org] ?? '—'}
                            </div>

                            {/* Type */}
                            <div className="text-gray-300 text-xs">
                              {ASSIGNMENT_TYPE_LABELS[assignment.assignment_type] ?? assignment.assignment_type}
                            </div>

                            {/* Status */}
                            <div>
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', ASSIGNMENT_STATUS_BADGE[assignment.status])}>
                                {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                              </span>
                            </div>

                            {/* Priority */}
                            <div>
                              <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', PRIORITY_BADGE[assignment.priority] ?? PRIORITY_BADGE.normal)}>
                                {assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)}
                              </span>
                            </div>

                            {/* Assigned To */}
                            <div className="text-gray-300 text-xs">{assignment.assigned_to ?? '—'}</div>

                            {/* Due Date */}
                            <div className={cn('text-xs', isOverdue ? 'text-red-400 font-medium' : 'text-gray-400')}>
                              {assignment.due_date ? fmtDate(assignment.due_date) : '—'}
                              {isOverdue && <div className="text-red-500 text-[10px]">Overdue</div>}
                            </div>

                            {/* Created */}
                            <div className="text-gray-400 text-xs">
                              {fmtDate(assignment.created_at)}
                              <div className="text-gray-600">{daysAgo(assignment.created_at)}d ago</div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <AssignmentDetail
                            assignment={assignment}
                            project={project ?? null}
                            isEngineering={isEngineering}
                            isPlatform={isPlatform}
                            onStatusChange={(status) => handleStatusChange(assignment, status)}
                            onPriorityChange={(priority) => handlePriorityChange(assignment, priority)}
                            onOpenProject={openProjectPanel}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && orgId && currentUser && (
        <SubmitAssignmentModal
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={loadData}
          orgId={orgId}
          userId={currentUser.id}
          userName={currentUser.name}
        />
      )}

      {/* Project Panel */}
      {openProject && (
        <ProjectPanel
          project={openProject}
          onClose={() => setOpenProject(null)}
          onProjectUpdated={loadData}
        />
      )}
    </div>
  )
}
