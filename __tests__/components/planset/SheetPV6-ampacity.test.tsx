import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SheetPV6 } from '@/components/planset/SheetPV6'
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

const patriciaStrings: PlansetString[] = [1, 2, 3, 4, 5].map((id) => ({
  id, mppt: ((id - 1) % 3) + 1, modules: 9, roofFace: 1,
  vocCold: 404.9, vmpNominal: 313.2, current: 12.65,
}))

// Ampacity correction table column order:
//   0 CONDUCTOR · 1 AMPACITY · 2 CONDUIT FILL · 3 AMBIENT · 4 TEMP CF
//   5 CORRECTED · 6 75°C MAX · 7 USABLE
const COL_COND = 0
const COL_75C = 6

const findRowByConductor = (container: HTMLElement, substr: string): HTMLTableRowElement | undefined =>
  Array.from(container.querySelectorAll('tbody tr')).find((tr) => {
    const cell0 = tr.children[COL_COND]?.textContent ?? ''
    return cell0.includes(substr)
  }) as HTMLTableRowElement | undefined

const cell = (row: HTMLTableRowElement, idx: number): string => row.children[idx]?.textContent?.trim() ?? ''

describe('SheetPV6 ampacity correction table — cross-sheet consistency', () => {
  // Was hardcoded #10 AWG / 30A which drifted from PV-8 (35A per NEC 310.16
  // for #10 AWG copper @ 75°C). Now derives from data.dcHomerunWire via
  // ampacityFor() lookup. Same pattern as battery + inverter rows.

  it('DC string row 75°C MAX = 35A for #10 AWG (NEC 310.16, matches PV-8)', () => {
    const data = buildPlansetData(makeProject(), { panelCount: 45, inverterCount: 2, strings: patriciaStrings })
    const { container } = render(<SheetPV6 data={data} />)
    const stringRow = findRowByConductor(container, 'DC STRING')
    expect(stringRow).toBeDefined()
    expect(cell(stringRow!, COL_75C)).toBe('35')
  })

  it('DC string row tracks data.dcHomerunWire override (not hardcoded #10)', () => {
    // Override homerun to #8 AWG CU THWN-2 — ampacity should change.
    const data = buildPlansetData(makeProject(), {
      panelCount: 45, inverterCount: 2, strings: patriciaStrings,
      dcHomerunWire: '#8 AWG CU THWN-2',
    })
    const { container } = render(<SheetPV6 data={data} />)
    const stringRow = findRowByConductor(container, 'DC STRING')!
    // #8 AWG CU @ 75°C = 50A per NEC 310.16. Conductor cell should reflect
    // #8 AWG, 75°C MAX should be 50.
    expect(cell(stringRow, COL_COND)).toContain('#8 AWG')
    expect(cell(stringRow, COL_75C)).toBe('50')
  })
})
