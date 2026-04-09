import { describe, it, expect } from 'vitest'
import {
  selectCase,
  djb2,
  utcDayKey,
  isAdminRole,
  type QACandidateCase,
  type QARecentRun,
} from '@/lib/qa/case-selection'

function makeCase(overrides: Partial<QACandidateCase> = {}): QACandidateCase {
  return {
    id: 'case-1',
    plan_id: 'plan-1',
    plan_name: 'Plan 1',
    plan_role_filter: 'all',
    plan_sort_order: 0,
    title: 'Case',
    instructions: null,
    expected_result: null,
    page_url: '/command',
    priority: 'medium',
    sort_order: 0,
    ...overrides,
  }
}

function makeRun(caseId: string, daysAgo: number, now: Date): QARecentRun {
  return {
    test_case_id: caseId,
    started_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
  }
}

const NOW = new Date('2026-04-09T12:00:00Z')

describe('djb2 + utcDayKey', () => {
  it('djb2 is deterministic', () => {
    expect(djb2('greg:2026-04-09:case-1')).toBe(djb2('greg:2026-04-09:case-1'))
  })
  it('djb2 differs for different inputs', () => {
    expect(djb2('a')).not.toBe(djb2('b'))
  })
  it('utcDayKey returns YYYY-MM-DD', () => {
    expect(utcDayKey(new Date('2026-04-09T23:59:00Z'))).toBe('2026-04-09')
  })
})

describe('isAdminRole', () => {
  it('admin/super_admin/manager are admins', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('super_admin')).toBe(true)
    expect(isAdminRole('manager')).toBe(true)
  })
  it('user/sales/finance are not admins', () => {
    expect(isAdminRole('user')).toBe(false)
    expect(isAdminRole('sales')).toBe(false)
    expect(isAdminRole('finance')).toBe(false)
  })
})

describe('selectCase — basic', () => {
  it('returns null when no candidates', () => {
    const r = selectCase({ candidates: [], recentRuns: [], testerRole: 'admin', testerId: 'u', now: NOW })
    expect(r).toBeNull()
  })

  it('filters out cases on cooldown', () => {
    const c = makeCase({ id: 'c1' })
    const r = selectCase({
      candidates: [c],
      recentRuns: [makeRun('c1', 3, NOW)],
      testerRole: 'admin',
      testerId: 'u',
      now: NOW,
    })
    expect(r).toBeNull()
  })

  it('lets a case back in after the cooldown window', () => {
    const c = makeCase({ id: 'c1' })
    const r = selectCase({
      candidates: [c],
      recentRuns: [makeRun('c1', 30, NOW)],
      testerRole: 'admin',
      testerId: 'u',
      now: NOW,
    })
    expect(r?.id).toBe('c1')
  })

  it('prefers higher priority', () => {
    const low = makeCase({ id: 'low', priority: 'low' })
    const crit = makeCase({ id: 'crit', priority: 'critical' })
    const r = selectCase({ candidates: [low, crit], recentRuns: [], testerRole: 'admin', testerId: 'u', now: NOW })
    expect(r?.id).toBe('crit')
  })
})

describe('selectCase — MicroGRID role filter (all/manager/admin)', () => {
  it('user role only sees role_filter=all', () => {
    const all   = makeCase({ id: 'all',   plan_role_filter: 'all' })
    const mgr   = makeCase({ id: 'mgr',   plan_role_filter: 'manager', priority: 'critical' })
    const adm   = makeCase({ id: 'adm',   plan_role_filter: 'admin',   priority: 'critical' })
    const r = selectCase({ candidates: [all, mgr, adm], recentRuns: [], testerRole: 'user', testerId: 'u', now: NOW })
    expect(r?.id).toBe('all')
  })

  it('manager sees all + manager but not admin', () => {
    const all = makeCase({ id: 'all', plan_role_filter: 'all', priority: 'low' })
    const mgr = makeCase({ id: 'mgr', plan_role_filter: 'manager', priority: 'critical' })
    const adm = makeCase({ id: 'adm', plan_role_filter: 'admin', priority: 'critical' })
    const r = selectCase({ candidates: [all, mgr, adm], recentRuns: [], testerRole: 'manager', testerId: 'u', now: NOW })
    expect(r?.id).toBe('mgr')
  })

  it('admin sees everything', () => {
    const all = makeCase({ id: 'all', plan_role_filter: 'all', priority: 'low' })
    const adm = makeCase({ id: 'adm', plan_role_filter: 'admin', priority: 'critical' })
    const r = selectCase({ candidates: [all, adm], recentRuns: [], testerRole: 'admin', testerId: 'u', now: NOW })
    expect(r?.id).toBe('adm')
  })

  it('super_admin and manager admin-roles also see admin plans', () => {
    const adm = makeCase({ id: 'adm', plan_role_filter: 'admin' })
    expect(selectCase({ candidates: [adm], recentRuns: [], testerRole: 'super_admin', testerId: 'u', now: NOW })?.id).toBe('adm')
  })
})

