// lib/api/material-requests.ts — MRF (Material Request Form) data access
// Org filtering: inherited via project_id FK — RLS SELECT policy uses
// EXISTS (SELECT 1 FROM projects WHERE id = material_requests.project_id AND org_id = ...)
// No direct org_id column; RLS enforces org scope.
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { INACTIVE_DISPOSITION_FILTER } from '@/lib/utils'

export interface MaterialRequest {
  id: string
  project_id: string
  schedule_id: string | null
  requested_by: string
  crew_name: string | null
  status: string // submitted, approved, ordered, fulfilled, cancelled
  notes: string | null
  needed_by: string | null
  created_at: string
  updated_at: string
  items?: MaterialRequestItem[]
  project?: { name: string; address: string | null } | null
}

export interface MaterialRequestItem {
  id: string
  request_id: string
  description: string
  quantity: number
  unit: string
  fulfilled_qty: number
  notes: string | null
  sort_order: number
}

export const MRF_STATUSES = ['submitted', 'approved', 'ordered', 'fulfilled', 'cancelled'] as const

export const MRF_STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-900/40 text-blue-400',
  approved: 'bg-green-900/40 text-green-400',
  ordered: 'bg-amber-900/40 text-amber-400',
  fulfilled: 'bg-green-900/40 text-green-300',
  cancelled: 'bg-red-900/40 text-red-400',
}

/** Create a new MRF with items */
export async function createMaterialRequest(mrf: {
  project_id: string
  schedule_id?: string | null
  requested_by: string
  crew_name?: string | null
  notes?: string | null
  needed_by?: string | null
  items: { description: string; quantity: number; unit?: string; notes?: string }[]
}): Promise<string | null> {
  const supabase = db()

  const { data, error } = await supabase.from('material_requests').insert({
    project_id: mrf.project_id,
    schedule_id: mrf.schedule_id ?? null,
    requested_by: mrf.requested_by,
    crew_name: mrf.crew_name ?? null,
    notes: mrf.notes ?? null,
    needed_by: mrf.needed_by ?? null,
    status: 'submitted',
  }).select('id').single()

  if (error || !data) { console.error('[createMRF]', error); return null }
  const mrfId = (data as { id: string }).id

  if (mrf.items.length > 0) {
    const rows = mrf.items.map((item, i) => ({
      request_id: mrfId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? 'ea',
      notes: item.notes ?? null,
      sort_order: i,
    }))
    const { error: itemErr } = await supabase.from('material_request_items').insert(rows)
    if (itemErr) console.error('[createMRF] items insert failed:', itemErr)
  }

  return mrfId
}

/** Load MRFs — for Danny's processing queue or filtered by project */
export async function loadMaterialRequests(filters?: {
  projectId?: string
  status?: string
}): Promise<MaterialRequest[]> {
  const supabase = createClient()
  let q = supabase
    .from('material_requests')
    .select('id, project_id, schedule_id, requested_by, crew_name, status, notes, needed_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters?.projectId) q = q.eq('project_id', filters.projectId)
  if (filters?.status) q = q.eq('status', filters.status)

  const { data, error } = await q
  if (error) { console.error('[loadMRFs]', error); return [] }

  const mrfs = (data ?? []) as MaterialRequest[]

  // Load items for each MRF
  if (mrfs.length > 0) {
    const mrfIds = mrfs.map(m => m.id)
    const { data: items } = await supabase
      .from('material_request_items')
      .select('id, request_id, description, quantity, unit, fulfilled_qty, notes, sort_order')
      .in('request_id', mrfIds)
      .order('sort_order')
      .limit(1000)

    if (items && Array.isArray(items) && items.length > 0) {
      const itemMap: Record<string, MaterialRequestItem[]> = {}
      for (const item of items as MaterialRequestItem[]) {
        if (!item?.request_id) continue
        if (!itemMap[item.request_id]) itemMap[item.request_id] = []
        itemMap[item.request_id].push(item)
      }
      for (const mrf of mrfs) mrf.items = itemMap[mrf.id] ?? []
    } else {
      for (const mrf of mrfs) mrf.items = []
    }

    // Load project names
    const projectIds = [...new Set(mrfs.map(m => m.project_id))]
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, address')
      .in('id', projectIds)
      .not('disposition', 'in', INACTIVE_DISPOSITION_FILTER)
    if (projects && Array.isArray(projects)) {
      const projMap: Record<string, { name: string; address: string | null }> = {}
      for (const p of projects as { id: string; name: string; address: string | null }[]) {
        if (p?.id) projMap[p.id] = { name: p.name ?? '', address: p.address ?? null }
      }
      for (const mrf of mrfs) mrf.project = projMap[mrf.project_id] ?? null
    }
  }

  return mrfs
}

/** Update MRF status (Danny's workflow) */
export async function updateMRFStatus(id: string, status: string): Promise<boolean> {
  const { error } = await db().from('material_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('[updateMRFStatus]', error); return false }
  return true
}

/** Update fulfilled quantity on an item */
export async function updateMRFItemFulfilled(itemId: string, fulfilledQty: number): Promise<boolean> {
  const { error } = await db().from('material_request_items').update({ fulfilled_qty: fulfilledQty }).eq('id', itemId)
  if (error) { console.error('[updateMRFItemFulfilled]', error); return false }
  return true
}
