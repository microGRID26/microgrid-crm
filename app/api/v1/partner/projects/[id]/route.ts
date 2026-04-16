// GET /api/v1/partner/projects/:id
// Returns the project row, PII-redacted unless the caller has customer_pii_scope.
// Access gated: caller org must have at least one non-cancelled engineering
// assignment on this project, or be a platform tenant.

import { NextResponse } from 'next/server'
import { withPartnerAuth } from '@/lib/partner-api/middleware'
import { partnerApiAdmin } from '@/lib/partner-api/supabase-admin'
import { ApiError } from '@/lib/partner-api/errors'
import { redactCustomerFields } from '@/lib/partner-api/pii'
import { partnerHasProjectAccess } from '@/lib/partner-api/project-access'

export const runtime = 'nodejs'

export const GET = withPartnerAuth(
  { scopes: ['projects:read'], category: 'read' },
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

    // R1/R2 fix: explicit column list so partners only see fields we intend
    // to expose. Verified against types/database.ts Project interface — no
    // fields here that don't exist in the projects table. `name` IS the
    // customer name; no separate customer_name column. `ahj`/`utility` are
    // text labels; no FK id columns.
    const PARTNER_PROJECT_FIELDS = `
      id, name, stage, stage_date, sale_date, disposition,
      address, city, zip,
      systemkw, module, module_qty, inverter, inverter_qty, battery, battery_qty,
      optimizer, optimizer_qty,
      voltage, msp_bus_rating, mpu,
      meter_location, panel_location,
      ahj, utility, financier, financing_type,
      email, phone,
      survey_date, install_complete_date, pto_date, in_service_date,
      created_at
    `
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = partnerApiAdmin() as any
    const { data, error } = await sb
      .from('projects')
      .select(PARTNER_PROJECT_FIELDS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new ApiError('internal_error', error.message)
    if (!data) throw new ApiError('not_found', 'Project not found')

    const redacted = redactCustomerFields(data as Record<string, unknown>, ctx.customerPiiScope)
    return NextResponse.json(
      { data: redacted },
      { headers: { 'X-Request-Id': ctx.requestId } },
    )
  },
)
