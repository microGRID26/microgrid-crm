// GET /api/v1/partner/projects/:id/planset
//
// v1 returns the structured project specs Rush needs to render their own
// stamped planset. No server-rendered PDF — partners build their package
// from this JSON. Phase 4 can add a signed-URL PDF once that workflow is
// proven.

import { NextResponse } from 'next/server'
import { withPartnerAuth } from '@/lib/partner-api/middleware'
import { partnerApiAdmin } from '@/lib/partner-api/supabase-admin'
import { ApiError } from '@/lib/partner-api/errors'
import { redactCustomerFields } from '@/lib/partner-api/pii'
import { partnerHasProjectAccess } from '@/lib/partner-api/project-access'

export const runtime = 'nodejs'

// R1/R2 fix: verified against types/database.ts Project interface. `name` is
// the customer name (no separate customer_name column). `ahj`/`utility` are
// text labels on projects (no FK ids). Drop the imaginary columns.
const PLANSET_FIELDS = `
  id, name, address, city, zip, stage, sale_date,
  systemkw,
  module, module_qty, inverter, inverter_qty, battery, battery_qty,
  optimizer, optimizer_qty,
  voltage, msp_bus_rating, mpu,
  meter_location, panel_location,
  ahj, utility,
  email, phone
`

export const GET = withPartnerAuth(
  { scopes: ['projects:planset:read'], category: 'read' },
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

    // Fetch project + folder in parallel. ahj + utility are text fields on
    // the project row itself (verified against types/database.ts) so no
    // second hop needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = partnerApiAdmin() as any
    const [project, folder] = await Promise.all([
      sb.from('projects').select(PLANSET_FIELDS).eq('id', id).maybeSingle(),
      sb.from('project_folders').select('folder_url, folder_id').eq('project_id', id).maybeSingle(),
    ])

    if (project.error) throw new ApiError('internal_error', project.error.message)
    if (!project.data) throw new ApiError('not_found', 'Project not found')

    const redacted = redactCustomerFields(project.data as Record<string, unknown>, ctx.customerPiiScope)

    return NextResponse.json(
      {
        data: {
          project: redacted,
          drive_folder: folder.data ?? null,
          note: 'v1 returns structured project specs. Render your own stamped planset from this payload. Server-rendered PDF coming in v2. AHJ and utility are text labels on the project itself.',
        },
      },
      { headers: { 'X-Request-Id': ctx.requestId } },
    )
  },
)
