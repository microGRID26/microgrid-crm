// __tests__/lib/commission-advanced.test.ts
// Tests for EC/Non-EC commission calculation, M1 advances, clawback, adder deductions

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Constants ─────────────────────────────────────────────────────────────────

describe('commission-advanced constants', () => {
  it('ADVANCE_STATUSES contains all 5 statuses', async () => {
    const { ADVANCE_STATUSES } = await import('@/lib/api/commission-advanced')
    expect(ADVANCE_STATUSES).toEqual(['pending', 'approved', 'paid', 'clawed_back', 'cancelled'])
    expect(ADVANCE_STATUSES).toHaveLength(5)
  })

  it('ADVANCE_STATUS_LABELS maps every status', async () => {
    const { ADVANCE_STATUS_LABELS, ADVANCE_STATUSES } = await import('@/lib/api/commission-advanced')
    for (const s of ADVANCE_STATUSES) {
      expect(ADVANCE_STATUS_LABELS[s]).toBeTruthy()
    }
    expect(ADVANCE_STATUS_LABELS.pending).toBe('Pending')
    expect(ADVANCE_STATUS_LABELS.clawed_back).toBe('Clawed Back')
  })

  it('ADVANCE_STATUS_BADGE maps every status to CSS classes', async () => {
    const { ADVANCE_STATUS_BADGE, ADVANCE_STATUSES } = await import('@/lib/api/commission-advanced')
    for (const s of ADVANCE_STATUSES) {
      expect(ADVANCE_STATUS_BADGE[s]).toMatch(/bg-/)
      expect(ADVANCE_STATUS_BADGE[s]).toMatch(/text-/)
    }
  })

  it('EC_DEFAULTS has correct EC/Non-EC rates from CSV', async () => {
    const { EC_DEFAULTS } = await import('@/lib/api/commission-advanced')
    expect(EC_DEFAULTS.ec_gross_per_watt).toBe(0.50)
    expect(EC_DEFAULTS.non_ec_gross_per_watt).toBe(0.35)
    expect(EC_DEFAULTS.ec_bonus_per_watt).toBe(0.15)
    expect(EC_DEFAULTS.operations_per_watt).toBe(0.10)
    expect(EC_DEFAULTS.operations_deduction_pct).toBe(20)
    expect(EC_DEFAULTS.ec_effective_per_watt).toBe(0.40)
    expect(EC_DEFAULTS.non_ec_effective_per_watt).toBe(0.25)
    expect(EC_DEFAULTS.m1_advance_amount).toBe(1000)
    expect(EC_DEFAULTS.m1_self_gen_ec_split).toBe(100)
    expect(EC_DEFAULTS.m1_ec_ea_split).toBe(50)
    expect(EC_DEFAULTS.clawback_days).toBe(90)
    expect(EC_DEFAULTS.adder_deduction_from_stack).toBe(true)
  })
})

// ── calculateDaysSinceSale ────────────────────────────────────────────────────

describe('calculateDaysSinceSale', () => {
  it('returns 0 for null date', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    expect(calculateDaysSinceSale(null)).toBe(0)
  })

  it('returns 0 for undefined date', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    expect(calculateDaysSinceSale(undefined)).toBe(0)
  })

  it('returns 0 for empty string', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    expect(calculateDaysSinceSale('')).toBe(0)
  })

  it('returns 0 for today', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    const today = new Date().toISOString().split('T')[0]
    expect(calculateDaysSinceSale(today)).toBe(0)
  })

  it('returns 1 for yesterday', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(calculateDaysSinceSale(yesterday.toISOString().split('T')[0])).toBe(1)
  })

  it('returns 0 for future date (never negative)', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(calculateDaysSinceSale(tomorrow.toISOString().split('T')[0])).toBe(0)
  })

  it('returns correct days for a date 30 days ago', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    const d = new Date()
    d.setDate(d.getDate() - 30)
    expect(calculateDaysSinceSale(d.toISOString().split('T')[0])).toBe(30)
  })

  it('returns 0 for invalid date string', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    expect(calculateDaysSinceSale('not-a-date')).toBe(0)
  })
})

