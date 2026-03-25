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

// ── loadChangeOrders ────────────────────────────────────────────────────────

describe('loadChangeOrders', () => {
  it('orders by created_at desc and includes project join', async () => {
    const orders = [
      { id: '1', title: 'Panel swap', project: { name: 'Alpha', city: 'Houston', pm: 'Jane', pm_id: 'u1' } },
    ]
    const chain = mockChain({ data: orders, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadChangeOrders } = await import('@/lib/api/change-orders')
    const result = await loadChangeOrders()

    expect(mockSupabase.from).toHaveBeenCalledWith('change_orders')
    expect(chain.select).toHaveBeenCalledWith('*, project:projects(name, city, pm, pm_id)')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(2000)
    expect(result.data).toEqual(orders)
    expect(result.error).toBeNull()
  })

  it('respects custom limit parameter', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadChangeOrders } = await import('@/lib/api/change-orders')
    await loadChangeOrders(500)

    expect(chain.limit).toHaveBeenCalledWith(500)
  })

  it('defaults limit to 2000', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadChangeOrders } = await import('@/lib/api/change-orders')
    await loadChangeOrders()

    expect(chain.limit).toHaveBeenCalledWith(2000)
  })

  it('returns empty array on error and logs to console', async () => {
    const chain = mockChain({ data: null, error: { message: 'change order error' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadChangeOrders } = await import('@/lib/api/change-orders')
    const result = await loadChangeOrders()

    expect(result.data).toEqual([])
    expect(result.error).toEqual({ message: 'change order error' })
    expect(consoleSpy).toHaveBeenCalledWith('change_orders load failed:', { message: 'change order error' })
    consoleSpy.mockRestore()
  })

  it('returns multiple change orders in order', async () => {
    const orders = [
      { id: '3', title: 'Inverter change', created_at: '2026-03-25T10:00:00Z' },
      { id: '2', title: 'Panel swap', created_at: '2026-03-20T10:00:00Z' },
      { id: '1', title: 'Layout update', created_at: '2026-03-15T10:00:00Z' },
    ]
    const chain = mockChain({ data: orders, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadChangeOrders } = await import('@/lib/api/change-orders')
    const result = await loadChangeOrders()

    expect(result.data).toHaveLength(3)
    expect(result.data[0].title).toBe('Inverter change')
  })

  it('includes all project join fields', async () => {
    const orders = [
      { id: '1', title: 'Test', project: { name: 'Proj', city: 'Austin', pm: 'John', pm_id: 'u2' } },
    ]
    const chain = mockChain({ data: orders, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadChangeOrders } = await import('@/lib/api/change-orders')
    const result = await loadChangeOrders()

    const project = result.data[0].project
    expect(project).toHaveProperty('name')
    expect(project).toHaveProperty('city')
    expect(project).toHaveProperty('pm')
    expect(project).toHaveProperty('pm_id')
  })
})
