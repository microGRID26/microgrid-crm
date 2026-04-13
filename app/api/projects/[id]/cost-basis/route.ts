import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { rateLimit } from '@/lib/rate-limit'
import { loadProjectCostBasis } from '@/lib/cost/api'
import type { Project } from '@/types/database'

const INTERNAL_ROLES = new Set(['admin', 'super_admin', 'manager', 'finance'])

/**
 * GET /api/projects/[id]/cost-basis
 *
 * Returns the per-project cost reconciliation: line items + I34:M39 summary.
 * Internal-only — gated to admin / super_admin / manager / finance roles per
 * Mark Bench's "secure tab" requirement (2026-04-13 meeting). EPC and customer
 * tenants get 403.
 *
 * Query params:
 *   ?persist=1  — if no line items exist, persist the catalog defaults
 *                 (used by the first-load path in ProjectCostBasisTab.tsx)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params

  // ── Auth + role gate ───────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()
  const role = (userRow as { role: string } | null)?.role
  if (!role || !INTERNAL_ROLES.has(role)) {
    return NextResponse.json({ error: 'Internal users only' }, { status: 403 })
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const { success } = await rateLimit(`cost-basis:${projectId}`, {
    windowMs: 60_000,
    max: 30,
    prefix: 'cost-basis',
  })
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // ── Load project + cost basis ──────────────────────────────────────────
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  if (projectErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const persist = new URL(request.url).searchParams.get('persist') === '1'

  try {
    const result = await loadProjectCostBasis(project as Project, { persist })
    return NextResponse.json({
      project_id: projectId,
      project_name: (project as Project).name,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/projects/[id]/cost-basis]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
