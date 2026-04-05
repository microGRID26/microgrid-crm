import { describe, it, expect } from 'vitest'
import {
  TASKS, TASK_TO_STAGE, ALL_TASKS_MAP, ALL_TASKS_FLAT,
  TASK_DATE_FIELDS, AHJ_REQUIRED_TASKS,
  isTaskRequired, getSameStageDownstream,
} from '@/lib/tasks'

// ── isTaskRequired ─────────────────────────────────────────────────────────

describe('isTaskRequired', () => {
  it('returns true for inherently required tasks', () => {
    expect(isTaskRequired({ id: 'welcome', req: true }, null)).toBe(true)
    expect(isTaskRequired({ id: 'welcome', req: true }, 'Houston')).toBe(true)
  })

  it('returns false for optional tasks with no AHJ match', () => {
    expect(isTaskRequired({ id: 'stamps', req: false }, 'Houston')).toBe(false)
    expect(isTaskRequired({ id: 'stamps', req: false }, null)).toBe(false)
  })

  it('returns true for wp1 in Corpus Christi (exact match)', () => {
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Corpus Christi')).toBe(true)
  })

  it('returns true for wp1 in Corpus Christi with suffix after space', () => {
    // startsWith check uses space delimiter: "corpus christi " prefix
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Corpus Christi TX')).toBe(true)
  })

  it('returns true for wp1 in Texas City (exact match)', () => {
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Texas City')).toBe(true)
  })

  it('returns true for wp1 in Texas City with suffix after space', () => {
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Texas City TX')).toBe(true)
  })

  it('returns false for wp1 with comma suffix (no space)', () => {
    // "Corpus Christi, TX" starts with "Corpus Christi," not "Corpus Christi "
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Corpus Christi, TX')).toBe(false)
  })

  it('returns false for wp1 in other cities', () => {
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Houston')).toBe(false)
    expect(isTaskRequired({ id: 'wp1', req: false }, 'Dallas')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isTaskRequired({ id: 'wp1', req: false }, 'corpus christi')).toBe(true)
    expect(isTaskRequired({ id: 'wp1', req: false }, 'CORPUS CHRISTI')).toBe(true)
  })

  it('returns true for wpi28 in Corpus Christi', () => {
    expect(isTaskRequired({ id: 'wpi28', req: false }, 'Corpus Christi')).toBe(true)
  })

  it('returns false when ahj is null', () => {
    expect(isTaskRequired({ id: 'wp1', req: false }, null)).toBe(false)
  })
})

// ── getSameStageDownstream ─────────────────────────────────────────────────

describe('getSameStageDownstream', () => {
  it('finds downstream tasks for scope in design', () => {
    const downstream = getSameStageDownstream('scope')
    // scope → monitoring, build_eng, wp1, prod_add, new_ia, onsite_redesign, quote_ext_scope
    // build_eng → eng_approval
    // So downstream should include monitoring, build_eng, eng_approval, and optionals
    expect(downstream).toContain('monitoring')
    expect(downstream).toContain('build_eng')
    expect(downstream).toContain('eng_approval')
  })

  it('scope does not include itself', () => {
    const downstream = getSameStageDownstream('scope')
    expect(downstream).not.toContain('scope')
  })

  it('follows transitive dependencies', () => {
    // build_eng → eng_approval (transitive from scope)
    const downstream = getSameStageDownstream('build_design')
    expect(downstream).toContain('scope')
    expect(downstream).toContain('build_eng')
    expect(downstream).toContain('eng_approval')
    expect(downstream).toContain('monitoring')
  })

  it('stays within same stage', () => {
    // eng_approval is in design, hoa/city_permit are in permit (next stage)
    // build_design downstream should NOT include permit tasks
    const downstream = getSameStageDownstream('build_design')
    expect(downstream).not.toContain('hoa')
    expect(downstream).not.toContain('city_permit')
  })

  it('returns empty for leaf tasks (no dependents)', () => {
    // eng_approval has no same-stage dependents in design
    const downstream = getSameStageDownstream('eng_approval')
    expect(downstream).toEqual([])
  })

  it('returns empty for unknown task', () => {
    expect(getSameStageDownstream('nonexistent_task')).toEqual([])
  })

  it('finds downstream for sched_install in install stage', () => {
    const downstream = getSameStageDownstream('sched_install')
    expect(downstream).toContain('inventory')
    expect(downstream).toContain('install_done')
  })

  it('finds downstream for insp_review in inspection', () => {
    const downstream = getSameStageDownstream('insp_review')
    expect(downstream).toContain('sched_city')
    expect(downstream).toContain('sched_util')
    expect(downstream).toContain('city_insp')
    expect(downstream).toContain('util_insp')
  })
})

