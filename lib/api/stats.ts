// lib/api/stats.ts — Live dashboard stats (parallel count queries)
// Org filtering: uses direct org_id where available, RLS for the rest

import { db } from '@/lib/db'
import { INACTIVE_DISPOSITIONS } from '@/lib/utils'

export interface StageStat {
  count: number
  value: number
}

export interface LiveStats {
  projectsByStage: Record<string, StageStat>
  totalProjects: number
  totalValue: number
  openTickets: number
  activeCrews: number
  totalNotes: number
  activeUsers: number
  totalAHJs: number
  totalEquipment: number
  /** Archived NetSuite records in `legacy_projects` (In Service + Loyalty + Legal). */
  legacyRecordsCount: number
}

const EMPTY_STATS: LiveStats = {
  projectsByStage: {},
  totalProjects: 0,
  totalValue: 0,
  openTickets: 0,
  activeCrews: 0,
  totalNotes: 0,
  activeUsers: 0,
  totalAHJs: 0,
  totalEquipment: 0,
  legacyRecordsCount: 0,
}

/** Load live dashboard stats via parallel count queries.
 *  Projects include both counts and contract values per stage. */
export async function loadLiveStats(orgId?: string): Promise<LiveStats> {
  const supabase = db()
  const inactiveFilter = `(${INACTIVE_DISPOSITIONS.map(d => `"${d}"`).join(',')})`

  try {
    let projectQ = supabase.from('projects')
      .select('stage, contract')
      .not('disposition', 'in', inactiveFilter)
      .limit(5000)
    if (orgId) projectQ = projectQ.eq('org_id', orgId)

    let ticketsQ = supabase.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'escalated'])
    let crewsQ = supabase.from('crews').select('id', { count: 'exact', head: true }).eq('active', 'TRUE')
    if (orgId) { ticketsQ = ticketsQ.eq('org_id', orgId); crewsQ = crewsQ.eq('org_id', orgId) }

    const [projectsRes, ticketsRes, crewsRes, notesRes, usersRes, ahjsRes, equipRes, legacyRes] = await Promise.all([
      projectQ,
      ticketsQ,
      crewsQ,
      supabase.from('notes').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('ahjs').select('id', { count: 'exact', head: true }),
      supabase.from('equipment').select('id', { count: 'exact', head: true }),
      supabase.from('legacy_projects').select('id', { count: 'exact', head: true }),
    ])

    const projectsByStage: Record<string, StageStat> = {}
    let totalValue = 0
    for (const row of (projectsRes.data ?? []) as { stage: string; contract: number | null }[]) {
      if (!row.stage) continue
      if (!projectsByStage[row.stage]) projectsByStage[row.stage] = { count: 0, value: 0 }
      projectsByStage[row.stage].count++
      const v = Number(row.contract) || 0
      projectsByStage[row.stage].value += v
      totalValue += v
    }

    return {
      projectsByStage,
      totalProjects: (projectsRes.data ?? []).length,
      totalValue,
      openTickets: ticketsRes.count ?? 0,
      activeCrews: crewsRes.count ?? 0,
      totalNotes: notesRes.count ?? 0,
      activeUsers: usersRes.count ?? 0,
      totalAHJs: ahjsRes.count ?? 0,
      totalEquipment: equipRes.count ?? 0,
      legacyRecordsCount: legacyRes.count ?? 0,
    }
  } catch (err) {
    console.error('loadLiveStats failed:', err)
    return EMPTY_STATS
  }
}
