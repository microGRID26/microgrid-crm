import { db } from '@/lib/db'

// ── Schedule data access ─────────────────────────────────────────────────────

/** Load schedule entries for a date range with project name join.
 *  Catches multi-day jobs: date <= endDate AND (end_date >= startDate OR (end_date IS NULL AND date >= startDate))
 */
export async function loadScheduleByDateRange(startDate: string, endDate: string) {
  // Uses db() because the select includes a join (project:projects) which requires untyped query
  const { data, error } = await db().from('schedule')
    .select('*, project:projects(name, city)')
    .lte('date', endDate)
    .or(`end_date.gte.${startDate},and(end_date.is.null,date.gte.${startDate})`)
  if (error) console.error('schedule load failed:', error)
  return { data: data ?? [], error }
}
