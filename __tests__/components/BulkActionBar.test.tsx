import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getAllowedDispositions, useBulkSelect } from '@/components/BulkActionBar'
import type { Project } from '@/types/database'

// ── getAllowedDispositions ───────────────────────────────────────────────────

describe('getAllowedDispositions', () => {
  it('Sale allows Sale and Loyalty', () => {
    expect(getAllowedDispositions('Sale')).toEqual(['Sale', 'Loyalty'])
  })

  it('null defaults to Sale rules', () => {
    expect(getAllowedDispositions(null)).toEqual(['Sale', 'Loyalty'])
  })

  it('Loyalty allows Sale, Loyalty, and Cancelled', () => {
    expect(getAllowedDispositions('Loyalty')).toEqual(['Sale', 'Loyalty', 'Cancelled'])
  })

  it('In Service allows Sale and In Service', () => {
    expect(getAllowedDispositions('In Service')).toEqual(['Sale', 'In Service'])
  })

  it('Cancelled allows Loyalty and Cancelled', () => {
    expect(getAllowedDispositions('Cancelled')).toEqual(['Loyalty', 'Cancelled'])
  })

  it('unknown disposition defaults to Sale and Loyalty', () => {
    expect(getAllowedDispositions('InvalidValue')).toEqual(['Sale', 'Loyalty'])
  })

  it('Sale cannot transition directly to Cancelled', () => {
    const allowed = getAllowedDispositions('Sale')
    expect(allowed).not.toContain('Cancelled')
  })

  it('Cancelled cannot transition to In Service', () => {
    const allowed = getAllowedDispositions('Cancelled')
    expect(allowed).not.toContain('In Service')
  })

  it('Cancelled option is only available from Loyalty and Cancelled states', () => {
    const statesWithCancelled = ['Sale', 'Loyalty', 'In Service', 'Cancelled', null]
      .filter(s => getAllowedDispositions(s).includes('Cancelled'))
    expect(statesWithCancelled).toEqual(['Loyalty', 'Cancelled'])
  })
})

// ── Cancelled filtering for non-admin ───────────────────────────────────────
// The BulkActionBar component conditionally renders the Cancelled option
// based on currentUser?.isAdmin. We test the logic that would drive that filtering.

describe('Cancelled disposition filtering by admin status', () => {
  it('non-admin should not see Cancelled even when allowed by rules', () => {
    const isAdmin = false
    const allowed = getAllowedDispositions('Loyalty')
    const filtered = isAdmin ? allowed : allowed.filter(d => d !== 'Cancelled')
    expect(filtered).toEqual(['Sale', 'Loyalty'])
    expect(filtered).not.toContain('Cancelled')
  })

  it('admin sees all allowed dispositions including Cancelled', () => {
    const isAdmin = true
    const allowed = getAllowedDispositions('Loyalty')
    const filtered = isAdmin ? allowed : allowed.filter(d => d !== 'Cancelled')
    expect(filtered).toEqual(['Sale', 'Loyalty', 'Cancelled'])
  })

  it('non-admin filtering does not affect states without Cancelled', () => {
    const isAdmin = false
    const allowed = getAllowedDispositions('Sale')
    const filtered = isAdmin ? allowed : allowed.filter(d => d !== 'Cancelled')
    // Sale -> [Sale, Loyalty] — Cancelled is not present anyway
    expect(filtered).toEqual(['Sale', 'Loyalty'])
  })
})

// ── useBulkSelect ───────────────────────────────────────────────────────────

describe('useBulkSelect', () => {
  const makeProjects = (ids: string[]): Project[] =>
    ids.map(id => ({ id, name: `Project ${id}` } as Project))

  it('starts with selectMode off and no selections', () => {
    const projects = makeProjects(['P1', 'P2', 'P3'])
    const { result } = renderHook(() => useBulkSelect(projects))

    expect(result.current.selectMode).toBe(false)
    expect(result.current.selectedIds.size).toBe(0)
    expect(result.current.selectedProjects).toEqual([])
  })

  it('toggleSelect adds and removes IDs', () => {
    const projects = makeProjects(['P1', 'P2', 'P3'])
    const { result } = renderHook(() => useBulkSelect(projects))

    // Select P1
    act(() => { result.current.toggleSelect('P1') })
    expect(result.current.selectedIds.has('P1')).toBe(true)
    expect(result.current.selectedIds.size).toBe(1)

    // Select P2
    act(() => { result.current.toggleSelect('P2') })
    expect(result.current.selectedIds.size).toBe(2)

    // Deselect P1
    act(() => { result.current.toggleSelect('P1') })
    expect(result.current.selectedIds.has('P1')).toBe(false)
    expect(result.current.selectedIds.size).toBe(1)
  })

  it('selectedProjects returns matching project objects', () => {
    const projects = makeProjects(['P1', 'P2', 'P3'])
    const { result } = renderHook(() => useBulkSelect(projects))

    act(() => { result.current.toggleSelect('P1') })
    act(() => { result.current.toggleSelect('P3') })

    expect(result.current.selectedProjects).toHaveLength(2)
    expect(result.current.selectedProjects.map(p => p.id)).toEqual(['P1', 'P3'])
  })

  it('selectAll adds all given IDs', () => {
    const projects = makeProjects(['P1', 'P2', 'P3'])
    const { result } = renderHook(() => useBulkSelect(projects))

    act(() => { result.current.selectAll(['P1', 'P2', 'P3']) })
    expect(result.current.selectedIds.size).toBe(3)
  })

  it('selectAll merges with existing selections', () => {
    const projects = makeProjects(['P1', 'P2', 'P3', 'P4'])
    const { result } = renderHook(() => useBulkSelect(projects))

    act(() => { result.current.toggleSelect('P1') })
    act(() => { result.current.selectAll(['P2', 'P3']) })

    expect(result.current.selectedIds.size).toBe(3)
    expect(result.current.selectedIds.has('P1')).toBe(true)
    expect(result.current.selectedIds.has('P2')).toBe(true)
    expect(result.current.selectedIds.has('P3')).toBe(true)
  })

  it('deselectAll clears all selections', () => {
    const projects = makeProjects(['P1', 'P2', 'P3'])
    const { result } = renderHook(() => useBulkSelect(projects))

    act(() => { result.current.selectAll(['P1', 'P2', 'P3']) })
    expect(result.current.selectedIds.size).toBe(3)

    act(() => { result.current.deselectAll() })
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('exitSelectMode turns off selectMode and clears selections', () => {
    const projects = makeProjects(['P1', 'P2'])
    const { result } = renderHook(() => useBulkSelect(projects))

    act(() => { result.current.setSelectMode(true) })
    act(() => { result.current.toggleSelect('P1') })

    expect(result.current.selectMode).toBe(true)
    expect(result.current.selectedIds.size).toBe(1)

    act(() => { result.current.exitSelectMode() })

    expect(result.current.selectMode).toBe(false)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('setSelectMode toggles select mode', () => {
    const projects = makeProjects(['P1'])
    const { result } = renderHook(() => useBulkSelect(projects))

    expect(result.current.selectMode).toBe(false)

    act(() => { result.current.setSelectMode(true) })
    expect(result.current.selectMode).toBe(true)

    act(() => { result.current.setSelectMode(false) })
    expect(result.current.selectMode).toBe(false)
  })
})
