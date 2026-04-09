/**
 * QA daily-driver case selection.
 *
 * Pure (no IO) so it can be unit-tested deterministically. The server route
 * loads the candidate cases + recent runs and feeds them in.
 *
 * Algorithm
 * ──────────
 * 1. Filter out any case the tester has run (any terminal status) within the
 *    cooldown window (default 14 days). This guarantees rotation.
 * 2. Filter by role: admins see every plan; non-admins see plans whose
 *    role_filter is in the allowed list for their role (see ALLOWED_ROLE_FILTERS).
 * 3. Sort by:
 *      a. Priority weight desc (critical > high > medium > low)
 *      b. Days since last run desc (older = more stale)
 *      c. plan.sort_order asc, then case.sort_order asc (deterministic tail)
 *      d. Daily seed hash (so different testers get different cases on the
 *         same day, and refreshes don't shuffle)
 * 4. Pick the first case after sorting. If none qualify, return null.
 */

export const QA_PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export const QA_CASE_COOLDOWN_DAYS = 14

export interface QACandidateCase {
  id: string
  plan_id: string
  plan_name: string
  plan_role_filter: string
  plan_sort_order: number
  title: string
  instructions: string | null
  expected_result: string | null
  page_url: string | null
  priority: string
  sort_order: number
}

export interface QARecentRun {
  test_case_id: string
  /** ISO timestamp */
  started_at: string
}

export interface SelectCaseOpts {
  candidates: QACandidateCase[]
  recentRuns: QARecentRun[]
  /** Tester role string — used to derive which plan role_filters are visible. */
  testerRole: string
  /** Tester id — part of the daily seed so testers get different picks. */
  testerId: string
  /** Case ids the tester has been explicitly assigned. When non-null, the
   *  picker is constrained to ONLY these cases (regardless of role). When
   *  null/undefined, the picker uses the full role-filtered pool. */
  assignedCaseIds?: string[] | null
  /** "Today" — defaults to new Date(). Tests can pin this. */
  now?: Date
  /** Cooldown window in days (default 14). */
  cooldownDays?: number
  /** Exclude these case ids from the pick — used by "Run another". */
  excludeCaseIds?: string[]
}

/** MicroGRID role_filter values are 'all', 'manager', 'admin'.
 *  Each role can see plans whose role_filter is in their allowed list.  */
const ALLOWED_ROLE_FILTERS: Record<string, string[]> = {
  super_admin: ['all', 'manager', 'admin'],
  admin:       ['all', 'manager', 'admin'],
  manager:     ['all', 'manager'],
  finance:     ['all'],
  user:        ['all'],
  sales:       ['all'],
}

const ADMIN_ROLE_LIST = ['admin', 'super_admin', 'manager']

/** Strip a date down to YYYY-MM-DD in UTC for stable daily seeding. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Cheap deterministic hash → integer. Not crypto, just for tiebreaks. */
export function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

/** Pick today's case for a tester. Returns null if every case is on cooldown
 *  or no candidates pass the role filter. */
export function selectCase(opts: SelectCaseOpts): QACandidateCase | null {
  const {
    candidates,
    recentRuns,
    testerRole,
    testerId,
    assignedCaseIds = null,
    excludeCaseIds = [],
    now = new Date(),
    cooldownDays = QA_CASE_COOLDOWN_DAYS,
  } = opts

  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000
  const nowMs = now.getTime()
  const allowedFilters = new Set(ALLOWED_ROLE_FILTERS[testerRole] ?? ['all'])

  // Map case_id → most recent run timestamp (ms) within cooldown.
  const recentByCase = new Map<string, number>()
  for (const r of recentRuns) {
    const ts = new Date(r.started_at).getTime()
    if (Number.isNaN(ts)) continue
    if (nowMs - ts > cooldownMs) continue
    const prev = recentByCase.get(r.test_case_id)
    if (prev == null || ts > prev) recentByCase.set(r.test_case_id, ts)
  }

  const daysSinceLastRun = (caseId: string): number => {
    const last = recentByCase.get(caseId)
    if (last == null) return Number.POSITIVE_INFINITY
    return (nowMs - last) / (24 * 60 * 60 * 1000)
  }

  const assignedSet = assignedCaseIds ? new Set(assignedCaseIds) : null
  const excludedSet = new Set(excludeCaseIds)

  const eligible = candidates.filter((c) => {
    if (excludedSet.has(c.id)) return false
    if (recentByCase.has(c.id)) return false
    // Assignment gate: when an explicit assigned set is provided, the
    // tester only sees those cases, full stop.
    if (assignedSet && !assignedSet.has(c.id)) return false
    // Role gate: only enforced when there's no explicit assignment list.
    if (!assignedSet && !allowedFilters.has(c.plan_role_filter)) return false
    return true
  })

  if (eligible.length === 0) return null

  const dayKey = utcDayKey(now)

  eligible.sort((a, b) => {
    const pa = QA_PRIORITY_WEIGHT[a.priority] ?? 0
    const pb = QA_PRIORITY_WEIGHT[b.priority] ?? 0
    if (pb !== pa) return pb - pa

    const da = daysSinceLastRun(a.id)
    const db = daysSinceLastRun(b.id)
    if (db !== da) return db - da

    if (a.plan_sort_order !== b.plan_sort_order) return a.plan_sort_order - b.plan_sort_order
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order

    const ha = djb2(`${testerId}:${dayKey}:${a.id}`)
    const hb = djb2(`${testerId}:${dayKey}:${b.id}`)
    return ha - hb
  })

  return eligible[0]
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLE_LIST.includes(role)
}
