import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    in: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── loadCrewsByIds ──────────────────────────────────────────────────────────

describe('loadCrewsByIds', () => {
  it('returns empty array for empty input without querying', async () => {
    const { loadCrewsByIds } = await import('@/lib/api/crews')
    const result = await loadCrewsByIds([])

    expect(result).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('filters crews by IDs and selects id+name', async () => {
    const crews = [
      { id: 'c1', name: 'Crew Alpha' },
      { id: 'c2', name: 'Crew Beta' },
    ]
    const chain = mockChain({ data: crews, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadCrewsByIds } = await import('@/lib/api/crews')
    const result = await loadCrewsByIds(['c1', 'c2'])

    expect(mockSupabase.from).toHaveBeenCalledWith('crews')
    expect(chain.select).toHaveBeenCalledWith('id, name')
    expect(chain.in).toHaveBeenCalledWith('id', ['c1', 'c2'])
    expect(result).toEqual(crews)
  })

  it('returns single crew for single ID', async () => {
    const crews = [{ id: 'c1', name: 'Solo Crew' }]
    const chain = mockChain({ data: crews, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadCrewsByIds } = await import('@/lib/api/crews')
    const result = await loadCrewsByIds(['c1'])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Solo Crew')
  })

  it('returns empty array on error and logs to console', async () => {
    const chain = mockChain({ data: null, error: { message: 'crews error' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadCrewsByIds } = await import('@/lib/api/crews')
    const result = await loadCrewsByIds(['c1'])

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('crews batch load failed:', { message: 'crews error' })
    consoleSpy.mockRestore()
  })
})

// ── loadActiveCrews ─────────────────────────────────────────────────────────

describe('loadActiveCrews', () => {
  it('filters on active=TRUE string and orders by name', async () => {
    const crews = [
      { id: 'c1', name: 'Alpha Crew', active: 'TRUE' },
      { id: 'c2', name: 'Beta Crew', active: 'TRUE' },
    ]
    const chain = mockChain({ data: crews, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadActiveCrews } = await import('@/lib/api/crews')
    const result = await loadActiveCrews()

    expect(mockSupabase.from).toHaveBeenCalledWith('crews')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('active', 'TRUE')
    expect(chain.order).toHaveBeenCalledWith('name')
    expect(result.data).toEqual(crews)
    expect(result.error).toBeNull()
  })

  it('returns empty array on error and logs to console', async () => {
    const chain = mockChain({ data: null, error: { message: 'crews error' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadActiveCrews } = await import('@/lib/api/crews')
    const result = await loadActiveCrews()

    expect(result.data).toEqual([])
    expect(result.error).toEqual({ message: 'crews error' })
    expect(consoleSpy).toHaveBeenCalledWith('active crews load failed:', { message: 'crews error' })
    consoleSpy.mockRestore()
  })

  it('returns all fields with select(*)', async () => {
    const crews = [
      { id: 'c1', name: 'Alpha Crew', active: 'TRUE', phone: '555-0001', email: 'alpha@test.com' },
    ]
    const chain = mockChain({ data: crews, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadActiveCrews } = await import('@/lib/api/crews')
    const result = await loadActiveCrews()

    expect(result.data[0]).toHaveProperty('phone')
    expect(result.data[0]).toHaveProperty('email')
  })
})
