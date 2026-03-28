import { createClient } from '@/lib/supabase/client'

// ── Crew data access ─────────────────────────────────────────────────────────

/** Load crews by IDs (batch lookup for enrichment) */
export async function loadCrewsByIds(crewIds: string[], orgId?: string | null): Promise<{ id: string; name: string }[]> {
  if (!crewIds.length) return []
  const supabase = createClient()
  let query = supabase.from('crews')
    .select('id, name')
    .in('id', crewIds)
  if (orgId) query = query.eq('org_id', orgId)
  const { data, error } = await query
  if (error) console.error('crews batch load failed:', error)
  return (data ?? []) as { id: string; name: string }[]
}

/** Load all active crews */
export async function loadActiveCrews(orgId?: string | null) {
  const supabase = createClient()
  let query = supabase.from('crews')
    .select('*')
    .eq('active', 'TRUE')
    .order('name')
  if (orgId) query = query.eq('org_id', orgId)
  const { data, error } = await query
  if (error) console.error('active crews load failed:', error)
  return { data: data ?? [], error }
}
