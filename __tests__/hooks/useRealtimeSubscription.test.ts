import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('useRealtimeSubscription', () => {
  it('creates channel and subscribes when enabled', async () => {
    const subscribeFn = vi.fn()
    const onFn = vi.fn().mockReturnThis()
    const channelObj = { on: onFn, subscribe: subscribeFn }
    const channelFn = vi.fn((..._args: any[]) => channelObj)
    const removeChannelFn = vi.fn()

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        channel: channelFn,
        removeChannel: removeChannelFn,
      }),
    }))

    const { useRealtimeSubscription } = await import('@/lib/hooks/useRealtimeSubscription')

    renderHook(() =>
      useRealtimeSubscription('projects', {
        onChange: () => {},
        enabled: true,
      })
    )

    expect(channelFn).toHaveBeenCalledWith(expect.stringMatching(/^realtime::projects::\*::all::/))
    expect(onFn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: '*', schema: 'public', table: 'projects' }),
      expect.any(Function)
    )
    expect(subscribeFn).toHaveBeenCalled()
  })

  it('cleans up channel on unmount', async () => {
    const channelObj: Record<string, any> = {}
    channelObj.on = vi.fn(() => channelObj)
    channelObj.subscribe = vi.fn(() => channelObj)
    const channelFn = vi.fn((..._args: any[]) => channelObj)
    const removeChannelFn = vi.fn()

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        channel: channelFn,
        removeChannel: removeChannelFn,
      }),
    }))

    const { useRealtimeSubscription } = await import('@/lib/hooks/useRealtimeSubscription')

    const { unmount } = renderHook(() =>
      useRealtimeSubscription('projects', {
        onChange: () => {},
        enabled: true,
      })
    )

    unmount()

    expect(removeChannelFn).toHaveBeenCalledWith(channelObj)
  })

  it('debounces onChange callback', async () => {
    vi.useFakeTimers()

    const subscribeFn = vi.fn()
    const onFn = vi.fn().mockReturnThis()
    const channelObj = { on: onFn, subscribe: subscribeFn }
    const channelFn = vi.fn((..._args: any[]) => channelObj)
    const removeChannelFn = vi.fn()

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        channel: channelFn,
        removeChannel: removeChannelFn,
      }),
    }))

    const { useRealtimeSubscription } = await import('@/lib/hooks/useRealtimeSubscription')
    const onChange = vi.fn()

    renderHook(() =>
      useRealtimeSubscription('projects', {
        onChange,
        debounceMs: 200,
        enabled: true,
      })
    )

    // Get the handler that was passed to .on()
    const handler = onFn.mock.calls[0][2]

    // Fire the handler multiple times rapidly
    handler()
    handler()
    handler()

    // onChange should not have been called yet (debounce pending)
    expect(onChange).not.toHaveBeenCalled()

    // Advance past the debounce window
    vi.advanceTimersByTime(200)

    // Should have been called exactly once
    expect(onChange).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('does not subscribe when enabled is false', async () => {
    const subscribeFn = vi.fn()
    const onFn = vi.fn().mockReturnThis()
    const channelObj = { on: onFn, subscribe: subscribeFn }
    const channelFn = vi.fn((..._args: any[]) => channelObj)
    const removeChannelFn = vi.fn()

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        channel: channelFn,
        removeChannel: removeChannelFn,
      }),
    }))

    const { useRealtimeSubscription } = await import('@/lib/hooks/useRealtimeSubscription')

    renderHook(() =>
      useRealtimeSubscription('projects', {
        onChange: () => {},
        enabled: false,
      })
    )

    expect(channelFn).not.toHaveBeenCalled()
    expect(subscribeFn).not.toHaveBeenCalled()
  })

  it('uses stable channel names (no Math.random)', async () => {
    const subscribeFn = vi.fn()
    const onFn = vi.fn().mockReturnThis()
    const channelObj = { on: onFn, subscribe: subscribeFn }
    const channelFn = vi.fn((..._args: any[]) => channelObj)
    const removeChannelFn = vi.fn()

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        channel: channelFn,
        removeChannel: removeChannelFn,
      }),
    }))

    const { useRealtimeSubscription } = await import('@/lib/hooks/useRealtimeSubscription')

    const { rerender } = renderHook(() =>
      useRealtimeSubscription('task_state', {
        onChange: () => {},
        event: 'UPDATE',
        filter: 'project_id=eq.PROJ-001',
        enabled: true,
      })
    )

    const firstChannelName = channelFn.mock.calls[0][0]
    expect(firstChannelName).toMatch(/^realtime::task_state::UPDATE::project_id=eq\.PROJ-001::/)

    // Re-render with same props should produce the same channel name (useId is stable per instance)
    rerender()

    if (channelFn.mock.calls.length > 1) {
      expect(channelFn.mock.calls[1][0]).toBe(firstChannelName)
    }
  })

  it('produces unique channel names across hook instances (no collision)', async () => {
    // Regression: Jen Harper 2026-04-27 — two useSupabaseQuery('task_state') hooks on the
    // same page (app/command/page.tsx:54+61) collided on the shared channel name and the
    // second .on('postgres_changes', ...) threw "cannot add postgres_changes callbacks ...
    // after subscribe()".
    const subscribeFn = vi.fn().mockReturnThis()
    const onFn = vi.fn().mockReturnThis()
    const channelFn = vi.fn((..._args: any[]) => ({ on: onFn, subscribe: subscribeFn }))
    const removeChannelFn = vi.fn()

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        channel: channelFn,
        removeChannel: removeChannelFn,
      }),
    }))

    const { useRealtimeSubscription } = await import('@/lib/hooks/useRealtimeSubscription')

    renderHook(() =>
      useRealtimeSubscription('task_state', { onChange: () => {}, enabled: true })
    )
    renderHook(() =>
      useRealtimeSubscription('task_state', { onChange: () => {}, enabled: true })
    )

    expect(channelFn).toHaveBeenCalledTimes(2)
    const firstName = channelFn.mock.calls[0]?.[0]
    const secondName = channelFn.mock.calls[1]?.[0]
    expect(firstName).not.toBe(secondName)
    expect(firstName).toMatch(/^realtime::task_state::\*::all::/)
    expect(secondName).toMatch(/^realtime::task_state::\*::all::/)
  })
})
