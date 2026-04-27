import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SheetPV8 } from '@/components/planset/SheetPV8'
import { buildPlansetData } from '@/lib/planset-types'
import type { Project } from '@/types/database'
import type { PlansetString } from '@/lib/planset-types'

const makeProject = (): Project => ({
  id: 'test',
  name: 'Test',
  address: '',
  city: '',
  zip: '',
  utility: '',
  module_qty: 45,
  battery_qty: null,
  inverter_qty: null,
}) as unknown as Project

// Patricia Smith string config: 5× 9 modules, 3 on INV1 + 2 on INV2.
const patriciaStrings: PlansetString[] = [1, 2, 3, 4, 5].map((id) => ({
  id, mppt: ((id - 1) % 3) + 1, modules: 9, roofFace: 1,
  vocCold: 404.9, vmpNominal: 313.2, current: 12.65,
}))

describe('SheetPV8 OCPD columns — cross-sheet consistency', () => {
  // Patricia Smith case: Seraphim 440W (Isc 13.5A), 2× Duracell Max Hybrid 15kW
  // (80A backfeed each), 200A main. Each row gets validated independently
  // against the rule it has to satisfy.

  it('string OCPD = 25A per NEC 690.9(B): Isc × 1.56 (was 20A using wrong basis)', () => {
    const data = buildPlansetData(makeProject(), { panelCount: 45, inverterCount: 2, strings: patriciaStrings })
    const { container } = render(<SheetPV8 data={data} />)
    // Isc 13.5 × 1.56 = 21.06 → ceil to 25A standard fuse size.
    // PV-6 wire chart already uses this rule; PV-8 was drifted at Imp × 1.25 = 20A.
    const stringRow = Array.from(container.querySelectorAll('tr'))
      .find((tr) => tr.textContent?.includes('STRING 1'))
    expect(stringRow).toBeDefined()
    expect(stringRow?.textContent).toContain('25')
    expect(stringRow?.textContent).not.toMatch(/\b20\b(?!.*USABLE)/) // 20 ≠ string OCPD
  })

  it('inverter→MSP OCPD = data.backfeedBreakerA (was hardcoded 100A drifting from PV-6/PV-7.1/PV-4)', () => {
    const data = buildPlansetData(makeProject(), { panelCount: 45, inverterCount: 2, strings: patriciaStrings })
    const { container } = render(<SheetPV8 data={data} />)
    const invRow = Array.from(container.querySelectorAll('tr'))
      .find((tr) => tr.textContent?.includes('INVERTER → MSP'))
    expect(invRow).toBeDefined()
    expect(invRow?.textContent).toContain(String(data.backfeedBreakerA))
    // Verify it tracks the data field — bump the breaker, the row tracks.
    const upsized = buildPlansetData(makeProject(), {
      panelCount: 45, inverterCount: 2,
    })
    expect(invRow?.textContent).toContain(String(upsized.backfeedBreakerA))
  })

  it('service-entrance row uses data.serviceEntranceConduit (was hardcoded "2\\" EMT")', () => {
    const data = buildPlansetData(makeProject(), {
      panelCount: 45, inverterCount: 2, strings: patriciaStrings, serviceEntranceConduit: '3" EMT',
    })
    const { container } = render(<SheetPV8 data={data} />)
    const genRow = Array.from(container.querySelectorAll('tr'))
      .find((tr) => tr.textContent?.includes('SERVICE DISCONNECT'))
    expect(genRow).toBeDefined()
    expect(genRow?.textContent).toContain('3" EMT')
  })

  it('service-entrance OCPD tracks data.mainBreaker (was hardcoded 200)', () => {
    const proj = makeProject()
    proj.main_breaker = '150' as unknown as Project['main_breaker']
    const data = buildPlansetData(proj, { panelCount: 45, inverterCount: 2, strings: patriciaStrings })
    const { container } = render(<SheetPV8 data={data} />)
    const genRow = Array.from(container.querySelectorAll('tr'))
      .find((tr) => tr.textContent?.includes('SERVICE DISCONNECT'))
    expect(genRow).toBeDefined()
    expect(genRow?.textContent).toContain('150')
  })
})
