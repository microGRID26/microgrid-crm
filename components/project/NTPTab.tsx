'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn, fmtDate, daysAgo } from '@/lib/utils'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg } from '@/lib/hooks'
import {
  loadNTPRequestByProject, loadNTPHistory, submitNTPRequest, reviewNTPRequest, resubmitNTPRequest,
  NTP_STATUS_LABELS, NTP_STATUS_BADGE,
} from '@/lib/api/ntp'
import type { NTPRequest, NTPStatus } from '@/lib/api/ntp'
import { db } from '@/lib/db'
import { sendToEdge } from '@/lib/api/edge-sync'
import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Clock, Eye, Send, RotateCcw } from 'lucide-react'

interface NTPTabProps {
  project: { id: string; name: string; stage: string }
}

const STATUS_ICON: Record<NTPStatus, typeof ClipboardCheck> = {
  pending: Clock,
  under_review: Eye,
  approved: CheckCircle,
  rejected: XCircle,
  revision_required: AlertTriangle,
}

export function NTPTab({ project }: NTPTabProps) {
  const { user: currentUser } = useCurrentUser()
  const { orgId, orgType } = useOrg()
  const isPlatform = orgType === 'platform'

  const [currentRequest, setCurrentRequest] = useState<NTPRequest | null>(null)
  const [history, setHistory] = useState<NTPRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [reviewReason, setReviewReason] = useState('')
  const [reviewAction, setReviewAction] = useState<'rejected' | 'revision_required' | null>(null)

  // Task completion status for evidence
  const [taskStates, setTaskStates] = useState<{ task_id: string; status: string }[]>([])
  const [docCount, setDocCount] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [req, hist] = await Promise.all([
      loadNTPRequestByProject(project.id),
      loadNTPHistory(project.id),
    ])
    setCurrentRequest(req)
    setHistory(hist)

    // Load task states for evidence summary
    const supabase = db()
    const { data: tasks } = await supabase
      .from('task_state')
      .select('task_id, status')
      .eq('project_id', project.id)
    setTaskStates((tasks ?? []) as { task_id: string; status: string }[])

    // Count documents
    const { count } = await supabase
      .from('project_files')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
    setDocCount(count ?? 0)

    setLoading(false)
  }, [project.id])

  useEffect(() => { loadData() }, [loadData])

  const completedTasks = taskStates.filter(t => t.status === 'Complete').length
  const totalTasks = taskStates.length

  // Determine if there's an active (non-terminal) request or an already-approved one
  const hasActiveRequest = currentRequest && !['approved', 'rejected'].includes(currentRequest.status)
  const hasApprovedRequest = history.some(r => r.status === 'approved')
  const canSubmit = !hasActiveRequest && !hasApprovedRequest && !isPlatform
  const canResubmit = currentRequest?.status === 'revision_required' && !isPlatform

  async function handleSubmit() {
    if (!orgId || !currentUser) return
    setSubmitting(true)

    const evidence = {
      completed_tasks: completedTasks,
      total_tasks: totalTasks,
      document_count: docCount,
      stage: project.stage,
    }

    const result = await submitNTPRequest(
      project.id, orgId, currentUser.id, currentUser.name, evidence, notes || undefined
    )
    setSubmitting(false)
    if (result) {
      setShowSubmitForm(false)
      setNotes('')
      loadData()
    }
  }

  async function handleResubmit() {
    if (!currentRequest) return
    setSubmitting(true)

    const evidence = {
      completed_tasks: completedTasks,
      total_tasks: totalTasks,
      document_count: docCount,
      stage: project.stage,
    }

    const result = await resubmitNTPRequest(currentRequest.id, evidence, notes || undefined)
    setSubmitting(false)
    if (result) {
      setNotes('')
      loadData()
    }
  }

  async function handleReview(status: 'under_review' | 'approved' | 'rejected' | 'revision_required') {
    if (!currentRequest || !currentUser) return

    if (status === 'approved') {
      const result = await reviewNTPRequest(currentRequest.id, 'approved', currentUser.id, currentUser.name)
      if (result) {
        // Set ntp_date and mark task complete
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        const supabase = db()
        await supabase.from('projects').update({ ntp_date: today }).eq('id', project.id)
        await supabase.from('task_state').upsert({
          project_id: project.id,
          task_id: 'ntp',
          status: 'Complete',
          completed_date: now.toISOString(),
        })
        await supabase.from('audit_log').insert({
          project_id: project.id,
          field: 'ntp_status',
          old_value: currentRequest.status,
          new_value: 'approved',
          changed_by: currentUser.name,
          changed_by_id: currentUser.id,
        })
        void sendToEdge('project.updated', project.id, {
          event_detail: 'ntp.approved',
          ntp_date: today,
        })
        loadData()
      }
    } else if (status === 'under_review') {
      await reviewNTPRequest(currentRequest.id, 'under_review', currentUser.id, currentUser.name)
      loadData()
    } else if (status === 'rejected' || status === 'revision_required') {
      setReviewAction(status)
    }
  }

  async function submitReview() {
    if (!currentRequest || !currentUser || !reviewAction || !reviewReason.trim()) return
    setSubmitting(true)
    const result = await reviewNTPRequest(currentRequest.id, reviewAction, currentUser.id, currentUser.name, reviewReason)
    setSubmitting(false)
    if (result) {
      if (reviewAction === 'rejected') {
        // Set NTP task to Revision Required
        const supabase = db()
        await supabase.from('task_state').upsert({
          project_id: project.id,
          task_id: 'ntp',
          status: 'Revision Required',
          reason: reviewReason,
        })
        void sendToEdge('project.updated', project.id, {
          event_detail: 'ntp.rejected',
          rejection_reason: reviewReason,
        })
      } else if (reviewAction === 'revision_required') {
        void sendToEdge('project.updated', project.id, {
          event_detail: 'ntp.revision_required',
          revision_notes: reviewReason,
        })
      }
      setReviewAction(null)
      setReviewReason('')
      loadData()
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-500 w-full">Loading NTP status...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full">
      {/* Current Status */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-green-400" />
          NTP Status
        </h3>

        {currentRequest ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
            {/* Status badge */}
            <div className="flex items-center justify-between">
              <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium', NTP_STATUS_BADGE[currentRequest.status])}>
                {(() => { const Icon = STATUS_ICON[currentRequest.status]; return Icon ? <Icon className="w-4 h-4" /> : null })()}
                {NTP_STATUS_LABELS[currentRequest.status]}
              </span>
              <span className="text-xs text-gray-500">
                Submitted {fmtDate(currentRequest.submitted_at)} ({daysAgo(currentRequest.submitted_at)}d ago)
              </span>
            </div>

            {/* Submitter / Reviewer */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Submitted by:</span>{' '}
                <span className="text-gray-300">{currentRequest.submitted_by ?? '—'}</span>
              </div>
              {currentRequest.reviewed_by && (
                <div>
                  <span className="text-gray-500">Reviewed by:</span>{' '}
                  <span className="text-gray-300">{currentRequest.reviewed_by}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {currentRequest.notes && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Notes</div>
                <div className="text-sm text-gray-300 bg-gray-900 rounded p-2">{currentRequest.notes}</div>
              </div>
            )}

            {/* Rejection / Revision reason */}
            {currentRequest.rejection_reason && (
              <div className="bg-red-900/20 border border-red-800 rounded p-3">
                <div className="text-xs text-red-400 mb-1">Rejection Reason</div>
                <div className="text-sm text-red-300">{currentRequest.rejection_reason}</div>
              </div>
            )}
            {currentRequest.revision_notes && (
              <div className="bg-orange-900/20 border border-orange-800 rounded p-3">
                <div className="text-xs text-orange-400 mb-1">Revision Notes</div>
                <div className="text-sm text-orange-300">{currentRequest.revision_notes}</div>
              </div>
            )}

            {/* Platform review actions */}
            {isPlatform && (currentRequest.status === 'pending' || currentRequest.status === 'under_review') && (
              <div className="flex gap-2 pt-2 border-t border-gray-700">
                {currentRequest.status === 'pending' && (
                  <button onClick={() => handleReview('under_review')} aria-label="Start NTP review" className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Start Review
                  </button>
                )}
                <button onClick={() => handleReview('approved')} aria-label="Approve NTP request" className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Approve
                </button>
                <button onClick={() => handleReview('rejected')} aria-label="Reject NTP request" className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Reject
                </button>
                <button onClick={() => handleReview('revision_required')} aria-label="Request revision on NTP" className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Request Revision
                </button>
              </div>
            )}

            {/* Review reason form */}
            {reviewAction && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                <label htmlFor="ntp-review-reason" className="text-xs text-gray-400">{reviewAction === 'rejected' ? 'Rejection Reason' : 'Revision Notes'} *</label>
                <textarea
                  id="ntp-review-reason"
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={submitReview} disabled={submitting || !reviewReason.trim()} className={cn('px-3 py-1.5 text-xs text-white rounded-lg disabled:opacity-50', reviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700')}>
                    {submitting ? 'Saving...' : reviewAction === 'rejected' ? 'Confirm Reject' : 'Confirm Revision Request'}
                  </button>
                  <button onClick={() => { setReviewAction(null); setReviewReason('') }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                </div>
              </div>
            )}

            {/* EPC resubmit action */}
            {canResubmit && (
              <div className="pt-2 border-t border-gray-700 space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Updated notes for resubmission..."
                  className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
                />
                <button
                  onClick={handleResubmit}
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> {submitting ? 'Resubmitting...' : 'Resubmit for NTP'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
            <ClipboardCheck className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No NTP request submitted for this project</p>
          </div>
        )}
      </div>

      {/* Evidence Summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Evidence Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-500">Tasks Complete</div>
            <div className="text-lg font-bold text-white">{completedTasks} / {totalTasks}</div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }} />
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-500">Documents</div>
            <div className="text-lg font-bold text-white">{docCount}</div>
            <div className="text-xs text-gray-600 mt-1">files uploaded</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-500">Stage</div>
            <div className="text-lg font-bold text-white capitalize">{project.stage}</div>
          </div>
        </div>
      </div>

      {/* Submit Button (EPC only) */}
      {canSubmit && !showSubmitForm && (
        <button
          onClick={() => setShowSubmitForm(true)}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 font-medium"
        >
          <Send className="w-4 h-4" /> Submit for NTP Review
        </button>
      )}

      {/* Submit Form (EPC only) */}
      {canSubmit && showSubmitForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-medium text-white">Submit NTP Request</h4>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes for the underwriting team (optional)..."
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button onClick={() => { setShowSubmitForm(false); setNotes('') }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Request History</h3>
          <div className="space-y-2">
            {history.map(req => {
              const Icon = STATUS_ICON[req.status] ?? Clock
              return (
                <div key={req.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', NTP_STATUS_BADGE[req.status])}>
                      <Icon className="w-3 h-3" />
                      {NTP_STATUS_LABELS[req.status]}
                    </span>
                    <span className="text-xs text-gray-500">by {req.submitted_by}</span>
                  </div>
                  <div className="text-xs text-gray-500">{fmtDate(req.submitted_at)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
