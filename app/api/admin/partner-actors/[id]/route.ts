// DELETE /api/admin/partner-actors/:id — soft-deactivate (sets active=false)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/partner-api/admin/require-admin'
import { deactivateActor } from '@/lib/partner-api/admin/actors'

export const runtime = 'nodejs'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminSession(request)
  if (!gate.ok) return gate.response

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Actor id must be a UUID' }, { status: 400 })
  }

  try {
    const result = await deactivateActor(id)
    return NextResponse.json({
      data: {
        id,
        status: result.already_inactive ? 'already_inactive' : 'deactivated',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    const isMissing = /not found/i.test(msg)
    return NextResponse.json(
      { error: msg },
      { status: isMissing ? 404 : 400 },
    )
  }
}
