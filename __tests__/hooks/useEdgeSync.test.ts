import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// useEdgeSync now calls fetch via edge-events-client (fire-and-forget)
const mockFetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
vi.stubGlobal('fetch', mockFetch)

import { useEdgeSync } from '@/lib/hooks/useEdgeSync'

function lastFetchBody(): Record<string, unknown> {
  const calls = mockFetch.mock.calls as unknown[][]
  const call = calls[calls.length - 1]
  return JSON.parse(((call[1] as RequestInit).body) as string)
}

describe('useEdgeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all expected functions', () => {
    const { result } = renderHook(() => useEdgeSync())
    expect(result.current.notifyInstallComplete).toBeTypeOf('function')
    expect(result.current.notifyPTOReceived).toBeTypeOf('function')
    expect(result.current.notifyStageChanged).toBeTypeOf('function')
    expect(result.current.notifyFundingMilestone).toBeTypeOf('function')
    expect(result.current.notifyInService).toBeTypeOf('function')
    expect(result.current.send).toBeTypeOf('function')
  })

  function callBody(callIndex: number): Record<string, unknown> {
    const calls = mockFetch.mock.calls as unknown[][]
    return JSON.parse(((calls[callIndex][1] as RequestInit).body) as string)
  }

  it('notifyInstallComplete sends event and syncs funding', () => {
    const { result } = renderHook(() => useEdgeSync())
    result.current.notifyInstallComplete('PROJ-100', '2026-04-01')
    expect(callBody(0)).toMatchObject({
      event: 'project.install_complete',
      projectId: 'PROJ-100',
      data: { install_complete_date: '2026-04-01' },
    })
    expect(callBody(1)).toMatchObject({ projectId: 'PROJ-100', type: 'funding' })
  })

  it('notifyPTOReceived sends event and syncs funding', () => {
    const { result } = renderHook(() => useEdgeSync())
    result.current.notifyPTOReceived('PROJ-200', '2026-04-05')
    expect(callBody(0)).toMatchObject({
      event: 'project.pto_received',
      projectId: 'PROJ-200',
      data: { pto_date: '2026-04-05' },
    })
    expect(callBody(1)).toMatchObject({ projectId: 'PROJ-200', type: 'funding' })
  })

  it('notifyStageChanged sends old and new stage', () => {
    const { result } = renderHook(() => useEdgeSync())
    result.current.notifyStageChanged('PROJ-300', 'design', 'permit')
    expect(lastFetchBody()).toMatchObject({
      event: 'project.stage_changed',
      projectId: 'PROJ-300',
      data: { old_stage: 'design', new_stage: 'permit' },
    })
  })

  it('notifyFundingMilestone sends milestone and status', () => {
    const { result } = renderHook(() => useEdgeSync())
    result.current.notifyFundingMilestone('PROJ-400', 'M1', 'Eligible')
    expect(lastFetchBody()).toMatchObject({
      event: 'funding.milestone_updated',
      projectId: 'PROJ-400',
      data: { milestone: 'M1', status: 'Eligible' },
    })
  })

  it('notifyInService sends in_service event with today date', () => {
    const { result } = renderHook(() => useEdgeSync())
    result.current.notifyInService('PROJ-500')
    const body = lastFetchBody()
    expect(body).toMatchObject({ event: 'project.in_service', projectId: 'PROJ-500' })
    expect((body.data as Record<string, string>).in_service_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('send passes through custom event type and data', () => {
    const { result } = renderHook(() => useEdgeSync())
    result.current.send('project.updated' as any, 'PROJ-600', { custom: 'data' })
    expect(lastFetchBody()).toMatchObject({
      event: 'project.updated',
      projectId: 'PROJ-600',
      data: { custom: 'data' },
    })
  })

  it('all functions are fire-and-forget (return undefined)', () => {
    const { result } = renderHook(() => useEdgeSync())
    expect(result.current.notifyInstallComplete('PROJ-1', '2026-01-01')).toBeUndefined()
    expect(result.current.notifyPTOReceived('PROJ-1', '2026-01-01')).toBeUndefined()
    expect(result.current.notifyStageChanged('PROJ-1', 'a', 'b')).toBeUndefined()
    expect(result.current.notifyFundingMilestone('PROJ-1', 'M1', 'Eligible')).toBeUndefined()
    expect(result.current.notifyInService('PROJ-1')).toBeUndefined()
  })

  it('does not throw when fetch rejects', () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useEdgeSync())
    // Should not throw — fire-and-forget
    expect(() => result.current.notifyInstallComplete('PROJ-1', '2026-01-01')).not.toThrow()
  })
})