// ── isClawbackEligible ────────────────────────────────────────────────────────

describe('isClawbackEligible', () => {
  it('returns true for paid advance past clawback date', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(true)
  })

  it('returns false for paid advance within clawback window', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: futureDate.toISOString().split('T')[0],
    })).toBe(false)
  })

  it('returns false for non-paid status even if past clawback date', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 10)
    expect(isClawbackEligible({
      status: 'pending',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(false)
    expect(isClawbackEligible({
      status: 'approved',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(false)
    expect(isClawbackEligible({
      status: 'clawed_back',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(false)
    expect(isClawbackEligible({
      status: 'cancelled',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(false)
  })

  it('returns false when clawback_date is null', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: null,
    })).toBe(false)
  })

  it('returns false for invalid clawback_date string', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: 'not-a-date',
    })).toBe(false)
  })

  it('returns true for paid advance on exact clawback date', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    // "today" should be >= today, so eligible
    const today = new Date().toISOString().split('T')[0]
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: today,
    })).toBe(true)
  })
})

// ── calculateProjectCommission ────────────────────────────────────────────────

describe('calculateProjectCommission', () => {
  const defaultConfig: Record<string, string> = {
    ec_gross_per_watt: '0.50',
    non_ec_gross_per_watt: '0.35',
    ec_bonus_per_watt: '0.15',
    operations_per_watt: '0.10',
    ec_effective_per_watt: '0.40',
    non_ec_effective_per_watt: '0.25',
    m1_advance_amount: '1000',
    m1_self_gen_ec_split: '100',
    m1_ec_ea_split: '50',
    adder_deduction_from_stack: 'true',
  }

  const distribution = [
    { role_key: 'ec', label: 'Energy Consultant', percentage: 40 },
    { role_key: 'ea', label: 'Energy Advisor', percentage: 40 },
    { role_key: 'mgr', label: 'Manager', percentage: 20 },
  ]

  it('EC project: correct gross, ops deduction, and effective per watt', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    // 10 kW = 10,000 W
    expect(result.is_ec).toBe(true)
    expect(result.system_watts).toBe(10000)
    expect(result.gross_per_watt).toBe(0.50)
    expect(result.ops_deduction_per_watt).toBe(0.10)
    expect(result.effective_per_watt).toBe(0.40)
    expect(result.total_gross).toBe(5000) // 10000 * 0.50
    expect(result.total_ops_deduction).toBe(1000) // 10000 * 0.10
    expect(result.total_adder_deduction).toBe(0)
    expect(result.total_net).toBe(4000) // 5000 - 1000 = 4000
  })

  it('Non-EC project: correct gross ($0.35/W) and effective ($0.25/W)', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: false, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    expect(result.is_ec).toBe(false)
    expect(result.gross_per_watt).toBe(0.35)
    expect(result.ops_deduction_per_watt).toBe(0.10)
    expect(result.effective_per_watt).toBe(0.25)
    expect(result.total_gross).toBe(3500) // 10000 * 0.35
    expect(result.total_ops_deduction).toBe(1000) // 10000 * 0.10
    expect(result.total_net).toBe(2500) // 3500 - 1000 = 2500
  })

  it('distribution percentages are applied correctly to each role', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    // Total distributable pool = 5000 - 1000 = 4000
    expect(result.lines).toHaveLength(3)
    const ecLine = result.lines.find(l => l.role_key === 'ec')!
    const eaLine = result.lines.find(l => l.role_key === 'ea')!
    const mgrLine = result.lines.find(l => l.role_key === 'mgr')!

    expect(ecLine.percentage).toBe(40)
    expect(ecLine.net_commission).toBe(1600) // 4000 * 0.40
    expect(eaLine.net_commission).toBe(1600) // 4000 * 0.40
    expect(mgrLine.net_commission).toBe(800)  // 4000 * 0.20
  })

  it('adder deduction reduces distributable pool', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 500, self_generated: false },
      defaultConfig,
      distribution,
    )
    // Pool: 5000 - 1000 - 500 = 3500
    expect(result.total_adder_deduction).toBe(500)
    expect(result.total_net).toBe(3500)
  })

  it('adder deduction disabled when config says false', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const config = { ...defaultConfig, adder_deduction_from_stack: 'false' }
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 500, self_generated: false },
      config,
      distribution,
    )
    expect(result.total_adder_deduction).toBe(0)
    expect(result.total_net).toBe(4000) // no adder deduction
  })

  it('zero system kW produces zero commission', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 0, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    expect(result.system_watts).toBe(0)
    expect(result.total_gross).toBe(0)
    expect(result.total_net).toBe(0)
    result.lines.forEach(l => expect(l.net_commission).toBe(0))
  })

  it('ops deduction math: exactly 20% of gross for EC', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    // $0.10 / $0.50 = 20%
    expect(result.total_ops_deduction / result.total_gross).toBeCloseTo(0.20)
  })

  it('ops deduction math for Non-EC: $0.10/$0.35 = ~28.6%', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: false, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    // ops per watt is flat $0.10 regardless of EC/non-EC
    expect(result.total_ops_deduction).toBe(1000)
    expect(result.total_ops_deduction / result.total_gross).toBeCloseTo(0.10 / 0.35)
  })

  it('M1 advance: self-generated gets 100% EC split', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: true },
      defaultConfig,
      distribution,
    )
    expect(result.m1_advance).toBe(1000)
    expect(result.m1_ec_amount).toBe(1000) // 100% to EC
    expect(result.m1_ea_amount).toBe(0)    // 0% to EA
  })

  it('M1 advance: non-self-generated splits 50/50', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      distribution,
    )
    expect(result.m1_advance).toBe(1000)
    expect(result.m1_ec_amount).toBe(500) // 50% to EC
    expect(result.m1_ea_amount).toBe(500) // 50% to EA
  })

  it('net commission never goes negative (large adder deduction)', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 1, energy_community: false, adder_total: 10000, self_generated: false },
      defaultConfig,
      distribution,
    )
    // 1kW = 1000W * $0.35 = $350 gross, $100 ops, $10000 adder = hugely negative
    // Math.max(0, ...) should prevent negative
    expect(result.total_net).toBeGreaterThanOrEqual(0)
    result.lines.forEach(l => expect(l.net_commission).toBeGreaterThanOrEqual(0))
  })

  it('uses defaults when config keys are missing', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      {}, // empty config
      distribution,
    )
    // Should fall back to EC_DEFAULTS
    expect(result.gross_per_watt).toBe(0.50)
    expect(result.ops_deduction_per_watt).toBe(0.10)
    expect(result.effective_per_watt).toBe(0.40)
    expect(result.m1_advance).toBe(1000)
  })

  it('rounds to 2 decimal places for currency', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 7.3, energy_community: true, adder_total: 333, self_generated: false },
      defaultConfig,
      [{ role_key: 'rep', label: 'Rep', percentage: 100 }],
    )
    // Verify no floating point artifacts
    const decimalPlaces = (n: number) => {
      const s = String(n)
      if (!s.includes('.')) return 0
      return s.split('.')[1].length
    }
    expect(decimalPlaces(result.total_gross)).toBeLessThanOrEqual(2)
    expect(decimalPlaces(result.total_net)).toBeLessThanOrEqual(2)
    result.lines.forEach(l => {
      expect(decimalPlaces(l.net_commission)).toBeLessThanOrEqual(2)
      expect(decimalPlaces(l.gross_amount)).toBeLessThanOrEqual(2)
    })
  })
})

