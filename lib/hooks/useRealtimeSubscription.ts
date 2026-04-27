'use client'

import { useEffect, useRef, useCallback, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type TableName = keyof Database['public']['Tables']

interface RealtimeOptions {
  /** Callback when a change is detected */
  onChange: () => void
  /** Debounce interval in ms (default 300) */
  debounceMs?: number
  /** Only subscribe to specific events */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  /** Filter expression (e.g., 'project_id=eq.PROJ-123') */
  filter?: string
  /** Whether subscription is active (default true) */
  enabled?: boolean
}

/**
 * Reusable hook for Supabase realtime subscriptions.
 * Creates a channel, subscribes to postgres_changes, debounces callbacks, and cleans up on unmount.
 */
export function useRealtimeSubscription(table: TableName, options: RealtimeOptions) {
  const { onChange, debounceMs = 300, event = '*', filter, enabled = true } = options

  // Per-instance id so two consumers on the same page (e.g. two useSupabaseQuery('task_state')
  // hooks in app/command/page.tsx) don't collide on a shared channel name. Supabase's
  // client.channel(name) returns the already-subscribed instance for a duplicate name, and
  // the subsequent .on('postgres_changes', ...) throws.
  const instanceId = useId()

  // Stable ref for the callback so we don't re-subscribe when it changes
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const channelRef = useRef<RealtimeChannel | null>(null)

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    // Channel name is unique per hook instance (instanceId suffix) so duplicate subscriptions
    // on the same table/event/filter from different components don't collide.
    const channelName = `realtime::${table}::${event}::${filter ?? 'all'}::${instanceId}`

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const handleChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        onChangeRef.current()
      }, debounceMs)
    }

    const channelConfig: {
      event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: string
      table: string
      filter?: string
    } = {
      event,
      schema: 'public',
      table,
    }
    if (filter) channelConfig.filter = filter

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, handleChange)
      .subscribe()

    channelRef.current = channel

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [table, event, filter, debounceMs, enabled, instanceId])

  // Exposed for callers that need to manually tear down the subscription before unmount,
  // e.g., when switching contexts within a long-lived component. Normal cleanup is automatic via useEffect.
  return { unsubscribe }
}
