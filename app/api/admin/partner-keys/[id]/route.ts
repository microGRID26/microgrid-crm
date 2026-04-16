// DELETE /api/admin/partner-keys/:id — revoke a partner key (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/partner-api/admin/require-admin'
import { revokeKey } from '@/lib/partner-api/admin/keys'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminSession(request)
  if (!gate.ok) return gate.response

  const { id } = await context.params
  // R1 fix (Medium): validate UUID before hitting Postgres to surface a clean
  // 400 instead of a Postgres cast error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Key id must be a UUID' }, { status: 400 })
  }

  let reason: string | undefined
  try {
    const body = await request.json() as { reason?: string }
    reason = body.reason
  } catch {
    // No body is fine — reason is optional
  }

  try {
    const result = await revokeKey({ keyId: id, revokedById: gate.session.userId, reason })
    return NextResponse.json({
      data: {
        id,
        status: result.already_revoked ? 'already_revoked' : 'revoked',
      },
    })
  } catch (err) {
    console.error('[admin/partner-keys DELETE]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 400 },
    )
  }
}
