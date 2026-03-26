import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ── EDGE → NOVA Webhook: Funding Status Updates ────────────────────────────
// Receives POST from EDGE Portal when funding status changes.
// Updates NOVA's project_funding table and logs to audit_log.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || ''
const WEBHOOK_SECRET = process.env.EDGE_WEBHOOK_SECRET || ''

function supabase() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET)
}

/** Timing-safe secret comparison */
function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true // No secret configured = skip verification

  try {
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}

interface EdgeInboundPayload {
  event?: string
  project_id?: string
  timestamp?: string
  data?: Record<string, unknown>
}

async function logToAudit(
  db: ReturnType<typeof supabase>,
  projectId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null
) {
  await db.from('audit_log').insert({
    project_id: projectId,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: 'EDGE Portal',
    changed_by_id: null,
  })
}

async function logSync(
  db: ReturnType<typeof supabase>,
  projectId: string,
  eventType: string,
  payload: Record<string, unknown>,
  status: 'delivered' | 'failed',
  responseCode: number,
  errorMessage?: string
) {
  await db.from('edge_sync_log').insert({
    project_id: projectId,
    event_type: eventType,
    direction: 'inbound',
    payload,
    status,
    response_code: responseCode,
    error_message: errorMessage ?? null,
  })
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text()

  // Verify webhook signature
  if (WEBHOOK_SECRET) {
    const signature = request.headers.get('x-webhook-signature') ?? ''
    if (!verifySignature(bodyText, signature)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let payload: EdgeInboundPayload
  try {
    payload = JSON.parse(bodyText) as EdgeInboundPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event, project_id, data } = payload

  // Validate required fields
  if (!event || !project_id) {
    return NextResponse.json({ error: 'Missing required fields: event and project_id' }, { status: 400 })
  }

  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Missing or invalid data field' }, { status: 400 })
  }

  const db = supabase()

  // Verify project exists
  const { data: existingProject, error: projErr } = await db
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .maybeSingle()

  if (projErr || !existingProject) {
    await logSync(db, project_id, event, payload as Record<string, unknown>, 'failed', 404, 'Project not found')
    return NextResponse.json({ error: `Project ${project_id} not found` }, { status: 404 })
  }

  try {
    switch (event) {
      case 'funding.m2_funded': {
        const amount = data.amount as number | null
        const fundedDate = (data.funded_date as string) ?? new Date().toISOString().slice(0, 10)

        // Get current values for audit
        const { data: current } = await db.from('project_funding').select('m2_status, m2_amount, m2_funded_date').eq('project_id', project_id).maybeSingle()

        const { error } = await db.from('project_funding').upsert(
          {
            project_id,
            m2_status: 'Funded',
            m2_amount: amount ?? current?.m2_amount ?? null,
            m2_funded_date: fundedDate,
          },
          { onConflict: 'project_id' }
        )
        if (error) throw error

        await logToAudit(db, project_id, 'm2_status', current?.m2_status ?? null, 'Funded')
        if (amount != null) await logToAudit(db, project_id, 'm2_amount', String(current?.m2_amount ?? ''), String(amount))
        await logToAudit(db, project_id, 'm2_funded_date', current?.m2_funded_date ?? null, fundedDate)
        break
      }

      case 'funding.m3_funded': {
        const amount = data.amount as number | null
        const fundedDate = (data.funded_date as string) ?? new Date().toISOString().slice(0, 10)

        const { data: current } = await db.from('project_funding').select('m3_status, m3_amount, m3_funded_date').eq('project_id', project_id).maybeSingle()

        const { error } = await db.from('project_funding').upsert(
          {
            project_id,
            m3_status: 'Funded',
            m3_amount: amount ?? current?.m3_amount ?? null,
            m3_funded_date: fundedDate,
          },
          { onConflict: 'project_id' }
        )
        if (error) throw error

        await logToAudit(db, project_id, 'm3_status', current?.m3_status ?? null, 'Funded')
        if (amount != null) await logToAudit(db, project_id, 'm3_amount', String(current?.m3_amount ?? ''), String(amount))
        await logToAudit(db, project_id, 'm3_funded_date', current?.m3_funded_date ?? null, fundedDate)
        break
      }

      case 'funding.rejected': {
        const milestone = data.milestone as string // 'm2' or 'm3'
        const reason = data.reason as string | null
        const statusField = milestone === 'm2' ? 'm2_status' : milestone === 'm3' ? 'm3_status' : null

        if (!statusField) {
          await logSync(db, project_id, event, payload as Record<string, unknown>, 'failed', 400, 'Invalid milestone')
          return NextResponse.json({ error: 'Invalid milestone: must be m2 or m3' }, { status: 400 })
        }

        const { data: current } = await db.from('project_funding').select('m2_status, m3_status').eq('project_id', project_id).maybeSingle()
        const currentStatus = current ? (current as Record<string, unknown>)[statusField] as string | null : null

        const notesField = milestone === 'm2' ? 'm2_notes' : 'm3_notes'
        const update: Record<string, unknown> = {
          project_id,
          [statusField]: 'Rejected',
        }
        if (reason) update[notesField] = reason

        const { error } = await db.from('project_funding').upsert(update, { onConflict: 'project_id' })
        if (error) throw error

        await logToAudit(db, project_id, statusField, currentStatus ?? null, 'Rejected')
        if (reason) await logToAudit(db, project_id, notesField, null, reason)
        break
      }

      case 'funding.status_update': {
        const milestone = data.milestone as string
        const status = data.status as string
        const statusField = milestone === 'm1' ? 'm1_status' : milestone === 'm2' ? 'm2_status' : milestone === 'm3' ? 'm3_status' : null

        if (!statusField || !status) {
          await logSync(db, project_id, event, payload as Record<string, unknown>, 'failed', 400, 'Invalid milestone or status')
          return NextResponse.json({ error: 'Invalid milestone or missing status' }, { status: 400 })
        }

        const { data: current } = await db.from('project_funding').select('m1_status, m2_status, m3_status').eq('project_id', project_id).maybeSingle()
        const currentStatus = current ? (current as Record<string, unknown>)[statusField] as string | null : null

        const { error } = await db.from('project_funding').upsert(
          { project_id, [statusField]: status },
          { onConflict: 'project_id' }
        )
        if (error) throw error

        await logToAudit(db, project_id, statusField, currentStatus ?? null, status)
        break
      }

      default:
        await logSync(db, project_id, event, payload as Record<string, unknown>, 'failed', 400, `Unknown event: ${event}`)
        return NextResponse.json({ error: `Unknown event type: ${event}` }, { status: 400 })
    }

    // Log successful sync
    await logSync(db, project_id, event, payload as Record<string, unknown>, 'delivered', 200)

    console.log(`edge-webhook: processed ${event} for ${project_id}`)
    return NextResponse.json({ success: true, project_id, event }, { status: 200 })

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('edge-webhook error:', err)
    await logSync(db, project_id, event, payload as Record<string, unknown>, 'failed', 500, errorMessage)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: WEBHOOK_SECRET ? 'configured' : 'no_secret',
    message: 'EDGE → NOVA webhook endpoint. Accepts funding status updates.',
  })
}
