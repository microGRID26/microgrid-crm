import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/webhooks/subhub-vwc
 *
 * Receives Welcome Call survey event data from SubHub.
 * Phase 1: Logs raw payload to welcome_call_logs table for inspection.
 * Phase 2: After payload shape is known, parse and store structured data.
 *
 * Auth: Optional SUBHUB_WEBHOOK_SECRET via Authorization or X-Webhook-Secret header.
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[subhub-vwc] SUPABASE_SECRET_KEY not configured')
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  // Optional auth — if secret is set, validate it
  const webhookSecret = process.env.SUBHUB_WEBHOOK_SECRET
  if (webhookSecret) {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('x-webhook-secret') ?? ''
    const candidate = authHeader.replace(/^Bearer\s+/i, '')
    if (candidate !== webhookSecret) {
      console.warn('[subhub-vwc] Invalid webhook secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Try to extract identifiers from common SubHub fields
  const data = payload as Record<string, unknown>
  const projectId = data.subhub_id ?? data.subhub_uuid ?? data.proposal_id ?? data.project_id ?? null
  const customerName = data.name ?? data.customer_name ?? data.first_name ?? null
  const eventType = data.event_type ?? data.event ?? data.survey_type ?? 'unknown'

  // Store raw payload for inspection
  const { error } = await supabase
    .from('welcome_call_logs')
    .insert({
      source_id: projectId ? String(projectId) : null,
      customer_name: customerName ? String(customerName) : null,
      event_type: String(eventType),
      payload: payload,
      received_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[subhub-vwc] insert error:', error.message)
    // Still return 200 so SubHub doesn't retry
    return NextResponse.json({ received: true, stored: false, error: 'Storage failed' })
  }

  console.log(`[subhub-vwc] Logged welcome call event: ${eventType} for ${projectId ?? 'unknown'}`)
  return NextResponse.json({ received: true, stored: true })
}

/**
 * GET /api/webhooks/subhub-vwc
 * Health check — confirms endpoint is live.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'subhub-vwc',
    description: 'SubHub Welcome Call webhook receiver',
  })
}
