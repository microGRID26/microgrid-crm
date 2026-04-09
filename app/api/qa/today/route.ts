/**
 * GET /api/qa/today
 * Returns today's QA case for the current tester, plus done-state and streak.
 *
 * Auth: must be logged in. Gate: tester must have at least one row in
 * test_assignments OR be an admin/manager (admins see the full pool).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { selectCase, isAdminRole } from '@/lib/qa/case-selection'
import {
  loadCandidateCases, loadRecentRuns, findTodayRun, computeStreak,
  loadAssignedCaseIds, resolveTesterId, getQaAdmin,
} from '@/lib/qa/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tester = await resolveTesterId(user.email)
  if (!tester) return NextResponse.json({ error: 'No user record' }, { status: 403 })

  const now = new Date()
  const [today, candidates, recentRuns, streak, assignedCaseIds] = await Promise.all([
    findTodayRun(tester.id, now),
    loadCandidateCases(),
    loadRecentRuns(tester.id, now),
    computeStreak(tester.id, now),
    loadAssignedCaseIds(tester.id),
  ])

  // Gate: assignments OR admin override (admins see the whole pool).
  const hasAssignments = assignedCaseIds.length > 0
  const isAdmin = isAdminRole(tester.role)
  if (!hasAssignments && !isAdmin) {
    return NextResponse.json({ error: 'Not a QA tester' }, { status: 403 })
  }

  const pickerAssignedIds = hasAssignments ? assignedCaseIds : null

  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'

  if (today && today.status !== 'started' && !force) {
    return NextResponse.json({
      done: true,
      run: today,
      streak,
      hasMore: hasAssignments
        ? assignedCaseIds.length > new Set(recentRuns.map((r) => r.test_case_id)).size
        : true,
    })
  }

  if (today && today.status === 'started') {
    const admin = getQaAdmin()
    const { data: theCase } = await admin
      .from('test_cases')
      .select('id, plan_id, title, instructions, expected_result, page_url, priority, sort_order, plan:test_plans!inner(id, name, role_filter, sort_order)')
      .eq('id', today.test_case_id)
      .single() as { data: { id: string; plan: { name?: string } | null; title: string; instructions: string | null; expected_result: string | null; page_url: string | null; priority: string } | null }
    return NextResponse.json({
      done: false,
      streak,
      activeRun: today,
      case: theCase
        ? {
            id: theCase.id,
            plan_name: theCase.plan?.name ?? '',
            title: theCase.title,
            instructions: theCase.instructions,
            expected_result: theCase.expected_result,
            page_url: theCase.page_url,
            priority: theCase.priority,
          }
        : null,
    })
  }

  const todayCaseIds = new Set<string>()
  if (force) {
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
    for (const r of recentRuns) {
      if (r.started_at >= startOfDay) todayCaseIds.add(r.test_case_id)
    }
  }

  const picked = selectCase({
    candidates,
    recentRuns,
    testerRole: tester.role,
    testerId: tester.id,
    assignedCaseIds: pickerAssignedIds,
    excludeCaseIds: Array.from(todayCaseIds),
    now,
  })

  if (!picked) {
    return NextResponse.json({ done: false, streak, case: null, empty: true })
  }

  return NextResponse.json({
    done: false,
    streak,
    case: {
      id: picked.id,
      plan_name: picked.plan_name,
      title: picked.title,
      instructions: picked.instructions,
      expected_result: picked.expected_result,
      page_url: picked.page_url,
      priority: picked.priority,
    },
  })
}
