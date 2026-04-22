/** POST /api/admin/reseed-taylor-tests — finance/admin only. Resets TEST-TAYLOR-* fixtures. */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(_req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const emailLc = user.email.toLowerCase()

  const { success } = await rateLimit(`reseed-taylor:${emailLc}`, { windowMs: 60_000, max: 10, prefix: 'reseed-taylor' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role, active')
    .ilike('email', emailLc)
    .maybeSingle<{ role: string | null; active: boolean | null }>()
  if (profileErr || !profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (profile.active === false) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!profile.role || !['finance', 'admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Finance or admin only' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('atlas_reseed_taylor_test_projects')
  if (error) {
    console.error('atlas_reseed_taylor_test_projects failed', error)
    return NextResponse.json({ error: 'Reseed failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result: data })
}
