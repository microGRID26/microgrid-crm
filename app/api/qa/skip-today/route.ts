/**
 * POST /api/qa/skip-today
 * Body: { caseId }
 * Creates a fresh `skipped` qa_runs row so the dashboard banner stays hidden
 * across refreshes for the rest of the day.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { findTodayRun, getQaAdmin, resolveTesterId } from '@/lib/qa/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-skip-today:${user.email}`, { windowMs: 60_000, max: 30, prefix: 'qa-skip-today' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const tester = await resolveTesterId(user.email)
  if (!tester) return NextResponse.json({ error: 'No user record' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { caseId } = body as { caseId?: string }
  if (!caseId || !UUID_RE.test(caseId)) return NextResponse.json({ error: 'Invalid caseId' }, { status: 400 })

  const existing = await findTodayRun(tester.id, new Date())
  if (existing) {
    return NextResponse.json({ ok: true, runId: existing.id, alreadyExists: true })
  }

  const admin = getQaAdmin()
  const now = new Date().toISOString()
  const { data: created, error } = await admin
    .from('qa_runs')
    .insert({
      tester_id: tester.id,
      test_case_id: caseId,
      status: 'skipped',
      started_at: now,
      completed_at: now,
      duration_ms: 0,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (error || !created) {
    console.error('skip-today insert failed', error)
    return NextResponse.json({ error: 'Failed to skip' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, runId: created.id })
}
