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
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

const NTP_REQUEST = {
  id: 'ntp-1',
  project_id: 'PROJ-00001',
  requesting_org: 'org-epc-1',
  status: 'pending',
  submitted_by: 'John PM',
  submitted_by_id: 'user-1',
  reviewed_by: null,
  reviewed_by_id: null,
  submitted_at: '2026-03-28T12:00:00Z',
  reviewed_at: null,
  rejection_reason: null,
  revision_notes: null,
  evidence: { completed_tasks: 5, total_tasks: 8 },
  notes: 'Ready for review',
  created_at: '2026-03-28T12:00:00Z',
  updated_at: '2026-03-28T12:00:00Z',
}

const NTP_APPROVED = {
  ...NTP_REQUEST,
  id: 'ntp-2',
  status: 'approved',
  reviewed_by: 'EDGE Reviewer',
  reviewed_by_id: 'user-edge-1',
  reviewed_at: '2026-03-29T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

// ── NTP_STATUSES ─────────────────────────────────────────────────────────────

describe('NTP constants', () => {
  it('exports all NTP statuses', async () => {
    const { NTP_STATUSES, NTP_STATUS_LABELS, NTP_STATUS_BADGE } = await import('@/lib/api/ntp')
    expect(NTP_STATUSES).toEqual(['pending', 'under_review', 'approved', 'rejected', 'revision_required'])
    expect(Object.keys(NTP_STATUS_LABELS)).toHaveLength(5)
    expect(Object.keys(NTP_STATUS_BADGE)).toHaveLength(5)
  })
})

// ── loadNTPRequests ──────────────────────────────────────────────────────────

describe('loadNTPRequests', () => {
  it('loads all requests without filters', async () => {
    const chain = mockChain({ data: [NTP_REQUEST], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPRequests } = await import('@/lib/api/ntp')
    const result = await loadNTPRequests()

    expect(mockSupabase.from).toHaveBeenCalledWith('ntp_requests')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('submitted_at', { ascending: false })
    expect(result).toEqual([NTP_REQUEST])
  })

  it('filters by org when orgId provided', async () => {
    const chain = mockChain({ data: [NTP_REQUEST], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPRequests } = await import('@/lib/api/ntp')
    await loadNTPRequests('org-epc-1')

    expect(chain.eq).toHaveBeenCalledWith('requesting_org', 'org-epc-1')
  })

  it('filters by status when status provided', async () => {
    const chain = mockChain({ data: [NTP_REQUEST], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPRequests } = await import('@/lib/api/ntp')
    await loadNTPRequests(null, 'pending')

    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'test error' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPRequests } = await import('@/lib/api/ntp')
    const result = await loadNTPRequests()

    expect(result).toEqual([])
  })
})

// ── loadNTPRequestByProject ──────────────────────────────────────────────────

describe('loadNTPRequestByProject', () => {
  it('loads the most recent request for a project', async () => {
    const chain = mockChain({ data: NTP_REQUEST, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPRequestByProject } = await import('@/lib/api/ntp')
    const result = await loadNTPRequestByProject('PROJ-00001')

    expect(mockSupabase.from).toHaveBeenCalledWith('ntp_requests')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-00001')
    expect(chain.order).toHaveBeenCalledWith('submitted_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(1)
    expect(result).toEqual(NTP_REQUEST)
  })

  it('returns null when no request exists', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPRequestByProject } = await import('@/lib/api/ntp')
    const result = await loadNTPRequestByProject('PROJ-99999')

    expect(result).toBeNull()
  })
})

// ── loadNTPHistory ───────────────────────────────────────────────────────────

describe('loadNTPHistory', () => {
  it('loads all requests for a project', async () => {
    const chain = mockChain({ data: [NTP_REQUEST, NTP_APPROVED], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPHistory } = await import('@/lib/api/ntp')
    const result = await loadNTPHistory('PROJ-00001')

    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-00001')
    expect(result).toHaveLength(2)
  })
})

// ── submitNTPRequest ─────────────────────────────────────────────────────────

describe('submitNTPRequest', () => {
  it('submits a new NTP request with evidence and notes', async () => {
    const chain = mockChain({ data: NTP_REQUEST, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { submitNTPRequest } = await import('@/lib/api/ntp')
    const result = await submitNTPRequest(
      'PROJ-00001', 'org-epc-1', 'user-1', 'John PM',
      { completed_tasks: 5 }, 'Ready for review'
    )

    expect(mockSupabase.from).toHaveBeenCalledWith('ntp_requests')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'PROJ-00001',
      requesting_org: 'org-epc-1',
      submitted_by: 'John PM',
      submitted_by_id: 'user-1',
      status: 'pending',
      evidence: { completed_tasks: 5 },
      notes: 'Ready for review',
    }))
    expect(result).toEqual(NTP_REQUEST)
  })

  it('submits with empty evidence when not provided', async () => {
    const chain = mockChain({ data: NTP_REQUEST, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { submitNTPRequest } = await import('@/lib/api/ntp')
    await submitNTPRequest('PROJ-00001', 'org-epc-1', 'user-1', 'John PM')

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      evidence: {},
      notes: null,
    }))
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert error' } })
    mockSupabase.from.mockReturnValue(chain)

    const { submitNTPRequest } = await import('@/lib/api/ntp')
    const result = await submitNTPRequest('PROJ-00001', 'org-epc-1', 'user-1', 'John PM')

    expect(result).toBeNull()
  })
})

// ── reviewNTPRequest ─────────────────────────────────────────────────────────

describe('reviewNTPRequest', () => {
  it('approves a request', async () => {
    const chain = mockChain({ data: NTP_APPROVED, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { reviewNTPRequest } = await import('@/lib/api/ntp')
    const result = await reviewNTPRequest('ntp-1', 'approved', 'user-edge-1', 'EDGE Reviewer')

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      reviewed_by: 'EDGE Reviewer',
      reviewed_by_id: 'user-edge-1',
    }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'ntp-1')
  })

  it('rejects with reason', async () => {
    const chain = mockChain({ data: { ...NTP_REQUEST, status: 'rejected' }, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { reviewNTPRequest } = await import('@/lib/api/ntp')
    await reviewNTPRequest('ntp-1', 'rejected', 'user-edge-1', 'EDGE Reviewer', 'Missing documents')

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected',
      rejection_reason: 'Missing documents',
    }))
  })

  it('sets revision_notes for revision_required', async () => {
    const chain = mockChain({ data: { ...NTP_REQUEST, status: 'revision_required' }, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { reviewNTPRequest } = await import('@/lib/api/ntp')
    await reviewNTPRequest('ntp-1', 'revision_required', 'user-edge-1', 'EDGE Reviewer', 'Need updated plan set')

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'revision_required',
      revision_notes: 'Need updated plan set',
    }))
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'update error' } })
    mockSupabase.from.mockReturnValue(chain)

    const { reviewNTPRequest } = await import('@/lib/api/ntp')
    const result = await reviewNTPRequest('ntp-1', 'approved', 'user-edge-1', 'EDGE Reviewer')

    expect(result).toBeNull()
  })
})

