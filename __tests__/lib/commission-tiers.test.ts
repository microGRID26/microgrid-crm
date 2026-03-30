import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_RATES = [
  { id: 'r1', role_key: 'sales_rep', label: 'Sales Rep', rate_type: 'per_watt', rate: 0.50, active: true, sort_order: 1, org_id: null },
  { id: 'r2', role_key: 'closer', label: 'Closer', rate_type: 'per_watt', rate: 0.25, active: true, sort_order: 2, org_id: null },
  { id: 'r3', role_key: 'adder', label: 'Adder', rate_type: 'percentage', rate: 10.0, active: true, sort_order: 5, org_id: null },
  { id: 'r4', role_key: 'referral', label: 'Referral', rate_type: 'flat', rate: 500, active: true, sort_order: 6, org_id: null },
]

const MOCK_TIERS = [
  { id: 't1', rate_id: 'r1', min_deals: 1, max_deals: 5, min_watts: null, max_watts: null, rate: 0.50, label: 'Tier 1', sort_order: 1 },
  { id: 't2', rate_id: 'r1', min_deals: 6, max_deals: 10, min_watts: null, max_watts: null, rate: 0.60, label: 'Tier 2', sort_order: 2 },
  { id: 't3', rate_id: 'r1', min_deals: 11, max_deals: null, min_watts: null, max_watts: null, rate: 0.75, label: 'Tier 3', sort_order: 3 },
]

const MOCK_WATT_TIERS = [
  { id: 'tw1', rate_id: 'r2', min_deals: null, max_deals: null, min_watts: 0, max_watts: 50000, rate: 0.25, label: 'Small', sort_order: 1 },
  { id: 'tw2', rate_id: 'r2', min_deals: null, max_deals: null, min_watts: 50001, max_watts: 100000, rate: 0.30, label: 'Medium', sort_order: 2 },
  { id: 'tw3', rate_id: 'r2', min_deals: null, max_deals: null, min_watts: 100001, max_watts: null, rate: 0.35, label: 'Large', sort_order: 3 },
]

const MOCK_GEO_MODIFIERS = [
  { id: 'g1', state: 'TX', city: 'Houston', region: null, modifier: 1.2, label: 'Houston premium', active: true, org_id: null },
  { id: 'g2', state: 'TX', city: null, region: null, modifier: 1.1, label: 'Texas', active: true, org_id: null },
  { id: 'g3', state: null, city: null, region: 'Southeast', modifier: 0.95, label: 'SE region', active: true, org_id: null },
  { id: 'g4', state: 'CA', city: null, region: null, modifier: 1.3, label: 'California', active: true, org_id: null },
  { id: 'g5', state: 'TX', city: 'Dallas', region: null, modifier: 1.15, label: 'Dallas', active: true, org_id: null },
  { id: 'g6', state: 'NY', city: null, region: null, modifier: 0.9, label: 'New York inactive', active: false, org_id: null },
]

const MOCK_HIERARCHY = [
  { id: 'h1', user_id: 'u1', user_name: 'Alice', role_key: 'sales_rep', parent_id: null, team_name: 'Alpha', active: true, org_id: null },
  { id: 'h2', user_id: 'u2', user_name: 'Bob', role_key: 'closer', parent_id: 'h1', team_name: 'Alpha', active: true, org_id: null },
]

// ── Import functions under test ─────────────────────────────────────────────

import {
  getTieredRate,
  getGeoModifier,
  calculateTieredCommission,
  loadCommissionTiers,
  loadGeoModifiers,
  loadHierarchy,
  addCommissionTier,
  deleteCommissionTier,
  addGeoModifier,
  updateGeoModifier,
  deleteGeoModifier,
  addHierarchyMember,
  updateHierarchyMember,
  removeHierarchyMember,
} from '@/lib/api/commissions'

// ═══════════════════════════════════════════════════════════════════════════════
// getTieredRate — pure function
// ═══════════════════════════════════════════════════════════════════════════════

