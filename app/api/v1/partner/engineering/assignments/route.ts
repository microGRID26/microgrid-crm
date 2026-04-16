// GET /api/v1/partner/engineering/assignments
// List engineering assignments routed to the caller's org.
// Query params: ?status=pending&cursor=<opaque>&limit=25
// Scoped to rows where assigned_org = ctx.orgId unless caller is platform.

import { NextRequest, NextResponse } from 'next/server'
import { withPartnerAuth } from '@/lib/partner-api/middleware'
import { partnerApiAdmin } from '@/lib/partner-api/supabase-admin'
import { ApiError } from '@/lib/partner-api/errors'
import { parseLimit, decodeCursor, buildListResponse } from '@/lib/partner-api/pagination'
import { ASSIGNMENT_STATUSES } from '@/lib/api/engineering'

export const runtime = 'nodejs'

const ASSIGNMENT_COLUMNS = `id, project_id, assigned_org, requesting_org, assignment_type,
  status, priority, assigned_to, assigned_at, started_at, completed_at,
  due_date, notes, deliverables, revision_count, created_by, created_by_id,
  created_at, updated_at`

export const GET = withPartnerAuth(
  { scopes: ['engineering:assignments:read'], category: 'read' },
  async (req, ctx) => {
    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status')
    const limit = parseLimit(url.searchParams.get('limit'))
    const cursor = decodeCursor(url.searchParams.get('cursor'))

    if (statusParam && !(ASSIGNMENT_STATUSES as readonly string[]).includes(statusParam)) {
      throw new ApiError('invalid_request', `status must be one of: ${ASSIGNMENT_STATUSES.join(', ')}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = partnerApiAdmin() as any
    let q = sb.from('engineering_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)

    // Scope to the caller's org unless they're a platform tenant.
    if (ctx.orgType !== 'platform') {
      q = q.eq('assigned_org', ctx.orgId)
    }
    if (statusParam) q = q.eq('status', statusParam)
    if (cursor) {
      // (created_at DESC, id DESC) — next page is rows strictly older.
      q = q.or(`created_at.lt.${cursor.t},and(created_at.eq.${cursor.t},id.lt.${cursor.id})`)
    }

    const { data, error } = await q
    if (error) {
      throw new ApiError('internal_error', `Query failed: ${error.message}`)
    }

    const rows = (data as Array<{ id: string; created_at: string }> | null) ?? []
    const list = buildListResponse(rows, limit)
    return NextResponse.json(list, { headers: { 'X-Request-Id': ctx.requestId } })
  },
)