describe('selectCase — assignment scoping', () => {
  it('only assigned cases are eligible when assignedCaseIds is set', () => {
    const a = makeCase({ id: 'a', priority: 'critical' })
    const b = makeCase({ id: 'b', priority: 'low' })
    const r = selectCase({
      candidates: [a, b],
      recentRuns: [],
      testerRole: 'user',
      testerId: 'u',
      assignedCaseIds: ['b'],
      now: NOW,
    })
    expect(r?.id).toBe('b')
  })

  it('assignment overrides role filter', () => {
    const adm = makeCase({ id: 'adm', plan_role_filter: 'admin', priority: 'critical' })
    const r = selectCase({
      candidates: [adm],
      recentRuns: [],
      testerRole: 'user',
      testerId: 'u',
      assignedCaseIds: ['adm'],
      now: NOW,
    })
    expect(r?.id).toBe('adm')
  })

  it('empty assignment list returns null', () => {
    const c = makeCase({ id: 'c1' })
    const r = selectCase({
      candidates: [c],
      recentRuns: [],
      testerRole: 'user',
      testerId: 'u',
      assignedCaseIds: [],
      now: NOW,
    })
    expect(r).toBeNull()
  })

  it('null assignedCaseIds falls back to role filter', () => {
    const c = makeCase({ id: 'c1', plan_role_filter: 'all' })
    const r = selectCase({
      candidates: [c],
      recentRuns: [],
      testerRole: 'user',
      testerId: 'u',
      assignedCaseIds: null,
      now: NOW,
    })
    expect(r?.id).toBe('c1')
  })
})

describe('selectCase — exclude (run another)', () => {
  it('excludeCaseIds prevents the picker from selecting a just-completed case', () => {
    const a = makeCase({ id: 'a', priority: 'critical' })
    const b = makeCase({ id: 'b', priority: 'high' })
    const r = selectCase({
      candidates: [a, b],
      recentRuns: [],
      testerRole: 'admin',
      testerId: 'u',
      excludeCaseIds: ['a'],
      now: NOW,
    })
    expect(r?.id).toBe('b')
  })

  it('returns null when every assigned case is also excluded', () => {
    const a = makeCase({ id: 'a' })
    const r = selectCase({
      candidates: [a],
      recentRuns: [],
      testerRole: 'user',
      testerId: 'u',
      assignedCaseIds: ['a'],
      excludeCaseIds: ['a'],
      now: NOW,
    })
    expect(r).toBeNull()
  })
})

describe('selectCase — determinism', () => {
  it('same tester+day = same case', () => {
    const a = makeCase({ id: 'a' })
    const b = makeCase({ id: 'b' })
    const c = makeCase({ id: 'c' })
    const r1 = selectCase({ candidates: [a, b, c], recentRuns: [], testerRole: 'admin', testerId: 'tester-1', now: NOW })
    const r2 = selectCase({ candidates: [a, b, c], recentRuns: [], testerRole: 'admin', testerId: 'tester-1', now: NOW })
    expect(r1?.id).toBe(r2?.id)
  })

  it('ignores malformed run timestamps', () => {
    const c = makeCase({ id: 'c1' })
    const r = selectCase({
      candidates: [c],
      recentRuns: [{ test_case_id: 'c1', started_at: 'not-a-date' }],
      testerRole: 'admin',
      testerId: 'u',
      now: NOW,
    })
    expect(r?.id).toBe('c1')
  })
})
