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
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

const VENDOR_A = {
  id: 'v1',
  name: 'Acme Solar',
  contact_name: 'John Doe',
  contact_email: 'john@acme.com',
  contact_phone: '555-0001',
  website: 'https://acme.com',
  address: '123 Main St',
  city: 'Houston',
  state: 'TX',
  zip: '77001',
  category: 'manufacturer',
  equipment_types: ['modules', 'inverters'],
  lead_time_days: 14,
  payment_terms: 'Net 30',
  notes: 'Preferred vendor',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
}

const VENDOR_B = {
  id: 'v2',
  name: 'Beta Electric',
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  website: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  category: 'subcontractor',
  equipment_types: null,
  lead_time_days: null,
  payment_terms: null,
  notes: null,
  active: false,
  created_at: '2026-02-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── loadVendors ──────────────────────────────────────────────────────────────

describe('loadVendors', () => {
  it('loads all vendors ordered by name', async () => {
    const chain = mockChain({ data: [VENDOR_A, VENDOR_B], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadVendors } = await import('@/lib/api/vendors')
    const result = await loadVendors()

    expect(mockSupabase.from).toHaveBeenCalledWith('vendors')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('name')
    expect(chain.eq).not.toHaveBeenCalled()
    expect(result).toEqual([VENDOR_A, VENDOR_B])
  })

  it('filters to active only when activeOnly=true', async () => {
    const chain = mockChain({ data: [VENDOR_A], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadVendors } = await import('@/lib/api/vendors')
    const result = await loadVendors(true)

    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(result).toEqual([VENDOR_A])
  })

  it('returns empty array and logs on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'db down' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadVendors } = await import('@/lib/api/vendors')
    const result = await loadVendors()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('[loadVendors]', 'db down')
    consoleSpy.mockRestore()
  })
})

// ── searchVendors ────────────────────────────────────────────────────────────

describe('searchVendors', () => {
  it('returns empty array for empty query without querying', async () => {
    const { searchVendors } = await import('@/lib/api/vendors')
    const result = await searchVendors('')

    expect(result).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('returns empty array for whitespace-only query', async () => {
    const { searchVendors } = await import('@/lib/api/vendors')
    const result = await searchVendors('   ')

    expect(result).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('searches active vendors by name with ilike and limit', async () => {
    const chain = mockChain({ data: [VENDOR_A], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchVendors } = await import('@/lib/api/vendors')
    const result = await searchVendors('acme')

    expect(mockSupabase.from).toHaveBeenCalledWith('vendors')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.ilike).toHaveBeenCalledWith('name', '%acme%')
    expect(chain.order).toHaveBeenCalledWith('name')
    expect(chain.limit).toHaveBeenCalledWith(20)
    expect(result).toEqual([VENDOR_A])
  })

  it('escapes special ilike characters in query', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchVendors } = await import('@/lib/api/vendors')
    await searchVendors('100%_match')

    // escapeIlike converts % -> \% and _ -> \_
    expect(chain.ilike).toHaveBeenCalledWith('name', '%100\\%\\_match%')
  })

  it('returns empty array and logs on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'search failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { searchVendors } = await import('@/lib/api/vendors')
    const result = await searchVendors('test')

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('[searchVendors]', 'search failed')
    consoleSpy.mockRestore()
  })
})

// ── loadVendor ───────────────────────────────────────────────────────────────

describe('loadVendor', () => {
  it('loads a single vendor by ID', async () => {
    const chain = mockChain({ data: VENDOR_A, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadVendor } = await import('@/lib/api/vendors')
    const result = await loadVendor('v1')

    expect(mockSupabase.from).toHaveBeenCalledWith('vendors')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('id', 'v1')
    expect(chain.single).toHaveBeenCalled()
    expect(result).toEqual(VENDOR_A)
  })

  it('returns null when vendor not found', async () => {
    const chain = mockChain({ data: null, error: { message: 'not found' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadVendor } = await import('@/lib/api/vendors')
    const result = await loadVendor('nonexistent')

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith('[loadVendor]', 'not found')
    consoleSpy.mockRestore()
  })

  it('returns null and logs on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'db error' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadVendor } = await import('@/lib/api/vendors')
    const result = await loadVendor('v1')

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith('[loadVendor]', 'db error')
    consoleSpy.mockRestore()
  })
})

// ── addVendor ────────────────────────────────────────────────────────────────

describe('addVendor', () => {
  const newVendor = {
    name: 'New Vendor',
    contact_name: 'Jane',
    contact_email: 'jane@new.com',
    contact_phone: '555-9999',
    website: null,
    address: null,
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    category: 'distributor' as const,
    equipment_types: ['batteries'],
    lead_time_days: 7,
    payment_terms: 'Net 15',
    notes: null,
    active: true,
  }

  it('inserts vendor and returns created record', async () => {
    const created = { ...newVendor, id: 'v3', created_at: '2026-03-25T00:00:00Z' }
    const chain = mockChain({ data: created, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { addVendor } = await import('@/lib/api/vendors')
    const result = await addVendor(newVendor)

    expect(mockSupabase.from).toHaveBeenCalledWith('vendors')
    expect(chain.insert).toHaveBeenCalledWith(newVendor)
    expect(chain.select).toHaveBeenCalled()
    expect(chain.single).toHaveBeenCalled()
    expect(result).toEqual(created)
  })

  it('returns null and logs on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { addVendor } = await import('@/lib/api/vendors')
    const result = await addVendor(newVendor)

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith('[addVendor]', 'insert failed')
    consoleSpy.mockRestore()
  })
})

// ── updateVendor ─────────────────────────────────────────────────────────────

describe('updateVendor', () => {
  it('updates vendor and returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { updateVendor } = await import('@/lib/api/vendors')
    const result = await updateVendor('v1', { name: 'Updated Name', lead_time_days: 21 })

    expect(mockSupabase.from).toHaveBeenCalledWith('vendors')
    expect(chain.update).toHaveBeenCalledWith({ name: 'Updated Name', lead_time_days: 21 })
    expect(chain.eq).toHaveBeenCalledWith('id', 'v1')
    expect(result).toBe(true)
  })

  it('returns false and logs on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'update failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { updateVendor } = await import('@/lib/api/vendors')
    const result = await updateVendor('v1', { name: 'Fail' })

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('[updateVendor]', 'update failed')
    consoleSpy.mockRestore()
  })
})

// ── deleteVendor ─────────────────────────────────────────────────────────────

describe('deleteVendor', () => {
  it('deletes vendor and returns true on success', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { deleteVendor } = await import('@/lib/api/vendors')
    const result = await deleteVendor('v1')

    expect(mockSupabase.from).toHaveBeenCalledWith('vendors')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'v1')
    expect(result).toBe(true)
  })

  it('returns false and logs on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'delete failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deleteVendor } = await import('@/lib/api/vendors')
    const result = await deleteVendor('v1')

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('[deleteVendor]', 'delete failed')
    consoleSpy.mockRestore()
  })
})
