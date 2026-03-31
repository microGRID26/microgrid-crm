import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
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

// ── upsertTaskState ─────────────────────────────────────────────────────────

describe('upsertTaskState', () => {
  it('upserts a task state record', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { upsertTaskState } = await import('@/lib/api/tasks')
    const record = {
      project_id: 'PROJ-001',
      task_id: 'site_survey',
      status: 'Complete',
      completed_date: '2026-03-15',
    }
    const result = await upsertTaskState(record)

    expect(mockSupabase.from).toHaveBeenCalledWith('task_state')
    expect(chain.upsert).toHaveBeenCalledWith(record, { onConflict: 'project_id,task_id' })
    expect(result.error).toBeNull()
  })

  it('handles optional fields', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { upsertTaskState } = await import('@/lib/api/tasks')
    const record = {
      project_id: 'PROJ-001',
      task_id: 'site_survey',
      status: 'In Progress',
      reason: null,
      follow_up_date: '2026-04-01',
      notes: 'Waiting for homeowner',
    }
    const result = await upsertTaskState(record)

    expect(chain.upsert).toHaveBeenCalledWith(record, { onConflict: 'project_id,task_id' })
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'upsert failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { upsertTaskState } = await import('@/lib/api/tasks')
    const result = await upsertTaskState({ project_id: 'P1', task_id: 't1', status: 'X' })
    expect(result.error).toBeTruthy()
  })
})

// ── loadTaskHistory ─────────────────────────────────────────────────────────

describe('loadTaskHistory', () => {
  it('loads task history for multiple projects', async () => {
    const history = [
      { project_id: 'PROJ-001', task_id: 'site_survey', status: 'Complete', changed_at: '2026-03-15' },
    ]
    const chain = mockChain({ data: history, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadTaskHistory } = await import('@/lib/api/tasks')
    const result = await loadTaskHistory(['PROJ-001', 'PROJ-002'])

    expect(mockSupabase.from).toHaveBeenCalledWith('task_history')
    expect(chain.in).toHaveBeenCalledWith('project_id', ['PROJ-001', 'PROJ-002'])
    expect(chain.order).toHaveBeenCalledWith('changed_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(50)
    expect(result.data).toEqual(history)
  })

  it('uses custom limit when provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadTaskHistory } = await import('@/lib/api/tasks')
    await loadTaskHistory(['PROJ-001'], { limit: 200 })

    expect(chain.limit).toHaveBeenCalledWith(200)
  })

  it('filters by status when provided', async () => {
    const chain = mockChain({ data: [], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadTaskHistory } = await import('@/lib/api/tasks')
    await loadTaskHistory(['PROJ-001'], { statusFilter: ['Complete', 'Revision Required'] })

    expect(chain.in).toHaveBeenCalledWith('status', ['Complete', 'Revision Required'])
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadTaskHistory } = await import('@/lib/api/tasks')
    const result = await loadTaskHistory(['PROJ-001'])
    expect(result.data).toEqual([])
  })
})

// ── insertTaskHistory ───────────────────────────────────────────────────────

describe('insertTaskHistory', () => {
  it('inserts a history record', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { insertTaskHistory } = await import('@/lib/api/tasks')
    const record = {
      project_id: 'PROJ-001',
      task_id: 'site_survey',
      status: 'Complete',
      changed_by: 'Greg',
    }
    const result = await insertTaskHistory(record)

    expect(mockSupabase.from).toHaveBeenCalledWith('task_history')
    expect(chain.insert).toHaveBeenCalledWith(record)
    expect(result.error).toBeNull()
  })

  it('handles optional reason field', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { insertTaskHistory } = await import('@/lib/api/tasks')
    const record = {
      project_id: 'PROJ-001',
      task_id: 'city_permit',
      status: 'Pending Resolution',
      reason: 'Permit Drop Off/Pickup',
      changed_by: 'Greg',
    }
    const result = await insertTaskHistory(record)
    expect(chain.insert).toHaveBeenCalledWith(record)
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { insertTaskHistory } = await import('@/lib/api/tasks')
    const result = await insertTaskHistory({ project_id: 'P1', task_id: 't1', status: 'X' })
    expect(result.error).toBeTruthy()
  })
})

// ── loadProjectAdders ───────────────────────────────────────────────────────

describe('loadProjectAdders', () => {
  it('loads adders for a project', async () => {
    const adders = [
      { id: 'a1', project_id: 'PROJ-001', adder_name: 'EV Charger', price: 1500, quantity: 1 },
      { id: 'a2', project_id: 'PROJ-001', adder_name: 'Critter Guard', price: 800, quantity: 2 },
    ]
    const chain = mockChain({ data: adders, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectAdders } = await import('@/lib/api/tasks')
    const result = await loadProjectAdders('PROJ-001')

    expect(mockSupabase.from).toHaveBeenCalledWith('project_adders')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-001')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(chain.limit).toHaveBeenCalledWith(500)
    expect(result.data).toEqual(adders)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectAdders } = await import('@/lib/api/tasks')
    const result = await loadProjectAdders('PROJ-001')
    expect(result.data).toEqual([])
  })
})

// ── addProjectAdder ─────────────────────────────────────────────────────────

describe('addProjectAdder', () => {
  it('inserts an adder', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { addProjectAdder } = await import('@/lib/api/tasks')
    const adder = {
      project_id: 'PROJ-001',
      adder_name: 'Ground Mount',
      price: 5000,
      quantity: 1,
      total_amount: 5000,
    }
    const result = await addProjectAdder(adder)

    expect(mockSupabase.from).toHaveBeenCalledWith('project_adders')
    expect(chain.insert).toHaveBeenCalledWith(adder)
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { addProjectAdder } = await import('@/lib/api/tasks')
    const result = await addProjectAdder({
      project_id: 'P1', adder_name: 'X', price: 0, quantity: 0, total_amount: 0,
    })
    expect(result.error).toBeTruthy()
  })
})

// ── deleteProjectAdder ──────────────────────────────────────────────────────

describe('deleteProjectAdder', () => {
  it('deletes an adder by id', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { deleteProjectAdder } = await import('@/lib/api/tasks')
    const result = await deleteProjectAdder('adder-123')

    expect(mockSupabase.from).toHaveBeenCalledWith('project_adders')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'adder-123')
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'delete failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { deleteProjectAdder } = await import('@/lib/api/tasks')
    const result = await deleteProjectAdder('bad-id')
    expect(result.error).toBeTruthy()
  })
})
