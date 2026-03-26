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

// ── loadScheduleByDateRange ─────────────────────────────────────────────────

describe('loadScheduleByDateRange', () => {
  it('filters by date range and includes project join', async () => {
    const scheduleData = [
      { id: '1', date: '2026-03-20', project: { name: 'Alpha', city: 'Houston' } },
    ]
    const chain = mockChain({ data: scheduleData, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadScheduleByDateRange } = await import('@/lib/api/schedules')
    const result = await loadScheduleByDateRange('2026-03-01', '2026-03-31')

    expect(mockSupabase.from).toHaveBeenCalledWith('schedule')
    expect(chain.select).toHaveBeenCalledWith('*, project:projects(name, city)')
    expect(chain.lte).toHaveBeenCalledWith('date', '2026-03-31')
    expect(chain.or).toHaveBeenCalledWith('end_date.gte.2026-03-01,and(end_date.is.null,date.gte.2026-03-01)')
    expect(result.data).toEqual(scheduleData)
    expect(result.error).toBeNull()
  })

  it('returns empty array when no data matches date range', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadScheduleByDateRange } = await import('@/lib/api/schedules')
    const result = await loadScheduleByDateRange('2020-01-01', '2020-01-31')

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns empty array on error and logs to console', async () => {
    const chain = mockChain({ data: null, error: { message: 'schedule error' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadScheduleByDateRange } = await import('@/lib/api/schedules')
    const result = await loadScheduleByDateRange('2026-03-01', '2026-03-31')

    expect(result.data).toEqual([])
    expect(result.error).toEqual({ message: 'schedule error' })
    expect(consoleSpy).toHaveBeenCalledWith('schedule load failed:', { message: 'schedule error' })
    consoleSpy.mockRestore()
  })

  it('handles multiple schedule entries with different dates', async () => {
    const scheduleData = [
      { id: '1', date: '2026-03-15', job_type: 'install', project: { name: 'Alpha', city: 'Houston' } },
      { id: '2', date: '2026-03-20', job_type: 'survey', project: { name: 'Beta', city: 'Dallas' } },
      { id: '3', date: '2026-03-25', job_type: 'inspection', project: { name: 'Gamma', city: 'Austin' } },
    ]
    const chain = mockChain({ data: scheduleData, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadScheduleByDateRange } = await import('@/lib/api/schedules')
    const result = await loadScheduleByDateRange('2026-03-01', '2026-03-31')

    expect(result.data).toHaveLength(3)
    expect(result.data[0].project.name).toBe('Alpha')
    expect(result.data[2].project.name).toBe('Gamma')
  })

  it('returns null error on success', async () => {
    const chain = mockChain({ data: [{ id: '1' }], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadScheduleByDateRange } = await import('@/lib/api/schedules')
    const result = await loadScheduleByDateRange('2026-03-01', '2026-03-31')

    expect(result.error).toBeNull()
  })
})