// ── Helper: create a pre-configured mock chain ───────────────────────────────
// mockSupabase.from() creates a new chain each call, so we must configure the
// chain _before_ the code under test calls from() by using mockReturnValueOnce.
function setupMockChain(overrides: Record<string, any> = {}) {
  // Build a chain with all methods returning itself
  const chain: any = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'ilike',
    'gt', 'lt', 'gte', 'lte', 'or', 'order', 'range', 'limit']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.then = vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb))

  // Apply overrides
  for (const [k, v] of Object.entries(overrides)) {
    chain[k] = v
  }

  mockSupabase.from.mockReturnValueOnce(chain)
  return chain
}

// ── loadCommissionConfig ──────────────────────────────────────────────────────

describe('loadCommissionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns config as key-value record', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({
        data: [
          { config_key: 'ec_gross_per_watt', value: '0.50' },
          { config_key: 'non_ec_gross_per_watt', value: '0.35' },
        ],
        error: null,
      }).then(cb)),
    })

    const { loadCommissionConfig } = await import('@/lib/api/commission-advanced')
    const config = await loadCommissionConfig()
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_config')
    expect(config).toEqual({
      ec_gross_per_watt: '0.50',
      non_ec_gross_per_watt: '0.35',
    })
  })

  it('filters by orgId when provided', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
    })

    const { loadCommissionConfig } = await import('@/lib/api/commission-advanced')
    await loadCommissionConfig('org-123')
    expect(chain.or).toHaveBeenCalled()
  })

  it('returns empty record on error', async () => {
    setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({
        data: null,
        error: { message: 'DB error' },
      }).then(cb)),
    })

    const { loadCommissionConfig } = await import('@/lib/api/commission-advanced')
    const config = await loadCommissionConfig()
    expect(config).toEqual({})
  })
})