// ── Task Structure Validation ──────────────────────────────────────────────

describe('TASKS structure', () => {
  it('covers all 7 stages', () => {
    const stages = Object.keys(TASKS)
    expect(stages).toContain('evaluation')
    expect(stages).toContain('survey')
    expect(stages).toContain('design')
    expect(stages).toContain('permit')
    expect(stages).toContain('install')
    expect(stages).toContain('inspection')
    expect(stages).toContain('complete')
    expect(stages).toHaveLength(7)
  })

  it('all task IDs are unique across stages', () => {
    const allIds = Object.values(TASKS).flat().map(t => t.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
  })

  it('all prerequisites reference valid task IDs', () => {
    const allIds = new Set(Object.values(TASKS).flat().map(t => t.id))
    for (const [stage, tasks] of Object.entries(TASKS)) {
      for (const task of tasks) {
        for (const preId of task.pre) {
          expect(allIds.has(preId)).toBe(true)
        }
      }
    }
  })

  it('all tasks have non-empty names', () => {
    for (const tasks of Object.values(TASKS)) {
      for (const t of tasks) {
        expect(t.name.length).toBeGreaterThan(0)
      }
    }
  })

  it('every stage has at least one required task', () => {
    for (const [stage, tasks] of Object.entries(TASKS)) {
      expect(tasks.some(t => t.req)).toBe(true)
    }
  })
})

// ── Derived Lookups ────────────────────────────────────────────────────────

describe('derived lookups', () => {
  it('ALL_TASKS_MAP has entry for every task', () => {
    const allIds = Object.values(TASKS).flat().map(t => t.id)
    for (const id of allIds) {
      expect(ALL_TASKS_MAP[id]).toBeDefined()
    }
  })

  it('ALL_TASKS_FLAT includes stage info', () => {
    expect(ALL_TASKS_FLAT['welcome'].stage).toBe('evaluation')
    expect(ALL_TASKS_FLAT['scope'].stage).toBe('design')
    expect(ALL_TASKS_FLAT['pto'].stage).toBe('complete')
  })

  it('TASK_TO_STAGE maps correctly', () => {
    expect(TASK_TO_STAGE['welcome']).toBe('evaluation')
    expect(TASK_TO_STAGE['install_done']).toBe('install')
    expect(TASK_TO_STAGE['in_service']).toBe('complete')
  })
})

// ── TASK_DATE_FIELDS ───────────────────────────────────────────────────────

describe('TASK_DATE_FIELDS', () => {
  it('maps NTP to ntp_date', () => {
    expect(TASK_DATE_FIELDS['ntp']).toBe('ntp_date')
  })

  it('maps install_done to install_complete_date', () => {
    expect(TASK_DATE_FIELDS['install_done']).toBe('install_complete_date')
  })

  it('maps pto to pto_date', () => {
    expect(TASK_DATE_FIELDS['pto']).toBe('pto_date')
  })

  it('maps in_service to in_service_date', () => {
    expect(TASK_DATE_FIELDS['in_service']).toBe('in_service_date')
  })

  it('all mapped task IDs exist in TASKS', () => {
    const allIds = new Set(Object.values(TASKS).flat().map(t => t.id))
    for (const taskId of Object.keys(TASK_DATE_FIELDS)) {
      expect(allIds.has(taskId)).toBe(true)
    }
  })
})

// ── AHJ_REQUIRED_TASKS ────────────────────────────────────────────────────

describe('AHJ_REQUIRED_TASKS', () => {
  it('wp1 requires Corpus Christi and Texas City', () => {
    expect(AHJ_REQUIRED_TASKS['wp1']).toContain('Corpus Christi')
    expect(AHJ_REQUIRED_TASKS['wp1']).toContain('Texas City')
  })

  it('all AHJ task IDs exist in TASKS', () => {
    const allIds = new Set(Object.values(TASKS).flat().map(t => t.id))
    for (const taskId of Object.keys(AHJ_REQUIRED_TASKS)) {
      expect(allIds.has(taskId)).toBe(true)
    }
  })
})
