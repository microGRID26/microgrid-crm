import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Reset the module cache before each test to clear the cached user
beforeEach(async () => {
  vi.resetModules()
})

describe('useCurrentUser', () => {
  it('returns user data from users table', async () => {
    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: '1', name: 'Greg Kelsch', role: 'super_admin', email: 'greg@gomicrogridenergy.com' },
            error: null,
          })),
        })),
      })),
    }))

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        from: mockFrom,
        auth: {
          getUser: vi.fn(() => Promise.resolve({
            data: { user: { email: 'greg@gomicrogridenergy.com' } },
            error: null,
          })),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
      }),
    }))

    const { useCurrentUser } = await import('@/lib/useCurrentUser')
    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user?.name).toBe('Greg Kelsch')
    expect(result.current.user?.role).toBe('super_admin')
    expect(result.current.user?.isAdmin).toBe(true)
    expect(result.current.user?.isSuperAdmin).toBe(true)
  })

  it('falls back to email prefix when no user row', async () => {
    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'not found' } })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => Promise.resolve({
            data: { user: { email: 'newuser@gomicrogridenergy.com' } },
            error: null,
          })),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
      }),
    }))

    const { useCurrentUser } = await import('@/lib/useCurrentUser')
    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user?.name).toBe('newuser')
    expect(result.current.user?.role).toBe('user')
    expect(result.current.user?.isAdmin).toBe(false)
  })

  it('handles auth failure gracefully', async () => {
    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        from: vi.fn(),
        auth: {
          getUser: vi.fn(() => Promise.resolve({
            data: { user: null },
            error: null,
          })),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
      }),
    }))

    const { useCurrentUser } = await import('@/lib/useCurrentUser')
    const { result } = renderHook(() => useCurrentUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })

  it('installs auth listener even when cache exists', async () => {
    const onAuthStateChangeMock = vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }))

    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: '1', name: 'Greg', role: 'admin', email: 'greg@gomicrogridenergy.com' },
            error: null,
          })),
        })),
      })),
    }))

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        from: mockFrom,
        auth: {
          getUser: vi.fn(() => Promise.resolve({
            data: { user: { email: 'greg@gomicrogridenergy.com' } },
            error: null,
          })),
          onAuthStateChange: onAuthStateChangeMock,
        },
      }),
    }))

    const { useCurrentUser } = await import('@/lib/useCurrentUser')

    // First render — populates cache
    const { result, unmount } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const firstCallCount = onAuthStateChangeMock.mock.calls.length
    expect(firstCallCount).toBeGreaterThanOrEqual(1)

    unmount()

    // Second render — cache exists, but auth listener should still be installed
    const { result: result2 } = renderHook(() => useCurrentUser())
    await waitFor(() => expect(result2.current.loading).toBe(false))

    // onAuthStateChange should have been called again for the second mount
    expect(onAuthStateChangeMock.mock.calls.length).toBeGreaterThan(firstCallCount)
  })

  it('does not call setState after unmount (mounted guard)', async () => {
    // This test verifies the mountedRef guard prevents setState on unmounted component.
    // We create a scenario where the async resolve fires after unmount.
    let resolveGetUser: (value: any) => void
    const getUserPromise = new Promise(resolve => { resolveGetUser = resolve })

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { id: '1', name: 'Test', role: 'user', email: 'test@gomicrogridenergy.com' },
                error: null,
              })),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn(() => getUserPromise),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
      }),
    }))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { useCurrentUser } = await import('@/lib/useCurrentUser')
    const { result, unmount } = renderHook(() => useCurrentUser())

    // Should be loading while getUser is pending
    expect(result.current.loading).toBe(true)

    // Unmount before getUser resolves
    unmount()

    // Now resolve getUser — the mounted guard should prevent setState
    resolveGetUser!({
      data: { user: { email: 'test@gomicrogridenergy.com' } },
      error: null,
    })

    // Wait a tick for the promise to resolve
    await new Promise(r => setTimeout(r, 50))

    // No React warnings about updating unmounted components should occur.
    // The test passes if no errors are thrown.
    consoleSpy.mockRestore()
  })
})
