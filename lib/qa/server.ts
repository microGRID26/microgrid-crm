/**
 * Server-side QA daily-driver helpers for MicroGRID.
 *
 * Uses the service-role admin client to bypass RLS. Routes verify session
 * + tester identity before calling these.
 *
 * Note: in MicroGRID, tester_id is `users.id` stored as text — NOT auth.uid().
 * Routes look up users.id from auth.user.email and pass it in.
 */
import { createClient } from '@supabase/supabase-js'
import type { QACandidateCase, QARecentRun } from './case-selection'
import { QA_CASE_COOLDOWN_DAYS } from './case-selection'

export const QA_RUN_TERMINAL_STATUSES = ['pass', 'fail', 'blocked', 'skipped', 'abandoned'] as const
export const QA_RUN_ABANDON_AFTER_HOURS = 8

// MicroGRID's generated Database type doesn't include qa_runs / qa_run_events.
// Using the untyped Generic schema lets us touch them without TS gymnastics.
// (Routes still validate inputs explicitly.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  if (adminClient) return adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service key')
  adminClient = createClient(url, key)
  return adminClient
}

/** Resolve auth user → users.id (the value used as tester_id). */
export async function resolveTesterId(email: string): Promise<{ id: string; role: string; name: string } | null> {
  const admin = getAdmin()
  const { data } = await admin.from('users').select('id, role, name').eq('email', email).single()
  if (!data) return null
  return { id: data.id as string, role: (data.role as string) ?? 'user', name: (data.name as string) ?? email }
}

/** Load every test case + its parent plan, joined into a flat shape. */
export async function loadCandidateCases(): Promise<QACandidateCase[]> {
  const admin = getAdmin()
  const { data, error } = await admin
    .from('test_cases')
    .select('id, plan_id, title, instructions, expected_result, page_url, priority, sort_order, plan:test_plans!inner(id, name, role_filter, sort_order)')
  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((c) => ({
    id: c.id,
    plan_id: c.plan_id,
    plan_name: c.plan?.name ?? '',
    plan_role_filter: c.plan?.role_filter ?? 'all',
    plan_sort_order: c.plan?.sort_order ?? 0,
    title: c.title,
    instructions: c.instructions,
    expected_result: c.expected_result,
    page_url: c.page_url,
    priority: c.priority,
    sort_order: c.sort_order,
  }))
}

/** Load case_ids the tester has been assigned via test_assignments. */
export async function loadAssignedCaseIds(testerId: string): Promise<string[]> {
  const admin = getAdmin()
  const { data } = await admin.from('test_assignments').select('test_case_id').eq('tester_id', testerId)
  if (!data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => r.test_case_id as string)
}

/** Load all terminal runs for a tester within the cooldown window. */
export async function loadRecentRuns(testerId: string, now = new Date()): Promise<QARecentRun[]> {
  const admin = getAdmin()
  const cutoff = new Date(now.getTime() - QA_CASE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('qa_runs')
    .select('test_case_id, started_at')
    .eq('tester_id', testerId)
    .in('status', QA_RUN_TERMINAL_STATUSES as unknown as string[])
    .gte('started_at', cutoff)
  if (!data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({ test_case_id: r.test_case_id as string, started_at: r.started_at as string }))
}

/** Has the tester completed any run today (UTC)? */
export async function findTodayRun(testerId: string, now = new Date()) {
  const admin = getAdmin()
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const { data } = await admin
    .from('qa_runs')
    .select('id, status, test_case_id, started_at, completed_at')
    .eq('tester_id', testerId)
    .gte('started_at', startOfDay)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Compute current consecutive-day streak for a tester (UTC days). */
export async function computeStreak(testerId: string, now = new Date()): Promise<number> {
  const admin = getAdmin()
  const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('qa_runs')
    .select('started_at, status')
    .eq('tester_id', testerId)
    .in('status', QA_RUN_TERMINAL_STATUSES as unknown as string[])
    .gte('started_at', cutoff)
    .order('started_at', { ascending: false })
  if (!data || data.length === 0) return 0

  const days = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of data as any[]) {
    days.add(new Date(row.started_at).toISOString().slice(0, 10))
  }

  let streak = 0
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

/** Get a fresh admin client (used by routes that need ad-hoc inserts).
 *  Returns `any` because MicroGRID's typed Database doesn't include qa_runs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getQaAdmin(): any {
  return getAdmin()
}