// ── loadNTPQueue ─────────────────────────────────────────────────────────────

describe('loadNTPQueue', () => {
  it('loads all requests by default (no status filter)', async () => {
    const chain = mockChain({ data: [NTP_REQUEST], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPQueue } = await import('@/lib/api/ntp')
    const result = await loadNTPQueue()

    expect(mockSupabase.from).toHaveBeenCalledWith('ntp_requests')
    expect(chain.order).toHaveBeenCalledWith('submitted_at', { ascending: false })
    // No status filter applied when no status specified — returns all
    expect(chain.eq).not.toHaveBeenCalled()
    expect(result).toEqual([NTP_REQUEST])
  })

  it('filters by specific status', async () => {
    const chain = mockChain({ data: [NTP_REQUEST], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadNTPQueue } = await import('@/lib/api/ntp')
    await loadNTPQueue('pending')

    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
  })
})

// ── resubmitNTPRequest ───────────────────────────────────────────────────────

describe('resubmitNTPRequest', () => {
  it('resets status to pending with updated evidence', async () => {
    const chain = mockChain({ data: { ...NTP_REQUEST, status: 'pending' }, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { resubmitNTPRequest } = await import('@/lib/api/ntp')
    const result = await resubmitNTPRequest('ntp-1', { completed_tasks: 8 }, 'All fixed')

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      evidence: { completed_tasks: 8 },
      notes: 'All fixed',
      reviewed_at: null,
      reviewed_by: null,
      reviewed_by_id: null,
      rejection_reason: null,
      revision_notes: null,
    }))
    expect(chain.eq).toHaveBeenCalledWith('id', 'ntp-1')
  })

  it('returns null on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'update error' } })
    mockSupabase.from.mockReturnValue(chain)

    const { resubmitNTPRequest } = await import('@/lib/api/ntp')
    const result = await resubmitNTPRequest('ntp-1')

    expect(result).toBeNull()
  })
})
