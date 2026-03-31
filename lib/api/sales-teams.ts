// lib/api/sales-teams.ts — Pay scale stacks, sales teams, reps, and onboarding
// Sequifi-inspired: named pay tiers, deductive override calculation, rep onboarding docs

import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'

// ── Type Re-exports ─────────────────────────────────────────────────────────

export type { PayScale, PayDistribution, SalesTeam, SalesRep, OnboardingRequirement, OnboardingDocument, RepStatus, OnboardingDocStatus } from '@/types/database'
import type { PayScale, PayDistribution, SalesTeam, SalesRep, OnboardingRequirement, OnboardingDocument, RepStatus, OnboardingDocStatus } from '@/types/database'

// ── Constants ───────────────────────────────────────────────────────────────

export const REP_STATUSES: RepStatus[] = ['onboarding', 'active', 'inactive', 'terminated']

export const REP_STATUS_LABELS: Record<RepStatus, string> = {
  onboarding: 'Onboarding',
  active: 'Active',
  inactive: 'Inactive',
  terminated: 'Terminated',
}

export const REP_STATUS_BADGE: Record<RepStatus, string> = {
  onboarding: 'bg-blue-900 text-blue-300',
  active: 'bg-green-900 text-green-300',
  inactive: 'bg-gray-700 text-gray-300',
  terminated: 'bg-red-900 text-red-300',
}

export const DOC_STATUSES: OnboardingDocStatus[] = ['pending', 'sent', 'viewed', 'signed', 'uploaded', 'verified', 'rejected']

export const DOC_STATUS_LABELS: Record<OnboardingDocStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  uploaded: 'Uploaded',
  verified: 'Verified',
  rejected: 'Rejected',
}

export const DOC_STATUS_BADGE: Record<OnboardingDocStatus, string> = {
  pending: 'bg-gray-700 text-gray-300',
  sent: 'bg-blue-900 text-blue-300',
  viewed: 'bg-cyan-900 text-cyan-300',
  signed: 'bg-emerald-900 text-emerald-300',
  uploaded: 'bg-amber-900 text-amber-300',
  verified: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
}

export const DEFAULT_ROLE_KEYS = [
  { key: 'energy_consultant', label: 'Energy Consultant' },
  { key: 'energy_advisor', label: 'Energy Advisor' },
  { key: 'incentive_budget', label: 'Incentive Budget' },
  { key: 'project_manager', label: 'Project Manager' },
  { key: 'assistant_manager', label: 'Assistant Manager' },
  { key: 'vp', label: 'VP' },
  { key: 'regional', label: 'Regional' },
] as const

// ── Pay Scales ──────────────────────────────────────────────────────────────

export async function loadPayScales(orgId?: string | null): Promise<PayScale[]> {
  const supabase = createClient()
  let query = supabase
    .from('pay_scales')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .limit(200)

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},org_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('loadPayScales error:', error); return [] }
  return (data ?? []) as PayScale[]
}

export async function addPayScale(scale: {
  name: string
  per_watt_rate: number
  description?: string
  adder_percentage?: number
  referral_bonus?: number
  sort_order?: number
  org_id?: string
}): Promise<PayScale | null> {
  const { data, error } = await db()
    .from('pay_scales')
    .insert(scale)
    .select()
    .single()
  if (error) { console.error('addPayScale error:', error); return null }
  return data as PayScale
}

export async function updatePayScale(id: string, updates: Partial<PayScale>): Promise<boolean> {
  const { error } = await db()
    .from('pay_scales')
    .update(updates)
    .eq('id', id)
  if (error) { console.error('updatePayScale error:', error); return false }
  return true
}

export async function deletePayScale(id: string): Promise<boolean> {
  const { error } = await db()
    .from('pay_scales')
    .delete()
    .eq('id', id)
  if (error) { console.error('deletePayScale error:', error); return false }
  return true
}

// ── Pay Distribution ────────────────────────────────────────────────────────

export async function loadPayDistribution(orgId?: string | null): Promise<PayDistribution[]> {
  const supabase = createClient()
  let query = supabase
    .from('pay_distribution')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .limit(200)

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},org_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('loadPayDistribution error:', error); return [] }
  return (data ?? []) as PayDistribution[]
}

export async function updatePayDistribution(id: string, updates: Partial<PayDistribution>): Promise<boolean> {
  const { error } = await db()
    .from('pay_distribution')
    .update(updates)
    .eq('id', id)
  if (error) { console.error('updatePayDistribution error:', error); return false }
  return true
}

