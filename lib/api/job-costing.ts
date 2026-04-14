// lib/api/job-costing.ts — Job costing data access layer
// Tables: job_cost_labor, job_cost_materials, job_cost_overhead, crew_rates (migration 071)
// Org filtering: direct org_id column on all tables + RLS

import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { INACTIVE_DISPOSITION_FILTER } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

export interface JobCostLabor {
  id: string
  project_id: string
  work_order_id: string | null
  crew_id: string | null
  worker_name: string | null
  hours: number
  hourly_rate: number
  total_cost: number  // generated column
  work_date: string
  category: string
  notes: string | null
  org_id: string | null
  created_at: string
}

export interface JobCostMaterial {
  id: string
  project_id: string
  material_name: string
  category: string | null
  quantity: number
  unit_cost: number
  total_cost: number  // generated column
  vendor: string | null
  po_number: string | null
  notes: string | null
  org_id: string | null
  created_at: string
}

export interface JobCostOverhead {
  id: string
  project_id: string
  category: string
  description: string | null
  amount: number
  vendor: string | null
  notes: string | null
  org_id: string | null
  created_at: string
}

export interface CrewRate {
  id: string
  crew_id: string
  crew_name: string | null
  role: string
  hourly_rate: number
  effective_date: string
  active: boolean
  org_id: string | null
  created_at: string
}

export interface ProjectCostSummary {
  project_id: string
  project_name: string
  contract: number
  systemkw: number
  labor_cost: number
  material_cost: number
  overhead_cost: number
  total_cost: number
  margin: number
  margin_pct: number
  cost_per_watt: number
}

// ── Constants ────────────────────────────────────────────────────────────────

export const LABOR_CATEGORIES = ['install', 'electrical', 'battery', 'roofing', 'inspection', 'rework', 'other'] as const
export const MATERIAL_CATEGORIES = ['modules', 'inverter', 'battery', 'racking', 'bos', 'electrical', 'roofing', 'other'] as const
export const OVERHEAD_CATEGORIES = ['permits', 'engineering', 'travel', 'equipment_rental', 'disposal', 'contingency', 'other'] as const

// ── Crew Rates ───────────────────────────────────────────────────────────────

export async function loadCrewRates(orgId?: string): Promise<CrewRate[]> {
  const supabase = createClient()
  let q = supabase.from('crew_rates')
    .select('id, crew_id, crew_name, role, hourly_rate, effective_date, active, org_id, created_at')
    .eq('active', true)
    .order('crew_name')
    .order('role')
    .limit(500)
  if (orgId) q = q.eq('org_id', orgId)
  const { data, error } = await q
  if (error) console.error('[loadCrewRates]', error.message)
  return (data ?? []) as CrewRate[]
}

export async function addCrewRate(rate: {
  crew_id: string
  crew_name?: string
  role?: string
  hourly_rate: number
  effective_date?: string
  org_id?: string
}): Promise<CrewRate | null> {
  const { data, error } = await db().from('crew_rates')
    .insert({
      crew_id: rate.crew_id,
      crew_name: rate.crew_name ?? null,
      role: rate.role ?? 'installer',
      hourly_rate: rate.hourly_rate,
      effective_date: rate.effective_date ?? new Date().toISOString().slice(0, 10),
      org_id: rate.org_id ?? null,
    })
    .select().single()
  if (error) { console.error('[addCrewRate]', error.message); return null }
  return data as CrewRate
}

export async function updateCrewRate(id: string, updates: Partial<Pick<CrewRate, 'hourly_rate' | 'role' | 'active'>>): Promise<boolean> {
  const { error } = await db().from('crew_rates').update(updates).eq('id', id)
  if (error) { console.error('[updateCrewRate]', error.message); return false }
  return true
}

// ── Labor Costs ──────────────────────────────────────────────────────────────

export async function loadLaborCosts(projectId?: string): Promise<JobCostLabor[]> {
  const supabase = createClient()
  let q = supabase.from('job_cost_labor')
    .select('id, project_id, work_order_id, crew_id, worker_name, hours, hourly_rate, total_cost, work_date, category, notes, org_id, created_at')
    .order('work_date', { ascending: false })
    .limit(2000)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) console.error('[loadLaborCosts]', error.message)
  return (data ?? []) as JobCostLabor[]
}

