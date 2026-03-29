'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Nav } from '@/components/Nav'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import { cn, fmtDate, daysAgo, escapeIlike } from '@/lib/utils'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg } from '@/lib/hooks'
import { useRealtimeSubscription } from '@/lib/hooks'
import {
  loadNTPRequests, loadNTPQueue, submitNTPRequest, reviewNTPRequest,
  NTP_STATUS_LABELS, NTP_STATUS_BADGE,
} from '@/lib/api/ntp'
import type { NTPRequest, NTPStatus } from '@/lib/api/ntp'
import type { Project } from '@/types/database'
import { loadProjectById } from '@/lib/api'
import { db } from '@/lib/db'
import { sendToEdge } from '@/lib/api/edge-sync'
import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Clock, Search, Plus, ChevronDown, ChevronUp, X, Eye, Download } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<NTPStatus, typeof ClipboardCheck> = {
  pending: Clock,
  under_review: Eye,
  approved: CheckCircle,
  rejected: XCircle,
  revision_required: AlertTriangle,
}

// ── Submit NTP Modal ─────────────────────────────────────────────────────────

function SubmitNTPModal({
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
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; stage: string }[]>([])
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null)

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    const pid = selectedProject?.id || projectId.trim()
    if (!pid) return
    setSaving(true)
    const result = await submitNTPRequest(pid, orgId, userId, userName, {}, notes || undefined)
    setSaving(false)
    if (result) {
      onSubmitted()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Submit for NTP</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Project search */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Project *</label>
            {selectedProject ? (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-white text-sm">{selectedProject.id} — {selectedProject.name}</span>
                <button onClick={() => { setSelectedProject(null); setProjectId(''); setProjectSearch('') }} className="text-gray-400 hover:text-white ml-auto"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={projectSearch}
                  onChange={e => { setProjectSearch(e.target.value); setProjectId(e.target.value) }}
                  placeholder="Search by name or PROJ-XXXXX"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-48 overflow-y-auto z-10">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProject({ id: p.id, name: p.name }); setProjectId(p.id); setSearchResults([]) }}
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

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes for the underwriting team..."
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || (!selectedProject && !projectId.trim())}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit for NTP'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Review Modal (Reject / Revision) ─────────────────────────────────────────

function ReviewModal({
  action,
  request,
  onClose,
  onComplete,
  reviewerId,
  reviewerName,
}: {
  action: 'rejected' | 'revision_required'
  request: NTPRequest
  onClose: () => void
  onComplete: () => void
  reviewerId: string
  reviewerName: string
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSubmit() {
    if (!reason.trim()) return
    setSaving(true)
    const result = await reviewNTPRequest(request.id, action, reviewerId, reviewerName, reason)
    setSaving(false)
    if (result) {
      // Fire EDGE webhook
      if (action === 'rejected') {
        void sendToEdge('project.updated', request.project_id, {
          event_detail: 'ntp.rejected',
          rejection_reason: reason,
        })
      } else if (action === 'revision_required') {
        void sendToEdge('project.updated', request.project_id, {
          event_detail: 'ntp.revision_required',
          revision_notes: reason,
        })
      }
      onComplete()
      onClose()
    }
  }

  const title = action === 'rejected' ? 'Reject NTP Request' : 'Request Revision'
  const label = action === 'rejected' ? 'Rejection Reason' : 'Revision Notes'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-gray-400 mb-1">Project: <span className="text-green-400">{request.project_id}</span></div>
          <label className="text-xs text-gray-400 block mb-1 mt-3">{label} *</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            placeholder={action === 'rejected' ? 'Why is this NTP being rejected?' : 'What needs to be revised before approval?'}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !reason.trim()}
            className={cn(
              'px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50',
              action === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            )}
          >
            {saving ? 'Saving...' : action === 'rejected' ? 'Reject' : 'Request Revision'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded Row Detail ──────────────────────────────────────────────────────

function RequestDetail({
  request,
  project,
  isPlatform,
  onAction,
}: {
  request: NTPRequest
  project: { id: string; name: string; stage: string; pm: string | null; financier: string | null; systemkw: number | null; contract: number | null } | null
  isPlatform: boolean
  onAction: (action: 'approve' | 'reject' | 'revision' | 'under_review') => void
}) {
  const evidence = request.evidence as Record<string, unknown>

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

      {/* Evidence */}
      {Object.keys(evidence).length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Evidence</div>
          <div className="bg-gray-900 rounded p-2 text-xs text-gray-300">
            {Object.entries(evidence).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500">{k}:</span>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {request.notes && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Submission Notes</div>
          <div className="text-sm text-gray-300">{request.notes}</div>
        </div>
      )}

      {/* Rejection / Revision reason */}
      {request.rejection_reason && (
        <div className="bg-red-900/20 border border-red-800 rounded p-2">
          <div className="text-xs text-red-400 mb-1">Rejection Reason</div>
          <div className="text-sm text-red-300">{request.rejection_reason}</div>
        </div>
      )}
      {request.revision_notes && (
        <div className="bg-orange-900/20 border border-orange-800 rounded p-2">
          <div className="text-xs text-orange-400 mb-1">Revision Notes</div>
          <div className="text-sm text-orange-300">{request.revision_notes}</div>
        </div>
      )}

      {/* Platform action buttons */}
      {isPlatform && (request.status === 'pending' || request.status === 'under_review') && (
        <div className="flex gap-2 pt-2 border-t border-gray-700">
          {request.status === 'pending' && (
            <button
              onClick={() => onAction('under_review')}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Eye className="w-3 h-3" /> Start Review
            </button>
          )}
          <button
            onClick={() => onAction('approve')}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1"
          >
            <CheckCircle className="w-3 h-3" /> Approve
          </button>
          <button
            onClick={() => onAction('reject')}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1"
          >
            <XCircle className="w-3 h-3" /> Reject
          </button>
          <button
            onClick={() => onAction('revision')}
            className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3" /> Request Revision
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NTPPage() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const { orgId, orgType, orgName, loading: orgLoading } = useOrg()
  const isPlatform = orgType === 'platform'

  const [requests, setRequests] = useState<NTPRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<NTPStatus | ''>('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [reviewModal, setReviewModal] = useState<{ action: 'rejected' | 'revision_required'; request: NTPRequest } | null>(null)
  const [openProject, setOpenProject] = useState<Project | null>(null)
  const [sortCol, setSortCol] = useState<'submitted_at' | 'status' | 'project_id'>('submitted_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [orgMap, setOrgMap] = useState<Record<string, string>>({})
  const [projectMap, setProjectMap] = useState<Record<string, { id: string; name: string; stage: string; pm: string | null; financier: string | null; systemkw: number | null; contract: number | null }>>({})

  // Load requests
  const loadData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const data = isPlatform
      ? await loadNTPQueue(statusFilter || undefined)
      : await loadNTPRequests(orgId, statusFilter || undefined)
    setRequests(data)

    // Load project details and org names in parallel
    const projectIds = [...new Set(data.map(r => r.project_id))]
    const orgIds = isPlatform ? [...new Set(data.map(r => r.requesting_org))] : []
    const supabase = db()

    const [projectResult, orgResult] = await Promise.all([
      projectIds.length > 0
        ? supabase.from('projects').select('id, name, stage, pm, financier, systemkw, contract').in('id', projectIds).limit(500)
        : Promise.resolve({ data: null }),
      orgIds.length > 0
        ? supabase.from('organizations').select('id, name').in('id', orgIds)
        : Promise.resolve({ data: null }),
    ])

    if (projectResult.data) {
      const pMap: Record<string, typeof projectMap[string]> = {}
      for (const p of projectResult.data as { id: string; name: string; stage: string; pm: string | null; financier: string | null; systemkw: number | null; contract: number | null }[]) {
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
  }, [orgId, isPlatform, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  // Realtime subscription
  useRealtimeSubscription('ntp_requests', {
    event: '*',
    onChange: loadData,
    debounceMs: 500,
  })

  // Handle platform actions
  async function handleApprove(request: NTPRequest) {
    if (!currentUser) return
    const result = await reviewNTPRequest(request.id, 'approved', currentUser.id, currentUser.name)
    if (result) {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const supabase = db()

      // Set ntp_date on the project
      await supabase.from('projects').update({ ntp_date: today }).eq('id', request.project_id)

      // Mark NTP task as Complete
      await supabase.from('task_state').upsert({
        project_id: request.project_id,
        task_id: 'ntp',
        status: 'Complete',
        completed_date: now.toISOString(),
      })

      // Log to audit_log
      await supabase.from('audit_log').insert({
        project_id: request.project_id,
        field: 'ntp_status',
        old_value: request.status,
        new_value: 'approved',
        changed_by: currentUser.name,
        changed_by_id: currentUser.id,
      })

      // Fire EDGE webhook
      void sendToEdge('project.updated', request.project_id, {
        event_detail: 'ntp.approved',
        ntp_date: today,
      })

      loadData()
    }
  }

  async function handleAction(request: NTPRequest, action: 'approve' | 'reject' | 'revision' | 'under_review') {
    if (!currentUser) return
    if (action === 'approve') {
      handleApprove(request)
    } else if (action === 'under_review') {
      await reviewNTPRequest(request.id, 'under_review', currentUser.id, currentUser.name)
      loadData()
    } else if (action === 'reject') {
      setReviewModal({ action: 'rejected', request })
    } else if (action === 'revision') {
      setReviewModal({ action: 'revision_required', request })
    }
  }

  // Open project panel
  async function openProjectPanel(projectId: string) {
    const data = await loadProjectById(projectId)
    if (data) setOpenProject(data)
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...requests]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => {
        const pName = projectMap[r.project_id]?.name?.toLowerCase() ?? ''
        return r.project_id.toLowerCase().includes(q) || pName.includes(q) || (r.submitted_by?.toLowerCase().includes(q))
      })
    }

    list.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'submitted_at') cmp = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      else if (sortCol === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortCol === 'project_id') cmp = a.project_id.localeCompare(b.project_id)
      return sortAsc ? cmp : -cmp
    })

    return list
  }, [requests, search, sortCol, sortAsc, projectMap])

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { total: requests.length, pending: 0, under_review: 0, approved: 0, rejected: 0, revision_required: 0 }
    for (const r of requests) {
      if (r.status in c) c[r.status]++
    }
    return c
  }, [requests])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ['Project ID', 'Project Name', 'EPC', 'Status', 'Submitted By', 'Submitted Date', 'Reviewer', 'Reviewed Date', 'Notes']
    const rows = filtered.map(r => [
      r.project_id,
      projectMap[r.project_id]?.name ?? '',
      orgMap[r.requesting_org] ?? r.requesting_org ?? '',
      NTP_STATUS_LABELS[r.status] ?? r.status,
      r.submitted_by ?? '',
      r.submitted_at ? r.submitted_at.slice(0, 10) : '',
      r.reviewed_by ?? '',
      r.reviewed_at ? r.reviewed_at.slice(0, 10) : '',
      r.notes ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ntp-requests-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (userLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Nav active="NTP" />
        <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
      </div>
    )
  }

  if (currentUser && !currentUser.isManager) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">You don&apos;t have permission to view this page.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Nav active="NTP" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-green-400" />
              NTP {isPlatform ? 'Approval Queue' : 'Requests'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {isPlatform
                ? 'Review and approve Notice to Proceed requests from EPCs'
                : 'Submit and track NTP requests for your projects'}
            </p>
          </div>
          {!isPlatform && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Submit for NTP
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {isPlatform ? (
            <>
              <SummaryCard label="Pending Review" value={counts.pending} color="amber" onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')} active={statusFilter === 'pending'} />
              <SummaryCard label="Under Review" value={counts.under_review} color="blue" onClick={() => setStatusFilter(statusFilter === 'under_review' ? '' : 'under_review')} active={statusFilter === 'under_review'} />
              <SummaryCard label="Approved" value={counts.approved} color="green" onClick={() => setStatusFilter(statusFilter === 'approved' ? '' : 'approved')} active={statusFilter === 'approved'} />
              <SummaryCard label="Rejected" value={counts.rejected} color="red" onClick={() => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected')} active={statusFilter === 'rejected'} />
              <SummaryCard label="Revision Required" value={counts.revision_required} color="orange" onClick={() => setStatusFilter(statusFilter === 'revision_required' ? '' : 'revision_required')} active={statusFilter === 'revision_required'} />
            </>
          ) : (
            <>
              <SummaryCard label="Total Submitted" value={counts.total} color="gray" onClick={() => setStatusFilter('')} active={!statusFilter} />
              <SummaryCard label="Pending" value={counts.pending} color="amber" onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')} active={statusFilter === 'pending'} />
              <SummaryCard label="Approved" value={counts.approved} color="green" onClick={() => setStatusFilter(statusFilter === 'approved' ? '' : 'approved')} active={statusFilter === 'approved'} />
              <SummaryCard label="Rejected" value={counts.rejected} color="red" onClick={() => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected')} active={statusFilter === 'rejected'} />
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
              placeholder="Search by project ID, name, or submitter..."
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={exportCSV} aria-label="Export NTP requests to CSV"
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors shrink-0">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">Loading requests...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <ClipboardCheck className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-sm">{search || statusFilter ? 'No matching requests' : 'No NTP requests yet'}</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('project_id')}>
                    Project {sortCol === 'project_id' && (sortAsc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                  </th>
                  {isPlatform && <th className="px-4 py-3 text-gray-400 font-medium">EPC</th>}
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('status')}>
                    Status {sortCol === 'status' && (sortAsc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                  </th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Submitted By</th>
                  <th className="px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('submitted_at')}>
                    Submitted {sortCol === 'submitted_at' && (sortAsc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                  </th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Reviewer</th>
                  {isPlatform && <th className="px-4 py-3 text-gray-400 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const Icon = STATUS_ICON[req.status] ?? Clock
                  const project = projectMap[req.project_id]
                  const isExpanded = expandedId === req.id

                  return (
                    <tr key={req.id} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-4 py-3" colSpan={isPlatform ? 7 : 6}>
                        <div className="flex items-center">
                          {/* Expand toggle */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : req.id)}
                            className="text-gray-500 hover:text-white mr-2"
                            aria-label={isExpanded ? `Collapse details for ${req.project_id}` : `Expand details for ${req.project_id}`}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {/* Row content as grid to match headers */}
                          <div className={cn('flex-1 grid items-center gap-4', isPlatform ? 'grid-cols-7' : 'grid-cols-6')}>
                            {/* Project */}
                            <button onClick={() => openProjectPanel(req.project_id)} className="text-left hover:text-green-400 text-green-400">
                              <div className="font-medium">{req.project_id}</div>
                              {project && <div className="text-xs text-gray-500">{project.name}</div>}
                            </button>

                            {/* EPC (platform only) */}
                            {isPlatform && (
                              <div className="text-gray-300 text-xs">{orgMap[req.requesting_org] ?? '—'}</div>
                            )}

                            {/* Status */}
                            <div>
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', NTP_STATUS_BADGE[req.status])}>
                                <Icon className="w-3 h-3" />
                                {NTP_STATUS_LABELS[req.status]}
                              </span>
                            </div>

                            {/* Submitted By */}
                            <div className="text-gray-300 text-xs">{req.submitted_by ?? '—'}</div>

                            {/* Submitted */}
                            <div className="text-gray-400 text-xs">
                              {fmtDate(req.submitted_at)}
                              <div className="text-gray-600">{daysAgo(req.submitted_at)}d ago</div>
                            </div>

                            {/* Reviewer */}
                            <div className="text-gray-300 text-xs">
                              {req.reviewed_by ?? '—'}
                              {req.reviewed_at && <div className="text-gray-600">{fmtDate(req.reviewed_at)}</div>}
                            </div>

                            {/* Actions (platform only) */}
                            {isPlatform && (
                              <div className="flex gap-1">
                                {(req.status === 'pending' || req.status === 'under_review') && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleAction(req, 'approve') }}
                                      className="p-1 text-green-400 hover:bg-green-900/30 rounded"
                                      title="Approve"
                                      aria-label={`Approve NTP request for ${req.project_id}`}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleAction(req, 'reject') }}
                                      className="p-1 text-red-400 hover:bg-red-900/30 rounded"
                                      title="Reject"
                                      aria-label={`Reject NTP request for ${req.project_id}`}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleAction(req, 'revision') }}
                                      className="p-1 text-orange-400 hover:bg-orange-900/30 rounded"
                                      title="Request Revision"
                                      aria-label={`Request revision for NTP ${req.project_id}`}
                                    >
                                      <AlertTriangle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <RequestDetail
                            request={req}
                            project={project ?? null}
                            isPlatform={isPlatform}
                            onAction={(action) => handleAction(req, action)}
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
        <SubmitNTPModal
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={loadData}
          orgId={orgId}
          userId={currentUser.id}
          userName={currentUser.name}
        />
      )}

      {/* Review Modal */}
      {reviewModal && currentUser && (
        <ReviewModal
          action={reviewModal.action}
          request={reviewModal.request}
          onClose={() => setReviewModal(null)}
          onComplete={loadData}
          reviewerId={currentUser.id}
          reviewerName={currentUser.name}
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
    orange: 'border-orange-700 ring-1 ring-orange-500/50',
  }
  const textMap: Record<string, string> = {
    gray: 'text-white',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
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
