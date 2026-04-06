import { describe, it, expect } from 'vitest'
import {
  getNextTask as queueGetNextTask,
  getStuckTasks as queueGetStuckTasks,
  getDaysInStage,
  matchesDaysRange as queueMatchesDaysRange,
  sortProjects,
  priority,
} from '@/app/queue/components/helpers'
import {
  getNextTask as pipelineGetNextTask,
  getStuckTasks as pipelineGetStuckTasks,
  matchesDaysRange as pipelineMatchesDaysRange,
} from '@/app/pipeline/components/helpers'
import type { Project } from '@/types/database'

// ── FIXTURES ───────────────────────────────────────────────────────────────

function daysAgoDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-001',
    name: 'Test Project',
    stage: 'evaluation',
    stage_date: daysAgoDate(2),
    disposition: null,
    blocker: null,
    contract: 25000,
    ...overrides,
  } as Project
}

// ── Queue: getNextTask ─────────────────────────────────────────────────────

describe('queue getNextTask', () => {
  it('returns first incomplete task', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Complete' },
      ia: { status: 'In Progress' },
    }
    const next = queueGetNextTask(p, taskMap)
    expect(next).toBe('IA Confirmation')
  })

  it('returns first task when all are Not Ready', () => {
    const p = makeProject({ stage: 'evaluation' })
    const next = queueGetNextTask(p, {})
    expect(next).toBe('Welcome Call')
  })

  it('returns null when all tasks are complete', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Complete' },
      ia: { status: 'Complete' },
      ub: { status: 'Complete' },
      sched_survey: { status: 'Complete' },
      ntp: { status: 'Complete' },
    }
    expect(queueGetNextTask(p, taskMap)).toBeNull()
  })

  it('returns null for unknown stage', () => {
    const p = makeProject({ stage: 'mystery' as string })
    expect(queueGetNextTask(p, {})).toBeNull()
  })
})

// ── Pipeline: getNextTask ──────────────────────────────────────────────────

describe('pipeline getNextTask', () => {
  it('returns object with name and status', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Complete' },
      ia: { status: 'Pending Resolution' },
    }
    const next = pipelineGetNextTask(p, taskMap)
    expect(next).toEqual({ name: 'IA Confirmation', status: 'Pending Resolution' })
  })

  it('returns Not Ready status for missing tasks', () => {
    const p = makeProject({ stage: 'evaluation' })
    const next = pipelineGetNextTask(p, {})
    expect(next?.status).toBe('Not Ready')
  })

  it('returns null when all complete', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Complete' },
      ia: { status: 'Complete' },
      ub: { status: 'Complete' },
      sched_survey: { status: 'Complete' },
      ntp: { status: 'Complete' },
    }
    expect(pipelineGetNextTask(p, taskMap)).toBeNull()
  })
})

// ── Queue: getStuckTasks ───────────────────────────────────────────────────

describe('queue getStuckTasks', () => {
  it('finds Pending Resolution tasks', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Pending Resolution', reason: 'Customer no-show' },
    }
    const stuck = queueGetStuckTasks(p, taskMap)
    expect(stuck).toHaveLength(1)
    expect(stuck[0].name).toBe('Welcome Call')
    expect(stuck[0].status).toBe('Pending Resolution')
    expect(stuck[0].reason).toBe('Customer no-show')
  })

  it('finds Revision Required tasks', () => {
    const p = makeProject({ stage: 'design' })
    const taskMap = {
      scope: { status: 'Revision Required', reason: 'Wrong panel count' },
    }
    const stuck = queueGetStuckTasks(p, taskMap)
    expect(stuck).toHaveLength(1)
    expect(stuck[0].status).toBe('Revision Required')
  })

  it('returns empty when no stuck tasks', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Complete' },
      ia: { status: 'In Progress' },
    }
    expect(queueGetStuckTasks(p, taskMap)).toEqual([])
  })

  it('defaults reason to empty string', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Pending Resolution' },
    }
    const stuck = queueGetStuckTasks(p, taskMap)
    expect(stuck[0].reason).toBe('')
  })
})

// ── Pipeline: getStuckTasks ────────────────────────────────────────────────

describe('pipeline getStuckTasks', () => {
  it('matches queue behavior', () => {
    const p = makeProject({ stage: 'evaluation' })
    const taskMap = {
      welcome: { status: 'Pending Resolution', reason: 'No answer' },
    }
    const stuck = pipelineGetStuckTasks(p, taskMap)
    expect(stuck).toHaveLength(1)
    expect(stuck[0].name).toBe('Welcome Call')
  })
})

// ── getDaysInStage ─────────────────────────────────────────────────────────

describe('getDaysInStage', () => {
  it('returns days since stage_date', () => {
    const p = makeProject({ stage_date: daysAgoDate(5) })
    const days = getDaysInStage(p)
    expect(days).toBeGreaterThanOrEqual(4)
    expect(days).toBeLessThanOrEqual(6)
  })

  it('returns 0 for today', () => {
    const p = makeProject({ stage_date: daysAgoDate(0) })
    expect(getDaysInStage(p)).toBe(0)
  })

  it('returns 0 for null stage_date', () => {
    const p = makeProject({ stage_date: null })
    expect(getDaysInStage(p)).toBe(0)
  })
})

