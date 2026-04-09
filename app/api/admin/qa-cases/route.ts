/** POST /api/admin/qa-cases — admin only. Create a new test case inline. */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { getQaAdmin, resolveTesterId } from '@/lib/qa/server'
import { isAdminRole } from '@/lib/qa/case-selection'

const VALID_PRIORITY = ['critical', 'high', 'medium', 'low']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit(`qa-cases:${user.email}`, { windowMs: 60_000, max: 60, prefix: 'qa-cases' })
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const tester = await resolveTesterId(user.email)
  if (!tester || !isAdminRole(tester.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { plan_id, title, instructions, expected_result, page_url, priority, sort_order } = body as {
    plan_id?: string; title?: string; instructions?: string; expected_result?: string;
    page_url?: string; priority?: string; sort_order?: number
  }

  if (!plan_id || !UUID_RE.test(plan_id)) return NextResponse.json({ error: 'Invalid plan_id' }, { status: 400 })
  if (!title?.trim() || title.length > 200) return NextResponse.json({ error: 'title required (1-200 chars)' }, { status: 400 })
  if (!priority || !VALID_PRIORITY.includes(priority)) return NextResponse.json({ error: 'priority must be critical/high/medium/low' }, { status: 400 })

  for (const [field, value, max] of [
    ['instructions', instructions, 4000],
    ['expected_result', expected_result, 2000],
    ['page_url', page_url, 500],
  ] as const) {
    if (value != null && (typeof value !== 'string' || value.length > max)) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 })
    }
  }
  if (sort_order != null && (!Number.isInteger(sort_order) || sort_order < 0)) {
    return NextResponse.json({ error: 'Invalid sort_order' }, { status: 400 })
  }

  const admin = getQaAdmin()
  const { data: plan } = await admin.from('test_plans').select('id').eq('id', plan_id).single()
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const { data: created, error } = await admin
    .from('test_cases')
    .insert({
      plan_id,
      title: title.trim(),
      instructions: instructions?.trim() || null,
      expected_result: expected_result?.trim() || null,
      page_url: page_url?.trim() || null,
      priority,
      sort_order: sort_order ?? 999,
    })
    .select('id, plan_id, title, priority')
    .single()

  if (error || !created) {
    console.error('test_cases insert failed', error)
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, case: created })
}
