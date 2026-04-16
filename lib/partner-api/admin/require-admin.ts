// lib/partner-api/admin/require-admin.ts — Shared admin-session check for
// the /api/admin/partner-* routes. Mirrors the auth-then-role pattern used by
// /api/invoices/generate-chain.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

export interface AdminSession {
  userId: string
  userEmail: string
  role: string
}

/** Verify the calling CRM user is authenticated AND has admin-tier role.
 *  Returns a NextResponse on failure; returns an AdminSession on success. */
export async function requireAdminSession(request: NextRequest): Promise<
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse }
> {
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!user.email) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden — no email on session' }, { status: 403 }) }
  }
  const { data: userRow } = await sb
    .from('users')
    .select('id, role')
    .eq('email', user.email)
    .single()
  const row = userRow as { id: string; role: string } | null
  if (!row?.role || !ADMIN_ROLES.has(row.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { ok: true, session: { userId: row.id, userEmail: user.email, role: row.role } }
}