// ── matchesDaysRange ───────────────────────────────────────────────────────

describe('matchesDaysRange (queue)', () => {
  it('<7 matches fresh projects', () => {
    const p = makeProject({ stage_date: daysAgoDate(3) })
    expect(queueMatchesDaysRange(p, '<7')).toBe(true)
  })

  it('<7 rejects old projects', () => {
    const p = makeProject({ stage_date: daysAgoDate(10) })
    expect(queueMatchesDaysRange(p, '<7')).toBe(false)
  })

  it('7-30 matches mid-range', () => {
    const p = makeProject({ stage_date: daysAgoDate(15) })
    expect(queueMatchesDaysRange(p, '7-30')).toBe(true)
  })

  it('7-30 rejects boundaries', () => {
    expect(queueMatchesDaysRange(makeProject({ stage_date: daysAgoDate(3) }), '7-30')).toBe(false)
    expect(queueMatchesDaysRange(makeProject({ stage_date: daysAgoDate(35) }), '7-30')).toBe(false)
  })

  it('30-90 matches', () => {
    const p = makeProject({ stage_date: daysAgoDate(60) })
    expect(queueMatchesDaysRange(p, '30-90')).toBe(true)
  })

  it('90+ matches old projects', () => {
    const p = makeProject({ stage_date: daysAgoDate(100) })
    expect(queueMatchesDaysRange(p, '90+')).toBe(true)
  })

  it('empty string matches all', () => {
    expect(queueMatchesDaysRange(makeProject({ stage_date: daysAgoDate(0) }), '')).toBe(true)
    expect(queueMatchesDaysRange(makeProject({ stage_date: daysAgoDate(200) }), '')).toBe(true)
  })
})

describe('matchesDaysRange (pipeline)', () => {
  it('same logic as queue version', () => {
    const fresh = makeProject({ stage_date: daysAgoDate(3) })
    const old = makeProject({ stage_date: daysAgoDate(100) })
    expect(pipelineMatchesDaysRange(fresh, '<7')).toBe(true)
    expect(pipelineMatchesDaysRange(old, '90+')).toBe(true)
  })
})

// ── sortProjects ───────────────────────────────────────────────────────────

describe('sortProjects', () => {
  const p1 = makeProject({ id: 'a', name: 'Alpha', stage_date: daysAgoDate(10), contract: 30000 })
  const p2 = makeProject({ id: 'b', name: 'Beta', stage_date: daysAgoDate(5), contract: 50000 })
  const p3 = makeProject({ id: 'c', name: 'Charlie', stage_date: daysAgoDate(20), contract: 15000 })

  it('sorts by days descending', () => {
    const sorted = sortProjects([p1, p2, p3], 'days')
    expect(sorted[0].id).toBe('c') // 20 days
    expect(sorted[1].id).toBe('a') // 10 days
    expect(sorted[2].id).toBe('b') // 5 days
  })

  it('sorts by contract descending', () => {
    const sorted = sortProjects([p1, p2, p3], 'contract')
    expect(sorted[0].id).toBe('b') // $50K
    expect(sorted[1].id).toBe('a') // $30K
    expect(sorted[2].id).toBe('c') // $15K
  })

  it('sorts by name ascending', () => {
    const sorted = sortProjects([p3, p1, p2], 'name')
    expect(sorted[0].name).toBe('Alpha')
    expect(sorted[1].name).toBe('Beta')
    expect(sorted[2].name).toBe('Charlie')
  })

  it('does not mutate original array', () => {
    const original = [p1, p2, p3]
    const sorted = sortProjects(original, 'days')
    expect(original[0].id).toBe('a') // unchanged
    expect(sorted[0].id).toBe('c') // sorted differently
  })

  it('handles null contract gracefully', () => {
    const pNull = makeProject({ id: 'n', contract: null })
    const sorted = sortProjects([pNull, p2], 'contract')
    expect(sorted[0].id).toBe('b') // $50K
    expect(sorted[1].id).toBe('n') // null → 0
  })

  it('handles null name gracefully', () => {
    const pNull = makeProject({ id: 'n', name: null as unknown as string })
    const sorted = sortProjects([pNull, p1], 'name')
    expect(sorted.length).toBe(2) // doesn't crash
  })
})

// ── priority ───────────────────────────────────────────────────────────────

describe('priority', () => {
  it('blocked = 0 (highest)', () => {
    expect(priority(makeProject({ blocker: 'Waiting on HOA' }))).toBe(0)
  })

  it('crit SLA = 1', () => {
    // evaluation crit = 6 days
    expect(priority(makeProject({ stage: 'evaluation', stage_date: daysAgoDate(10) }))).toBe(1)
  })

  it('risk SLA = 2', () => {
    // evaluation risk = 4 days
    expect(priority(makeProject({ stage: 'evaluation', stage_date: daysAgoDate(4) }))).toBe(2)
  })

  it('warn SLA = 3', () => {
    // evaluation target = 3 days
    expect(priority(makeProject({ stage: 'evaluation', stage_date: daysAgoDate(3) }))).toBe(3)
  })

  it('ok = 4 (lowest)', () => {
    expect(priority(makeProject({ stage: 'evaluation', stage_date: daysAgoDate(1) }))).toBe(4)
  })
})
