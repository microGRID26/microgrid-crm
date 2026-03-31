import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any; count?: number }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

// ── loadProjectFiles ────────────────────────────────────────────────────────

describe('loadProjectFiles', () => {
  it('returns files for a project', async () => {
    const files = [
      { id: 'f1', project_id: 'PROJ-001', file_name: 'contract.pdf', folder_name: '01 Proposal' },
      { id: 'f2', project_id: 'PROJ-001', file_name: 'permit.pdf', folder_name: '05 Permit' },
    ]
    const chain = mockChain({ data: files, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectFiles } = await import('@/lib/api/documents')
    const result = await loadProjectFiles('PROJ-001')

    expect(mockSupabase.from).toHaveBeenCalledWith('project_files')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-001')
    expect(chain.limit).toHaveBeenCalledWith(2000)
    expect(result).toEqual(files)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'DB error' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectFiles } = await import('@/lib/api/documents')
    const result = await loadProjectFiles('PROJ-001')
    expect(result).toEqual([])
  })
})

// ── searchProjectFiles ──────────────────────────────────────────────────────

describe('searchProjectFiles', () => {
  it('searches files by name with escaping', async () => {
    const files = [{ id: 'f1', file_name: 'contract_v2.pdf' }]
    const chain = mockChain({ data: files, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchProjectFiles } = await import('@/lib/api/documents')
    const result = await searchProjectFiles('PROJ-001', 'contract')

    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-001')
    expect(chain.ilike).toHaveBeenCalledWith('file_name', '%contract%')
    expect(chain.limit).toHaveBeenCalledWith(50)
    expect(result).toEqual(files)
  })

  it('escapes special ILIKE characters in search', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { searchProjectFiles } = await import('@/lib/api/documents')
    await searchProjectFiles('PROJ-001', '100%_complete')

    // escapeIlike escapes % and _
    expect(chain.ilike).toHaveBeenCalledWith('file_name', '%100\\%\\_complete%')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { searchProjectFiles } = await import('@/lib/api/documents')
    const result = await searchProjectFiles('PROJ-001', 'test')
    expect(result).toEqual([])
  })
})

// ── searchAllProjectFiles ───────────────────────────────────────────────────

describe('searchAllProjectFiles', () => {
  it('returns paginated results with count', async () => {
    const files = [{ id: 'f1', file_name: 'test.pdf' }]
    const chain = mockChain({ data: files, error: null, count: 15 })
    mockSupabase.from.mockReturnValue(chain)

    const { searchAllProjectFiles } = await import('@/lib/api/documents')
    const result = await searchAllProjectFiles('test', 2, 10)

    // page 2, pageSize 10: from=10, to=19
    expect(chain.range).toHaveBeenCalledWith(10, 19)
    expect(result.data).toEqual(files)
  })

  it('defaults to page 1 pageSize 50', async () => {
    const chain = mockChain({ data: [], error: null, count: 0 })
    mockSupabase.from.mockReturnValue(chain)

    const { searchAllProjectFiles } = await import('@/lib/api/documents')
    await searchAllProjectFiles('test')

    expect(chain.range).toHaveBeenCalledWith(0, 49)
  })
})

// ── loadAllProjectFiles ─────────────────────────────────────────────────────

describe('loadAllProjectFiles', () => {
  it('returns paginated results', async () => {
    const files = [{ id: 'f1', file_name: 'a.pdf' }]
    const chain = mockChain({ data: files, error: null, count: 100 })
    mockSupabase.from.mockReturnValue(chain)

    const { loadAllProjectFiles } = await import('@/lib/api/documents')
    const result = await loadAllProjectFiles(3, 25)

    // page 3, pageSize 25: from=50, to=74
    expect(chain.range).toHaveBeenCalledWith(50, 74)
    expect(result.data).toEqual(files)
  })

  it('returns empty on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadAllProjectFiles } = await import('@/lib/api/documents')
    const result = await loadAllProjectFiles()
    expect(result).toEqual({ data: [], count: 0 })
  })
})

// ── loadDocumentRequirements ────────────────────────────────────────────────

describe('loadDocumentRequirements', () => {
  it('loads all active requirements', async () => {
    const reqs = [{ id: 'r1', stage: 'permit', document_type: 'Permit Application', active: true }]
    const chain = mockChain({ data: reqs, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadDocumentRequirements } = await import('@/lib/api/documents')
    const result = await loadDocumentRequirements()

    expect(mockSupabase.from).toHaveBeenCalledWith('document_requirements')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.limit).toHaveBeenCalledWith(500)
    expect(result).toEqual(reqs)
  })

  it('filters by stage when provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadDocumentRequirements } = await import('@/lib/api/documents')
    await loadDocumentRequirements('permit')

    // eq called twice: once for active, once for stage
    expect(chain.eq).toHaveBeenCalledWith('stage', 'permit')
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadDocumentRequirements } = await import('@/lib/api/documents')
    const result = await loadDocumentRequirements()
    expect(result).toEqual([])
  })
})

// ── loadProjectDocuments ────────────────────────────────────────────────────

describe('loadProjectDocuments', () => {
  it('loads documents for a project', async () => {
    const docs = [{ id: 'd1', project_id: 'PROJ-001', requirement_id: 'r1', doc_status: 'present' }]
    const chain = mockChain({ data: docs, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectDocuments } = await import('@/lib/api/documents')
    const result = await loadProjectDocuments('PROJ-001')

    expect(mockSupabase.from).toHaveBeenCalledWith('project_documents')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-001')
    expect(result).toEqual(docs)
  })
})

// ── updateDocumentStatus ────────────────────────────────────────────────────

describe('updateDocumentStatus', () => {
  it('updates status to present', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { updateDocumentStatus } = await import('@/lib/api/documents')
    const result = await updateDocumentStatus('PROJ-001', 'r1', 'present')

    expect(chain.update).toHaveBeenCalledWith({ doc_status: 'present' })
    expect(result).toBe(true)
  })

  it('sets verified_by and verified_at when status is verified', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { updateDocumentStatus } = await import('@/lib/api/documents')
    const result = await updateDocumentStatus('PROJ-001', 'r1', 'verified', 'Admin User')

    const updateCall = chain.update.mock.calls[0][0]
    expect(updateCall.doc_status).toBe('verified')
    expect(updateCall.verified_by).toBe('Admin User')
    expect(updateCall.verified_at).toBeDefined()
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { updateDocumentStatus } = await import('@/lib/api/documents')
    const result = await updateDocumentStatus('PROJ-001', 'r1', 'missing')
    expect(result).toBe(false)
  })
})
