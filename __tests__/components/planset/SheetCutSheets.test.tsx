import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SheetCutSheets, CUT_SHEETS } from '@/components/planset/SheetCutSheets'
import type { PlansetData } from '@/lib/planset-types'

const baseData: Partial<PlansetData> = {}

describe('SheetCutSheets — manufacturer cut sheet pages', () => {
  it('renders one section per cut sheet', () => {
    const { container } = render(<SheetCutSheets data={baseData as PlansetData} />)
    expect(container.querySelectorAll('[data-cut-sheet]').length).toBe(CUT_SHEETS.length)
  })

  it('embeds the PDF for each cut sheet', () => {
    const { container } = render(<SheetCutSheets data={baseData as PlansetData} />)
    const embeds = container.querySelectorAll('embed[type="application/pdf"]')
    expect(embeds.length).toBe(CUT_SHEETS.length)
  })

  it('renders the title for each cut sheet', () => {
    const { container } = render(<SheetCutSheets data={baseData as PlansetData} />)
    for (const cs of CUT_SHEETS) {
      expect(container.textContent).toContain(cs.title)
    }
  })

  it('exports current 2 cut sheets (Duracell battery + inverter)', () => {
    expect(CUT_SHEETS.length).toBeGreaterThanOrEqual(2)
    expect(CUT_SHEETS.some(cs => cs.src.includes('duracell-5plus'))).toBe(true)
    expect(CUT_SHEETS.some(cs => cs.src.includes('max-hybrid-15'))).toBe(true)
  })
})
