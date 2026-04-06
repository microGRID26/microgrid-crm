import { describe, it, expect, beforeEach } from 'vitest'
import { rangeStart, inRange, setCustomRange } from '@/components/analytics/shared'

// Reset custom range before each test
beforeEach(() => {
  setCustomRange(null, null)
})

// ── rangeStart ─────────────────────────────────────────────────────────────

describe('rangeStart', () => {
  it('ytd returns Jan 1 of current year', () => {
    const start = rangeStart('ytd')
    expect(start.getMonth()).toBe(0) // January
    expect(start.getDate()).toBe(1)
    expect(start.getFullYear()).toBe(new Date().getFullYear())
  })

  it('mtd returns 1st of current month', () => {
    const start = rangeStart('mtd')
    expect(start.getDate()).toBe(1)
    expect(start.getMonth()).toBe(new Date().getMonth())
  })

  it('qtd returns 1st of current quarter', () => {
    const start = rangeStart('qtd')
    const qMonth = Math.floor(new Date().getMonth() / 3) * 3
    expect(start.getMonth()).toBe(qMonth)
    expect(start.getDate()).toBe(1)
  })

  it('wtd returns Sunday of current week', () => {
    const start = rangeStart('wtd')
    expect(start.getDay()).toBe(0) // Sunday
  })

  it('last7 returns 7 days ago', () => {
    const start = rangeStart('last7')
    const expected = new Date()
    expected.setDate(expected.getDate() - 7)
    expected.setHours(0, 0, 0, 0)
    // Allow 1 day tolerance for timezone edge cases
    expect(Math.abs(start.getTime() - expected.getTime())).toBeLessThan(86400000)
  })

  it('last30 returns 30 days ago', () => {
    const start = rangeStart('last30')
    const now = new Date()
    const diffDays = (now.getTime() - start.getTime()) / 86400000
    expect(diffDays).toBeGreaterThanOrEqual(29)
    expect(diffDays).toBeLessThanOrEqual(31)
  })

  it('last90 returns 90 days ago', () => {
    const start = rangeStart('last90')
    const now = new Date()
    const diffDays = (now.getTime() - start.getTime()) / 86400000
    expect(diffDays).toBeGreaterThanOrEqual(89)
    expect(diffDays).toBeLessThanOrEqual(91)
  })

  it('custom returns custom start when set', () => {
    setCustomRange('2026-01-15', '2026-02-15')
    const start = rangeStart('custom')
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(0) // January
    expect(start.getDate()).toBe(15)
  })

  it('all ranges return midnight', () => {
    const periods = ['ytd', 'mtd', 'qtd', 'wtd', 'last7', 'last30', 'last90'] as const
    for (const p of periods) {
      const start = rangeStart(p)
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(start.getSeconds()).toBe(0)
    }
  })
})

// ── inRange ────────────────────────────────────────────────────────────────

describe('inRange', () => {
  it('returns false for null date', () => {
    expect(inRange(null, 'ytd')).toBe(false)
    expect(inRange(undefined, 'ytd')).toBe(false)
  })

  it('returns false for invalid date', () => {
    expect(inRange('not-a-date', 'ytd')).toBe(false)
  })

  it('returns true for today in ytd', () => {
    // Use local date (YYYY-MM-DD) to match rangeStart/inRange which use local time
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(inRange(today, 'ytd')).toBe(true)
  })

  it('returns false for last year in ytd', () => {
    const lastYear = `${new Date().getFullYear() - 1}-06-15`
    expect(inRange(lastYear, 'ytd')).toBe(false)
  })

  it('returns true for recent date in last30', () => {
    const recent = new Date()
    recent.setDate(recent.getDate() - 10)
    expect(inRange(recent.toISOString().split('T')[0], 'last30')).toBe(true)
  })

  it('returns false for old date in last7', () => {
    const old = new Date()
    old.setDate(old.getDate() - 20)
    expect(inRange(old.toISOString().split('T')[0], 'last7')).toBe(false)
  })

  it('works with custom range', () => {
    setCustomRange('2026-03-01', '2026-03-31')
    expect(inRange('2026-03-15', 'custom')).toBe(true)
    expect(inRange('2026-02-15', 'custom')).toBe(false)
    expect(inRange('2026-04-15', 'custom')).toBe(false)
  })
})

// ── setCustomRange ─────────────────────────────────────────────────────────

describe('setCustomRange', () => {
  it('clears range when both null', () => {
    setCustomRange('2026-01-01', '2026-12-31')
    setCustomRange(null, null)
    // Custom without range set should fallback to today
    const start = rangeStart('custom')
    const today = new Date()
    expect(start.getDate()).toBe(today.getDate())
  })

  it('sets and retrieves custom range', () => {
    setCustomRange('2026-06-01', '2026-06-30')
    expect(inRange('2026-06-15', 'custom')).toBe(true)
  })
})
