/**
 * GET /api/cron/qa-runs-cleanup
 * Daily 5 AM UTC. Marks any qa_runs row stuck in `started` for more than
 * QA_RUN_ABANDON_AFTER_HOURS as `abandoned`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getQaAdmin, QA_RUN_ABANDON_AFTER_HOURS } from '@/lib/qa/server'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const auth = request.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  let ok = false
  try {
    if (token.length === cronSecret.length) {
      ok = timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
    }
  } catch { ok = false }
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = getQaAdmin()
    const cutoff = new Date(Date.now() - QA_RUN_ABANDON_AFTER_HOURS * 60 * 60 * 1000).toISOString()
    const { data: stale } = await admin
      .from('qa_runs')
      .select('id')
      .eq('status', 'started')
      .lt('started_at', cutoff) as { data: { id: string }[] | null }

    const ids = (stale ?? []).map((r) => r.id)
    if (ids.length === 0) return NextResponse.json({ success: true, abandoned: 0 })

    const now = new Date().toISOString()
    const { error } = await admin
      .from('qa_runs')
      .update({ status: 'abandoned', completed_at: now })
      .in('id', ids)

    if (error) {
      console.error('cleanup update failed', error)
      return NextResponse.json({ error: 'Failed to abandon stale runs' }, { status: 500 })
    }

    console.log(`QA cron: abandoned ${ids.length} stale runs`)
    return NextResponse.json({ success: true, abandoned: ids.length })
  } catch (err) {
    console.error('cron error', err)
    return NextResponse.json({ error: 'Cron error' }, { status: 500 })
  }
}
