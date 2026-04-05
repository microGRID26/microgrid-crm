import { describe, it, expect } from 'vitest'
import { canAdvance } from '@/lib/hooks/useProjectTasks'

// ── canAdvance ─────────────────────────────────────────────────────────────

describe('canAdvance', () => {
  // Evaluation requires: welcome, ia, ub, sched_survey, ntp

  it('allows advance when all required tasks complete', () => {
    const tasks = {
      welcome: 'Complete',
      ia: 'Complete',
      ub: 'Complete',
      sched_survey: 'Complete',
      ntp: 'Complete',
    }
    const result = canAdvance('evaluation', tasks)
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('blocks advance when tasks are incomplete', () => {
    const tasks = {
      welcome: 'Complete',
      ia: 'In Progress',
      ub: 'Complete',
      sched_survey: 'Not Ready',
      ntp: 'Complete',
    }
    const result = canAdvance('evaluation', tasks)
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('IA Confirmation')
    expect(result.missing).toContain('Schedule Site Survey')
    expect(result.missing).toHaveLength(2)
  })

  it('blocks when no tasks are started', () => {
    const result = canAdvance('evaluation', {})
    expect(result.ok).toBe(false)
    expect(result.missing).toHaveLength(5) // all 5 evaluation tasks
  })

  it('ignores optional tasks in design stage', () => {
    // Design has required: build_design, scope, monitoring, build_eng, eng_approval
    // Optional: stamps, wp1, prod_add, new_ia, onsite_redesign, quote_ext_scope
    const tasks = {
      build_design: 'Complete',
      scope: 'Complete',
      monitoring: 'Complete',
      build_eng: 'Complete',
      eng_approval: 'Complete',
      // Optional tasks NOT complete — should still pass
    }
    const result = canAdvance('design', tasks)
    expect(result.ok).toBe(true)
  })

  it('requires wp1 for Corpus Christi AHJ', () => {
    const tasks = {
      build_design: 'Complete',
      scope: 'Complete',
      monitoring: 'Complete',
      build_eng: 'Complete',
      eng_approval: 'Complete',
      // wp1 NOT complete
    }
    const result = canAdvance('design', tasks, 'Corpus Christi')
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('WP1')
  })

  it('wp1 not required for Houston AHJ', () => {
    const tasks = {
      build_design: 'Complete',
      scope: 'Complete',
      monitoring: 'Complete',
      build_eng: 'Complete',
      eng_approval: 'Complete',
    }
    const result = canAdvance('design', tasks, 'Houston')
    expect(result.ok).toBe(true)
  })

  it('handles survey stage', () => {
    // Survey requires: site_survey, survey_review
    const tasks = { site_survey: 'Complete', survey_review: 'Complete' }
    expect(canAdvance('survey', tasks).ok).toBe(true)
  })

  it('handles permit stage', () => {
    // Permit requires: hoa, om_review, city_permit, util_permit, checkpoint1
    const tasks = {
      hoa: 'Complete',
      om_review: 'Complete',
      city_permit: 'Complete',
      util_permit: 'Complete',
      checkpoint1: 'Complete',
    }
    expect(canAdvance('permit', tasks).ok).toBe(true)
  })

  it('handles install stage', () => {
    // Install requires: sched_install, inventory, install_done
    const tasks = {
      sched_install: 'Complete',
      inventory: 'Complete',
      install_done: 'Complete',
    }
    expect(canAdvance('install', tasks).ok).toBe(true)
  })

  it('handles complete stage', () => {
    // Complete requires: pto, in_service
    const tasks = { pto: 'Complete', in_service: 'Complete' }
    expect(canAdvance('complete', tasks).ok).toBe(true)
  })

  it('returns empty missing for unknown stage', () => {
    const result = canAdvance('mystery', {})
    expect(result.ok).toBe(true) // no tasks = nothing to block
    expect(result.missing).toEqual([])
  })

  it('handles null ahj', () => {
    const tasks = {
      build_design: 'Complete',
      scope: 'Complete',
      monitoring: 'Complete',
      build_eng: 'Complete',
      eng_approval: 'Complete',
    }
    // null ahj = no AHJ-specific requirements
    expect(canAdvance('design', tasks, null).ok).toBe(true)
  })

  it('only reports required tasks in missing, not optional', () => {
    // All required tasks done except ntp
    const tasks = {
      welcome: 'Complete',
      ia: 'Complete',
      ub: 'Complete',
      sched_survey: 'Complete',
    }
    const result = canAdvance('evaluation', tasks)
    expect(result.missing).toEqual(['NTP Procedure'])
  })
})
