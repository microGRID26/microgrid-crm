import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { rateLimit } from '@/lib/rate-limit'
import { EPC_ATTESTATION_TEXT } from '@/lib/invoices/pdf'

export const runtime = 'nodejs'

/**
 * POST /api/invoices/[id]/attest
 *
 * Captures an EPC's attestation signature on an invoice. Per Mark Bench in
 * the 2026-04-13 meeting, EPC → EDGE invoices include a certification block
 * stating that the EPC's internal cost allocations are accurate (since those
 * lines have no external proof of payment — labor, project management,
 * overhead). The EPC's authorized signer fills in printed name, title, and
 * signs the invoice; this endpoint captures the signed attestation in the
 * invoice_attestations table for audit.
 *
 * Body:
 *   {
 *     attesting_name: string         // printed name (required)
 *     attesting_title?: string       // job title
 *     signature_method?: 'typed' | 'drawn' | 'uploaded'   // default 'typed'
 *     signature_data?: string        // base64 PNG for drawn/uploaded
 *   }
 *
 * Auth: valid Supabase session with membership in the from_org of the invoice.
 *       (Platform users can also attest on behalf of any org.)
 * Rate limited: 5 attestations per hour per user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params

  // ── Auth ────────────────────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limit per user ────────────────────────────────────────────────
  const { success } = await rateLimit(`invoice-attest:${user.id}`, {
    windowMs: 3_600_000,
    max: 5,
    prefix: 'invoice',
  })
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded (5 attestations/hour)' }, { status: 429 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: {
    attesting_name?: string
    attesting_title?: string
    signature_method?: 'typed' | 'drawn' | 'uploaded'
    signature_data?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const attestingName = body.attesting_name?.trim()
  if (!attestingName) {
    return NextResponse.json({ error: 'attesting_name is required' }, { status: 400 })
  }
  const signatureMethod = body.signature_method ?? 'typed'
  if (!['typed', 'drawn', 'uploaded'].includes(signatureMethod)) {
    return NextResponse.json({ error: 'invalid signature_method' }, { status: 400 })
  }
  if (signatureMethod !== 'typed' && !body.signature_data) {
    return NextResponse.json(
      { error: 'signature_data required for drawn/uploaded methods' },
      { status: 400 },
    )
  }

  // ── Load invoice to determine from_org for the attestation row ─────────
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, from_org, to_org, status')
    .eq('id', invoiceId)
    .single()
  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // ── Insert attestation row ─────────────────────────────────────────────
  // RLS on invoice_attestations enforces from_org membership at insert time.
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  const { data: attestation, error: attErr } = await supabase
    .from('invoice_attestations')
    .insert({
      invoice_id: invoiceId,
      attesting_org_id: invoice.from_org,
      attesting_user_id: user.id,
      attesting_name: attestingName,
      attesting_title: body.attesting_title?.trim() ?? null,
      attestation_text: EPC_ATTESTATION_TEXT,
      signature_method: signatureMethod,
      signature_data: body.signature_data ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select('id, signed_at')
    .single()

  if (attErr) {
    // Unique index → already attested
    if (attErr.code === '23505') {
      return NextResponse.json(
        { error: 'Invoice has already been attested' },
        { status: 409 },
      )
    }
    console.error('[invoice attest] insert failed:', attErr.message)
    return NextResponse.json({ error: 'Failed to capture attestation' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    attestationId: (attestation as { id: string; signed_at: string }).id,
    signedAt: (attestation as { id: string; signed_at: string }).signed_at,
  })
}