export async function addLaborCost(entry: {
  project_id: string
  work_order_id?: string | null
  crew_id?: string | null
  worker_name?: string | null
  hours: number
  hourly_rate: number
  work_date: string
  category?: string
  notes?: string | null
  org_id?: string | null
}): Promise<JobCostLabor | null> {
  const { data, error } = await db().from('job_cost_labor')
    .insert({
      project_id: entry.project_id,
      work_order_id: entry.work_order_id ?? null,
      crew_id: entry.crew_id ?? null,
      worker_name: entry.worker_name ?? null,
      hours: entry.hours,
      hourly_rate: entry.hourly_rate,
      work_date: entry.work_date,
      category: entry.category ?? 'install',
      notes: entry.notes ?? null,
      org_id: entry.org_id ?? null,
    })
    .select().single()
  if (error) { console.error('[addLaborCost]', error.message); return null }
  return data as JobCostLabor
}

export async function deleteLaborCost(id: string): Promise<boolean> {
  const { error } = await db().from('job_cost_labor').delete().eq('id', id)
  if (error) { console.error('[deleteLaborCost]', error.message); return false }
  return true
}

// ── Material Costs ───────────────────────────────────────────────────────────

export async function loadMaterialCosts(projectId?: string): Promise<JobCostMaterial[]> {
  const supabase = createClient()
  let q = supabase.from('job_cost_materials')
    .select('id, project_id, material_name, category, quantity, unit_cost, total_cost, vendor, po_number, notes, org_id, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) console.error('[loadMaterialCosts]', error.message)
  return (data ?? []) as JobCostMaterial[]
}

export async function addMaterialCost(entry: {
  project_id: string
  material_name: string
  category?: string | null
  quantity: number
  unit_cost: number
  vendor?: string | null
  po_number?: string | null
  notes?: string | null
  org_id?: string | null
}): Promise<JobCostMaterial | null> {
  const { data, error } = await db().from('job_cost_materials')
    .insert(entry)
    .select().single()
  if (error) { console.error('[addMaterialCost]', error.message); return null }
  return data as JobCostMaterial
}

export async function deleteMaterialCost(id: string): Promise<boolean> {
  const { error } = await db().from('job_cost_materials').delete().eq('id', id)
  if (error) { console.error('[deleteMaterialCost]', error.message); return false }
  return true
}

// ── Overhead Costs ───────────────────────────────────────────────────────────

export async function loadOverheadCosts(projectId?: string): Promise<JobCostOverhead[]> {
  const supabase = createClient()
  let q = supabase.from('job_cost_overhead')
    .select('id, project_id, category, description, amount, vendor, notes, org_id, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) console.error('[loadOverheadCosts]', error.message)
  return (data ?? []) as JobCostOverhead[]
}

export async function addOverheadCost(entry: {
  project_id: string
  category: string
  description?: string | null
  amount: number
  vendor?: string | null
  notes?: string | null
  org_id?: string | null
}): Promise<JobCostOverhead | null> {
  const { data, error } = await db().from('job_cost_overhead')
    .insert(entry)
    .select().single()
  if (error) { console.error('[addOverheadCost]', error.message); return null }
  return data as JobCostOverhead
}

export async function deleteOverheadCost(id: string): Promise<boolean> {
  const { error } = await db().from('job_cost_overhead').delete().eq('id', id)
  if (error) { console.error('[deleteOverheadCost]', error.message); return false }
  return true
}

// ── Aggregated Project Cost Summary ──────────────────────────────────────────

/** Load cost summaries for all projects that have any cost data.
 *  Joins with projects table for name, contract, systemkw. */
export async function loadProjectCostSummaries(orgId?: string): Promise<ProjectCostSummary[]> {
  const supabase = createClient()

  // Load all cost data in parallel
  let laborQ = supabase.from('job_cost_labor').select('project_id, total_cost').limit(10000)
  let materialQ = supabase.from('job_cost_materials').select('project_id, total_cost').limit(10000)
  let overheadQ = supabase.from('job_cost_overhead').select('project_id, amount').limit(10000)
  if (orgId) {
    laborQ = laborQ.eq('org_id', orgId)
    materialQ = materialQ.eq('org_id', orgId)
    overheadQ = overheadQ.eq('org_id', orgId)
  }

  const [laborRes, materialRes, overheadRes] = await Promise.all([laborQ, materialQ, overheadQ])

  // Aggregate by project
  const costMap: Record<string, { labor: number; material: number; overhead: number }> = {}

  for (const row of (laborRes.data ?? []) as { project_id: string; total_cost: number }[]) {
    if (!costMap[row.project_id]) costMap[row.project_id] = { labor: 0, material: 0, overhead: 0 }
    costMap[row.project_id].labor += Number(row.total_cost) || 0
  }
  for (const row of (materialRes.data ?? []) as { project_id: string; total_cost: number }[]) {
    if (!costMap[row.project_id]) costMap[row.project_id] = { labor: 0, material: 0, overhead: 0 }
    costMap[row.project_id].material += Number(row.total_cost) || 0
  }
  for (const row of (overheadRes.data ?? []) as { project_id: string; amount: number }[]) {
    if (!costMap[row.project_id]) costMap[row.project_id] = { labor: 0, material: 0, overhead: 0 }
    costMap[row.project_id].overhead += Number(row.amount) || 0
  }

  const projectIds = Object.keys(costMap)
  if (projectIds.length === 0) return []

  // Fetch project details
  const { data: projects } = await supabase.from('projects')
    .select('id, name, contract, systemkw')
    .in('id', projectIds)
    .not('disposition', 'in', INACTIVE_DISPOSITION_FILTER)
    .limit(5000)

  const projMap: Record<string, { name: string; contract: number; systemkw: number }> = {}
  for (const p of (projects ?? []) as { id: string; name: string; contract: number | null; systemkw: number | null }[]) {
    projMap[p.id] = { name: p.name, contract: Number(p.contract) || 0, systemkw: Number(p.systemkw) || 0 }
  }

  return projectIds.map(pid => {
    const costs = costMap[pid]
    const proj = projMap[pid] ?? { name: pid, contract: 0, systemkw: 0 }
    const totalCost = costs.labor + costs.material + costs.overhead
    const margin = proj.contract - totalCost
    const marginPct = proj.contract > 0 ? (margin / proj.contract) * 100 : 0
    const costPerWatt = proj.systemkw > 0 ? totalCost / (proj.systemkw * 1000) : 0

    return {
      project_id: pid,
      project_name: proj.name,
      contract: proj.contract,
      systemkw: proj.systemkw,
      labor_cost: costs.labor,
      material_cost: costs.material,
      overhead_cost: costs.overhead,
      total_cost: totalCost,
      margin,
      margin_pct: Math.round(marginPct * 10) / 10,
      cost_per_watt: Math.round(costPerWatt * 100) / 100,
    }
  }).sort((a, b) => b.total_cost - a.total_cost)
}

// ── Auto-capture: Create labor entry from completed work order ───────────────

/** When a work order completes, auto-create a labor cost entry using crew rate + time on site. */
export async function captureWOLaborCost(workOrder: {
  id: string
  project_id: string
  assigned_crew: string | null
  time_on_site_minutes: number | null
  type: string
  org_id?: string | null
}): Promise<JobCostLabor | null> {
  if (!workOrder.assigned_crew || !workOrder.time_on_site_minutes) return null

  // Look up crew rate
  const { data: rates } = await createClient().from('crew_rates')
    .select('hourly_rate, crew_id')
    .eq('crew_name', workOrder.assigned_crew)
    .eq('active', true)
    .order('effective_date', { ascending: false })
    .limit(1)

  if (!rates || rates.length === 0) return null
  const rate = (rates[0] as { hourly_rate: number; crew_id: string })

  const hours = Math.round((workOrder.time_on_site_minutes / 60) * 100) / 100

  return addLaborCost({
    project_id: workOrder.project_id,
    work_order_id: workOrder.id,
    crew_id: rate.crew_id,
    hours,
    hourly_rate: rate.hourly_rate,
    work_date: new Date().toISOString().slice(0, 10),
    category: workOrder.type === 'install' ? 'install' : workOrder.type === 'inspection' ? 'inspection' : 'other',
    notes: `Auto-captured from WO completion (${workOrder.time_on_site_minutes} min)`,
    org_id: workOrder.org_id ?? null,
  })
}
