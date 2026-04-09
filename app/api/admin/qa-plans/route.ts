/** POST /api/admin/qa-plans — admin only. Create a new test plan inline. */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { getQaAdmin, resolveTesterId } from '@/lib/qa/server'
import { isAdminRole } from '@/lib/qa/case-selection'

const VALID_ROLE_FILTER = ['all', 'manager', 'admin']

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-plans:${user.email}`, { windowMs: 60_000, max: 30, prefix: 'qa-plans' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const tester = await resolveTesterId(user.email)
  if (!tester || !isAdminRole(tester.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { name, description, role_filter, sort_order } = body as {
    name?: string; description?: string; role_filter?: string; sort_order?: number
  }

  if (!name?.trim() || name.length > 200) return NextResponse.json({ error: 'name required (1-200 chars)' }, { status: 400 })
  if (!role_filter || !VALID_ROLE_FILTER.includes(role_filter)) {
    return NextResponse.json({ error: 'role_filter must be all/manager/admin' }, { status: 400 })
  }
  if (description != null && (typeof description !== 'string' || description.length > 1000)) {
    return NextResponse.json({ error: 'Invalid description' }, { status: 400 })
  }
  if (sort_order != null && (!Number.isInteger(sort_order) || sort_order < 0)) {
    return NextResponse.json({ error: 'Invalid sort_order' }, { status: 400 })
  }

  const admin = getQaAdmin()
  const { data: created, error } = await admin
    .from('test_plans')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      role_filter,
      sort_order: sort_order ?? 999,
    })
    .select('id, name, role_filter, sort_order')
    .single()

  if (error || !created) {
    console.error('test_plans insert failed', error)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plan: created })
}
