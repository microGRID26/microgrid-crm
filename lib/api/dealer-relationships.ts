// lib/api/dealer-relationships.ts — CRUD for sales_dealer_relationships + epc_underwriting_fees
// Both tables are platform-internal (RLS: auth_is_platform_user).
// Backing migration: supabase/106-sales-dealer-relationships.sql

import { db } from '@/lib/db'

export type {
  SalesDealerRelationship,
  SalesDealerStatus,
  EpcUnderwritingFee,
  UnderwritingFeeType,
  UnderwritingFeeStatus,
} from '@/types/database'
import type {
  SalesDealerRelationship,
  SalesDealerStatus,
  EpcUnderwritingFee,
  UnderwritingFeeType,
  UnderwritingFeeStatus,
} from '@/types/database'

export const DEALER_STATUSES: SalesDealerStatus[] = [
  'pending_signature',
  'active',
  'suspended',
  'terminated',
]

export const DEALER_STATUS_LABELS: Record<SalesDealerStatus, string> = {
  pending_signature: 'Pending Signature',
  active: 'Active',
  suspended: 'Suspended',
  terminated: 'Terminated',
}

export const DEALER_STATUS_BADGE: Record<SalesDealerStatus, string> = {
  pending_signature: 'bg-amber-900/40 text-amber-400 border border-amber-800',
  active: 'bg-green-900/40 text-green-400 border border-green-800',
  suspended: 'bg-orange-900/40 text-orange-400 border border-orange-800',
  terminated: 'bg-gray-800 text-gray-500 border border-gray-700',
}

export const UNDERWRITING_FEE_TYPES: UnderwritingFeeType[] = [
  'one_time_onboarding',
  'recurring_gatekeeping',
  'per_project_review',
]

export const UNDERWRITING_FEE_TYPE_LABELS: Record<UnderwritingFeeType, string> = {
  one_time_onboarding: 'One-Time Onboarding',
  recurring_gatekeeping: 'Recurring Gatekeeping',
  per_project_review: 'Per-Project Review',
}

export const UNDERWRITING_FEE_STATUSES: UnderwritingFeeStatus[] = [
  'pending',
  'invoiced',
  'paid',
  'waived',
  'disputed',
]

export const UNDERWRITING_FEE_STATUS_BADGE: Record<UnderwritingFeeStatus, string> = {
  pending: 'bg-amber-900/40 text-amber-400 border border-amber-800',
  invoiced: 'bg-blue-900/40 text-blue-400 border border-blue-800',
  paid: 'bg-green-900/40 text-green-400 border border-green-800',
  waived: 'bg-gray-800 text-gray-500 border border-gray-700',
  disputed: 'bg-red-900/40 text-red-400 border border-red-800',
}

// ── sales_dealer_relationships CRUD ────────────────────────────────────────

export async function loadDealerRelationships(): Promise<SalesDealerRelationship[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('sales_dealer_relationships')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[loadDealerRelationships]', error.message)
    return []
  }
  return (data ?? []) as SalesDealerRelationship[]
}

export async function addDealerRelationship(
  row: Omit<SalesDealerRelationship, 'id' | 'created_at' | 'updated_at'>,
): Promise<SalesDealerRelationship | null> {
  const supabase = db()
  const { data, error } = await supabase
    .from('sales_dealer_relationships')
    .insert(row)
    .select()
    .single()
  if (error) {
    console.error('[addDealerRelationship]', error.message)
    throw new Error(error.message)
  }
  return data as SalesDealerRelationship
}

export async function updateDealerRelationship(
  id: string,
  updates: Partial<Omit<SalesDealerRelationship, 'id' | 'created_at' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase
    .from('sales_dealer_relationships')
    .update(updates)
    .eq('id', id)
  if (error) {
    console.error('[updateDealerRelationship]', error.message)
    throw new Error(error.message)
  }
  return true
}

export async function deleteDealerRelationship(id: string): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase
    .from('sales_dealer_relationships')
    .delete()
    .eq('id', id)
  if (error) {
    console.error('[deleteDealerRelationship]', error.message)
    throw new Error(error.message)
  }
  return true
}

// ── epc_underwriting_fees CRUD ─────────────────────────────────────────────

export async function loadUnderwritingFees(): Promise<EpcUnderwritingFee[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('epc_underwriting_fees')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[loadUnderwritingFees]', error.message)
    return []
  }
  return (data ?? []) as EpcUnderwritingFee[]
}

export async function addUnderwritingFee(
  row: Omit<EpcUnderwritingFee, 'id' | 'created_at' | 'updated_at'>,
): Promise<EpcUnderwritingFee | null> {
  const supabase = db()
  const { data, error } = await supabase
    .from('epc_underwriting_fees')
    .insert(row)
    .select()
    .single()
  if (error) {
    console.error('[addUnderwritingFee]', error.message)
    throw new Error(error.message)
  }
  return data as EpcUnderwritingFee
}

export async function updateUnderwritingFee(
  id: string,
  updates: Partial<Omit<EpcUnderwritingFee, 'id' | 'created_at' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase
    .from('epc_underwriting_fees')
    .update(updates)
    .eq('id', id)
  if (error) {
    console.error('[updateUnderwritingFee]', error.message)
    throw new Error(error.message)
  }
  return true
}

export async function deleteUnderwritingFee(id: string): Promise<boolean> {
  const supabase = db()
  const { error } = await supabase
    .from('epc_underwriting_fees')
    .delete()
    .eq('id', id)
  if (error) {
    console.error('[deleteUnderwritingFee]', error.message)
    throw new Error(error.message)
  }
  return true
}
