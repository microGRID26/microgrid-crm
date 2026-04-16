// GET  /api/admin/partner-actors?org_id=<uuid>&include_inactive=false
// POST /api/admin/partner-actors  { org_id, external_id, display_name?, email? }
//
// Admin-gated CRUD for partner_actors (rep-level sub-identities under an
// org-level partner API key). Used by Solicit to register its sales reps so
// the X-MG-Actor header can be validated at lead creation time.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/partner-api/admin/require-admin'
import { createActor, listActors } from '@/lib/partner-api/admin/actors'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const gate = await requireAdminSession(request)
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id') ?? undefined
  if (orgId && !UUID_RE.test(orgId)) {
    return NextResponse.json({ error: 'org_id must be a UUID' }, { status: 400 })
  }
  const includeInactive = searchParams.get('include_inactive') === 'true'

  try {
    const actors = await listActors({ orgId, includeInactive })
    return NextResponse.json({ data: actors })
  } catch (err) {
    console.error('[admin/partner-actors GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminSession(request)
  if (!gate.ok) return gate.response

  const { success } = await rateLimit(`admin:${gate.session.userId}`, {
    max: 60, prefix: 'partner-actors-create',
  })
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: { org_id?: string; external_id?: string; display_name?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.org_id || !UUID_RE.test(body.org_id)) {
    return NextResponse.json({ error: 'org_id must be a UUID' }, { status: 400 })
  }
  if (!body.external_id || !body.external_id.trim()) {
    return NextResponse.json({ error: 'external_id is required' }, { status: 400 })
  }
  if (body.external_id.length > 128) {
    return NextResponse.json({ error: 'external_id must be ≤128 characters' }, { status: 400 })
  }

  try {
    const actor = await createActor({
      orgId: body.org_id,
      externalId: body.external_id,
      displayName: body.display_name,
      email: body.email,
    })
    return NextResponse.json({ data: actor }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    // Unique-constraint collisions (same org + external_id twice) surface
    // here as a duplicate-key PG error. Return 409 instead of 500.
    const isDup = /duplicate key|unique constraint/i.test(msg)
    return NextResponse.json(
      { error: msg },
      { status: isDup ? 409 : 400 },
    )
  }
}
