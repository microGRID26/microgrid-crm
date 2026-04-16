// GET  /api/admin/partner-keys — list all partner keys (admin only)
// POST /api/admin/partner-keys — create a new partner key (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/partner-api/admin/require-admin'
import { createKey, listKeys } from '@/lib/partner-api/admin/keys'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const gate = await requireAdminSession(request)
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const includeRevoked = searchParams.get('include_revoked') === 'true'

  try {
    const keys = await listKeys({ includeRevoked })
    return NextResponse.json({ data: keys })
  } catch (err) {
    console.error('[admin/partner-keys GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminSession(request)
  if (!gate.ok) return gate.response

  // Admin rate limit — create at most 10 keys/min to avoid runaway scripts
  const { success } = await rateLimit(`admin:${gate.session.userId}`, {
    max: 10, prefix: 'partner-keys-create',
  })
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: {
    org_id?: string
    name?: string
    scopes?: string[]
    rate_limit_tier?: 'standard' | 'premium' | 'unlimited'
    customer_pii_scope?: boolean
    dpa_version?: string | null
    expires_at?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.org_id || !body.name || !Array.isArray(body.scopes)) {
    return NextResponse.json(
      { error: 'org_id, name, and scopes[] are required' },
      { status: 400 },
    )
  }

  // R1 fix (Medium): validate rate_limit_tier at route boundary so we return
  // a clean 400 instead of surfacing a Postgres CHECK error message.
  const VALID_TIERS = new Set(['standard', 'premium', 'unlimited'])
  if (body.rate_limit_tier && !VALID_TIERS.has(body.rate_limit_tier)) {
    return NextResponse.json(
      { error: `rate_limit_tier must be one of: ${[...VALID_TIERS].join(', ')}` },
      { status: 400 },
    )
  }

  // Validate org_id is a UUID (prevents PG cast errors on bad input).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.org_id)) {
    return NextResponse.json({ error: 'org_id must be a UUID' }, { status: 400 })
  }

  try {
    const result = await createKey({
      orgId: body.org_id,
      name: body.name,
      scopes: body.scopes,
      rateLimitTier: body.rate_limit_tier,
      customerPiiScope: body.customer_pii_scope,
      dpaVersion: body.dpa_version,
      expiresAt: body.expires_at,
      createdById: gate.session.userId,
    })
    return NextResponse.json({
      data: {
        id: result.id,
        plaintext: result.plaintext,         // SHOWN ONCE — admin UI must capture now
        prefix: result.prefix,
        expires_at: result.expires_at,
        reminder: 'Copy the plaintext now. It will never be shown again.',
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[admin/partner-keys POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 400 },
    )
  }
}
