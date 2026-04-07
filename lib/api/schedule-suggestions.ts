// ── Schedule Suggestion Engine ───────────────────────────────────────────────
// Suggests optimal schedule slots for projects ready for install, inspection,
// or survey. Scores by crew availability and geographic proximity.

import { db } from '@/lib/db'

export interface ScheduleSuggestion {
  project_id: string
  project_name: string
  city: string | null
  zip: string | null
  systemkw: number | null
  task_type: 'install' | 'inspection' | 'survey'
  suggested_crew: string | null
  suggested_crew_name: string | null
  suggested_date: string
  proximity_score: number  // 0-100, higher = closer to existing jobs
  reason: string           // human-readable explanation
}

/** Task IDs that indicate a project is ready for scheduling */
const SCHEDULABLE_TASKS: Record<string, ScheduleSuggestion['task_type']> = {
  'sched_install': 'install',
  'sched_city':    'inspection',
  'sched_survey':  'survey',
}

/** Job types that map to each task type on the schedule */
const TASK_TO_JOB_TYPE: Record<ScheduleSuggestion['task_type'], string> = {
  install:    'install',
  inspection: 'inspection',
  survey:     'survey',
}

/** Maximum daily jobs per crew before considering them "full" */
const MAX_DAILY_JOBS = 3

/**
 * Generate schedule suggestions for the next 2 weeks.
 * Finds projects with scheduling tasks in "Ready To Start" status,
 * then scores available crew+date combinations by proximity and availability.
 */