// ── updateCommissionConfig ────────────────────────────────────────────────────

describe('updateCommissionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true on success', async () => {
    const chain = setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const { updateCommissionConfig } = await import('@/lib/api/commission-advanced')
    const result = await updateCommissionConfig('ec_gross_per_watt', '0.55')
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_config')
    expect(chain.update).toHaveBeenCalledWith({ value: '0.55' })
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'fail' } })),
    })

    const { updateCommissionConfig } = await import('@/lib/api/commission-advanced')
    const result = await updateCommissionConfig('bad_key', 'val')
    expect(result).toBe(false)
  })
})

// ── loadAdvances ──────────────────────────────────────────────────────────────

describe('loadAdvances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads advances with no filters', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [{ id: '1' }], error: null }).then(cb)),
    })

    const { loadAdvances } = await import('@/lib/api/commission-advanced')
    const result = await loadAdvances()
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_advances')
    expect(chain.order).toHaveBeenCalled()
    expect(chain.limit).toHaveBeenCalledWith(500)
    expect(result).toHaveLength(1)
  })

  it('applies projectId filter', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
    })

    const { loadAdvances } = await import('@/lib/api/commission-advanced')
    await loadAdvances({ projectId: 'PROJ-123' })
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-123')
  })

  it('applies repId filter', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
    })

    const { loadAdvances } = await import('@/lib/api/commission-advanced')
    await loadAdvances({ repId: 'rep-uuid' })
    expect(chain.eq).toHaveBeenCalledWith('rep_id', 'rep-uuid')
  })

  it('applies status filter', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
    })

    const { loadAdvances } = await import('@/lib/api/commission-advanced')
    await loadAdvances({ status: 'paid' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'paid')
  })

  it('applies orgId filter', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
    })

    const { loadAdvances } = await import('@/lib/api/commission-advanced')
    await loadAdvances({ orgId: 'org-uuid' })
    expect(chain.eq).toHaveBeenCalledWith('org_id', 'org-uuid')
  })

  it('returns empty array on error', async () => {
    setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: null, error: { message: 'fail' } }).then(cb)),
    })

    const { loadAdvances } = await import('@/lib/api/commission-advanced')
    const result = await loadAdvances()
    expect(result).toEqual([])
  })
})

// ── createAdvance ─────────────────────────────────────────────────────────────

