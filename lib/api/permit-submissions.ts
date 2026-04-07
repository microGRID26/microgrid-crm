// lib/api/permit-submissions.ts — Permit submission tracking & AHJ e-filing eligibility

import { db } from '@/lib/db'

// ── Types ────────────────────────────────────────────────────────────────────

export type SubmissionType = 'solarapp' | 'online_portal' | 'email' | 'manual'
export type PermitSubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_needed'

export interface PermitSubmission {
  id: string
  project_id: string
  ahj_id: number | null
  submission_type: SubmissionType
  status: PermitSubmissionStatus
  submitted_at: string | null
  approved_at: string | null
  permit_number: string | null
  rejection_reason: string | null
  notes: string | null
  submitted_by: string | null
  org_id: string | null
  created_at: string
  updated_at: string
  // Joined fields (from queries)
  ahj_name?: string
  project_name?: string
}

export interface AHJEligibility {
  id: number
  name: string
  solarapp_eligible: boolean
  efiling_url: string | null
  efiling_type: string | null
  state: string | null
  county: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

export const SUBMISSION_TYPES: { value: SubmissionType; label: string }[] = [
  { value: 'solarapp', label: 'SolarAPP+' },
  { value: 'online_portal', label: 'Online Portal' },
  { value: 'email', label: 'Email' },
  { value: 'manual', label: 'Manual / In-Person' },
]

export const SUBMISSION_STATUSES: { value: PermitSubmissionStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-700 text-gray-300' },
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-900/60 text-blue-400' },
  { value: 'under_review', label: 'Under Review', color: 'bg-amber-900/60 text-amber-400' },
  { value: 'approved', label: 'Approved', color: 'bg-green-900/60 text-green-400' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-900/60 text-red-400' },
  { value: 'revision_needed', label: 'Revision Needed', color: 'bg-orange-900/60 text-orange-400' },
]

/** Valid status transitions for the permit workflow */
export const STATUS_TRANSITIONS: Record<PermitSubmissionStatus, PermitSubmissionStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected', 'revision_needed'],
  approved: [],
  rejected: ['revision_needed', 'draft'],
  revision_needed: ['submitted'],
}

// ── Data Access ──────────────────────────────────────────────────────────────

/** Load permit submissions, optionally filtered by projectId */
export async function loadPermitSubmissions(projectId?: string): Promise<PermitSubmission[]> {
  const supabase = db()
  let query = supabase
    .from('permit_submissions')
    .select('*, ahjs(name)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) {
    console.error('[loadPermitSubmissions]', error.message)
    return []
  }

  // Flatten joined AHJ name
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    ahj_name: (row.ahjs as { name?: string } | null)?.name ?? null,
    ahjs: undefined,
  })) as unknown as PermitSubmission[]
}

/** Create a new permit submission record */
export async function createPermitSubmission(input: {
  project_id: string
  ahj_id?: number | null
  submission_type?: SubmissionType
  status?: PermitSubmissionStatus
  permit_number?: string
  notes?: string
  submitted_by?: string
  org_id?: string
}): Promise<PermitSubmission | null> {
  const supabase = db()
  const { data, error } = await supabase
    .from('permit_submissions')
    .insert({
      project_id: input.project_id,
      ahj_id: input.ahj_id ?? null,
      submission_type: input.submission_type ?? 'manual',
      status: input.status ?? 'draft',
      permit_number: input.permit_number ?? null,
      notes: input.notes ?? null,
      submitted_by: input.submitted_by ?? null,
      org_id: input.org_id ?? null,
      submitted_at: input.status === 'submitted' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    console.error('[createPermitSubmission]', error.message)
    return null
  }
  return data as unknown as PermitSubmission
}

/** Update an existing permit submission */
export async function updatePermitSubmission(
  id: string,
  updates: Partial<Pick<PermitSubmission,
    'status' | 'submission_type' | 'permit_number' | 'rejection_reason' | 'notes' | 'submitted_by' | 'ahj_id'
  >>
): Promise<PermitSubmission | null> {
  const supabase = db()

  // Auto-set timestamps based on status changes
  const enriched: Record<string, unknown> = { ...updates }
  if (updates.status === 'submitted' && !enriched.submitted_at) {
    enriched.submitted_at = new Date().toISOString()
  }
  if (updates.status === 'approved' && !enriched.approved_at) {
    enriched.approved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('permit_submissions')
    .update(enriched)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[updatePermitSubmission]', error.message)
    return null
  }
  return data as unknown as PermitSubmission
}

/** Load AHJs with their e-filing eligibility status */
export async function loadAHJEligibility(): Promise<AHJEligibility[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('ahjs')
    .select('id, name, solarapp_eligible, efiling_url, efiling_type, state, county')
    .order('name', { ascending: true })
    .limit(5000)

  if (error) {
    console.error('[loadAHJEligibility]', error.message)
    return []
  }
  return (data ?? []) as unknown as AHJEligibility[]
}

/** Update AHJ e-filing fields */
export async function updateAHJEfiling(
  ahjId: number,
  updates: { solarapp_eligible?: boolean; efiling_url?: string; efiling_type?: string }
): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase
    .from('ahjs')
    .update(updates)
    .eq('id', ahjId)

  if (error) {
    console.error('[updateAHJEfiling]', error.message)
    return false
  }
  return true
}
