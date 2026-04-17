import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

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
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

const mockDb = {
  from: vi.fn((_table: string) => mockChain({ data: null, error: null })),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockDb),
}))

vi.mock('@/lib/tasks', () => ({
  TASKS: {
    evaluation: [
      { id: 'welcome_call', pre: [] },
      { id: 'site_audit', pre: ['welcome_call'] },
    ],
    survey: [
      { id: 'schedule_survey', pre: [] },
    ],
  },
}))

vi.mock('@/lib/api/edge-sync', () => ({
  syncProjectToEdge: vi.fn(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  originalEnv = { ...process.env }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SECRET_KEY = 'test-service-key'
  process.env.SUBHUB_WEBHOOK_SECRET = 'webhook-secret-123'
  process.env.SUBHUB_WEBHOOK_ENABLED = 'true'
})

afterEach(() => {
  process.env = originalEnv
  vi.unstubAllGlobals()
})

function makeRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request('https://localhost/api/webhooks/subhub', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// ── GET Health Check ────────────────────────────────────────────────────────

describe('GET /api/webhooks/subhub', () => {
  it('returns enabled status when webhook is enabled', async () => {
    const { GET } = await import('@/app/api/webhooks/subhub/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('enabled')
  })

  it('returns disabled status when webhook is disabled', async () => {
    delete process.env.SUBHUB_WEBHOOK_ENABLED
    const { GET } = await import('@/app/api/webhooks/subhub/route')
    const res = await GET()
    const json = await res.json()
    expect(json.status).toBe('disabled')
  })
})

// ── Webhook Enabled Check ───────────────────────────────────────────────────

describe('POST /api/webhooks/subhub — enabled check', () => {
  it('returns 503 when webhook is disabled', async () => {
    delete process.env.SUBHUB_WEBHOOK_ENABLED
    const req = makeRequest(
      { name: 'Test', street: '123 Main St' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toContain('disabled')
  })

  it('returns 503 when enabled but SUBHUB_WEBHOOK_SECRET is unset (R2 fail-closed)', async () => {
    process.env.SUBHUB_WEBHOOK_ENABLED = 'true'
    delete process.env.SUBHUB_WEBHOOK_SECRET
    const req = makeRequest({ name: 'Test', street: '123 Main St' }, {})
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toContain('not configured')
  })
})

// ── Auth / Secret Verification ──────────────────────────────────────────────

describe('POST /api/webhooks/subhub — auth', () => {
  it('returns 401 when webhook secret is wrong', async () => {
    const req = makeRequest(
      { name: 'Test', street: '123 Main St' },
      { Authorization: 'Bearer wrong-secret' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 401 when no auth header provided', async () => {
    const req = makeRequest({ name: 'Test', street: '123 Main St' })
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('accepts x-webhook-secret header', async () => {
    // Setup DB mocks for project creation path
    let callCount = 0
    mockDb.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Duplicate check
        return mockChain({ data: [], error: null })
      }
      if (callCount === 2) {
        // getNextProjectId
        return mockChain({ data: [{ id: 'PROJ-30100' }], error: null })
      }
      return mockChain({ data: null, error: null })
    })

    const req = makeRequest(
      { name: 'John Doe', street: '123 Main St' },
      { 'x-webhook-secret': 'webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    // Should not be 401, should proceed to creation
    expect(res.status).not.toBe(401)
  })

  it('uses timing-safe comparison for secret validation', async () => {
    // Verify that different-length secrets don't crash (timingSafeEqual would throw)
    const req = makeRequest(
      { name: 'Test', street: '123 Main St' },
      { Authorization: 'Bearer short' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })
})

// ── Validation ──────────────────────────────────────────────────────────────

describe('POST /api/webhooks/subhub — validation', () => {
  it('returns 400 when name is missing', async () => {
    const req = makeRequest(
      { street: '123 Main St' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('name')
  })

  it('returns 400 when address/street is missing', async () => {
    const req = makeRequest(
      { name: 'John Doe' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('address')
  })

  it('builds name from first_name + last_name when name is not provided', async () => {
    let callCount = 0
    mockDb.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return mockChain({ data: [], error: null })
      }
      if (callCount === 2) {
        return mockChain({ data: [{ id: 'PROJ-30050' }], error: null })
      }
      return mockChain({ data: null, error: null })
    })

    const req = makeRequest(
      { first_name: 'Jane', last_name: 'Smith', street: '456 Oak Ave' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.name).toBe('Jane Smith')
  })
})

// ── Duplicate Detection ─────────────────────────────────────────────────────

describe('POST /api/webhooks/subhub — duplicate detection', () => {
  it('returns existing project when duplicate is found', async () => {
    const dupChain = mockChain({ data: [{ id: 'PROJ-30001' }], error: null })
    mockDb.from.mockReturnValue(dupChain)

    const req = makeRequest(
      { name: 'John Doe', street: '123 Main St' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(json.project_id).toBe('PROJ-30001')
  })
})

// ── Project Creation ────────────────────────────────────────────────────────

describe('POST /api/webhooks/subhub — project creation', () => {
  it('creates project with all SubHub fields mapped', async () => {
    let callCount = 0
    mockDb.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Duplicate check - no existing
        return mockChain({ data: [], error: null })
      }
      if (callCount === 2) {
        // getNextProjectId
        return mockChain({ data: [{ id: 'PROJ-30100' }], error: null })
      }
      // All inserts succeed
      return mockChain({ data: null, error: null })
    })

    const payload = {
      subhub_id: 'SH-999',
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      phone: '555-1234',
      street: '100 Future Way',
      city: 'Dallas',
      state: 'TX',
      postal_code: '75001',
      contract_signed_date: '2026-04-01',
      contract_amount: 45000,
      system_size_kw: 12.5,
      finance_partner: 'GoodLeap',
      module_name: 'Duracell 400W',
      module_total_panels: 30,
      battery_name: 'Duracell 80kWh',
      battery_quantity: 1,
    }

    const req = makeRequest(payload, { Authorization: 'Bearer webhook-secret-123' })
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.project_id).toBe('PROJ-30101')
    expect(json.name).toBe('Sarah Connor')

    // Verify project was inserted
    expect(mockDb.from).toHaveBeenCalledWith('projects')
    // Verify task_state was inserted
    expect(mockDb.from).toHaveBeenCalledWith('task_state')
    // Verify stage_history was inserted
    expect(mockDb.from).toHaveBeenCalledWith('stage_history')
    // Verify funding record was inserted
    expect(mockDb.from).toHaveBeenCalledWith('project_funding')
  })

  it('returns 500 when project insert fails', async () => {
    let callCount = 0
    mockDb.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) return mockChain({ data: [], error: null })
      if (callCount === 2) return mockChain({ data: [{ id: 'PROJ-30000' }], error: null })
      if (callCount === 3) {
        // project insert fails
        return mockChain({ data: null, error: { message: 'Unique constraint violation' } })
      }
      return mockChain({ data: null, error: null })
    })

    const req = makeRequest(
      { name: 'Fail Test', street: '789 Error Blvd' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Failed to create project')
  })

  it('imports adders when present in payload', async () => {
    let callCount = 0
    const insertedTables: string[] = []
    mockDb.from.mockImplementation((table: string) => {
      callCount++
      insertedTables.push(table)
      if (callCount === 1) return mockChain({ data: [], error: null })
      if (callCount === 2) return mockChain({ data: [{ id: 'PROJ-30200' }], error: null })
      return mockChain({ data: null, error: null })
    })

    const req = makeRequest(
      {
        name: 'Adder Test',
        street: '123 Solar Ln',
        adders: [
          { name: 'Critter Guard', unit_price: 500, cost_total: 500, qty: 1 },
          { name: 'Trench', unit_price: 25, cost_total: 250, qty: 10 },
        ],
      },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    expect(insertedTables).toContain('project_adders')
  })

  it('creates Google Drive folder when DRIVE_WEBHOOK_URL is set', async () => {
    process.env.NEXT_PUBLIC_DRIVE_WEBHOOK_URL = 'https://drive.example.com/webhook'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ folder_url: 'https://drive.google.com/folder/123' })),
    })
    vi.stubGlobal('fetch', mockFetch)

    let callCount = 0
    mockDb.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) return mockChain({ data: [], error: null })
      if (callCount === 2) return mockChain({ data: [{ id: 'PROJ-30300' }], error: null })
      return mockChain({ data: null, error: null })
    })

    const req = makeRequest(
      { name: 'Drive Test', street: '111 Cloud St' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://drive.example.com/webhook',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('generates sequential project IDs', async () => {
    let callCount = 0
    mockDb.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) return mockChain({ data: [], error: null })
      if (callCount === 2) {
        // Last project ID
        return mockChain({ data: [{ id: 'PROJ-30500' }], error: null })
      }
      return mockChain({ data: null, error: null })
    })

    const req = makeRequest(
      { name: 'ID Test', street: '999 Sequence Ave' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    const json = await res.json()
    expect(json.project_id).toBe('PROJ-30501')
  })
})

// ── Error Handling ──────────────────────────────────────────────────────────

describe('POST /api/webhooks/subhub — error handling', () => {
  it('returns 500 on unexpected error', async () => {
    mockDb.from.mockImplementation(() => {
      throw new Error('Unexpected crash')
    })

    const req = makeRequest(
      { name: 'Crash Test', street: '000 Error Ln' },
      { Authorization: 'Bearer webhook-secret-123' }
    )
    const { POST } = await import('@/app/api/webhooks/subhub/route')
    const res = await POST(req as any)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Internal server error')
  })
})
