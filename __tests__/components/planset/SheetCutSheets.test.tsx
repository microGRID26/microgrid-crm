import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { SheetCutSheet, CUT_SHEETS, computeSheetTotal } from '@/components/planset/SheetCutSheets'

describe('SheetCutSheet — single cut-sheet renderer', () => {
  const entry = CUT_SHEETS[0]

  beforeEach(() => {
    // Default: HEAD ok. Individual tests override for missing-file branch.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true } as Response)))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders data-cut-sheet attribute with the sheetId', () => {
    const { container } = render(<SheetCutSheet entry={entry} />)
    expect(container.querySelector(`[data-cut-sheet="${entry.sheetId}"]`)).toBeTruthy()
  })

  it('embeds the PDF when HEAD returns ok', async () => {
    const { container } = render(<SheetCutSheet entry={entry} />)
    await waitFor(() => {
      const embed = container.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement | null
      expect(embed).toBeTruthy()
      expect(embed?.getAttribute('src')).toBe(entry.src)
    })
  })

  it('renders the print warning banner', () => {
    const { container } = render(<SheetCutSheet entry={entry} />)
    expect(container.textContent).toContain('Cut sheets do NOT print via Save-as-PDF')
    expect(container.textContent).toContain(entry.src)
  })

  it('renders the title', () => {
    const { container } = render(<SheetCutSheet entry={entry} />)
    expect(container.textContent).toContain(entry.title)
  })

  it('shows PDF UNAVAILABLE fallback when HEAD returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response)))
    const { container } = render(<SheetCutSheet entry={entry} />)
    await waitFor(() => {
      expect(container.querySelector('[data-cut-sheet-missing]')).toBeTruthy()
      expect(container.textContent).toContain('PDF UNAVAILABLE')
    })
    // Embed should NOT render in the missing branch.
    expect(container.querySelector('embed[type="application/pdf"]')).toBeNull()
  })

  it('shows PDF UNAVAILABLE fallback when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))))
    const { container } = render(<SheetCutSheet entry={entry} />)
    await waitFor(() => {
      expect(container.textContent).toContain('PDF UNAVAILABLE')
    })
  })
})

describe('CUT_SHEETS catalog', () => {
  it('exports current Duracell battery + inverter cut sheets', () => {
    expect(CUT_SHEETS.length).toBeGreaterThanOrEqual(2)
    expect(CUT_SHEETS.some(cs => cs.src.includes('duracell-5plus'))).toBe(true)
    expect(CUT_SHEETS.some(cs => cs.src.includes('max-hybrid-15'))).toBe(true)
  })

  it('every CUT_SHEETS entry points to a file that exists in /public/', () => {
    // Catches the typo case where a future cut sheet is added to the array
    // but the PDF file is forgotten on disk — would otherwise only surface
    // when a designer opens the planset and sees the missing-file fallback.
    for (const cs of CUT_SHEETS) {
      const diskPath = join(process.cwd(), 'public', cs.src.replace(/^\//, ''))
      expect(existsSync(diskPath), `${cs.src} not found at ${diskPath}`).toBe(true)
    }
  })

  it('each CUT_SHEETS entry has a unique sheetId', () => {
    const ids = CUT_SHEETS.map(cs => cs.sheetId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Planset sheetTotal formula alignment', () => {
  // Sheet count breakdown:
  //   Always: PV-1, PV-2, PV-2A, PV-3, PV-4, PV-5, PV-6, PV-7, PV-7.1, PV-8 = 10
  //   Enhanced extras: UTIL, PV-3.1, PV-4.1 = 3 (total 13)
  //   Plus N cut sheets (one sheetList entry per CUT_SHEETS entry)

  it('non-enhanced sheetTotal = 10 base + cut sheets', () => {
    expect(CUT_SHEETS.length).toBeGreaterThanOrEqual(2)
    expect(computeSheetTotal(false)).toBe(10 + CUT_SHEETS.length)
  })

  it('enhanced sheetTotal = 13 base + cut sheets', () => {
    expect(CUT_SHEETS.length).toBeGreaterThanOrEqual(2)
    expect(computeSheetTotal(true)).toBe(13 + CUT_SHEETS.length)
  })

  it('enhanced adds exactly 3 extras over non-enhanced', () => {
    expect(computeSheetTotal(true) - computeSheetTotal(false)).toBe(3)
  })
})
