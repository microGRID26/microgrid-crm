// GET /api/v1/partner/leads/:id/status
//
// Lightweight status-only read for partners polling on the milestone state
// without pulling the full lead payload. Also exposes the funding-milestone
// summary so Solicit can show the rep "install complete / PTO / M3 funded"
// chips in their own UI.

import { NextResponse } from 'next/server'
import { withPartnerAuth } from '@/lib/partner-api/middleware'
import { partnerApiAdmin } from '@/lib/partner-api/supabase-admin'
import { ApiError } from '@/lib/partner-api/errors'

export const runtime = 'nodejs'

export const GET = withPartnerAuth(
  { scopes: ['leads:read'], category: 'read' },
  async (_req, ctx, routeCtx: { params: Promise<{ id: string }> }) => {
    const { id } = await routeCtx.params
    if (!id) throw new ApiError('invalid_request', 'id required')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = partnerApiAdmin() as any
    const { data, error } = await sb
      .from('projects')
      .select(`
        id, stage, stage_date, disposition, sale_date,
        survey_date, install_complete_date, pto_date, in_service_date,
        origination_partner_org_id
      `)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new ApiError('internal_error', error.message)
    if (!data) throw new ApiError('not_found', 'Lead not found')
    const row = data as {
      origination_partner_org_id: string | null
      [k: string]: unknown
    }
    if (ctx.orgType !== 'platform' && row.origination_partner_org_id !== ctx.orgId) {
      throw new ApiError('not_found', 'Lead not found or not accessible to this org')
    }

    // Optional: pull funding milestone status alongside.
    const { data: funding } = await sb
      .from('project_funding')
      .select('m1_status, m2_status, m3_status, m2_funded_date, m3_funded_date')
      .eq('project_id', id)
      .maybeSingle()

    return NextResponse.json(
      {
        data: {
          id: row.id,
          stage: row.stage,
          stage_date: row.stage_date,
          disposition: row.disposition,
          sale_date: row.sale_date,
          survey_date: row.survey_date,
          install_complete_date: row.install_complete_date,
          pto_date: row.pto_date,
          in_service_date: row.in_service_date,
          funding: funding ?? null,
        },
      },
      { headers: { 'X-Request-Id': ctx.requestId } },
    )
  },
)
