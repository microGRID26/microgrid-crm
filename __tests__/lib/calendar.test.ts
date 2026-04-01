import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockSupabase } from '../../vitest.setup'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((cb: any) => Promise.resolve(result).then(cb)),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── loadCalendarSettings ─────────────────────────────────────────────────────

describe('loadCalendarSettings', () => {
  it('loads all calendar settings ordered by crew_id', async () => {
    const settings = [
      { id: '1', crew_id: 'crew-a', calendar_id: 'cal-1', enabled: true, auto_sync: true, last_full_sync: null },
      { id: '2', crew_id: 'crew-b', calendar_id: null, enabled: false, auto_sync: true, last_full_sync: null },
    ]
    const chain = mockChain({ data: settings, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadCalendarSettings } = await import('@/lib/api/calendar')
    const result = await loadCalendarSettings()

    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_settings')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('crew_id', { ascending: true })
    expect(result).toHaveLength(2)
    expect(result[0].crew_id).toBe('crew-a')
    expect(result[0].enabled).toBe(true)
  })

  it('returns empty array on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadCalendarSettings } = await import('@/lib/api/calendar')
    const result = await loadCalendarSettings()

    expect(result).toEqual([])
    consoleSpy.mockRestore()
  })
})

// ── updateCalendarSettings ───────────────────────────────────────────────────

describe('updateCalendarSettings', () => {
  it('upserts settings for a crew', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { updateCalendarSettings } = await import('@/lib/api/calendar')
    const result = await updateCalendarSettings('crew-a', { enabled: true, calendar_id: 'cal-123' })

    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_settings')
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ crew_id: 'crew-a', enabled: true, calendar_id: 'cal-123' }),
      { onConflict: 'crew_id' }
    )
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'upsert fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { updateCalendarSettings } = await import('@/lib/api/calendar')
    const result = await updateCalendarSettings('crew-a', { enabled: true })

    expect(result).toBe(false)
    consoleSpy.mockRestore()
  })
})

// ── loadSyncStatus ───────────────────────────────────────────────────────────

describe('loadSyncStatus', () => {
  it('loads sync entries for given schedule IDs', async () => {
    const entries = [
      { id: 's1', schedule_id: 'sched-1', calendar_id: 'cal-1', event_id: 'evt-1', sync_status: 'synced' },
    ]
    const chain = mockChain({ data: entries, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadSyncStatus } = await import('@/lib/api/calendar')
    const result = await loadSyncStatus(['sched-1', 'sched-2'])

    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_sync')
    expect(chain.in).toHaveBeenCalledWith('schedule_id', ['sched-1', 'sched-2'])
    expect(result).toHaveLength(1)
    expect(result[0].sync_status).toBe('synced')
  })

  it('returns empty array for empty input', async () => {
    const { loadSyncStatus } = await import('@/lib/api/calendar')
    const result = await loadSyncStatus([])

    expect(result).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })
})

// ── upsertSyncEntry ──────────────────────────────────────────────────────────

describe('upsertSyncEntry', () => {
  it('upserts a sync entry', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { upsertSyncEntry } = await import('@/lib/api/calendar')
    const result = await upsertSyncEntry({
      schedule_id: 'sched-1',
      calendar_id: 'cal-1',
      event_id: 'evt-1',
      crew_id: 'crew-a',
      sync_status: 'synced',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_sync')
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule_id: 'sched-1',
        calendar_id: 'cal-1',
        event_id: 'evt-1',
        sync_status: 'synced',
      }),
      { onConflict: 'schedule_id,calendar_id' }
    )
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'upsert fail' } })
    mockSupabase.from.mockReturnValue(chain)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { upsertSyncEntry } = await import('@/lib/api/calendar')
    const result = await upsertSyncEntry({
      schedule_id: 'sched-1',
      calendar_id: 'cal-1',
      event_id: 'evt-1',
      crew_id: null,
      sync_status: 'error',
    })

    expect(result).toBe(false)
    consoleSpy.mockRestore()
  })
})

// ── deleteSyncEntry ──────────────────────────────────────────────────────────

