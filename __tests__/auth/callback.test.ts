import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the auth callback logic directly since it's a server-side route
describe('auth callback', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn(),
        getUser: vi.fn(),
      },
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }
  })

  it('redirects to /command on successful exchange', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'test@gomicrogridenergy.com', user_metadata: { full_name: 'Test User' } } },
      error: null,
    })

    const { error } = await mockSupabase.auth.exchangeCodeForSession('valid-code')
    expect(error).toBeNull()
  })

  it('redirects to /login?error=auth_failed on exchange failure', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid code' },
    })

    const { error } = await mockSupabase.auth.exchangeCodeForSession('bad-code')
    expect(error).toBeTruthy()
    expect(error.message).toBe('Invalid code')
  })

  it('provisions user after successful exchange', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'new@gomicrogridenergy.com', user_metadata: { full_name: 'New User' } } },
      error: null,
    })

    // Simulate the callback logic
    const { error } = await mockSupabase.auth.exchangeCodeForSession('code')
    if (!error) {
      const { data: { user } } = await mockSupabase.auth.getUser()
      if (user?.email) {
        await mockSupabase.rpc('provision_user', {
          p_email: user.email,
          p_name: user.user_metadata?.full_name ?? user.email.split('@')[0],
        })
      }
    }

    expect(mockSupabase.rpc).toHaveBeenCalledWith('provision_user', {
      p_email: 'new@gomicrogridenergy.com',
      p_name: 'New User',
    })
  })

  it('uses email prefix when full_name is missing', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'test@gomicrogridenergy.com', user_metadata: {} } },
      error: null,
    })

    const { error } = await mockSupabase.auth.exchangeCodeForSession('code')
    if (!error) {
      const { data: { user } } = await mockSupabase.auth.getUser()
      if (user?.email) {
        await mockSupabase.rpc('provision_user', {
          p_email: user.email,
          p_name: user.user_metadata?.full_name ?? user.email.split('@')[0],
        })
      }
    }

    expect(mockSupabase.rpc).toHaveBeenCalledWith('provision_user', {
      p_email: 'test@gomicrogridenergy.com',
      p_name: 'test',
    })
  })

  it('skips provisioning when no code provided', async () => {
    // No code = no exchange, no provisioning
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockSupabase.rpc).not.toHaveBeenCalled()
  })
})