describe('getTieredRate', () => {
  it('returns base rate when no tiers exist', () => {
    const rate = getTieredRate('r1', 3, 10000, MOCK_RATES, [])
    expect(rate).toBe(0.50)
  })

  it('returns base rate when no tiers match the rate ID', () => {
    const otherTiers = MOCK_TIERS.map(t => ({ ...t, rate_id: 'other' }))
    const rate = getTieredRate('r1', 3, 10000, MOCK_RATES, otherTiers)
    expect(rate).toBe(0.50)
  })

  it('returns 0 when rate ID is not found in rates', () => {
    const rate = getTieredRate('nonexistent', 5, 10000, MOCK_RATES, MOCK_TIERS)
    expect(rate).toBe(0)
  })

  it('matches tier by deal count — tier 1 (1-5 deals)', () => {
    const rate = getTieredRate('r1', 3, 0, MOCK_RATES, MOCK_TIERS)
    expect(rate).toBe(0.50)
  })

  it('matches tier by deal count — tier 2 (6-10 deals)', () => {
    const rate = getTieredRate('r1', 8, 0, MOCK_RATES, MOCK_TIERS)
    expect(rate).toBe(0.60)
  })

  it('matches tier by deal count — tier 3 (11+ deals, no max)', () => {
    const rate = getTieredRate('r1', 15, 0, MOCK_RATES, MOCK_TIERS)
    expect(rate).toBe(0.75)
  })

  it('matches tier by watts', () => {
    const rate = getTieredRate('r2', 0, 75000, MOCK_RATES, MOCK_WATT_TIERS)
    expect(rate).toBe(0.30) // Medium tier
  })

  it('matches tier by watts — large (100001+)', () => {
    const rate = getTieredRate('r2', 0, 200000, MOCK_RATES, MOCK_WATT_TIERS)
    expect(rate).toBe(0.35)
  })

  it('first matching tier wins (sort_order respected)', () => {
    const rate = getTieredRate('r1', 1, 0, MOCK_RATES, MOCK_TIERS)
    expect(rate).toBe(0.50) // Tier 1 matches first
  })

  it('falls back to base rate when no tier matches', () => {
    const rate = getTieredRate('r1', 0, 0, MOCK_RATES, MOCK_TIERS)
    // 0 deals doesn't match any tier (min_deals = 1)
    expect(rate).toBe(0.50) // base rate fallback
  })

  it('handles tier with both deal and watt bounds (both must match)', () => {
    const bothTiers = [
      { id: 'b1', rate_id: 'r1', min_deals: 5, max_deals: 10, min_watts: 50000, max_watts: 100000, rate: 0.80, label: 'Both', sort_order: 1 },
    ]
    // Deals match but watts don't
    expect(getTieredRate('r1', 7, 10000, MOCK_RATES, bothTiers)).toBe(0.50) // base
    // Both match
    expect(getTieredRate('r1', 7, 75000, MOCK_RATES, bothTiers)).toBe(0.80)
    // Watts match but deals don't
    expect(getTieredRate('r1', 2, 75000, MOCK_RATES, bothTiers)).toBe(0.50) // base
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getGeoModifier — pure function
// ═══════════════════════════════════════════════════════════════════════════════

describe('getGeoModifier', () => {
  it('returns 1.0 when no state or city provided', () => {
    expect(getGeoModifier(null, null, MOCK_GEO_MODIFIERS)).toBe(1.0)
    expect(getGeoModifier(undefined, undefined, MOCK_GEO_MODIFIERS)).toBe(1.0)
    expect(getGeoModifier('', '', MOCK_GEO_MODIFIERS)).toBe(1.0)
  })

  it('returns exact city+state match (highest priority)', () => {
    expect(getGeoModifier('TX', 'Houston', MOCK_GEO_MODIFIERS)).toBe(1.2)
  })

  it('returns state-only match when no city match', () => {
    expect(getGeoModifier('CA', null, MOCK_GEO_MODIFIERS)).toBe(1.3)
  })

  it('prefers city+state match over state-only match', () => {
    // Dallas, TX should match city+state (1.15), not state-only TX (1.1)
    expect(getGeoModifier('TX', 'Dallas', MOCK_GEO_MODIFIERS)).toBe(1.15)
  })

  it('falls back to state-only when city does not match', () => {
    // Austin, TX — no city match, falls back to TX state-only (1.1)
    expect(getGeoModifier('TX', 'Austin', MOCK_GEO_MODIFIERS)).toBe(1.1)
  })

  it('returns region match when no state/city match', () => {
    // FL is not in the modifiers, but there's a region-only modifier
    expect(getGeoModifier('FL', null, MOCK_GEO_MODIFIERS)).toBe(0.95)
  })

  it('returns 1.0 when no match at all and no region modifier', () => {
    const noRegion = MOCK_GEO_MODIFIERS.filter(m => m.region === null)
    expect(getGeoModifier('OR', null, noRegion)).toBe(1.0)
  })

  it('ignores inactive modifiers', () => {
    // NY has modifier 0.9 but active=false
    expect(getGeoModifier('NY', null, MOCK_GEO_MODIFIERS)).toBe(0.95) // falls through to region
  })

  it('is case-insensitive', () => {
    expect(getGeoModifier('tx', 'houston', MOCK_GEO_MODIFIERS)).toBe(1.2)
    expect(getGeoModifier('TX', 'HOUSTON', MOCK_GEO_MODIFIERS)).toBe(1.2)
  })

  it('trims whitespace from inputs', () => {
    expect(getGeoModifier(' TX ', ' Houston ', MOCK_GEO_MODIFIERS)).toBe(1.2)
  })

  it('returns 1.0 with empty modifiers array', () => {
    expect(getGeoModifier('TX', 'Houston', [])).toBe(1.0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// calculateTieredCommission — pure function
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateTieredCommission', () => {
  it('calculates with base rate when no tiers provided', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', MOCK_RATES, [])
    expect(result.solarCommission).toBe(5000) // 10000 * 0.50
    expect(result.total).toBe(5000)
  })

  it('applies tiered rate instead of base rate', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', MOCK_RATES, MOCK_TIERS, undefined, 8)
    // 8 deals matches Tier 2 (0.60), so 10000 * 0.60 = 6000
    expect(result.solarCommission).toBe(6000)
    expect(result.total).toBe(6000)
  })

  it('applies geo modifier multiplier', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', MOCK_RATES, [], 1.2)
    // 10000 * 0.50 * 1.2 = 6000
    expect(result.solarCommission).toBe(6000)
    expect(result.total).toBe(6000)
  })

  it('applies both tier rate and geo modifier together', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', MOCK_RATES, MOCK_TIERS, 1.2, 8)
    // Tier 2 rate = 0.60, geo = 1.2 → 10000 * 0.60 * 1.2 = 7200
    expect(result.solarCommission).toBe(7200)
    expect(result.total).toBe(7200)
  })

  it('defaults geo modifier to 1.0 when not provided', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', MOCK_RATES, [])
    expect(result.solarCommission).toBe(5000) // 10000 * 0.50 * 1.0
  })

  it('includes adder and referral commissions without geo modifier', () => {
    const result = calculateTieredCommission(10000, 5000, 2, 'sales_rep', MOCK_RATES, [], 1.5)
    // Solar: 10000 * 0.50 * 1.5 = 7500
    // Adder: 5000 * 10% = 500 (no geo applied to adders)
    // Referral: 2 * 500 = 1000 (no geo applied to referrals)
    expect(result.solarCommission).toBe(7500)
    expect(result.adderCommission).toBe(500)
    expect(result.referralCommission).toBe(1000)
    expect(result.total).toBe(9000)
  })

  it('guards against negative inputs', () => {
    const result = calculateTieredCommission(-5000, -1000, -3, 'sales_rep', MOCK_RATES, [])
    expect(result.solarCommission).toBe(0)
    expect(result.adderCommission).toBe(0)
    expect(result.referralCommission).toBe(0)
    expect(result.total).toBe(0)
  })

  it('returns zero for unknown role', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'nonexistent_role', MOCK_RATES, [])
    expect(result.solarCommission).toBe(0)
    expect(result.total).toBe(0)
  })

  it('handles percentage rate type with geo modifier', () => {
    const pctRates = [{ ...MOCK_RATES[0], rate_type: 'percentage' as const, rate: 5 }]
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', pctRates as any, [], 1.1)
    // 10000 * 5 / 100 * 1.1 = 550
    expect(result.solarCommission).toBe(550)
  })

  it('handles flat rate type with geo modifier', () => {
    const flatRates = [{ ...MOCK_RATES[0], rate_type: 'flat' as const, rate: 1000 }]
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', flatRates as any, [], 1.2)
    // flat 1000 * 1.2 = 1200
    expect(result.solarCommission).toBe(1200)
  })

  it('uses base rate when tiers exist but no volume data provided', () => {
    const result = calculateTieredCommission(10000, 0, 0, 'sales_rep', MOCK_RATES, MOCK_TIERS)
    // No dealCount or totalWatts passed → uses base rate
    expect(result.solarCommission).toBe(5000) // 10000 * 0.50
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — loadCommissionTiers
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadCommissionTiers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads tiers filtered by rateId', async () => {
    const chain = mockChain({ data: MOCK_TIERS, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await loadCommissionTiers('r1')
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_tiers')
    expect(chain.eq).toHaveBeenCalledWith('rate_id', 'r1')
    expect(chain.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(chain.limit).toHaveBeenCalledWith(50)
    expect(result).toEqual(MOCK_TIERS)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'db error' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await loadCommissionTiers('r1')
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — addCommissionTier / deleteCommissionTier
// ═══════════════════════════════════════════════════════════════════════════════

describe('addCommissionTier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts tier and returns it', async () => {
    const newTier = { rate_id: 'r1', min_deals: 1, max_deals: 5, min_watts: null, max_watts: null, rate: 0.50, label: 'T1', sort_order: 1 }
    const saved = { id: 'new-id', ...newTier, created_at: '2026-03-28' }
    const chain = mockChain({ data: saved, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await addCommissionTier(newTier as any)
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_tiers')
    expect(chain.insert).toHaveBeenCalled()
    expect(result).toEqual(saved)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert error' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await addCommissionTier({} as any)
    expect(result).toBeNull()
  })
})

describe('deleteCommissionTier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes tier and returns true', async () => {
    const chain = mockChain({ data: null, error: null })
    // delete doesn't call .single(), it resolves the chain directly
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: null }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    const result = await deleteCommissionTier('t1')
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_tiers')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 't1')
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'delete error' } })
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: { message: 'delete error' } }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    const result = await deleteCommissionTier('t1')
    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — loadGeoModifiers
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadGeoModifiers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads active modifiers without orgId filter', async () => {
    const chain = mockChain({ data: MOCK_GEO_MODIFIERS, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await loadGeoModifiers()
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_geo_modifiers')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.limit).toHaveBeenCalledWith(500)
    expect(chain.or).not.toHaveBeenCalled()
    expect(result).toEqual(MOCK_GEO_MODIFIERS)
  })

  it('applies org filter when orgId is provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    await loadGeoModifiers('org-123')
    expect(chain.or).toHaveBeenCalledWith('org_id.eq.org-123,org_id.is.null')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await loadGeoModifiers()
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — addGeoModifier / updateGeoModifier / deleteGeoModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('addGeoModifier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts and returns the modifier', async () => {
    const mod = { state: 'FL', city: null, region: null, modifier: 1.05, label: 'Florida', active: true, org_id: null }
    const saved = { id: 'new-g', ...mod, created_at: '2026-03-28' }
    const chain = mockChain({ data: saved, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await addGeoModifier(mod as any)
    expect(chain.insert).toHaveBeenCalled()
    expect(result).toEqual(saved)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await addGeoModifier({} as any)
    expect(result).toBeNull()
  })
})

describe('updateGeoModifier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns the modifier', async () => {
    const updated = { ...MOCK_GEO_MODIFIERS[0], modifier: 1.25 }
    const chain = mockChain({ data: updated, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await updateGeoModifier('g1', { modifier: 1.25 })
    expect(chain.update).toHaveBeenCalledWith({ modifier: 1.25 })
    expect(chain.eq).toHaveBeenCalledWith('id', 'g1')
    expect(result).toEqual(updated)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await updateGeoModifier('g1', { modifier: 1.25 })
    expect(result).toBeNull()
  })
})

describe('deleteGeoModifier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes and returns true', async () => {
    const chain = mockChain({ data: null, error: null })
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: null }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    const result = await deleteGeoModifier('g1')
    expect(chain.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: { message: 'err' } }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    const result = await deleteGeoModifier('g1')
    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — loadHierarchy
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadHierarchy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads active hierarchy without orgId', async () => {
    const chain = mockChain({ data: MOCK_HIERARCHY, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await loadHierarchy()
    expect(mockSupabase.from).toHaveBeenCalledWith('commission_hierarchy')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.limit).toHaveBeenCalledWith(500)
    expect(chain.or).not.toHaveBeenCalled()
    expect(result).toEqual(MOCK_HIERARCHY)
  })

  it('applies org filter when orgId is provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    await loadHierarchy('org-456')
    expect(chain.or).toHaveBeenCalledWith('org_id.eq.org-456,org_id.is.null')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await loadHierarchy()
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — addHierarchyMember / updateHierarchyMember / removeHierarchyMember
// ═══════════════════════════════════════════════════════════════════════════════

describe('addHierarchyMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts and returns the member', async () => {
    const member = { user_id: 'u3', user_name: 'Charlie', role_key: 'team_leader', parent_id: null, team_name: 'Bravo', active: true, org_id: null }
    const saved = { id: 'h3', ...member, created_at: '2026-03-28', updated_at: '2026-03-28' }
    const chain = mockChain({ data: saved, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await addHierarchyMember(member as any)
    expect(chain.insert).toHaveBeenCalled()
    expect(result).toEqual(saved)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await addHierarchyMember({} as any)
    expect(result).toBeNull()
  })
})

describe('updateHierarchyMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns the member', async () => {
    const updated = { ...MOCK_HIERARCHY[0], team_name: 'Delta' }
    const chain = mockChain({ data: updated, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const result = await updateHierarchyMember('h1', { team_name: 'Delta' })
    expect(chain.update).toHaveBeenCalledWith({ team_name: 'Delta' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'h1')
    expect(result).toEqual(updated)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)

    const result = await updateHierarchyMember('h1', {})
    expect(result).toBeNull()
  })
})

describe('removeHierarchyMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting active=false', async () => {
    const chain = mockChain({ data: null, error: null })
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: null }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    const result = await removeHierarchyMember('h1')
    expect(chain.update).toHaveBeenCalledWith({ active: false })
    expect(chain.eq).toHaveBeenCalledWith('id', 'h1')
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: { message: 'err' } }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    const result = await removeHierarchyMember('h1')
    expect(result).toBe(false)
  })

  it('does NOT hard-delete — uses update, not delete', async () => {
    const chain = mockChain({ data: null, error: null })
    chain.then = vi.fn((cb: any) => Promise.resolve({ data: null, error: null }).then(cb))
    mockSupabase.from.mockReturnValue(chain)

    await removeHierarchyMember('h1')
    expect(chain.update).toHaveBeenCalled()
    expect(chain.delete).not.toHaveBeenCalled()
  })
})