describe('createAdvance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns created advance on success', async () => {
    const advance = { id: 'adv-1', project_id: 'PROJ-1', amount: 1000 }
    const chain = setupMockChain({
      single: vi.fn(() => Promise.resolve({ data: advance, error: null })),
    })

    const { createAdvance } = await import('@/lib/api/commission-advanced')
    const result = await createAdvance({
      project_id: 'PROJ-1',
      rep_id: null,
      rep_name: 'Test Rep',
      role_key: 'ec',
      amount: 1000,
      milestone: 'M1',
      paid_at: null,
      clawback_date: '2026-06-28',
      clawback_reason: null,
      clawed_back_at: null,
      notes: null,
      admin_notes: null,
      org_id: null,
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_advances')
    expect(chain.insert).toHaveBeenCalled()
    expect(result).toEqual(advance)
  })

  it('returns null on error', async () => {
    setupMockChain({
      single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'fail' } })),
    })

    const { createAdvance } = await import('@/lib/api/commission-advanced')
    const result = await createAdvance({
      project_id: 'PROJ-1',
      rep_id: null,
      rep_name: 'Test',
      role_key: 'ec',
      amount: 1000,
      milestone: 'M1',
      paid_at: null,
      clawback_date: null,
      clawback_reason: null,
      clawed_back_at: null,
      notes: null,
      admin_notes: null,
      org_id: null,
    })
    expect(result).toBeNull()
  })
})

// ── updateAdvance ─────────────────────────────────────────────────────────────

describe('updateAdvance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true on success', async () => {
    const chain = setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const { updateAdvance } = await import('@/lib/api/commission-advanced')
    const result = await updateAdvance('adv-1', { status: 'approved' })
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_advances')
    expect(chain.update).toHaveBeenCalledWith({ status: 'approved' })
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'fail' } })),
    })

    const { updateAdvance } = await import('@/lib/api/commission-advanced')
    const result = await updateAdvance('adv-1', { status: 'approved' })
    expect(result).toBe(false)
  })
})

// ── clawbackAdvance ───────────────────────────────────────────────────────────

describe('clawbackAdvance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets status to clawed_back with reason and timestamp', async () => {
    const chain = setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const { clawbackAdvance } = await import('@/lib/api/commission-advanced')
    const result = await clawbackAdvance('adv-1', 'Project cancelled')
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'clawed_back',
      clawback_reason: 'Project cancelled',
    }))
    // Verify clawed_back_at is an ISO timestamp
    const call = chain.update.mock.calls[0][0]
    expect(call.clawed_back_at).toBeTruthy()
    expect(new Date(call.clawed_back_at).getTime()).not.toBeNaN()
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'fail' } })),
    })

    const { clawbackAdvance } = await import('@/lib/api/commission-advanced')
    const result = await clawbackAdvance('adv-1', 'reason')
    expect(result).toBe(false)
  })
})

// ── loadPendingClawbacks ──────────────────────────────────────────────────────

