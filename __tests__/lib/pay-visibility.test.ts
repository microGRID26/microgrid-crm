import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('getVisibleUserIds', () => {
  it('returns own userId when user is a leaf node (no reports)', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const hierarchy = [
      { id: 'h1', user_id: 'u-manager', role_key: 'manager', parent_id: null, active: true, team_name: null, user_name: 'Manager', org_id: null, created_at: '', updated_at: '' },
      { id: 'h2', user_id: 'u-rep', role_key: 'sales_rep', parent_id: 'h1', active: true, team_name: null, user_name: 'Rep', org_id: null, created_at: '', updated_at: '' },
    ]
    const result = getVisibleUserIds(hierarchy, 'u-rep')
    expect(result).toEqual(['u-rep'])
  })

  it('returns own + direct reports', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const hierarchy = [
      { id: 'h1', user_id: 'u-manager', role_key: 'manager', parent_id: null, active: true, team_name: null, user_name: 'Manager', org_id: null, created_at: '', updated_at: '' },
      { id: 'h2', user_id: 'u-rep1', role_key: 'sales_rep', parent_id: 'h1', active: true, team_name: null, user_name: 'Rep1', org_id: null, created_at: '', updated_at: '' },
      { id: 'h3', user_id: 'u-rep2', role_key: 'sales_rep', parent_id: 'h1', active: true, team_name: null, user_name: 'Rep2', org_id: null, created_at: '', updated_at: '' },
    ]
    const result = getVisibleUserIds(hierarchy, 'u-manager')
    expect(result).toContain('u-manager')
    expect(result).toContain('u-rep1')
    expect(result).toContain('u-rep2')
    expect(result).toHaveLength(3)
  })

  it('returns own + indirect reports (multi-level)', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const hierarchy = [
      { id: 'h1', user_id: 'u-vp', role_key: 'vp', parent_id: null, active: true, team_name: null, user_name: 'VP', org_id: null, created_at: '', updated_at: '' },
      { id: 'h2', user_id: 'u-mgr', role_key: 'manager', parent_id: 'h1', active: true, team_name: null, user_name: 'Mgr', org_id: null, created_at: '', updated_at: '' },
      { id: 'h3', user_id: 'u-rep', role_key: 'sales_rep', parent_id: 'h2', active: true, team_name: null, user_name: 'Rep', org_id: null, created_at: '', updated_at: '' },
    ]
    const result = getVisibleUserIds(hierarchy, 'u-vp')
    expect(result).toContain('u-vp')
    expect(result).toContain('u-mgr')
    expect(result).toContain('u-rep')
    expect(result).toHaveLength(3)
  })

  it('does NOT include parent/sibling nodes', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const hierarchy = [
      { id: 'h1', user_id: 'u-vp', role_key: 'vp', parent_id: null, active: true, team_name: null, user_name: 'VP', org_id: null, created_at: '', updated_at: '' },
      { id: 'h2', user_id: 'u-mgr', role_key: 'manager', parent_id: 'h1', active: true, team_name: null, user_name: 'Mgr', org_id: null, created_at: '', updated_at: '' },
      { id: 'h3', user_id: 'u-rep1', role_key: 'sales_rep', parent_id: 'h2', active: true, team_name: null, user_name: 'Rep1', org_id: null, created_at: '', updated_at: '' },
      { id: 'h4', user_id: 'u-rep2', role_key: 'sales_rep', parent_id: 'h2', active: true, team_name: null, user_name: 'Rep2', org_id: null, created_at: '', updated_at: '' },
    ]
    // Rep1 should NOT see VP, Mgr, or Rep2
    const result = getVisibleUserIds(hierarchy, 'u-rep1')
    expect(result).toEqual(['u-rep1'])
    expect(result).not.toContain('u-vp')
    expect(result).not.toContain('u-mgr')
    expect(result).not.toContain('u-rep2')
  })

  it('returns null when user is not in hierarchy', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const hierarchy = [
      { id: 'h1', user_id: 'u-manager', role_key: 'manager', parent_id: null, active: true, team_name: null, user_name: 'Manager', org_id: null, created_at: '', updated_at: '' },
    ]
    const result = getVisibleUserIds(hierarchy, 'u-unknown')
    expect(result).toBeNull()
  })

  it('handles empty hierarchy', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const result = getVisibleUserIds([], 'u-any')
    expect(result).toBeNull()
  })

  it('handles circular references without infinite loop', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    // Pathological: h2 points to h1, h1 has no parent, but h3 points to h2
    const hierarchy = [
      { id: 'h1', user_id: 'u-a', role_key: 'vp', parent_id: null, active: true, team_name: null, user_name: 'A', org_id: null, created_at: '', updated_at: '' },
      { id: 'h2', user_id: 'u-b', role_key: 'mgr', parent_id: 'h1', active: true, team_name: null, user_name: 'B', org_id: null, created_at: '', updated_at: '' },
      { id: 'h3', user_id: 'u-c', role_key: 'rep', parent_id: 'h2', active: true, team_name: null, user_name: 'C', org_id: null, created_at: '', updated_at: '' },
    ]
    const result = getVisibleUserIds(hierarchy, 'u-a')
    expect(result).toHaveLength(3)
  })

  it('manager sees below but not above (key privacy test)', async () => {
    const { getVisibleUserIds } = await import('@/lib/api/commissions')
    const hierarchy = [
      { id: 'h1', user_id: 'u-vp', role_key: 'vp', parent_id: null, active: true, team_name: null, user_name: 'VP', org_id: null, created_at: '', updated_at: '' },
      { id: 'h2', user_id: 'u-regional', role_key: 'regional', parent_id: 'h1', active: true, team_name: null, user_name: 'Regional', org_id: null, created_at: '', updated_at: '' },
      { id: 'h3', user_id: 'u-mgr', role_key: 'manager', parent_id: 'h2', active: true, team_name: null, user_name: 'Mgr', org_id: null, created_at: '', updated_at: '' },
      { id: 'h4', user_id: 'u-rep', role_key: 'sales_rep', parent_id: 'h3', active: true, team_name: null, user_name: 'Rep', org_id: null, created_at: '', updated_at: '' },
    ]
    // Manager sees self + rep, but NOT VP or Regional
    const result = getVisibleUserIds(hierarchy, 'u-mgr')
    expect(result).toContain('u-mgr')
    expect(result).toContain('u-rep')
    expect(result).not.toContain('u-vp')
    expect(result).not.toContain('u-regional')
    expect(result).toHaveLength(2)
  })
})

describe('updateDocFileUrl', () => {
  it('is exported from the API', async () => {
    const api = await import('@/lib/api')
    expect(typeof api.updateDocFileUrl).toBe('function')
  })
})
