import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { rateLimit } from '@/lib/rate-limit'
import { fireMilestoneInvoices, TRIGGER_MILESTONES, type TriggerMilestone } from '@/lib/invoices/trigger'

/**
 * POST /api/invoices/trigger
 *
 * Fires all active invoice_rules matching a given (project, milestone) pair.
 * Called fire-and-forget from useProjectTasks.ts when NTP/install/PTO tasks
 * move to Complete. Idempotent via the unique index on
 * (project_id, rule_id, milestone).
 *
 * Body:
 *   { project_id: string, milestone: 'ntp' | 'installation' | 'pto' }
 *
 * Auth: valid Supabase session (must be a CRM user).
 * Rate limited: 20 requests per minute per project.
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: { project_id?: string; milestone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const projectId = body.project_id
  const milestone = body.milestone

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }
  if (!milestone || !TRIGGER_MILESTONES.includes(milestone as TriggerMilestone)) {
    return NextResponse.json(
      { error: `milestone must be one of: ${TRIGGER_MILESTONES.join(', ')}` },
      { status: 400 },
    )
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const { success } = await rateLimit(`invoice-trigger:${projectId}`, {
    windowMs: 60_000,
    max: 20,
    prefix: 'invoice',
  })
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // ── Fire trigger ───────────────────────────────────────────────────────
  try {
    const result = await fireMilestoneInvoices({
      projectId,
      milestone: milestone as TriggerMilestone,
    })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('[POST /api/invoices/trigger]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
