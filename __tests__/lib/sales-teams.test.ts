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

const MOCK_PAY_SCALE = {
  id: 'ps-1', name: 'Consultant', description: 'Entry-level', per_watt_rate: 0.20,
  adder_percentage: 10, referral_bonus: 500, sort_order: 1, active: true,
  org_id: null, created_at: '2026-03-28', updated_at: '2026-03-28',
}

const MOCK_PAY_SCALE_2 = {
  id: 'ps-2', name: 'Elite', description: 'Top performer', per_watt_rate: 0.30,
  adder_percentage: 10, referral_bonus: 500, sort_order: 3, active: true,
  org_id: 'a0000000-0000-0000-0000-000000000001', created_at: '2026-03-28', updated_at: '2026-03-28',
}

const MOCK_DISTRIBUTION = [
  { id: 'd1', role_key: 'energy_consultant', label: 'Energy Consultant', percentage: 40, sort_order: 1, active: true, org_id: null, created_at: '2026-03-28' },
  { id: 'd2', role_key: 'energy_advisor', label: 'Energy Advisor', percentage: 40, sort_order: 2, active: true, org_id: null, created_at: '2026-03-28' },
  { id: 'd3', role_key: 'project_manager', label: 'Project Manager', percentage: 3, sort_order: 4, active: true, org_id: null, created_at: '2026-03-28' },
  { id: 'd4', role_key: 'vp', label: 'VP', percentage: 3, sort_order: 6, active: true, org_id: null, created_at: '2026-03-28' },
  { id: 'd5', role_key: 'regional', label: 'Regional', percentage: 9, sort_order: 7, active: true, org_id: null, created_at: '2026-03-28' },
  { id: 'd6', role_key: 'incentive_budget', label: 'Incentive Budget', percentage: 2, sort_order: 3, active: true, org_id: null, created_at: '2026-03-28' },
  { id: 'd7', role_key: 'assistant_manager', label: 'Assistant Manager', percentage: 3, sort_order: 5, active: true, org_id: null, created_at: '2026-03-28' },
]

const MOCK_TEAM = {
  id: 'team-1', name: 'Alpha Team', vp_user_id: 'u1', vp_name: 'VP Person',
  regional_user_id: 'u2', regional_name: 'Regional Person',
  manager_user_id: 'u3', manager_name: 'Manager Person',
  assistant_manager_user_id: null, assistant_manager_name: null,
  stack_per_watt: 0.40, active: true, org_id: null,
  created_at: '2026-03-28', updated_at: '2026-03-28',
}

const MOCK_REP = {
  id: 'rep-1', user_id: 'u5', auth_user_id: null,
  first_name: 'John', last_name: 'Doe', email: 'john@test.com', phone: '555-0100',
  team_id: 'team-1', pay_scale_id: 'ps-1', role_key: 'energy_consultant',
  hire_date: '2026-01-15', status: 'active' as const, split_percentage: 100,
  split_partner_id: null, notes: null, org_id: null,
  created_at: '2026-03-28', updated_at: '2026-03-28',
}

const MOCK_REQUIREMENT = {
  id: 'req-1', name: 'Offer Letter', description: 'Employment offer letter',
  required: true, sort_order: 1, active: true, org_id: null, created_at: '2026-03-28',
}

