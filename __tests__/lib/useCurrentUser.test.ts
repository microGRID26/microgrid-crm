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
})
