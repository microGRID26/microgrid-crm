import { describe, it, expect } from 'vitest'
import { detectDrift, type DriftRow } from '@/lib/legacy-drift'

describe('detectDrift', () => {
  it('reports zero overlap when arrays are disjoint', () => {
    const a: DriftRow[] = [{ id: 'PROJ-1', name: 'Alice', contract: 1000, systemkw: 5 }]
    const b: DriftRow[] = [{ id: 'PROJ-2', name: 'Bob', contract: 2000, systemkw: 6 }]
    const r = detectDrift(a, b)
    expect(r.overlapCount).toBe(0)
    expect(r.onlyInProjects).toEqual(['PROJ-1'])
    expect(r.onlyInLegacy).toEqual(['PROJ-2'])
    expect(r.disagreements).toEqual([])
  })

  it('reports no disagreements when overlap rows match exactly', () => {
    const row: DriftRow = { id: 'PROJ-100', name: 'Hugo Torres', contract: 27360, systemkw: 6.84 }
    const r = detectDrift([row], [row])
    expect(r.overlapCount).toBe(1)
    expect(r.disagreements).toEqual([])
  })

  it('treats numeric strings and floats as equal (27360 vs 27360.0)', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'Hugo Torres', contract: '27360.0', systemkw: '6.84' }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'Hugo Torres', contract: 27360, systemkw: 6.84 }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toEqual([])
  })

  it('rounds numeric to 2 decimals to absorb cosmetic noise', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360.001, systemkw: 6.840 }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360.005, systemkw: 6.84  }]
    const r = detectDrift(a, b)
    // 27360.001 → "27360.00", 27360.005 → "27360.01" — these DO differ at 2dp.
    // Real-world: identical contracts would round identically.
    expect(r.disagreements.find(d => d.field === 'contract')).toBeDefined()
    expect(r.disagreements.find(d => d.field === 'systemkw')).toBeUndefined()
  })

  it('flags name mismatch on overlapping id', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'Hugo Torres', contract: 27360, systemkw: 6.84 }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'HUGO TORRES', contract: 27360, systemkw: 6.84 }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toHaveLength(1)
    expect(r.disagreements[0]).toEqual({
      id: 'PROJ-100',
      field: 'name',
      projects: 'Hugo Torres',
      legacy: 'HUGO TORRES',
    })
  })

  it('flags contract mismatch on overlapping id', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 30000, systemkw: 6.84 }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360, systemkw: 6.84 }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toHaveLength(1)
    expect(r.disagreements[0]).toMatchObject({
      id: 'PROJ-100',
      field: 'contract',
      projects: '30000.00',
      legacy: '27360.00',
    })
  })

  it('flags systemkw mismatch on overlapping id', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360, systemkw: 7.50 }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360, systemkw: 6.84 }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toHaveLength(1)
    expect(r.disagreements[0]).toMatchObject({ id: 'PROJ-100', field: 'systemkw' })
  })

  it('flags multiple field disagreements on the same row', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'A', contract: 1, systemkw: 1 }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'B', contract: 2, systemkw: 2 }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toHaveLength(3)
    const fields = r.disagreements.map(d => d.field).sort()
    expect(fields).toEqual(['contract', 'name', 'systemkw'])
  })

  it('handles null values consistently', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: null, contract: null, systemkw: null }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: null, contract: null, systemkw: null }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toEqual([])
  })

  it('treats null vs value as a disagreement', () => {
    const a: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360, systemkw: null }]
    const b: DriftRow[] = [{ id: 'PROJ-100', name: 'X', contract: 27360, systemkw: 6.84 }]
    const r = detectDrift(a, b)
    expect(r.disagreements).toHaveLength(1)
    expect(r.disagreements[0]).toMatchObject({ id: 'PROJ-100', field: 'systemkw', projects: null, legacy: '6.84' })
  })

  it('reports correct partition counts for mixed input', () => {
    const a: DriftRow[] = [
      { id: 'PROJ-1', name: 'A', contract: 100, systemkw: 1 },
      { id: 'PROJ-2', name: 'B', contract: 200, systemkw: 2 },
      { id: 'PROJ-3', name: 'C', contract: 300, systemkw: 3 },
    ]
    const b: DriftRow[] = [
      { id: 'PROJ-2', name: 'B', contract: 200, systemkw: 2 },
      { id: 'PROJ-3', name: 'C-different', contract: 300, systemkw: 3 },
      { id: 'PROJ-4', name: 'D', contract: 400, systemkw: 4 },
    ]
    const r = detectDrift(a, b)
    expect(r.overlapCount).toBe(2)
    expect(r.onlyInProjects).toEqual(['PROJ-1'])
    expect(r.onlyInLegacy).toEqual(['PROJ-4'])
    expect(r.disagreements).toHaveLength(1)
    expect(r.disagreements[0].id).toBe('PROJ-3')
  })
})
