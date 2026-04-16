// GET /api/v1/partner/projects/:id/photos
//
// v1 shape: returns the Drive folder URL(s) the partner can open in their
// browser (assuming we granted Drive access to the partner's workspace).
// Vision-classified auto-sorted photos land in Phase 4 once we extract the
// shared logic from /api/planset/drive-photos.

import { NextResponse } from 'next/server'
import { withPartnerAuth } from '@/lib/partner-api/middleware'
import { partnerApiAdmin } from '@/lib/partner-api/supabase-admin'
import { ApiError } from '@/lib/partner-api/errors'
import { partnerHasProjectAccess } from '@/lib/partner-api/project-access'

export const runtime = 'nodejs'

export const GET = withPartnerAuth(
  { scopes: ['projects:photos:read'], category: 'read' },
  async (_req, ctx, routeCtx: { params: Promise<{ id: string }> }) => {
    const { id } = await routeCtx.params
    if (!id) throw new ApiError('invalid_request', 'id required')

    const hasAccess = await partnerHasProjectAccess({
      orgId: ctx.orgId,
      orgType: ctx.orgType,
      projectId: id,
    })
    if (!hasAccess) {
      throw new ApiError('not_found', 'Project not found or not accessible to this org')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = partnerApiAdmin() as any
    const { data, error } = await sb
      .from('project_folders')
      .select('folder_url, folder_id, provider, updated_at')
      .eq('project_id', id)
      .limit(5)
    if (error) throw new ApiError('internal_error', error.message)

    const folders = ((data as Array<{
      folder_url: string | null
      folder_id: string | null
      provider: string | null
      updated_at: string | null
    }> | null) ?? []).filter((f) => f.folder_url)

    return NextResponse.json(
      {
        data: {
          folders,
          note: 'v1 returns Drive folder links. Grant your engineering team Drive read on the MicroGRID Projects Shared Drive to open these. Auto-classified photo slotting ships in v2.',
        },
      },
      { headers: { 'X-Request-Id': ctx.requestId } },
    )
  },
)
