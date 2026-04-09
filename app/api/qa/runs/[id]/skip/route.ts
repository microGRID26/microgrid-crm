/** POST /api/qa/runs/[id]/skip — finalize an in-progress run as skipped. */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { getQaAdmin, resolveTesterId } from '@/lib/qa/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-skip:${user.email}`, { windowMs: 60_000, max: 30, prefix: 'qa-skip' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid runId' }, { status: 400 })

  const tester = await resolveTesterId(user.email)
  if (!tester) return NextResponse.json({ error: 'No user record' }, { status: 403 })

  const admin = getQaAdmin()
  const { data: run } = await admin
    .from('qa_runs')
    .select('id, tester_id, status, started_at')
    .eq('id', id)
    .single() as { data: { id: string; tester_id: string; status: string; started_at: string } | null }
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.tester_id !== tester.id) return NextResponse.json({ error: 'Not your run' }, { status: 403 })
  if (run.status !== 'started') return NextResponse.json({ error: 'Run already finalized' }, { status: 409 })

  const completedAt = new Date()
  const durationMs = completedAt.getTime() - new Date(run.started_at).getTime()

  const { data: updated, error } = await admin
    .from('qa_runs')
    .update({
      status: 'skipped',
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
    })
    .eq('id', id)
    .eq('status', 'started')
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (error || !updated) return NextResponse.json({ error: 'Run could not be skipped' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
