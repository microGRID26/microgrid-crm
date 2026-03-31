import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
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

// ── loadProjectNotes ────────────────────────────────────────────────────────

describe('loadProjectNotes', () => {
  it('loads notes where task_id is null (project-level notes)', async () => {
    const notes = [
      { id: 'n1', project_id: 'PROJ-001', text: 'Hello', time: '2026-03-01', task_id: null },
    ]
    const chain = mockChain({ data: notes, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectNotes } = await import('@/lib/api/notes')
    const result = await loadProjectNotes('PROJ-001')

    expect(mockSupabase.from).toHaveBeenCalledWith('notes')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'PROJ-001')
    expect(chain.is).toHaveBeenCalledWith('task_id', null)
    expect(chain.order).toHaveBeenCalledWith('time', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(2000)
    expect(result.data).toEqual(notes)
    expect(result.error).toBeNull()
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadProjectNotes } = await import('@/lib/api/notes')
    const result = await loadProjectNotes('PROJ-001')
    expect(result.data).toEqual([])
  })
})

// ── loadTaskNotes ───────────────────────────────────────────────────────────

describe('loadTaskNotes', () => {
  it('loads notes where task_id is not null (task-level notes)', async () => {
    const notes = [
      { id: 'n2', task_id: 'site_survey', text: 'Survey done', time: '2026-03-01', pm: 'PM1' },
    ]
    const chain = mockChain({ data: notes, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadTaskNotes } = await import('@/lib/api/notes')
    const result = await loadTaskNotes('PROJ-001')

    expect(chain.select).toHaveBeenCalledWith('id, task_id, text, time, pm')
    expect(chain.not).toHaveBeenCalledWith('task_id', 'is', null)
    expect(chain.order).toHaveBeenCalledWith('time', { ascending: true })
    expect(chain.limit).toHaveBeenCalledWith(5000)
    expect(result.data).toEqual(notes)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const { loadTaskNotes } = await import('@/lib/api/notes')
    const result = await loadTaskNotes('PROJ-001')
    expect(result.data).toEqual([])
  })
})

// ── addNote ─────────────────────────────────────────────────────────────────

describe('addNote', () => {
  it('inserts a project note and returns it', async () => {
    const newNote = { id: 'n3', task_id: null, text: 'New note', time: '2026-03-15T10:00:00Z', pm: 'Greg' }
    const chain = mockChain({ data: newNote, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { addNote } = await import('@/lib/api/notes')
    const input = { project_id: 'PROJ-001', text: 'New note', time: '2026-03-15T10:00:00Z', pm: 'Greg' }
    const result = await addNote(input)

    expect(mockSupabase.from).toHaveBeenCalledWith('notes')
    expect(chain.insert).toHaveBeenCalledWith(input)
    expect(chain.select).toHaveBeenCalledWith('id, task_id, text, time, pm')
    expect(result.data).toEqual(newNote)
  })

  it('inserts a task note with task_id', async () => {
    const chain = mockChain({ data: { id: 'n4' }, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { addNote } = await import('@/lib/api/notes')
    const input = {
      project_id: 'PROJ-001',
      text: 'Task note',
      time: '2026-03-15T10:00:00Z',
      pm: 'Greg',
      task_id: 'site_survey',
    }
    const result = await addNote(input)

    expect(chain.insert).toHaveBeenCalledWith(input)
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { addNote } = await import('@/lib/api/notes')
    const result = await addNote({ project_id: 'PROJ-001', text: 'x', time: 'now', pm: null })
    expect(result.error).toBeTruthy()
  })
})

// ── deleteNote ──────────────────────────────────────────────────────────────

describe('deleteNote', () => {
  it('deletes a note by id', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { deleteNote } = await import('@/lib/api/notes')
    const result = await deleteNote('n1')

    expect(mockSupabase.from).toHaveBeenCalledWith('notes')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'n1')
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'delete failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { deleteNote } = await import('@/lib/api/notes')
    const result = await deleteNote('n1')
    expect(result.error).toBeTruthy()
  })
})

// ── createMentionNotification ───────────────────────────────────────────────

describe('createMentionNotification', () => {
  it('creates a mention notification', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { createMentionNotification } = await import('@/lib/api/notes')
    const mention = {
      project_id: 'PROJ-001',
      mentioned_user_id: 'user-123',
      mentioned_by: 'Greg',
      message: 'Hey @user check this',
    }
    const result = await createMentionNotification(mention)

    expect(mockSupabase.from).toHaveBeenCalledWith('mention_notifications')
    expect(chain.insert).toHaveBeenCalledWith(mention)
    expect(result.error).toBeNull()
  })

  it('returns error on failure', async () => {
    const chain = mockChain({ data: null, error: { message: 'failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const { createMentionNotification } = await import('@/lib/api/notes')
    const result = await createMentionNotification({
      project_id: 'PROJ-001',
      mentioned_user_id: 'u1',
      mentioned_by: 'Greg',
      message: 'test',
    })
    expect(result.error).toBeTruthy()
  })
})
