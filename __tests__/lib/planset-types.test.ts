import { describe, it, expect } from 'vitest'
import { MICROGRID_CONTRACTOR, buildPlansetData, DURACELL_DEFAULTS } from '@/lib/planset-types'
import type { Project } from '@/types/database'

describe('MICROGRID_CONTRACTOR phone', () => {
  it('uses the live 832 number, not the dead 888 number', () => {
    expect(MICROGRID_CONTRACTOR.phone).toBe('(832) 280-7764')
  })
  it('is in proper formatted (XXX) XXX-XXXX shape', () => {
    expect(MICROGRID_CONTRACTOR.phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/)
  })
})

const makeProject = (): Project => ({
  id: 'test',
  name: 'Test',
  address: '',
  city: '',
  zip: '',
  utility: '',
  module_qty: 12,
  battery_qty: null,
  inverter_qty: null,
}) as unknown as Project

describe('PlansetData topology discriminator', () => {
  it('defaults to string-mppt for new Duracell projects', () => {
    const data = buildPlansetData(makeProject())
    expect(data.systemTopology).toBe('string-mppt')
  })
  it('respects override to micro-inverter (Hambrick-style legacy projects)', () => {
    const data = buildPlansetData(makeProject(), { systemTopology: 'micro-inverter' })
    expect(data.systemTopology).toBe('micro-inverter')
  })
  it('rapidShutdownModel defaults to RSD-D-20', () => {
    const data = buildPlansetData(makeProject())
    expect(data.rapidShutdownModel).toBe('RSD-D-20')
  })
  it('rapidShutdownModel override is respected', () => {
    const data = buildPlansetData(makeProject(), { rapidShutdownModel: 'IMO RSD-D-50' })
    expect(data.rapidShutdownModel).toBe('IMO RSD-D-50')
  })
  it('hasCantexBar defaults to true', () => {
    const data = buildPlansetData(makeProject())
    expect(data.hasCantexBar).toBe(true)
  })
  it('hasCantexBar override to false is respected', () => {
    const data = buildPlansetData(makeProject(), { hasCantexBar: false })
    expect(data.hasCantexBar).toBe(false)
  })
})

describe('PlansetRoofFace polygon + setbacks', () => {
  it('roof faces default to empty polygon and all setbacks false (walkable) when not provided', () => {
    const data = buildPlansetData(makeProject(), {
      strings: [{ id: 1, mppt: 1, modules: 12, roofFace: 1, vocCold: 0, vmpNominal: 0, current: 0 }],
    })
    expect(data.roofFaces.length).toBe(1)
    const f = data.roofFaces[0]
    expect(f.polygon).toEqual([])
    expect(f.setbacks).toEqual({ ridge: false, eave: false, rake: false, pathClear: 'walkable' })
  })

  it('roof face polygon + setbacks override is preserved end-to-end', () => {
    const polygon: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const data = buildPlansetData(makeProject(), {
      roofFaces: [{
        id: 1, tilt: 25, azimuth: 180, modules: 12,
        polygon,
        setbacks: { ridge: true, eave: false, rake: false, pathClear: 'partial' },
      }],
    })
    expect(data.roofFaces[0].polygon).toEqual(polygon)
    expect(data.roofFaces[0].setbacks.ridge).toBe(true)
    expect(data.roofFaces[0].setbacks.pathClear).toBe('partial')
  })

  it('pathClear accepts walkable | partial | blocked', () => {
    for (const p of ['walkable', 'partial', 'blocked'] as const) {
      const data = buildPlansetData(makeProject(), {
        roofFaces: [{
          id: 1, tilt: 0, azimuth: 0, modules: 0,
          polygon: [], setbacks: { ridge: false, eave: false, rake: false, pathClear: p },
        }],
      })
      expect(data.roofFaces[0].setbacks.pathClear).toBe(p)
    }
  })
})