export async function addPayDistribution(dist: {
  role_key: string
  label: string
  percentage: number
  sort_order?: number
  active?: boolean
  org_id?: string
}): Promise<PayDistribution | null> {
  const { data, error } = await db()
    .from('pay_distribution')
    .insert(dist)
    .select()
    .single()
  if (error) { console.error('addPayDistribution error:', error); return null }
  return data as PayDistribution
}

export async function deletePayDistribution(id: string): Promise<boolean> {
  const { error } = await db()
    .from('pay_distribution')
    .delete()
    .eq('id', id)
  if (error) { console.error('deletePayDistribution error:', error); return false }
  return true
}

// ── Sales Teams ─────────────────────────────────────────────────────────────

export async function loadSalesTeams(orgId?: string | null): Promise<SalesTeam[]> {
  const supabase = createClient()
  let query = supabase
    .from('sales_teams')
    .select('*')
    .order('name')
    .limit(200)

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},org_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('loadSalesTeams error:', error); return [] }
  return (data ?? []) as SalesTeam[]
}

export async function addSalesTeam(team: {
  name: string
  stack_per_watt?: number
  vp_user_id?: string
  vp_name?: string
  regional_user_id?: string
  regional_name?: string
  manager_user_id?: string
  manager_name?: string
  assistant_manager_user_id?: string
  assistant_manager_name?: string
  org_id?: string
}): Promise<SalesTeam | null> {
  const { data, error } = await db()
    .from('sales_teams')
    .insert(team)
    .select()
    .single()
  if (error) { console.error('addSalesTeam error:', error); return null }
  return data as SalesTeam
}

export async function updateSalesTeam(id: string, updates: Partial<SalesTeam>): Promise<boolean> {
  const { error } = await db()
    .from('sales_teams')
    .update(updates)
    .eq('id', id)
  if (error) { console.error('updateSalesTeam error:', error); return false }
  return true
}

export async function deleteSalesTeam(id: string): Promise<boolean> {
  const { error } = await db()
    .from('sales_teams')
    .delete()
    .eq('id', id)
  if (error) { console.error('deleteSalesTeam error:', error); return false }
  return true
}

// ── Sales Reps ──────────────────────────────────────────────────────────────

export interface SalesRepFilters {
  teamId?: string
  status?: RepStatus
  orgId?: string | null
  search?: string
}

