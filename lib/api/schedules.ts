import { db } from '@/lib/db'

// ── Schedule data access ─────────────────────────────────────────────────────

/** Load schedule entries for a date range with project name join */
export async function loadScheduleByDateRange(startDate: string, endDate: string) {
  // Uses db() because the select includes a join (project:projects) which requires untyped query
  const { data, error } = await db().from('schedule')
    .select('*, project:projects(name, city)')
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) console.error('schedule load failed:', error)
  return { data: data ?? [], error }
}
