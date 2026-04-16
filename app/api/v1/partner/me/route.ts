// GET /api/v1/partner/me
// First real partner-authenticated endpoint. Returns the caller's org + key
// metadata. Useful for SDKs to verify auth + dump the scope set.

import { NextResponse } from 'next/server'
import { withPartnerAuth } from '@/lib/partner-api/middleware'

export const runtime = 'nodejs'

export const GET = withPartnerAuth(
  { scopes: [], category: 'read' },
  async (_req, ctx) => {
    return NextResponse.json(
      {
        data: {
          org: {
            id: ctx.orgId,
            slug: ctx.orgSlug,
            type: ctx.orgType,
          },
          key: {
            id: ctx.keyId,
            name: ctx.keyName,
            scopes: ctx.scopes,
            rate_limit_tier: ctx.rateLimitTier,
            customer_pii_scope: ctx.customerPiiScope,
          },
          actor: ctx.actorExternalId ? { external_id: ctx.actorExternalId } : null,
          request_id: ctx.requestId,
        },
      },
      { headers: { 'X-Request-Id': ctx.requestId } },
    )
  },
)
