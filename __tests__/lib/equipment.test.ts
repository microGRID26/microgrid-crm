import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

// ── stripRawPrice ───────────────────────────────────────────────────────────

describe('stripRawPrice', () => {
  it('preserves raw_price for supply org type', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    const items = [
      { id: '1', raw_price: 150.00, sell_price: 200.00 },
      { id: '2', raw_price: 75.50, sell_price: 100.00 },
    ]
    const result = stripRawPrice(items, 'supply')
    expect(result[0].raw_price).toBe(150.00)
    expect(result[1].raw_price).toBe(75.50)
  })

  it('strips raw_price for non-supply org types', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    const items = [
      { id: '1', raw_price: 150.00, sell_price: 200.00 },
      { id: '2', raw_price: 75.50, sell_price: 100.00 },
    ]
    const result = stripRawPrice(items, 'epc')
    expect(result[0].raw_price).toBeNull()
    expect(result[1].raw_price).toBeNull()
    // sell_price should be preserved
    expect(result[0].sell_price).toBe(200.00)
  })

  it('strips raw_price when orgType is null', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    const items = [{ id: '1', raw_price: 100 }]
    const result = stripRawPrice(items, null)
    expect(result[0].raw_price).toBeNull()
  })

  it('strips raw_price when orgType is undefined', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    const items = [{ id: '1', raw_price: 100 }]
    const result = stripRawPrice(items)
    expect(result[0].raw_price).toBeNull()
  })

  it('handles empty array', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    expect(stripRawPrice([], 'epc')).toEqual([])
  })

  it('handles items with null raw_price', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    const items = [{ id: '1', raw_price: null }]
    const result = stripRawPrice(items, 'epc')
    expect(result[0].raw_price).toBeNull()
  })

  it('strips for platform org type', async () => {
    const { stripRawPrice } = await import('@/lib/api/equipment')
    const items = [{ id: '1', raw_price: 100 }]
    const result = stripRawPrice(items, 'platform')
    expect(result[0].raw_price).toBeNull()
  })
})

// ── EQUIPMENT_CATEGORIES ────────────────────────────────────────────────────

describe('EQUIPMENT_CATEGORIES', () => {
  it('has 8 categories', async () => {
    const { EQUIPMENT_CATEGORIES } = await import('@/lib/api/equipment')
    expect(EQUIPMENT_CATEGORIES).toHaveLength(8)
  })

  it('includes all expected categories', async () => {
    const { EQUIPMENT_CATEGORIES } = await import('@/lib/api/equipment')
    const values = EQUIPMENT_CATEGORIES.map(c => c.value)
    expect(values).toContain('module')
    expect(values).toContain('inverter')
    expect(values).toContain('battery')
    expect(values).toContain('optimizer')
    expect(values).toContain('racking')
    expect(values).toContain('electrical')
    expect(values).toContain('adder')
    expect(values).toContain('other')
  })

  it('each category has a value and label', async () => {
    const { EQUIPMENT_CATEGORIES } = await import('@/lib/api/equipment')
    for (const cat of EQUIPMENT_CATEGORIES) {
      expect(cat.value).toBeTruthy()
      expect(cat.label).toBeTruthy()
    }
  })
})

// ── loadEquipment ───────────────────────────────────────────────────────────

describe('loadEquipment', () => {
  it('loads active equipment', async () => {
    const equipment = [
      { id: 'e1', name: 'Q.PEAK 400W', category: 'module', active: true, raw_price: 50 },
    ]
    const chain = mockChain({ data: equipment, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadEquipment } = await import('@/lib/api/equipment')
    const result = await loadEquipment()

    expect(mockSupabase.from).toHaveBeenCalledWith('equipment')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.limit).toHaveBeenCalledWith(5000)
    // raw_price stripped for non-supply
    expect(result[0].raw_price).toBeNull()
  })

  it('filters by category when provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadEquipment } = await import('@/lib/api/equipment')
    await loadEquipment('inverter')

    expect(chain.eq).toHaveBeenCalledWith('category', 'inverter')
  })

  it('preserves raw_price for supply org', async () => {
    const equipment = [{ id: 'e1', name: 'Panel', raw_price: 50 }]
    const chain = mockChain({ data: equipment, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadEquipment } = await import('@/lib/api/equipment')
    const result = await loadEquipment(undefined, 'supply')
    expect(result[0].raw_price).toBe(50)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadEquipment } = await import('@/lib/api/equipment')
    const result = await loadEquipment()
    expect(result).toEqual([])
  })
})

// ── searchEquipment ─────────────────────────────────────────────────────────

describe('searchEquipment', () => {
  it('searches by name/manufacturer/description with escaping', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchEquipment } = await import('@/lib/api/equipment')
    await searchEquipment('Q.PEAK')

    expect(chain.or).toHaveBeenCalledWith(
      'name.ilike.%Q.PEAK%,manufacturer.ilike.%Q.PEAK%,description.ilike.%Q.PEAK%'
    )
    expect(chain.limit).toHaveBeenCalledWith(20)
  })

  it('escapes special characters in search query', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchEquipment } = await import('@/lib/api/equipment')
    await searchEquipment('100%')

    expect(chain.or).toHaveBeenCalledWith(
      'name.ilike.%100\\%%,manufacturer.ilike.%100\\%%,description.ilike.%100\\%%'
    )
  })

  it('filters by category when provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchEquipment } = await import('@/lib/api/equipment')
    await searchEquipment('test', 'battery')

    expect(chain.eq).toHaveBeenCalledWith('category', 'battery')
  })

  it('strips raw_price for non-supply', async () => {
    const items = [{ id: 'e1', name: 'Panel', raw_price: 100, sell_price: 150 }]
    const chain = mockChain({ data: items, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchEquipment } = await import('@/lib/api/equipment')
    const result = await searchEquipment('Panel', undefined, 'epc')
    expect(result[0].raw_price).toBeNull()
    expect(result[0].sell_price).toBe(150)
  })
})

// ── loadAllEquipment ────────────────────────────────────────────────────────

describe('loadAllEquipment', () => {
  it('loads all equipment including inactive', async () => {
    const chain = mockChain({ data: [{ id: 'e1', active: false }], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadAllEquipment } = await import('@/lib/api/equipment')
    const result = await loadAllEquipment()

    // Should NOT filter by active (admin view)
    expect(chain.eq).not.toHaveBeenCalledWith('active', true)
    expect(chain.limit).toHaveBeenCalledWith(5000)
    expect(result).toHaveLength(1)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadAllEquipment } = await import('@/lib/api/equipment')
    const result = await loadAllEquipment()
    expect(result).toEqual([])
  })
})
