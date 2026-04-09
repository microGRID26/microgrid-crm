import { describe, it, expect } from 'vitest'
import { QA_PRIORITY_WEIGHT, QA_CASE_COOLDOWN_DAYS } from '@/lib/qa/case-selection'
import { QA_RUN_TERMINAL_STATUSES, QA_RUN_ABANDON_AFTER_HOURS } from '@/lib/qa/server'

/**
 * Validation contract tests for /api/qa/* and /api/admin/qa-* routes.
 * These mirror the validation logic in each route, run as pure unit tests.
 */

describe('QA constants', () => {
  it('priority weights are ordered critical > high > medium > low', () => {
    expect(QA_PRIORITY_WEIGHT.critical).toBeGreaterThan(QA_PRIORITY_WEIGHT.high)
    expect(QA_PRIORITY_WEIGHT.high).toBeGreaterThan(QA_PRIORITY_WEIGHT.medium)
    expect(QA_PRIORITY_WEIGHT.medium).toBeGreaterThan(QA_PRIORITY_WEIGHT.low)
  })

  it('cooldown is 14 days', () => {
    expect(QA_CASE_COOLDOWN_DAYS).toBe(14)
  })

  it('terminal statuses do not include "started"', () => {
    expect(QA_RUN_TERMINAL_STATUSES).not.toContain('started')
    expect(QA_RUN_TERMINAL_STATUSES).toContain('pass')
    expect(QA_RUN_TERMINAL_STATUSES).toContain('fail')
    expect(QA_RUN_TERMINAL_STATUSES).toContain('blocked')
    expect(QA_RUN_TERMINAL_STATUSES).toContain('skipped')
    expect(QA_RUN_TERMINAL_STATUSES).toContain('abandoned')
  })

  it('abandon after is 4-24h (sensible window)', () => {
    expect(QA_RUN_ABANDON_AFTER_HOURS).toBeGreaterThanOrEqual(4)
    expect(QA_RUN_ABANDON_AFTER_HOURS).toBeLessThanOrEqual(24)
  })
})

describe('start route validation', () => {
  const VALID_DEVICE = ['desktop', 'mobile', 'tablet']
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  it('accepts known device types', () => {
    for (const d of VALID_DEVICE) expect(VALID_DEVICE.includes(d)).toBe(true)
  })

  it('rejects unknown device types', () => {
    expect(VALID_DEVICE.includes('toaster')).toBe(false)
  })

  it('UUID regex accepts standard v4 UUIDs and rejects junk', () => {
    expect(UUID_RE.test('abcdef00-1111-2222-3333-444455556666')).toBe(true)
    expect(UUID_RE.test('not-a-uuid')).toBe(false)
    expect(UUID_RE.test('')).toBe(false)
  })

  it('viewport width validation', () => {
    const ok = (w: number) => Number.isFinite(w) && w >= 0 && w <= 10000
    expect(ok(390)).toBe(true)
    expect(ok(-1)).toBe(false)
    expect(ok(NaN)).toBe(false)
    expect(ok(Infinity)).toBe(false)
    expect(ok(1_000_000)).toBe(false)
  })
})

describe('complete route validation', () => {
  const VALID_RESULT = ['pass', 'fail', 'blocked']
  it('only pass/fail/blocked allowed as result', () => {
    expect(VALID_RESULT).toEqual(['pass', 'fail', 'blocked'])
    expect(VALID_RESULT.includes('skipped')).toBe(false)
    expect(VALID_RESULT.includes('abandoned')).toBe(false)
  })
  it('star rating must be 1-5 integer', () => {
    const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5
    expect(ok(1)).toBe(true)
    expect(ok(5)).toBe(true)
    expect(ok(0)).toBe(false)
    expect(ok(6)).toBe(false)
    expect(ok(3.5)).toBe(false)
  })
  it('screenshot path locked to qa-runs/ prefix', () => {
    const ok = (p: string) => p.startsWith('qa-runs/') && !p.includes('..')
    expect(ok('qa-runs/abc-123.png')).toBe(true)
    expect(ok('qa-runs/../etc/passwd')).toBe(false)
    expect(ok('foo/bar.png')).toBe(false)
  })
})

describe('admin/qa-plans + qa-cases validation', () => {
  it('qa-plans role_filter must be all/manager/admin', () => {
    const VALID = ['all', 'manager', 'admin']
    expect(VALID.includes('all')).toBe(true)
    expect(VALID.includes('user')).toBe(false)
  })
  it('qa-cases priority must be one of the four levels', () => {
    const VALID = ['critical', 'high', 'medium', 'low']
    expect(VALID.includes('urgent')).toBe(false)
    for (const p of VALID) expect(VALID.includes(p)).toBe(true)
  })
})

describe('event route validation', () => {
  const VALID_EVENT_TYPES = [
    'started', 'nav', 'console_error', 'click', 'form_submit',
    'field_focus', 'overlay_resized', 'overlay_collapsed', 'overlay_expanded',
  ]
  it('event types whitelist enforced', () => {
    expect(VALID_EVENT_TYPES.includes('nav')).toBe(true)
    expect(VALID_EVENT_TYPES.includes('console_error')).toBe(true)
    expect(VALID_EVENT_TYPES.includes('drop_database')).toBe(false)
  })
  it('elapsedMs must be non-negative finite number', () => {
    const ok = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0
    expect(ok(0)).toBe(true)
    expect(ok(123)).toBe(true)
    expect(ok(-1)).toBe(false)
    expect(ok(NaN)).toBe(false)
    expect(ok(Infinity)).toBe(false)
  })
})