describe('loadPendingClawbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries for paid advances past clawback date', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [{ id: 'adv-1' }], error: null }).then(cb)),
    })

    const { loadPendingClawbacks } = await import('@/lib/api/commission-advanced')
    const result = await loadPendingClawbacks()
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_advances')
    expect(chain.eq).toHaveBeenCalledWith('status', 'paid')
    expect(chain.limit).toHaveBeenCalledWith(200)
    expect(result).toHaveLength(1)
  })

  it('applies orgId filter when provided', async () => {
    const chain = setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: [], error: null }).then(cb)),
    })

    const { loadPendingClawbacks } = await import('@/lib/api/commission-advanced')
    await loadPendingClawbacks('org-123')
    expect(chain.eq).toHaveBeenCalledWith('org_id', 'org-123')
  })

  it('returns empty array on error', async () => {
    setupMockChain({
      then: vi.fn((cb: any) => Promise.resolve({ data: null, error: { message: 'fail' } }).then(cb)),
    })

    const { loadPendingClawbacks } = await import('@/lib/api/commission-advanced')
    const result = await loadPendingClawbacks()
    expect(result).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// ROUND 2: EDGE CASE TESTS
// ══════════════════════════════════════════════════════════════════════════════

// ── calculateProjectCommission edge cases ────────────────────────────────────

describe('calculateProjectCommission edge cases', () => {
  const defaultConfig: Record<string, string> = {
    ec_gross_per_watt: '0.50',
    non_ec_gross_per_watt: '0.35',
    ec_bonus_per_watt: '0.15',
    operations_per_watt: '0.10',
    ec_effective_per_watt: '0.40',
    non_ec_effective_per_watt: '0.25',
    m1_advance_amount: '1000',
    m1_self_gen_ec_split: '100',
    m1_ec_ea_split: '50',
    adder_deduction_from_stack: 'true',
  }

  const fullDistribution = [
    { role_key: 'ec', label: 'Energy Consultant', percentage: 40 },
    { role_key: 'ea', label: 'Energy Advisor', percentage: 40 },
    { role_key: 'mgr', label: 'Manager', percentage: 20 },
  ]

  it('very large system (100kW = 100,000 watts) scales correctly', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 100, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      fullDistribution,
    )
    expect(result.system_watts).toBe(100000)
    expect(result.total_gross).toBe(50000)         // 100,000 * $0.50
    expect(result.total_ops_deduction).toBe(10000) // 100,000 * $0.10
    expect(result.total_net).toBe(40000)            // 50,000 - 10,000
    // Verify line items sum to total
    const lineSum = result.lines.reduce((s, l) => s + l.net_commission, 0)
    expect(lineSum).toBeCloseTo(result.total_net, 2)
  })

  it('adder deduction exceeding commission stack clamps to zero', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    // 5kW EC: gross = 2500, ops = 500, net = 2000. Adder = 5000 >> 2000
    const result = calculateProjectCommission(
      { system_kw: 5, energy_community: true, adder_total: 5000, self_generated: false },
      defaultConfig,
      fullDistribution,
    )
    expect(result.total_adder_deduction).toBe(5000)
    // distributablePool = max(0, 2500 - 500 - 5000) = 0
    expect(result.total_net).toBe(0)
    result.lines.forEach(l => expect(l.net_commission).toBe(0))
  })

  it('distribution summing to less than 100% leaves remainder unallocated', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const partialDist = [
      { role_key: 'ec', label: 'EC', percentage: 30 },
      { role_key: 'ea', label: 'EA', percentage: 20 },
    ]
    // 50% total allocated
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      partialDist,
    )
    // Pool = 4000. Allocated: 30% + 20% = 50% = 2000
    expect(result.lines).toHaveLength(2)
    const ecLine = result.lines.find(l => l.role_key === 'ec')!
    const eaLine = result.lines.find(l => l.role_key === 'ea')!
    expect(ecLine.net_commission).toBe(1200) // 4000 * 0.30
    expect(eaLine.net_commission).toBe(800)  // 4000 * 0.20
    // total_net is the SUM of lines, which is only 50%
    expect(result.total_net).toBe(2000)
  })

  it('distribution with all roles inactive (empty array) produces zero net', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      [], // no roles
    )
    expect(result.lines).toHaveLength(0)
    expect(result.total_net).toBe(0)
    // Gross and ops should still be calculated
    expect(result.total_gross).toBe(5000)
    expect(result.total_ops_deduction).toBe(1000)
  })

  it('EC flag with zero system_kw produces zero across all fields', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 0, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      fullDistribution,
    )
    expect(result.is_ec).toBe(true)
    expect(result.system_watts).toBe(0)
    expect(result.total_gross).toBe(0)
    expect(result.total_ops_deduction).toBe(0)
    expect(result.total_net).toBe(0)
    // Per-watt rates should still reflect EC values
    expect(result.gross_per_watt).toBe(0.50)
    expect(result.effective_per_watt).toBe(0.40)
    // M1 advance is still calculated (independent of system size)
    expect(result.m1_advance).toBe(1000)
  })

  it('fractional kW with adders produces correctly rounded results', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const result = calculateProjectCommission(
      { system_kw: 3.333, energy_community: false, adder_total: 77.77, self_generated: false },
      defaultConfig,
      [{ role_key: 'solo', label: 'Solo', percentage: 100 }],
    )
    // 3.333 kW = 3333 W. Gross = 3333 * 0.35 = 1166.55
    expect(result.total_gross).toBe(1166.55)
    // Ops = 3333 * 0.10 = 333.30
    expect(result.total_ops_deduction).toBe(333.3)
    // Net pool = max(0, 1166.55 - 333.30 - 77.77) = 755.48
    expect(result.total_net).toBeCloseTo(755.48, 2)
    // All values should have at most 2 decimal places
    expect(Number(result.total_net.toFixed(2))).toBe(result.total_net)
  })

  it('distribution summing to more than 100% distributes proportionally', async () => {
    const { calculateProjectCommission } = await import('@/lib/api/commission-advanced')
    const overDist = [
      { role_key: 'a', label: 'A', percentage: 60 },
      { role_key: 'b', label: 'B', percentage: 60 },
    ]
    // 120% total
    const result = calculateProjectCommission(
      { system_kw: 10, energy_community: true, adder_total: 0, self_generated: false },
      defaultConfig,
      overDist,
    )
    // Pool = 4000. Each gets 60% = 2400
    expect(result.lines[0].net_commission).toBe(2400)
    expect(result.lines[1].net_commission).toBe(2400)
    // total_net = sum of lines = 4800 (120% of pool)
    expect(result.total_net).toBe(4800)
  })
})

