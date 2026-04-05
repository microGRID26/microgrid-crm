import { describe, it, expect } from 'vitest'
import { buildTaskMap, applyTaskInsertOrUpdate, applyTaskDelete } from '@/lib/queue-task-map'
import type { TaskStateRow, TaskMap } from '@/lib/queue-task-map'

// ── buildTaskMap ───────────────────────────────────────────────────────────

describe('buildTaskMap', () => {
  it('builds map from task state rows', () => {
    const rows: TaskStateRow[] = [
      { project_id: 'p1', task_id: 'welcome', status: 'Complete' },
      { project_id: 'p1', task_id: 'ia', status: 'In Progress' },
      { project_id: 'p2', task_id: 'ntp', status: 'Ready To Start', reason: 'Waiting on doc' },
    ]
    const map = buildTaskMap(rows)

    expect(map['p1']['welcome'].status).toBe('Complete')
    expect(map['p1']['ia'].status).toBe('In Progress')
    expect(map['p2']['ntp'].status).toBe('Ready To Start')
    expect(map['p2']['ntp'].reason).toBe('Waiting on doc')
  })

  it('returns empty map for empty input', () => {
    expect(buildTaskMap([])).toEqual({})
  })

  it('groups tasks by project_id', () => {
    const rows: TaskStateRow[] = [
      { project_id: 'p1', task_id: 'welcome', status: 'Complete' },
      { project_id: 'p1', task_id: 'ia', status: 'Complete' },
      { project_id: 'p2', task_id: 'welcome', status: 'Not Ready' },
    ]
    const map = buildTaskMap(rows)
    expect(Object.keys(map['p1'])).toHaveLength(2)
    expect(Object.keys(map['p2'])).toHaveLength(1)
  })

  it('converts null reason to undefined', () => {
    const rows: TaskStateRow[] = [
      { project_id: 'p1', task_id: 'welcome', status: 'Complete', reason: null },
    ]
    const map = buildTaskMap(rows)
    expect(map['p1']['welcome'].reason).toBeUndefined()
  })

  it('preserves string reason', () => {
    const rows: TaskStateRow[] = [
      { project_id: 'p1', task_id: 'welcome', status: 'Pending Resolution', reason: 'Customer unreachable' },
    ]
    const map = buildTaskMap(rows)
    expect(map['p1']['welcome'].reason).toBe('Customer unreachable')
  })

  it('last row wins for duplicate project_id + task_id', () => {
    const rows: TaskStateRow[] = [
      { project_id: 'p1', task_id: 'welcome', status: 'Not Ready' },
      { project_id: 'p1', task_id: 'welcome', status: 'Complete' },
    ]
    const map = buildTaskMap(rows)
    expect(map['p1']['welcome'].status).toBe('Complete')
  })
})

// ── applyTaskInsertOrUpdate ────────────────────────────────────────────────

describe('applyTaskInsertOrUpdate', () => {
  const relevant = new Set(['welcome', 'ia', 'ntp'])

  it('applies update for relevant task', () => {
    const map: TaskMap = { p1: { welcome: { status: 'Not Ready' } } }
    const result = applyTaskInsertOrUpdate(map, {
      project_id: 'p1', task_id: 'welcome', status: 'Complete',
    }, relevant)
    expect(result).toBe(true)
    expect(map['p1']['welcome'].status).toBe('Complete')
  })

  it('ignores irrelevant task_id', () => {
    const map: TaskMap = {}
    const result = applyTaskInsertOrUpdate(map, {
      project_id: 'p1', task_id: 'scope', status: 'Complete',
    }, relevant)
    expect(result).toBe(false)
    expect(map['p1']).toBeUndefined()
  })

  it('creates project entry if missing', () => {
    const map: TaskMap = {}
    applyTaskInsertOrUpdate(map, {
      project_id: 'p-new', task_id: 'welcome', status: 'In Progress',
    }, relevant)
    expect(map['p-new']['welcome'].status).toBe('In Progress')
  })

  it('sets reason from row', () => {
    const map: TaskMap = {}
    applyTaskInsertOrUpdate(map, {
      project_id: 'p1', task_id: 'ntp', status: 'Pending Resolution', reason: 'Missing HOA',
    }, relevant)
    expect(map['p1']['ntp'].reason).toBe('Missing HOA')
  })
})

// ── applyTaskDelete ────────────────────────────────────────────────────────

describe('applyTaskDelete', () => {
  const relevant = new Set(['welcome', 'ia'])

  it('deletes task from map', () => {
    const map: TaskMap = { p1: { welcome: { status: 'Complete' }, ia: { status: 'Complete' } } }
    const result = applyTaskDelete(map, { project_id: 'p1', task_id: 'welcome' }, relevant)
    expect(result).toBe(true)
    expect(map['p1']['welcome']).toBeUndefined()
    expect(map['p1']['ia'].status).toBe('Complete')
  })

  it('removes project entry when last task deleted', () => {
    const map: TaskMap = { p1: { welcome: { status: 'Complete' } } }
    applyTaskDelete(map, { project_id: 'p1', task_id: 'welcome' }, relevant)
    expect(map['p1']).toBeUndefined()
  })

  it('ignores irrelevant task_id', () => {
    const map: TaskMap = { p1: { welcome: { status: 'Complete' } } }
    const result = applyTaskDelete(map, { project_id: 'p1', task_id: 'scope' }, relevant)
    expect(result).toBe(false)
    expect(map['p1']['welcome'].status).toBe('Complete')
  })

  it('handles missing project gracefully', () => {
    const map: TaskMap = {}
    const result = applyTaskDelete(map, { project_id: 'p-none', task_id: 'welcome' }, relevant)
    expect(result).toBe(true) // task_id is relevant, just nothing to delete
  })
})
