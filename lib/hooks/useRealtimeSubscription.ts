'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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

  // Stable ref for the callback so we don't re-subscribe when it changes
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const unsubscribe = useCallback(() => {
    // Will be set by the effect cleanup
  }, [])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channelName = `realtime-${table}-${Math.random().toString(36).slice(2, 8)}`

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

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [table, event, filter, debounceMs, enabled])

  return { unsubscribe }
}