const MOCK_DOCUMENT = {
  id: 'doc-1', rep_id: 'rep-1', requirement_id: 'req-1', status: 'pending' as const,
  sent_at: null, viewed_at: null, signed_at: null, uploaded_at: null,
  verified_at: null, verified_by: null, file_url: null, notes: null,
  created_at: '2026-03-28', updated_at: '2026-03-28',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Sales Teams constants', () => {
  it('exports all rep statuses', async () => {
    const { REP_STATUSES, REP_STATUS_LABELS, REP_STATUS_BADGE } = await import('@/lib/api/sales-teams')
    expect(REP_STATUSES).toEqual(['onboarding', 'active', 'inactive', 'terminated'])
    expect(Object.keys(REP_STATUS_LABELS)).toHaveLength(4)
    expect(REP_STATUS_LABELS.onboarding).toBe('Onboarding')
    expect(REP_STATUS_LABELS.active).toBe('Active')
    expect(REP_STATUS_LABELS.inactive).toBe('Inactive')
    expect(REP_STATUS_LABELS.terminated).toBe('Terminated')
    expect(Object.keys(REP_STATUS_BADGE)).toHaveLength(4)
  })

  it('exports all doc statuses', async () => {
    const { DOC_STATUSES, DOC_STATUS_LABELS, DOC_STATUS_BADGE } = await import('@/lib/api/sales-teams')
    expect(DOC_STATUSES).toEqual(['pending', 'sent', 'viewed', 'signed', 'uploaded', 'verified', 'rejected'])
    expect(Object.keys(DOC_STATUS_LABELS)).toHaveLength(7)
    expect(DOC_STATUS_LABELS.pending).toBe('Pending')
    expect(DOC_STATUS_LABELS.verified).toBe('Verified')
    expect(DOC_STATUS_LABELS.rejected).toBe('Rejected')
    expect(Object.keys(DOC_STATUS_BADGE)).toHaveLength(7)
  })

  it('exports DEFAULT_ROLE_KEYS with 7 roles', async () => {
    const { DEFAULT_ROLE_KEYS } = await import('@/lib/api/sales-teams')
    expect(DEFAULT_ROLE_KEYS).toHaveLength(7)
    expect(DEFAULT_ROLE_KEYS[0]).toEqual({ key: 'energy_consultant', label: 'Energy Consultant' })
    expect(DEFAULT_ROLE_KEYS[6]).toEqual({ key: 'regional', label: 'Regional' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS: calculateOverride
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateOverride', () => {
  it('calculates basic deductive override', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    // Team stack $0.40/W, rep $0.20/W, 10kW system
    const result = calculateOverride(0.40, 0.20, 10000)
    expect(result.teamStackRate).toBe(0.40)
    expect(result.repRate).toBe(0.20)
    expect(result.overridePerWatt).toBe(0.20)
    expect(result.systemWatts).toBe(10000)
    expect(result.totalOverride).toBe(2000)
  })

  it('returns zero override when rep rate equals stack rate', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.40, 0.40, 10000)
    expect(result.overridePerWatt).toBe(0)
    expect(result.totalOverride).toBe(0)
  })

  it('handles zero watts', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.40, 0.20, 0)
    expect(result.overridePerWatt).toBe(0.20)
    expect(result.totalOverride).toBe(0)
  })

  it('clamps negative override to zero (rep rate exceeds stack)', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.20, 0.40, 10000)
    expect(result.overridePerWatt).toBe(0)
    expect(result.totalOverride).toBe(0)
  })

  it('handles fractional rates correctly', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.35, 0.22, 8500)
    expect(result.overridePerWatt).toBeCloseTo(0.13)
    expect(result.totalOverride).toBeCloseTo(1105)
  })

  it('handles zero stack rate', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0, 0, 10000)
    expect(result.overridePerWatt).toBe(0)
    expect(result.totalOverride).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS: calculateSplitOverride
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateSplitOverride', () => {
  it('calculates 50/50 split', async () => {
    const { calculateSplitOverride } = await import('@/lib/api/sales-teams')
    expect(calculateSplitOverride(2000, 50)).toBe(1000)
  })

  it('calculates 100% (no split)', async () => {
    const { calculateSplitOverride } = await import('@/lib/api/sales-teams')
    expect(calculateSplitOverride(2000, 100)).toBe(2000)
  })

  it('calculates custom percentage', async () => {
    const { calculateSplitOverride } = await import('@/lib/api/sales-teams')
    expect(calculateSplitOverride(2000, 60)).toBe(1200)
  })

  it('handles zero percentage', async () => {
    const { calculateSplitOverride } = await import('@/lib/api/sales-teams')
    expect(calculateSplitOverride(2000, 0)).toBe(0)
  })

  it('handles zero amount', async () => {
    const { calculateSplitOverride } = await import('@/lib/api/sales-teams')
    expect(calculateSplitOverride(0, 50)).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS: calculateTeamDistribution
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateTeamDistribution', () => {
  it('applies distribution percentages to total override', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const result = calculateTeamDistribution(2000, MOCK_DISTRIBUTION as any)
    expect(result).toHaveLength(7) // all active
    const ecLine = result.find(d => d.roleKey === 'energy_consultant')
    expect(ecLine?.amount).toBe(800) // 40% of 2000
    const vpLine = result.find(d => d.roleKey === 'vp')
    expect(vpLine?.amount).toBe(60) // 3% of 2000
    const regionalLine = result.find(d => d.roleKey === 'regional')
    expect(regionalLine?.amount).toBe(180) // 9% of 2000
  })

  it('sums to total amount when distribution is 100%', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const result = calculateTeamDistribution(2000, MOCK_DISTRIBUTION as any)
    const sum = result.reduce((s, d) => s + d.amount, 0)
    expect(sum).toBe(2000)
  })

  it('handles empty distribution array', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const result = calculateTeamDistribution(2000, [])
    expect(result).toEqual([])
  })

  it('filters out inactive entries', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const withInactive = [
      { ...MOCK_DISTRIBUTION[0], active: false },
      MOCK_DISTRIBUTION[1],
    ] as any
    const result = calculateTeamDistribution(1000, withInactive)
    expect(result).toHaveLength(1)
    expect(result[0].roleKey).toBe('energy_advisor')
  })

  it('handles zero total amount', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const result = calculateTeamDistribution(0, MOCK_DISTRIBUTION as any)
    result.forEach(d => expect(d.amount).toBe(0))
  })

  it('rounds amounts to 2 decimal places', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const dist = [{ id: 'd1', role_key: 'test', label: 'Test', percentage: 33.33, sort_order: 1, active: true, org_id: null, created_at: '' }] as any
    const result = calculateTeamDistribution(100, dist)
    // 33.33% of 100 = 33.33 (should be rounded to 2 decimal places)
    expect(result[0].amount).toBe(33.33)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PAY SCALES CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe('loadPayScales', () => {
  it('loads pay scales without orgId', async () => {
    const chain = mockChain({ data: [MOCK_PAY_SCALE], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadPayScales } = await import('@/lib/api/sales-teams')

    const result = await loadPayScales()
    expect(mockSupabase.from).toHaveBeenCalledWith('pay_scales')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.order).toHaveBeenCalledWith('sort_order')
    expect(chain.or).not.toHaveBeenCalled()
    expect(result).toEqual([MOCK_PAY_SCALE])
  })

  it('loads pay scales with orgId (includes null org)', async () => {
    const chain = mockChain({ data: [MOCK_PAY_SCALE, MOCK_PAY_SCALE_2], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadPayScales } = await import('@/lib/api/sales-teams')

    const orgId = 'a0000000-0000-0000-0000-000000000001'
    const result = await loadPayScales(orgId)
    expect(chain.or).toHaveBeenCalledWith(`org_id.eq.${orgId},org_id.is.null`)
    expect(result).toHaveLength(2)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'DB error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { loadPayScales } = await import('@/lib/api/sales-teams')

    const result = await loadPayScales()
    expect(result).toEqual([])
  })
})

describe('addPayScale', () => {
  it('adds a pay scale and returns it', async () => {
    const chain = mockChain({ data: MOCK_PAY_SCALE, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { addPayScale } = await import('@/lib/api/sales-teams')

    const result = await addPayScale({ name: 'Consultant', per_watt_rate: 0.20 })
    expect(mockSupabase.from).toHaveBeenCalledWith('pay_scales')
    expect(chain.insert).toHaveBeenCalled()
    expect(result).toEqual(MOCK_PAY_SCALE)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { addPayScale } = await import('@/lib/api/sales-teams')

    const result = await addPayScale({ name: 'Test', per_watt_rate: 0.10 })
    expect(result).toBeNull()
  })
})

describe('updatePayScale', () => {
  it('returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    // update doesn't call .single(), it resolves via .then
    mockSupabase.from.mockReturnValue(chain)
    const { updatePayScale } = await import('@/lib/api/sales-teams')

    const result = await updatePayScale('ps-1', { name: 'Updated' })
    expect(chain.update).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'update error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { updatePayScale } = await import('@/lib/api/sales-teams')

    const result = await updatePayScale('ps-1', { name: 'Fail' })
    expect(result).toBe(false)
  })
})

describe('deletePayScale', () => {
  it('returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { deletePayScale } = await import('@/lib/api/sales-teams')

    const result = await deletePayScale('ps-1')
    expect(chain.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'delete error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { deletePayScale } = await import('@/lib/api/sales-teams')

    const result = await deletePayScale('ps-1')
    expect(result).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PAY DISTRIBUTION
// ══════════════════════════════════════════════════════════════════════════════

describe('loadPayDistribution', () => {
  it('loads distribution without orgId', async () => {
    const chain = mockChain({ data: MOCK_DISTRIBUTION, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadPayDistribution } = await import('@/lib/api/sales-teams')

    const result = await loadPayDistribution()
    expect(mockSupabase.from).toHaveBeenCalledWith('pay_distribution')
    expect(chain.or).not.toHaveBeenCalled()
    expect(result).toHaveLength(7)
  })

  it('loads distribution with orgId', async () => {
    const chain = mockChain({ data: MOCK_DISTRIBUTION, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadPayDistribution } = await import('@/lib/api/sales-teams')

    const orgId = 'org-123'
    await loadPayDistribution(orgId)
    expect(chain.or).toHaveBeenCalledWith(`org_id.eq.${orgId},org_id.is.null`)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { loadPayDistribution } = await import('@/lib/api/sales-teams')

    expect(await loadPayDistribution()).toEqual([])
  })
})

describe('addPayDistribution', () => {
  it('adds a distribution role and returns it', async () => {
    const chain = mockChain({ data: MOCK_DISTRIBUTION[0], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { addPayDistribution } = await import('@/lib/api/sales-teams')

    const result = await addPayDistribution({ role_key: 'test', label: 'Test', percentage: 5 })
    expect(result).toEqual(MOCK_DISTRIBUTION[0])
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { addPayDistribution } = await import('@/lib/api/sales-teams')

    expect(await addPayDistribution({ role_key: 'x', label: 'X', percentage: 1 })).toBeNull()
  })
})

describe('deletePayDistribution', () => {
  it('returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { deletePayDistribution } = await import('@/lib/api/sales-teams')

    expect(await deletePayDistribution('d1')).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { deletePayDistribution } = await import('@/lib/api/sales-teams')

    expect(await deletePayDistribution('d1')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SALES TEAMS CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe('loadSalesTeams', () => {
  it('loads teams without orgId', async () => {
    const chain = mockChain({ data: [MOCK_TEAM], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesTeams } = await import('@/lib/api/sales-teams')

    const result = await loadSalesTeams()
    expect(mockSupabase.from).toHaveBeenCalledWith('sales_teams')
    expect(chain.order).toHaveBeenCalledWith('name')
    expect(chain.or).not.toHaveBeenCalled()
    expect(result).toEqual([MOCK_TEAM])
  })

  it('loads teams with orgId', async () => {
    const chain = mockChain({ data: [MOCK_TEAM], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesTeams } = await import('@/lib/api/sales-teams')

    await loadSalesTeams('org-1')
    expect(chain.or).toHaveBeenCalledWith('org_id.eq.org-1,org_id.is.null')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesTeams } = await import('@/lib/api/sales-teams')

    expect(await loadSalesTeams()).toEqual([])
  })
})

describe('addSalesTeam', () => {
  it('adds a team and returns it', async () => {
    const chain = mockChain({ data: MOCK_TEAM, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { addSalesTeam } = await import('@/lib/api/sales-teams')

    const result = await addSalesTeam({ name: 'Alpha Team' })
    expect(chain.insert).toHaveBeenCalled()
    expect(result).toEqual(MOCK_TEAM)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { addSalesTeam } = await import('@/lib/api/sales-teams')

    expect(await addSalesTeam({ name: 'Fail' })).toBeNull()
  })
})

describe('updateSalesTeam', () => {
  it('returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateSalesTeam } = await import('@/lib/api/sales-teams')

    expect(await updateSalesTeam('team-1', { name: 'Updated' })).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { updateSalesTeam } = await import('@/lib/api/sales-teams')

    expect(await updateSalesTeam('team-1', {})).toBe(false)
  })
})

describe('deleteSalesTeam', () => {
  it('returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { deleteSalesTeam } = await import('@/lib/api/sales-teams')

    expect(await deleteSalesTeam('team-1')).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { deleteSalesTeam } = await import('@/lib/api/sales-teams')

    expect(await deleteSalesTeam('team-1')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// SALES REPS
// ══════════════════════════════════════════════════════════════════════════════

describe('loadSalesReps', () => {
  it('loads reps without filters', async () => {
    const chain = mockChain({ data: [MOCK_REP], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    const result = await loadSalesReps()
    expect(mockSupabase.from).toHaveBeenCalledWith('sales_reps')
    expect(chain.order).toHaveBeenCalledWith('last_name')
    expect(chain.limit).toHaveBeenCalledWith(500)
    expect(result).toEqual([MOCK_REP])
  })

  it('loads reps with teamId filter', async () => {
    const chain = mockChain({ data: [MOCK_REP], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    await loadSalesReps({ teamId: 'team-1' })
    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-1')
  })

  it('loads reps with status filter', async () => {
    const chain = mockChain({ data: [MOCK_REP], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    await loadSalesReps({ status: 'active' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'active')
  })

  it('loads reps with orgId filter', async () => {
    const chain = mockChain({ data: [MOCK_REP], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    await loadSalesReps({ orgId: 'org-1' })
    expect(chain.or).toHaveBeenCalledWith('org_id.eq.org-1,org_id.is.null')
  })

  it('applies client-side search filter', async () => {
    const rep2 = { ...MOCK_REP, id: 'rep-2', first_name: 'Jane', last_name: 'Smith', email: 'jane@test.com' }
    const chain = mockChain({ data: [MOCK_REP, rep2], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    const result = await loadSalesReps({ search: 'jane' })
    expect(result).toHaveLength(1)
    expect(result[0].first_name).toBe('Jane')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'error' } })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    expect(await loadSalesReps()).toEqual([])
  })
})

describe('addSalesRep', () => {
  it('adds a rep and returns it', async () => {
    const chain = mockChain({ data: MOCK_REP, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { addSalesRep } = await import('@/lib/api/sales-teams')

    const result = await addSalesRep({ first_name: 'John', last_name: 'Doe', email: 'john@test.com' })
    expect(result).toEqual(MOCK_REP)
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { addSalesRep } = await import('@/lib/api/sales-teams')

    expect(await addSalesRep({ first_name: 'X', last_name: 'Y', email: 'x@y.com' })).toBeNull()
  })
})

describe('updateSalesRep', () => {
  it('returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateSalesRep } = await import('@/lib/api/sales-teams')

    expect(await updateSalesRep('rep-1', { status: 'active' })).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { updateSalesRep } = await import('@/lib/api/sales-teams')

    expect(await updateSalesRep('rep-1', {})).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING REQUIREMENTS
// ══════════════════════════════════════════════════════════════════════════════

describe('loadOnboardingRequirements', () => {
  it('loads active requirements', async () => {
    const chain = mockChain({ data: [MOCK_REQUIREMENT], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadOnboardingRequirements } = await import('@/lib/api/sales-teams')

    const result = await loadOnboardingRequirements()
    expect(mockSupabase.from).toHaveBeenCalledWith('onboarding_requirements')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.order).toHaveBeenCalledWith('sort_order')
    expect(result).toEqual([MOCK_REQUIREMENT])
  })

  it('applies orgId filter', async () => {
    const chain = mockChain({ data: [MOCK_REQUIREMENT], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadOnboardingRequirements } = await import('@/lib/api/sales-teams')

    await loadOnboardingRequirements('org-1')
    expect(chain.or).toHaveBeenCalledWith('org_id.eq.org-1,org_id.is.null')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { loadOnboardingRequirements } = await import('@/lib/api/sales-teams')

    expect(await loadOnboardingRequirements()).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

describe('loadRepDocuments', () => {
  it('loads documents for a rep', async () => {
    const chain = mockChain({ data: [MOCK_DOCUMENT], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadRepDocuments } = await import('@/lib/api/sales-teams')

    const result = await loadRepDocuments('rep-1')
    expect(mockSupabase.from).toHaveBeenCalledWith('onboarding_documents')
    expect(chain.eq).toHaveBeenCalledWith('rep_id', 'rep-1')
    expect(chain.order).toHaveBeenCalledWith('created_at')
    expect(result).toEqual([MOCK_DOCUMENT])
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { loadRepDocuments } = await import('@/lib/api/sales-teams')

    expect(await loadRepDocuments('rep-1')).toEqual([])
  })
})

describe('updateOnboardingDocStatus', () => {
  it('sets sent_at when status is sent', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    const result = await updateOnboardingDocStatus('doc-1', 'sent')
    expect(result).toBe(true)
    expect(chain.update).toHaveBeenCalled()
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('sent')
    expect(updateArg.sent_at).toBeDefined()
    expect(typeof updateArg.sent_at).toBe('string')
  })

  it('sets viewed_at when status is viewed', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'viewed')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.viewed_at).toBeDefined()
    expect(updateArg.sent_at).toBeUndefined()
  })

  it('sets signed_at when status is signed', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'signed')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.signed_at).toBeDefined()
  })

  it('sets uploaded_at when status is uploaded', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'uploaded')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.uploaded_at).toBeDefined()
  })

  it('sets verified_at when status is verified', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'verified')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.verified_at).toBeDefined()
  })

  it('does not set any timestamp for pending status', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'pending')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('pending')
    expect(updateArg.sent_at).toBeUndefined()
    expect(updateArg.viewed_at).toBeUndefined()
    expect(updateArg.signed_at).toBeUndefined()
    expect(updateArg.uploaded_at).toBeUndefined()
    expect(updateArg.verified_at).toBeUndefined()
  })

  it('does not set any timestamp for rejected status', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'rejected')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('rejected')
    expect(updateArg.verified_at).toBeUndefined()
  })

  it('includes notes when provided', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'sent', 'Sent via email')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.notes).toBe('Sent via email')
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'err' } })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    expect(await updateOnboardingDocStatus('doc-1', 'sent')).toBe(false)
  })
})

describe('initializeRepDocuments', () => {
  it('creates pending documents for all active requirements', async () => {
    // First call: loadOnboardingRequirements (via from('onboarding_requirements'))
    const reqChain = mockChain({ data: [MOCK_REQUIREMENT, { ...MOCK_REQUIREMENT, id: 'req-2', name: 'W9' }], error: null })
    // Second call: insert into onboarding_documents
    const insertChain = mockChain({ data: null, error: null })

    let callCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++
      if (table === 'onboarding_requirements') return reqChain
      if (table === 'onboarding_documents') return insertChain
      return reqChain
    })
    const { initializeRepDocuments } = await import('@/lib/api/sales-teams')

    const result = await initializeRepDocuments('rep-1')
    expect(result).toBe(true)
    // Should have inserted 2 rows (one per requirement)
    expect(insertChain.insert).toHaveBeenCalledWith([
      { rep_id: 'rep-1', requirement_id: 'req-1', status: 'pending' },
      { rep_id: 'rep-1', requirement_id: 'req-2', status: 'pending' },
    ])
  })

  it('returns true when no requirements exist', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { initializeRepDocuments } = await import('@/lib/api/sales-teams')

    const result = await initializeRepDocuments('rep-1')
    expect(result).toBe(true)
  })

  it('returns false on insert error', async () => {
    const reqChain = mockChain({ data: [MOCK_REQUIREMENT], error: null })
    const insertChain = mockChain({ data: null, error: { message: 'insert error' } })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'onboarding_requirements') return reqChain
      return insertChain
    })
    const { initializeRepDocuments } = await import('@/lib/api/sales-teams')

    const result = await initializeRepDocuments('rep-1')
    expect(result).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASES: calculateOverride
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateOverride edge cases', () => {
  it('handles very large watt values (1,000,000 watts = 1MW)', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.40, 0.20, 1_000_000)
    expect(result.overridePerWatt).toBe(0.20)
    expect(result.totalOverride).toBe(200_000)
    expect(result.systemWatts).toBe(1_000_000)
  })

  it('handles very small rates (0.001 per watt)', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.005, 0.001, 10_000)
    expect(result.overridePerWatt).toBeCloseTo(0.004)
    expect(result.totalOverride).toBeCloseTo(40)
  })

  it('handles both rep and team at zero rate', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0, 0, 50_000)
    expect(result.overridePerWatt).toBe(0)
    expect(result.totalOverride).toBe(0)
    expect(result.teamStackRate).toBe(0)
    expect(result.repRate).toBe(0)
  })

  it('handles fractional watts (e.g., 7,523.5 watts)', async () => {
    const { calculateOverride } = await import('@/lib/api/sales-teams')
    const result = calculateOverride(0.40, 0.25, 7523.5)
    expect(result.overridePerWatt).toBeCloseTo(0.15)
    expect(result.totalOverride).toBeCloseTo(1128.525)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASES: calculateTeamDistribution
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateTeamDistribution edge cases', () => {
  it('handles distribution that sums to 99.99% (rounding edge)', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const dist = [
      { id: 'd1', role_key: 'a', label: 'A', percentage: 33.33, sort_order: 1, active: true, org_id: null, created_at: '' },
      { id: 'd2', role_key: 'b', label: 'B', percentage: 33.33, sort_order: 2, active: true, org_id: null, created_at: '' },
      { id: 'd3', role_key: 'c', label: 'C', percentage: 33.33, sort_order: 3, active: true, org_id: null, created_at: '' },
    ] as any
    const result = calculateTeamDistribution(1000, dist)
    expect(result).toHaveLength(3)
    // Each: 33.33% of 1000 = 333.30
    result.forEach(d => expect(d.amount).toBe(333.3))
    const sum = result.reduce((s, d) => s + d.amount, 0)
    // Sum = 999.90, not 1000 — caller must accept rounding loss
    expect(sum).toBeCloseTo(999.9)
    expect(sum).not.toBe(1000)
  })

  it('handles single role at 100%', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const dist = [
      { id: 'd1', role_key: 'solo', label: 'Solo Rep', percentage: 100, sort_order: 1, active: true, org_id: null, created_at: '' },
    ] as any
    const result = calculateTeamDistribution(5000, dist)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5000)
    expect(result[0].roleKey).toBe('solo')
  })

  it('handles all roles at 0%', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const dist = [
      { id: 'd1', role_key: 'a', label: 'A', percentage: 0, sort_order: 1, active: true, org_id: null, created_at: '' },
      { id: 'd2', role_key: 'b', label: 'B', percentage: 0, sort_order: 2, active: true, org_id: null, created_at: '' },
    ] as any
    const result = calculateTeamDistribution(10_000, dist)
    expect(result).toHaveLength(2)
    result.forEach(d => expect(d.amount).toBe(0))
  })

  it('handles very large total amount ($1M override)', async () => {
    const { calculateTeamDistribution } = await import('@/lib/api/sales-teams')
    const dist = [
      { id: 'd1', role_key: 'a', label: 'A', percentage: 50, sort_order: 1, active: true, org_id: null, created_at: '' },
      { id: 'd2', role_key: 'b', label: 'B', percentage: 50, sort_order: 2, active: true, org_id: null, created_at: '' },
    ] as any
    const result = calculateTeamDistribution(1_000_000, dist)
    expect(result[0].amount).toBe(500_000)
    expect(result[1].amount).toBe(500_000)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASES: loadSalesReps with all filters combined
// ══════════════════════════════════════════════════════════════════════════════

describe('loadSalesReps edge cases', () => {
  it('applies all filters combined (teamId + status + orgId + search)', async () => {
    const rep1 = { ...MOCK_REP, id: 'rep-1', first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com' }
    const rep2 = { ...MOCK_REP, id: 'rep-2', first_name: 'Bob', last_name: 'Jones', email: 'bob@test.com' }
    const chain = mockChain({ data: [rep1, rep2], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    const result = await loadSalesReps({
      teamId: 'team-1',
      status: 'active',
      orgId: 'org-1',
      search: 'alice',
    })

    // DB filters applied
    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'active')
    expect(chain.or).toHaveBeenCalledWith('org_id.eq.org-1,org_id.is.null')
    // Client-side search narrows to alice only
    expect(result).toHaveLength(1)
    expect(result[0].first_name).toBe('Alice')
  })

  it('search is case-insensitive', async () => {
    const rep = { ...MOCK_REP, first_name: 'María', last_name: 'González', email: 'maria@test.com' }
    const chain = mockChain({ data: [rep], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    const result = await loadSalesReps({ search: 'MARÍA' })
    expect(result).toHaveLength(1)
  })

  it('search matches email', async () => {
    const chain = mockChain({ data: [MOCK_REP], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    const result = await loadSalesReps({ search: 'john@test' })
    expect(result).toHaveLength(1)
  })

  it('search with no matches returns empty array', async () => {
    const chain = mockChain({ data: [MOCK_REP], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { loadSalesReps } = await import('@/lib/api/sales-teams')

    const result = await loadSalesReps({ search: 'zzz_no_match' })
    expect(result).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASES: updateOnboardingDocStatus timestamp behavior
// ══════════════════════════════════════════════════════════════════════════════

describe('updateOnboardingDocStatus edge cases', () => {
  it('rejected status does NOT set any lifecycle timestamp', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'rejected')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('rejected')
    // No timestamp fields should be present
    expect(updateArg.sent_at).toBeUndefined()
    expect(updateArg.viewed_at).toBeUndefined()
    expect(updateArg.signed_at).toBeUndefined()
    expect(updateArg.uploaded_at).toBeUndefined()
    expect(updateArg.verified_at).toBeUndefined()
  })

  it('pending status does NOT set any lifecycle timestamp (reset scenario)', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'pending')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('pending')
    expect(updateArg.sent_at).toBeUndefined()
    expect(updateArg.viewed_at).toBeUndefined()
    expect(updateArg.signed_at).toBeUndefined()
    expect(updateArg.uploaded_at).toBeUndefined()
    expect(updateArg.verified_at).toBeUndefined()
  })

  it('rejected with notes includes the notes but no timestamps', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { updateOnboardingDocStatus } = await import('@/lib/api/sales-teams')

    await updateOnboardingDocStatus('doc-1', 'rejected', 'Missing signature on page 2')
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg.notes).toBe('Missing signature on page 2')
    expect(updateArg.verified_at).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASES: addSalesRep with minimal fields
// ══════════════════════════════════════════════════════════════════════════════

describe('addSalesRep edge cases', () => {
  it('adds a rep with minimal required fields only', async () => {
    const minimalRep = {
      id: 'rep-min', user_id: null, auth_user_id: null,
      first_name: 'Min', last_name: 'Rep', email: 'min@test.com', phone: null,
      team_id: null, pay_scale_id: null, role_key: 'energy_consultant',
      hire_date: null, status: 'onboarding' as const, split_percentage: 100,
      split_partner_id: null, notes: null, org_id: null,
      created_at: '2026-03-28', updated_at: '2026-03-28',
    }
    const chain = mockChain({ data: minimalRep, error: null })
    mockSupabase.from.mockReturnValue(chain)
    const { addSalesRep } = await import('@/lib/api/sales-teams')

    const result = await addSalesRep({
      first_name: 'Min',
      last_name: 'Rep',
      email: 'min@test.com',
      role_key: 'energy_consultant',
    })

    expect(result).not.toBeNull()
    expect(result?.first_name).toBe('Min')
    expect(result?.last_name).toBe('Rep')
    expect(result?.email).toBe('min@test.com')
    expect(result?.role_key).toBe('energy_consultant')
    // Verify insert was called with only the provided fields
    const insertArg = chain.insert.mock.calls[0][0]
    expect(insertArg.first_name).toBe('Min')
    expect(insertArg.last_name).toBe('Rep')
    expect(insertArg.email).toBe('min@test.com')
    expect(insertArg.role_key).toBe('energy_consultant')
    // Optional fields should not be present (not explicitly passed)
    expect(insertArg.phone).toBeUndefined()
    expect(insertArg.team_id).toBeUndefined()
    expect(insertArg.pay_scale_id).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// EDGE CASES: initializeRepDocuments when requirements query returns error
// ══════════════════════════════════════════════════════════════════════════════

describe('initializeRepDocuments edge cases', () => {
  it('returns true when requirements query returns error (empty fallback)', async () => {
    // When loadOnboardingRequirements errors, it returns [] (empty array)
    // So initializeRepDocuments should see 0 requirements and return true
    const reqChain = mockChain({ data: null, error: { message: 'DB connection lost' } })
    mockSupabase.from.mockReturnValue(reqChain)
    const { initializeRepDocuments } = await import('@/lib/api/sales-teams')

    const result = await initializeRepDocuments('rep-1')
    // loadOnboardingRequirements returns [] on error, so no insert is attempted
    expect(result).toBe(true)
  })

  it('passes orgId through to requirements query', async () => {
    const reqChain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(reqChain)
    const { initializeRepDocuments } = await import('@/lib/api/sales-teams')

    await initializeRepDocuments('rep-1', 'org-abc')
    // The requirements query should have applied the orgId filter
    expect(reqChain.or).toHaveBeenCalledWith('org_id.eq.org-abc,org_id.is.null')
  })
})
