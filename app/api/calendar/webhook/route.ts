import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { listCalendarEvents } from '@/lib/google-calendar'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseKey)
}

const WEBHOOK_TOKEN = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN ?? 'nova-calendar-sync'

// ── GET: Health check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'calendar-webhook',
    timestamp: new Date().toISOString(),
  })
}

// ── POST: Receive Google Calendar push notifications ─────────────────────────
// Google sends a notification when events change on a watched calendar.
// Headers include: X-Goog-Channel-Token, X-Goog-Resource-State, X-Goog-Channel-ID

export async function POST(req: NextRequest) {
  const channelToken = req.headers.get('x-goog-channel-token')
  const resourceState = req.headers.get('x-goog-resource-state')
  const channelId = req.headers.get('x-goog-channel-id')

  // Verify webhook token
  if (channelToken !== WEBHOOK_TOKEN) {
    console.warn('Calendar webhook: invalid token')
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  // Google sends a 'sync' event when the watch is first set up — acknowledge it
  if (resourceState === 'sync') {
    console.log('Calendar webhook: sync confirmation received for channel', channelId)
    return NextResponse.json({ status: 'sync acknowledged' })
  }

  // 'exists' means events were changed
  if (resourceState !== 'exists') {
    return NextResponse.json({ status: 'ignored', resourceState })
  }

  const db = getServiceClient()

  try {
    // Find which crew's calendar this notification is for
    // Channel ID format: "nova-crew-{crew_id}"
    const crewId = channelId?.replace('nova-crew-', '') ?? null
    if (!crewId) {
      console.warn('Calendar webhook: cannot extract crew_id from channel', channelId)
      return NextResponse.json({ status: 'ignored' })
    }

    // Load calendar settings for this crew
    const { data: settingsArr } = await db
      .from('calendar_settings')
      .select('*')
      .eq('crew_id', crewId)
      .limit(1)

    const settings = settingsArr?.[0] as Record<string, unknown> | undefined
    if (!settings?.calendar_id) {
      return NextResponse.json({ status: 'no calendar configured for crew' })
    }

    const calendarId = settings.calendar_id as string

    // Fetch recent events from Google Calendar to detect changes
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAhead = new Date(now)
    monthAhead.setDate(monthAhead.getDate() + 60)

    const events = await listCalendarEvents(
      calendarId,
      weekAgo.toISOString().slice(0, 10),
      monthAhead.toISOString().slice(0, 10)
    )

    // Load all sync entries for this crew
    const { data: syncEntries } = await db
      .from('calendar_sync')
      .select('*')
      .eq('crew_id', crewId)

    const syncByEventId = new Map(
      (syncEntries ?? []).map((s: Record<string, unknown>) => [s.event_id, s])
    )

    let updated = 0

    // Check each synced event for changes in the Google Calendar
    for (const event of events) {
      const e = event as unknown as Record<string, unknown>
      const eventId = e.id as string
      const syncEntry = syncByEventId.get(eventId) as Record<string, unknown> | undefined

      if (!syncEntry) continue // Event not tracked by us

      const scheduleId = syncEntry.schedule_id as string

      // Check if the event date/time changed in Google Calendar
      const startObj = e.start as Record<string, string> | undefined
      const endObj = e.end as Record<string, string> | undefined
      if (!startObj) continue

      const newDate = startObj.date ?? startObj.dateTime?.slice(0, 10)
      const newTime = startObj.dateTime ? startObj.dateTime.slice(11, 16) : null

      // Calculate end_date for multi-day events
      let newEndDate: string | null = null
      if (endObj?.date) {
        // All-day end dates are exclusive in Google Calendar, subtract 1 day
        const endDate = new Date(endObj.date + 'T00:00:00')
        endDate.setDate(endDate.getDate() - 1)
        const endStr = endDate.toISOString().slice(0, 10)
        if (endStr !== newDate) {
          newEndDate = endStr
        }
      }

      if (!newDate) continue

      // Load current schedule entry
      const { data: currentSched } = await db
        .from('schedule')
        .select('date, time, end_date, notes')
        .eq('id', scheduleId)
        .single()

      if (!currentSched) continue
      const curr = currentSched as Record<string, unknown>

      // Check if anything changed
      const dateChanged = curr.date !== newDate
      const timeChanged = (curr.time ?? null) !== newTime
      const endDateChanged = (curr.end_date ?? null) !== newEndDate

      if (dateChanged || timeChanged || endDateChanged) {
        // Update the schedule entry
        const updateFields: Record<string, unknown> = {}
        if (dateChanged) updateFields.date = newDate
        if (timeChanged) updateFields.time = newTime
        if (endDateChanged) updateFields.end_date = newEndDate

        const { error: updateErr } = await db
          .from('schedule')
          .update(updateFields)
          .eq('id', scheduleId)

        if (!updateErr) {
          // Update sync timestamp
          await db
            .from('calendar_sync')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', syncEntry.id)
          updated++
        }
      }
    }

    return NextResponse.json({
      status: 'processed',
      crew_id: crewId,
      events_checked: events.length,
      updated,
    })
  } catch (err) {
    console.error('Calendar webhook processing error:', err)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }
}