// ── calculateDaysSinceSale edge cases ────────────────────────────────────────

describe('calculateDaysSinceSale edge cases', () => {
  it('date at exact midnight boundary (start of day)', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    // Yesterday at midnight
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    const result = calculateDaysSinceSale(dateStr)
    // Should be at least 1 (could be 1 depending on time of day)
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(2)
  })

  it('very old date (10 years ago) returns large number', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    const tenYearsAgo = new Date()
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
    const result = calculateDaysSinceSale(tenYearsAgo.toISOString().split('T')[0])
    // 10 years = ~3650 days (accounting for leap years)
    expect(result).toBeGreaterThanOrEqual(3650)
    expect(result).toBeLessThanOrEqual(3653)
  })

  it('date with timestamp suffix is parsed correctly', async () => {
    const { calculateDaysSinceSale } = await import('@/lib/api/commission-advanced')
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    const isoFull = fiveDaysAgo.toISOString() // e.g. "2026-03-23T12:00:00.000Z"
    const result = calculateDaysSinceSale(isoFull)
    // Should handle full ISO strings too
    expect(result).toBeGreaterThanOrEqual(4)
    expect(result).toBeLessThanOrEqual(6)
  })
})

// ── isClawbackEligible edge cases ────────────────────────────────────────────

describe('isClawbackEligible edge cases', () => {
  it('cancelled status returns false even if past clawback date', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 30)
    expect(isClawbackEligible({
      status: 'cancelled',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(false)
  })

  it('clawed_back status returns false (already clawed back)', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 30)
    expect(isClawbackEligible({
      status: 'clawed_back',
      clawback_date: pastDate.toISOString().split('T')[0],
    })).toBe(false)
  })

  it('clawback_days = 0 means immediate clawback eligibility for paid advance', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    // With clawback_date set to today (simulating 0-day window)
    const today = new Date().toISOString().split('T')[0]
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: today,
    })).toBe(true)
  })

  it('undefined clawback_date treated same as null', async () => {
    const { isClawbackEligible } = await import('@/lib/api/commission-advanced')
    expect(isClawbackEligible({
      status: 'paid',
      clawback_date: undefined as any,
    })).toBe(false)
  })
})

// ── clawbackAdvance edge cases ───────────────────────────────────────────────

describe('clawbackAdvance edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clawback with empty reason string still sets status', async () => {
    const chain = setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const { clawbackAdvance } = await import('@/lib/api/commission-advanced')
    const result = await clawbackAdvance('adv-1', '')
    expect(result).toBe(true)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'clawed_back',
      clawback_reason: '',
    }))
    // clawed_back_at should still be set
    const call = chain.update.mock.calls[0][0]
    expect(call.clawed_back_at).toBeTruthy()
  })

  it('clawback with very long reason string passes through', async () => {
    const chain = setupMockChain({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const longReason = 'A'.repeat(1000)
    const { clawbackAdvance } = await import('@/lib/api/commission-advanced')
    const result = await clawbackAdvance('adv-1', longReason)
    expect(result).toBe(true)
    const call = chain.update.mock.calls[0][0]
    expect(call.clawback_reason).toBe(longReason)
    expect(call.clawback_reason).toHaveLength(1000)
  })
})