export async function generateScheduleSuggestions(orgId?: string): Promise<ScheduleSuggestion[]> {
  try {
    const today = new Date()
    const todayIso = today.toISOString().slice(0, 10)
    const twoWeeksOut = new Date(today)
    twoWeeksOut.setDate(today.getDate() + 14)
    const endIso = twoWeeksOut.toISOString().slice(0, 10)

    // ── 1. Find projects with scheduling tasks in "Ready To Start" ──────────
    const taskIds = Object.keys(SCHEDULABLE_TASKS)
    let taskQuery = db().from('task_state')
      .select('project_id, task_id, status')
      .in('task_id', taskIds)
      .eq('status', 'Ready To Start')
      .limit(200)
    if (orgId) taskQuery = taskQuery.eq('org_id', orgId)

    const { data: readyTasks, error: taskErr } = await taskQuery
    if (taskErr) {
      console.error('[schedule-suggestions] task_state query failed:', taskErr)
      return []
    }
    if (!readyTasks || readyTasks.length === 0) return []

    // ── 2. Load project details for addresses/zips ──────────────────────────
    const projectIds = [...new Set((readyTasks as { project_id: string }[]).map(t => t.project_id))]
    const { data: projects, error: projErr } = await db().from('projects')
      .select('id, name, city, zip, systemkw, org_id')
      .in('id', projectIds)
      .limit(500)
    if (projErr) {
      console.error('[schedule-suggestions] projects query failed:', projErr)
      return []
    }
    const projectMap = new Map(
      ((projects ?? []) as { id: string; name: string; city: string | null; zip: string | null; systemkw: number | null; org_id: string | null }[])
        .map(p => [p.id, p])
    )

    // ── 3. Load active crews ────────────────────────────────────────────────
    let crewQuery = db().from('crews')
      .select('id, name, warehouse')
      .eq('active', 'TRUE')
      .order('name', { ascending: true })
      .limit(100)
    if (orgId) crewQuery = crewQuery.eq('org_id', orgId)

    const { data: crews, error: crewErr } = await crewQuery
    if (crewErr) {
      console.error('[schedule-suggestions] crews query failed:', crewErr)
      return []
    }
    if (!crews || crews.length === 0) return []

    // ── 4. Load existing schedule for next 2 weeks ──────────────────────────
    let schedQuery = db().from('schedule')
      .select('id, project_id, crew_id, job_type, date, status')
      .gte('date', todayIso)
      .lte('date', endIso)
      .neq('status', 'cancelled')
      .limit(5000)
    if (orgId) schedQuery = schedQuery.eq('org_id', orgId)

    const { data: existingSchedule, error: schedErr } = await schedQuery
    if (schedErr) {
      console.error('[schedule-suggestions] schedule query failed:', schedErr)
      return []
    }

    // Also load project details for scheduled jobs (for proximity matching)
    const scheduledProjectIds = [...new Set(
      ((existingSchedule ?? []) as { project_id: string }[])
        .map(s => s.project_id).filter(Boolean)
    )]
    let scheduledProjectMap = new Map<string, { city: string | null; zip: string | null }>()
    if (scheduledProjectIds.length > 0) {
      const { data: schedProjects } = await db().from('projects')
        .select('id, city, zip')
        .in('id', scheduledProjectIds)
        .limit(2000)
      scheduledProjectMap = new Map(
        ((schedProjects ?? []) as { id: string; city: string | null; zip: string | null }[])
          .map(p => [p.id, { city: p.city, zip: p.zip }])
      )
    }

    // ── 5. Build crew+date availability map ─────────────────────────────────
    // key: "crewId|date" → count of jobs + list of zips/cities
    type SlotInfo = { count: number; zips: Set<string>; cities: Set<string> }
    const slotMap = new Map<string, SlotInfo>()

    for (const entry of (existingSchedule ?? []) as { crew_id: string; date: string; project_id: string }[]) {
      if (!entry.crew_id || !entry.date) continue
      const key = `${entry.crew_id}|${entry.date}`
      if (!slotMap.has(key)) slotMap.set(key, { count: 0, zips: new Set(), cities: new Set() })
      const slot = slotMap.get(key)!
      slot.count++
      const projGeo = scheduledProjectMap.get(entry.project_id)
      if (projGeo?.zip) slot.zips.add(projGeo.zip)
      if (projGeo?.city) slot.cities.add(projGeo.city.toLowerCase())
    }

    // ── 6. Generate working days for the next 2 weeks (Mon-Sat) ─────────────
    const workingDays: string[] = []
    const cursor = new Date(today)
    cursor.setDate(cursor.getDate() + 1) // Start from tomorrow
    while (cursor <= twoWeeksOut) {
      const dow = cursor.getDay()
      if (dow >= 1 && dow <= 6) { // Mon-Sat
        workingDays.push(cursor.toISOString().slice(0, 10))
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    // ── 7. Score each project × crew × date combination ────────────────────
    const suggestions: ScheduleSuggestion[] = []

    // Track which projects are already scheduled to avoid duplicate suggestions
    const alreadyScheduled = new Set(
      ((existingSchedule ?? []) as { project_id: string; job_type: string }[])
        .map(s => `${s.project_id}|${s.job_type}`)
    )

    for (const task of (readyTasks as { project_id: string; task_id: string }[])) {
      const project = projectMap.get(task.project_id)
      if (!project) continue

      const taskType = SCHEDULABLE_TASKS[task.task_id]
      if (!taskType) continue

      const jobType = TASK_TO_JOB_TYPE[taskType]

      // Skip if already scheduled
      if (alreadyScheduled.has(`${task.project_id}|${jobType}`)) continue

      let bestScore = -1
      let bestCrew: { id: string; name: string } | null = null
      let bestDate = ''
      let bestReason = ''

      for (const crew of (crews as { id: string; name: string }[])) {
        for (const day of workingDays) {
          const key = `${crew.id}|${day}`
          const slot = slotMap.get(key)
          const jobCount = slot?.count ?? 0

          // Skip full days
          if (jobCount >= MAX_DAILY_JOBS) continue

          // Base score: fewer jobs = more available
          let score = Math.max(0, (MAX_DAILY_JOBS - jobCount) * 10) // 10-30 for availability

          // Proximity scoring
          let proximityReason = 'open slot'
          if (slot) {
            if (project.zip && slot.zips.has(project.zip)) {
              score += 100 // Same zip code
              proximityReason = `same zip (${project.zip}) as existing job`
            } else if (project.city && slot.cities.has(project.city.toLowerCase())) {
              score += 75 // Same city
              proximityReason = `same city (${project.city}) as existing job`
            } else {
              score += 25 // Different area but crew has jobs
              proximityReason = 'crew active that day'
            }
          } else {
            // Empty day — lower proximity but good availability
            score += 15
            proximityReason = 'crew fully available'
          }

          // Prefer sooner dates (small bonus for earlier)
          const dayIndex = workingDays.indexOf(day)
          score += Math.max(0, 5 - Math.floor(dayIndex / 3))

          if (score > bestScore) {
            bestScore = score
            bestCrew = crew
            bestDate = day
            bestReason = proximityReason
          }
        }
      }

      if (bestCrew && bestDate) {
        // Clamp proximity_score to 0-100
        const proximityScore = Math.min(100, Math.max(0, bestScore))

        const dateLabel = new Date(bestDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        })

        suggestions.push({
          project_id: project.id,
          project_name: project.name ?? project.id,
          city: project.city,
          zip: project.zip,
          systemkw: project.systemkw,
          task_type: taskType,
          suggested_crew: bestCrew.id,
          suggested_crew_name: bestCrew.name,
          suggested_date: bestDate,
          proximity_score: proximityScore,
          reason: `${bestCrew.name} on ${dateLabel} — ${bestReason}`,
        })
      }
    }

    // Sort by proximity_score descending, then by date ascending
    suggestions.sort((a, b) => {
      if (b.proximity_score !== a.proximity_score) return b.proximity_score - a.proximity_score
      return a.suggested_date.localeCompare(b.suggested_date)
    })

    return suggestions.slice(0, 20)
  } catch (err) {
    console.error('[schedule-suggestions] unexpected error:', err)
    return []
  }
}
