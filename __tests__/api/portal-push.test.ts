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
  from: vi.fn(() => mockChain({ data: null, error: null })),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockDb),
}))

// Mock @supabase/ssr for session-based auth fallback
const mockAuthUser = { id: 'user-1', email: 'test@gomicrogridenergy.com' }
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: mockAuthUser }, error: null })),
    },
  })),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  originalEnv = { ...process.env }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SUPABASE_SECRET_KEY = 'test-service-key'
  process.env.CRON_SECRET = 'test-cron-secret'
})

afterEach(() => {
  process.env = originalEnv
  vi.unstubAllGlobals()
})

function makeRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request('https://localhost/api/portal/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/portal/push — auth', () => {
  it('returns 401 when no auth provided and session invalid', async () => {
    delete process.env.CRON_SECRET
    delete process.env.ADMIN_API_SECRET

    // Override the SSR mock to return no user
    const { createServerClient } = await import('@supabase/ssr')
    ;(createServerClient as any).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      },
    })

    const req = makeRequest({ projectId: 'PROJ-1', title: 'Test', body: 'Hello' })
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when session user has no role row (R1 audit gate)', async () => {
    // Exercises the internal-role gate added in R1 security audit.
    // A session WITHOUT a valid users row must not be able to push.
    delete process.env.CRON_SECRET
    delete process.env.ADMIN_API_SECRET

    const { createServerClient } = await import('@supabase/ssr')
    ;(createServerClient as any).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: 'u1', email: 'ghost@gomicrogridenergy.com' } },
          error: null,
        })),
      },
      from: vi.fn(() => mockChain({ data: null, error: null })),
    })

    const req = makeRequest({ projectId: 'PROJ-1', title: 'Test', body: 'Hello' })
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Forbidden')
  })

  it('returns 403 when session user is inactive (R1 audit gate)', async () => {
    delete process.env.CRON_SECRET
    delete process.env.ADMIN_API_SECRET

    const { createServerClient } = await import('@supabase/ssr')
    ;(createServerClient as any).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: 'u1', email: 'expired@gomicrogridenergy.com' } },
          error: null,
        })),
      },
      from: vi.fn(() => mockChain({ data: { role: 'user', active: false }, error: null })),
    })

    const req = makeRequest({ projectId: 'PROJ-1', title: 'Test', body: 'Hello' })
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(403)
  })

  it('accepts session user with valid role + active (R1 audit gate)', async () => {
    delete process.env.CRON_SECRET
    delete process.env.ADMIN_API_SECRET

    const { createServerClient } = await import('@supabase/ssr')
    ;(createServerClient as any).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: 'u1', email: 'manager@gomicrogridenergy.com' } },
          error: null,
        })),
      },
      from: vi.fn(() => mockChain({ data: { role: 'manager', active: true }, error: null })),
    })

    const accountsChain = mockChain({ data: [], error: null })
    mockDb.from.mockReturnValue(accountsChain)

    const req = makeRequest({ projectId: 'PROJ-1', title: 'Test', body: 'Hello' })
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(200)
  })

  it('accepts request with valid CRON_SECRET bearer token', async () => {
    process.env.CRON_SECRET = 'my-secret'

    const accountsChain = mockChain({ data: [], error: null })
    mockDb.from.mockReturnValue(accountsChain)

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer my-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    // Should pass auth (may return 200 with sent: 0 if no tokens)
    expect(res.status).toBe(200)
  })

  it('accepts request with valid ADMIN_API_SECRET bearer token', async () => {
    delete process.env.CRON_SECRET
    process.env.ADMIN_API_SECRET = 'admin-key'

    const accountsChain = mockChain({ data: [], error: null })
    mockDb.from.mockReturnValue(accountsChain)

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer admin-key' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(200)
  })
})

// ── Service key ──────────────────────────────────────────────────────────────

describe('POST /api/portal/push — service key', () => {
  it('returns 503 when service key not configured', async () => {
    delete process.env.SUPABASE_SECRET_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toBe('Service key not configured')
  })
})

// ── Validation ───────────────────────────────────────────────────────────────

describe('POST /api/portal/push — validation', () => {
  it('returns 400 when projectId missing', async () => {
    const req = makeRequest(
      { title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('projectId')
  })

  it('returns 400 when title missing', async () => {
    const req = makeRequest(
      { projectId: 'PROJ-1', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(400)
  })

  it('returns 400 when body missing', async () => {
    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(400)
  })
})

// ── Push behavior ────────────────────────────────────────────────────────────

describe('POST /api/portal/push — sending', () => {
  it('returns sent: 0 when no push tokens found', async () => {
    const accountsChain = mockChain({ data: [], error: null })
    mockDb.from.mockReturnValue(accountsChain)

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sent).toBe(0)
    expect(json.reason).toContain('no push tokens')
  })

  it('returns sent: 0 when accounts have null push_token', async () => {
    const accountsChain = mockChain({
      data: [{ push_token: null, name: 'John' }],
      error: null,
    })
    mockDb.from.mockReturnValue(accountsChain)

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sent).toBe(0)
  })

  it('sends push notification to Expo Push API for valid tokens', async () => {
    const accountsChain = mockChain({
      data: [
        { push_token: 'ExponentPushToken[abc123]', name: 'Jane' },
        { push_token: 'ExponentPushToken[def456]', name: 'Bob' },
      ],
      error: null,
    })
    mockDb.from.mockReturnValue(accountsChain)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ status: 'ok' }, { status: 'ok' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Stage Update', body: 'Your project moved to Install', data: { type: 'stage_change' } },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sent).toBe(2)

    // Verify fetch was called to Expo Push API
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://exp.host/--/api/v2/push/send')
    expect(options.method).toBe('POST')

    const messages = JSON.parse(options.body)
    expect(messages).toHaveLength(2)
    expect(messages[0].to).toBe('ExponentPushToken[abc123]')
    expect(messages[0].title).toBe('Stage Update')
    expect(messages[0].body).toBe('Your project moved to Install')
    expect(messages[0].data.projectId).toBe('PROJ-1')
    expect(messages[0].data.type).toBe('stage_change')
  })

  it('handles Expo Push API failure gracefully with 500', async () => {
    const accountsChain = mockChain({
      data: [{ push_token: 'ExponentPushToken[abc123]', name: 'Jane' }],
      error: null,
    })
    mockDb.from.mockReturnValue(accountsChain)

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'))
    vi.stubGlobal('fetch', mockFetch)

    const req = makeRequest(
      { projectId: 'PROJ-1', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    const res = await POST(req as any)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Internal error')
  })

  it('queries customer_accounts with correct filters', async () => {
    const accountsChain = mockChain({ data: [], error: null })
    mockDb.from.mockReturnValue(accountsChain)

    const req = makeRequest(
      { projectId: 'PROJ-42', title: 'Test', body: 'Hello' },
      { Authorization: 'Bearer test-cron-secret' }
    )
    const { POST } = await import('@/app/api/portal/push/route')
    await POST(req as any)

    expect(mockDb.from).toHaveBeenCalledWith('customer_accounts')
    expect(accountsChain.eq).toHaveBeenCalledWith('project_id', 'PROJ-42')
    expect(accountsChain.eq).toHaveBeenCalledWith('status', 'active')
    expect(accountsChain.not).toHaveBeenCalledWith('push_token', 'is', null)
  })
})

// ── GET health check ─────────────────────────────────────────────────────────

describe('GET /api/portal/push', () => {
  it('returns status message', async () => {
    const { GET } = await import('@/app/api/portal/push/route')
    const res = await GET()

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('Push notification API')
  })
})
