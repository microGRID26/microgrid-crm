/**
 * POST /api/qa/runs/start
 * Body: { caseId: string, deviceType?: string, viewportWidth?: number }
 *
 * Creates a `qa_runs` row in `started`. Idempotent for double-clicks.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { findTodayRun, getQaAdmin, resolveTesterId } from '@/lib/qa/server'

const VALID_DEVICE = ['desktop', 'mobile', 'tablet']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-start:${user.email}`, { windowMs: 60_000, max: 30, prefix: 'qa-start' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const tester = await resolveTesterId(user.email)
  if (!tester) return NextResponse.json({ error: 'No user record' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { caseId, deviceType, viewportWidth } = body as { caseId?: string; deviceType?: string; viewportWidth?: number }

  if (!caseId || typeof caseId !== 'string' || !UUID_RE.test(caseId)) {
    return NextResponse.json({ error: 'Invalid caseId' }, { status: 400 })
  }
  if (deviceType && !VALID_DEVICE.includes(deviceType)) {
    return NextResponse.json({ error: 'Invalid deviceType' }, { status: 400 })
  }
  if (viewportWidth != null && (!Number.isFinite(viewportWidth) || viewportWidth < 0 || viewportWidth > 10000)) {
    return NextResponse.json({ error: 'Invalid viewportWidth' }, { status: 400 })
  }

  const admin = getQaAdmin()
  const { data: theCase } = await admin
    .from('test_cases')
    .select('id, page_url, title')
    .eq('id', caseId)
    .single() as { data: { id: string; page_url: string | null; title: string } | null }
  if (!theCase) return NextResponse.json({ error: 'Test case not found' }, { status: 404 })

  // Idempotency: if a started run exists for this tester+case today, return it.
  const today = await findTodayRun(tester.id, new Date())
  if (today && today.status === 'started' && today.test_case_id === caseId) {
    return NextResponse.json({ runId: today.id, pageUrl: theCase.page_url, resumed: true })
  }

  const ua = req.headers.get('user-agent') ?? null
  const { data: created, error } = await admin
    .from('qa_runs')
    .insert({
      tester_id: tester.id,
      test_case_id: caseId,
      status: 'started',
      device_type: deviceType ?? null,
      user_agent: ua,
      viewport_width: viewportWidth ?? null,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (error || !created) {
    console.error('qa_runs insert failed', error)
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
  }

  await admin.from('qa_run_events').insert({
    run_id: created.id,
    event_type: 'started',
    url: theCase.page_url,
    elapsed_ms: 0,
  })

  return NextResponse.json({ runId: created.id, pageUrl: theCase.page_url, resumed: false })
}