describe('deleteSyncEntry', () => {
  it('deletes sync entries for a schedule ID', async () => {
    const chain = mockChain({ data: null, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { deleteSyncEntry } = await import('@/lib/api/calendar')
    const result = await deleteSyncEntry('sched-1')

    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_sync')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('schedule_id', 'sched-1')
    expect(result).toBe(true)
  })
})

// ── loadRecentSyncEntries ────────────────────────────────────────────────────

describe('loadRecentSyncEntries', () => {
  it('loads recent entries ordered by last_synced_at desc', async () => {
    const entries = [
      { id: 's1', schedule_id: 'sched-1', sync_status: 'synced', last_synced_at: '2026-03-28T12:00:00Z' },
    ]
    const chain = mockChain({ data: entries, error: null })
    mockSupabase.from.mockReturnValue(chain)

    const { loadRecentSyncEntries } = await import('@/lib/api/calendar')
    const result = await loadRecentSyncEntries(10)

    expect(chain.order).toHaveBeenCalledWith('last_synced_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(10)
    expect(result).toHaveLength(1)
  })
})

// ── JOB_TYPE_COLOR_ID ────────────────────────────────────────────────────────

describe('JOB_TYPE_COLOR_ID', () => {
  it('maps all four job types to Google Calendar color IDs', async () => {
    const { JOB_TYPE_COLOR_ID } = await import('@/lib/api/calendar')
    expect(JOB_TYPE_COLOR_ID.survey).toBe('9')      // blueberry
    expect(JOB_TYPE_COLOR_ID.install).toBe('10')     // basil
    expect(JOB_TYPE_COLOR_ID.inspection).toBe('5')   // banana
    expect(JOB_TYPE_COLOR_ID.service).toBe('11')     // tomato
  })
})

// ── google-calendar.ts helpers ──────────────────────────────────────────────

describe('buildEventTitle', () => {
  it('formats event title with job type label, project name, and ID', async () => {
    const { buildEventTitle } = await import('@/lib/google-calendar')
    expect(buildEventTitle('install', 'Smith Residence', 'PROJ-12345'))
      .toBe('[INSTALLATION] Smith Residence - PROJ-12345')
    expect(buildEventTitle('survey', 'Johnson Home', 'PROJ-99999'))
      .toBe('[SITE SURVEY] Johnson Home - PROJ-99999')
  })

  it('uppercases unknown job types', async () => {
    const { buildEventTitle } = await import('@/lib/google-calendar')
    expect(buildEventTitle('custom_type', 'Test', 'PROJ-1'))
      .toBe('[CUSTOM_TYPE] Test - PROJ-1')
  })
})

describe('buildEventDescription', () => {
  it('includes job type, crew, and CRM link', async () => {
    const { buildEventDescription } = await import('@/lib/google-calendar')
    const desc = buildEventDescription({
      jobType: 'install',
      crewName: 'Crew Alpha',
      notes: 'Bring extra panels',
      projectId: 'PROJ-12345',
      appUrl: 'https://test.example.com',
    })
    expect(desc).toContain('Job Type: Installation')
    expect(desc).toContain('Crew: Crew Alpha')
    expect(desc).toContain('Notes: Bring extra panels')
    expect(desc).toContain('https://test.example.com/pipeline?open=PROJ-12345&tab=info')
  })

  it('omits notes when null', async () => {
    const { buildEventDescription } = await import('@/lib/google-calendar')
    const desc = buildEventDescription({
      jobType: 'survey',
      crewName: 'Crew Beta',
      notes: null,
      projectId: 'PROJ-1',
    })
    expect(desc).not.toContain('Notes:')
    expect(desc).toContain('Job Type: Site Survey')
  })
})

describe('isGoogleCalendarConfigured', () => {
  it('returns false when env var is not set', async () => {
    const original = process.env.GOOGLE_CALENDAR_CREDENTIALS
    delete process.env.GOOGLE_CALENDAR_CREDENTIALS
    const { isGoogleCalendarConfigured } = await import('@/lib/google-calendar')
    expect(isGoogleCalendarConfigured()).toBe(false)
    if (original) process.env.GOOGLE_CALENDAR_CREDENTIALS = original
  })
})
