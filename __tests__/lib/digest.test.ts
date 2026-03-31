import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SLA_THRESHOLDS } from '@/lib/utils'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

// ── SLA Thresholds are now real values ──────────────────────────────────────

describe('SLA_THRESHOLDS (re-enabled)', () => {
  it('evaluation has real thresholds', () => {
    expect(SLA_THRESHOLDS.evaluation).toEqual({ target: 3, risk: 4, crit: 6 })
  })

  it('survey has real thresholds', () => {
    expect(SLA_THRESHOLDS.survey).toEqual({ target: 3, risk: 5, crit: 10 })
  })

  it('design has real thresholds', () => {
    expect(SLA_THRESHOLDS.design).toEqual({ target: 3, risk: 5, crit: 10 })
  })

  it('permit has the longest thresholds', () => {
    expect(SLA_THRESHOLDS.permit).toEqual({ target: 21, risk: 30, crit: 45 })
  })

  it('install has real thresholds', () => {
    expect(SLA_THRESHOLDS.install).toEqual({ target: 5, risk: 7, crit: 10 })
  })

  it('inspection has real thresholds', () => {
    expect(SLA_THRESHOLDS.inspection).toEqual({ target: 14, risk: 21, crit: 30 })
  })

  it('complete has real thresholds', () => {
    expect(SLA_THRESHOLDS.complete).toEqual({ target: 3, risk: 5, crit: 7 })
  })

  it('no thresholds are set to 999', () => {
    for (const [stage, t] of Object.entries(SLA_THRESHOLDS)) {
      expect(t.target, `${stage}.target`).toBeLessThan(100)
      expect(t.risk, `${stage}.risk`).toBeLessThan(100)
      expect(t.crit, `${stage}.crit`).toBeLessThan(100)
    }
  })

  it('thresholds are ordered target < risk < crit', () => {
    for (const [stage, t] of Object.entries(SLA_THRESHOLDS)) {
      expect(t.target, `${stage}: target < risk`).toBeLessThan(t.risk)
      expect(t.risk, `${stage}: risk < crit`).toBeLessThan(t.crit)
    }
  })
})

// ── getSLA with real thresholds ─────────────────────────────────────────────

describe('getSLA with real thresholds', () => {
  function daysAgoDate(n: number): string {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString().split('T')[0]
  }

  it('evaluation at 2 days = ok', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'evaluation', stage_date: daysAgoDate(2) } as any)
    expect(result.status).toBe('ok')
  })

  it('evaluation at 3 days = warn', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'evaluation', stage_date: daysAgoDate(3) } as any)
    expect(result.status).toBe('warn')
  })

  it('evaluation at 6 days = crit', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'evaluation', stage_date: daysAgoDate(6) } as any)
    expect(result.status).toBe('crit')
  })

  it('permit at 20 days = ok (long stage)', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'permit', stage_date: daysAgoDate(20) } as any)
    expect(result.status).toBe('ok')
  })

  it('permit at 22 days = warn', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'permit', stage_date: daysAgoDate(22) } as any)
    expect(result.status).toBe('warn')
  })

  it('permit at 46 days = crit', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'permit', stage_date: daysAgoDate(46) } as any)
    expect(result.status).toBe('crit')
  })

  it('inspection at 15 days = warn', async () => {
    const { getSLA } = await import('@/lib/classify')
    const result = getSLA({ stage: 'inspection', stage_date: daysAgoDate(15) } as any)
    expect(result.status).toBe('warn')
  })
})
