/**
 * POST /api/qa/runs/[id]/event
 * Body: { type, url?, message?, metadata?, elapsedMs }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { getQaAdmin, resolveTesterId } from '@/lib/qa/server'

const VALID_EVENT_TYPES = [
  'started', 'nav', 'console_error', 'click', 'form_submit',
  'field_focus', 'overlay_resized', 'overlay_collapsed', 'overlay_expanded',
]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-event:${user.email}`, { windowMs: 60_000, max: 200, prefix: 'qa-event' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid runId' }, { status: 400 })

  const tester = await resolveTesterId(user.email)
  if (!tester) return NextResponse.json({ error: 'No user record' }, { status: 403 })

  const admin = getQaAdmin()
  const { data: run } = await admin
    .from('qa_runs')
    .select('id, tester_id, status')
    .eq('id', id)
    .single() as { data: { id: string; tester_id: string; status: string } | null }
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.tester_id !== tester.id) return NextResponse.json({ error: 'Not your run' }, { status: 403 })
  if (run.status !== 'started') return NextResponse.json({ error: 'Run is not in progress' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const { type, url, message, metadata, elapsedMs } = body as {
    type?: string; url?: string; message?: string; metadata?: Record<string, unknown>; elapsedMs?: number
  }

  if (!type || !VALID_EVENT_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
  if (url != null && (typeof url !== 'string' || url.length > 2000)) return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  if (message != null && (typeof message !== 'string' || message.length > 4000)) return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return NextResponse.json({ error: 'Invalid elapsedMs' }, { status: 400 })
  }

  const { error } = await admin.from('qa_run_events').insert({
    run_id: id,
    event_type: type,
    url: url ?? null,
    message: message ?? null,
    metadata: metadata ?? null,
    elapsed_ms: Math.floor(elapsedMs),
  })

  if (error) {
    console.error('qa_run_events insert failed', error)
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