export async function loadSalesReps(filters?: SalesRepFilters): Promise<SalesRep[]> {
  const supabase = createClient()
  let query = supabase
    .from('sales_reps')
    .select('*')
    .order('last_name')
    .limit(500)

  if (filters?.teamId) {
    query = query.eq('team_id', filters.teamId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.orgId) {
    query = query.or(`org_id.eq.${filters.orgId},org_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('loadSalesReps error:', error); return [] }

  let reps = (data ?? []) as SalesRep[]

  // Client-side search filter (name, email)
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    reps = reps.filter(r =>
      r.first_name.toLowerCase().includes(q) ||
      r.last_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    )
  }

  return reps
}

export async function addSalesRep(rep: {
  first_name: string
  last_name: string
  email: string
  phone?: string
  team_id?: string
  pay_scale_id?: string
  role_key?: string
  hire_date?: string
  status?: RepStatus
  split_percentage?: number
  split_partner_id?: string
  notes?: string
  org_id?: string
  user_id?: string
  auth_user_id?: string
}): Promise<SalesRep | null> {
  const { data, error } = await db()
    .from('sales_reps')
    .insert(rep)
    .select()
    .single()
  if (error) { console.error('addSalesRep error:', error); return null }
  return data as SalesRep
}

export async function updateSalesRep(id: string, updates: Partial<SalesRep>): Promise<boolean> {
  const { error } = await db()
    .from('sales_reps')
    .update(updates)
    .eq('id', id)
  if (error) { console.error('updateSalesRep error:', error); return false }
  return true
}

export async function loadRepById(id: string): Promise<SalesRep | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sales_reps')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error('loadRepById error:', error); return null }
  return data as SalesRep
}

// ── Onboarding Requirements ────────────────────────────────────────────────

export async function loadOnboardingRequirements(orgId?: string | null): Promise<OnboardingRequirement[]> {
  const supabase = createClient()
  let query = supabase
    .from('onboarding_requirements')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .limit(200)

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},org_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('loadOnboardingRequirements error:', error); return [] }
  return (data ?? []) as OnboardingRequirement[]
}

// ── Onboarding Documents ───────────────────────────────────────────────────

export async function loadRepDocuments(repId: string): Promise<OnboardingDocument[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('onboarding_documents')
    .select('*')
    .eq('rep_id', repId)
    .order('created_at')
    .limit(200)
  if (error) { console.error('loadRepDocuments error:', error); return [] }
  return (data ?? []) as OnboardingDocument[]
}

export async function updateOnboardingDocStatus(
  docId: string,
  status: OnboardingDocStatus,
  notes?: string
): Promise<boolean> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status }

  // Auto-set lifecycle timestamps based on status transition
  switch (status) {
    case 'sent':
      updates.sent_at = now
      break
    case 'viewed':
      updates.viewed_at = now
      break
    case 'signed':
      updates.signed_at = now
      break
    case 'uploaded':
      updates.uploaded_at = now
      break
    case 'verified':
      updates.verified_at = now
      break
  }

  if (notes !== undefined) {
    updates.notes = notes
  }

  const { error } = await db()
    .from('onboarding_documents')
    .update(updates)
    .eq('id', docId)
  if (error) { console.error('updateDocumentStatus error:', error); return false }
  return true
}

/**
 * Update the file URL on an onboarding document (contract/doc link).
 */
export async function updateDocFileUrl(docId: string, fileUrl: string | null): Promise<boolean> {
  const { error } = await db()
    .from('onboarding_documents')
    .update({ file_url: fileUrl })
    .eq('id', docId)
  if (error) { console.error('updateDocFileUrl error:', error); return false }
  return true
}

/**
 * Create pending document records for all active requirements.
 * Called when a new rep is created to bootstrap their onboarding checklist.
 */
export async function initializeRepDocuments(repId: string, orgId?: string | null): Promise<boolean> {
  const requirements = await loadOnboardingRequirements(orgId)
  if (requirements.length === 0) return true

  // Check for existing docs to prevent duplicates on retry
  const { data: existing } = await db()
    .from('onboarding_documents')
    .select('requirement_id')
    .eq('rep_id', repId)
    .limit(200)
  const existingArr = Array.isArray(existing) ? existing : []
  const existingReqIds = new Set(existingArr.map((d: { requirement_id: string }) => d.requirement_id))

  const rows = requirements
    .filter(req => !existingReqIds.has(req.id))
    .map(req => ({
      rep_id: repId,
      requirement_id: req.id,
      status: 'pending',
    }))

  if (rows.length === 0) return true // all already initialized

  const { error } = await db()
    .from('onboarding_documents')
    .insert(rows)
  if (error) { console.error('initializeRepDocuments error:', error); return false }
  return true
}

// ── Override Calculation Engine (pure functions, no DB) ─────────────────────

export interface OverrideBreakdown {
  teamStackRate: number
  repRate: number
  overridePerWatt: number
  systemWatts: number
  totalOverride: number
}

/**
 * Calculate deductive leader override.
 * Override = (team stack rate - rep pay scale rate) * system watts
 *
 * Example: Team stack $0.40/W, rep is Consultant at $0.20/W, 10kW system
 *   Override = ($0.40 - $0.20) * 10,000 = $2,000
 *   The $2,000 is then distributed across leadership via pay_distribution percentages.
 */
export function calculateOverride(
  teamStackRate: number,
  repPayScaleRate: number,
  systemWatts: number
): OverrideBreakdown {
  const overridePerWatt = Math.max(0, teamStackRate - repPayScaleRate)
  const totalOverride = overridePerWatt * systemWatts

  return {
    teamStackRate,
    repRate: repPayScaleRate,
    overridePerWatt,
    systemWatts,
    totalOverride,
  }
}

/**
 * Calculate override amount for a split stack.
 * When two reps split a deal, the override is calculated on the split percentage.
 */
export function calculateSplitOverride(
  overrideAmount: number,
  splitPercentage: number
): number {
  return overrideAmount * (splitPercentage / 100)
}

export interface DistributionLine {
  roleKey: string
  label: string
  percentage: number
  amount: number
}

/**
 * Apply percentage distribution to a total stack override amount.
 * Returns per-role breakdown.
 *
 * Example: $2,000 total override with default distribution:
 *   Energy Consultant: 40% = $800
 *   Energy Advisor: 40% = $800
 *   PM: 3% = $60
 *   etc.
 */
export function calculateTeamDistribution(
  totalStackAmount: number,
  distribution: PayDistribution[]
): DistributionLine[] {
  return distribution
    .filter(d => d.active)
    .map(d => ({
      roleKey: d.role_key,
      label: d.label,
      percentage: d.percentage,
      amount: Math.round((totalStackAmount * d.percentage / 100) * 100) / 100,
    }))
}
