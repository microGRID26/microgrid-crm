/**
 * POST /api/qa/runs/[id]/complete
 * Body: { result: 'pass'|'fail'|'blocked', starRating?, notes?, screenshotUrl? }
 *
 * Atomic claim → finalize → dual-write a test_results row.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { getQaAdmin, resolveTesterId } from '@/lib/qa/server'

const VALID_RESULT = ['pass', 'fail', 'blocked']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-complete:${user.email}`, { windowMs: 60_000, max: 30, prefix: 'qa-complete' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid runId' }, { status: 400 })

  const tester = await resolveTesterId(user.email)
  if (!tester) return NextResponse.json({ error: 'No user record' }, { status: 403 })

  const admin = getQaAdmin()
  const { data: run } = await admin
    .from('qa_runs')
    .select('id, tester_id, test_case_id, status, started_at')
    .eq('id', id)
    .single() as { data: { id: string; tester_id: string; test_case_id: string; status: string; started_at: string } | null }
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.tester_id !== tester.id) return NextResponse.json({ error: 'Not your run' }, { status: 403 })
  if (run.status !== 'started') return NextResponse.json({ error: 'Run already finalized' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const { result, starRating, notes, screenshotUrl } = body as {
    result?: string; starRating?: number; notes?: string; screenshotUrl?: string
  }

  if (!result || !VALID_RESULT.includes(result)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
  if (starRating != null && (!Number.isInteger(starRating) || starRating < 1 || starRating > 5)) {
    return NextResponse.json({ error: 'Invalid starRating' }, { status: 400 })
  }
  if (notes != null && (typeof notes !== 'string' || notes.length > 4000)) {
    return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
  }
  if (screenshotUrl != null) {
    if (typeof screenshotUrl !== 'string' || screenshotUrl.length > 500) {
      return NextResponse.json({ error: 'Invalid screenshotUrl' }, { status: 400 })
    }
    if (!screenshotUrl.startsWith('qa-runs/') || screenshotUrl.includes('..')) {
      return NextResponse.json({ error: 'Invalid screenshot path' }, { status: 400 })
    }
  }

  const completedAt = new Date()
  const durationMs = completedAt.getTime() - new Date(run.started_at).getTime()

  const { data: updated, error: updErr } = await admin
    .from('qa_runs')
    .update({
      status: result,
      star_rating: starRating ?? null,
      notes: notes ?? null,
      screenshot_url: screenshotUrl ?? null,
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
    })
    .eq('id', id)
    .eq('status', 'started')
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (updErr || !updated) {
    return NextResponse.json({ error: 'Run could not be finalized' }, { status: 409 })
  }

  // Dual-write test_results so the existing /testing admin feed picks it up.
  const { data: result_row } = await admin
    .from('test_results')
    .insert({
      test_case_id: run.test_case_id,
      tester_id: tester.id,
      tester_name: tester.name,
      status: result,
      feedback: notes ?? null,
      screenshot_path: screenshotUrl ?? null,
      tested_at: completedAt.toISOString(),
    })
    .select('id')
    .single() as { data: { id: string } | null }

  if (result_row?.id) {
    await admin.from('qa_runs').update({ test_result_id: result_row.id }).eq('id', id)
  }

  await admin.from('qa_run_events').insert({
    run_id: id,
    event_type: 'completed',
    elapsed_ms: durationMs,
    metadata: { result, starRating: starRating ?? null },
  })

  return NextResponse.json({ ok: true, durationMs })
}
