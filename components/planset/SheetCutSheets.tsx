import type { PlansetData } from '@/lib/planset-types'

export interface CutSheetEntry {
  src: string       // path relative to /public/
  title: string     // display title above the embed
  sheetId: string   // 'PV-9', 'PV-10', etc. — ONE per cut sheet
}

export const CUT_SHEETS: CutSheetEntry[] = [
  { src: '/cut-sheets/duracell-5plus.pdf', title: 'Duracell 5+ Battery (LiFePO4)', sheetId: 'PV-9' },
  { src: '/cut-sheets/max-hybrid-15.pdf',  title: 'Duracell Power Center Max Hybrid 15kW Inverter', sheetId: 'PV-10' },
  // Pending — add when received from William (greg_action #317):
  // { src: '/cut-sheets/ja-solar-amp-380.pdf', title: 'JA Solar AMP 380W', sheetId: 'PV-11' },
  // { src: '/cut-sheets/rsd-d-20.pdf', title: 'RSD-D-20 Rapid Shutdown Device', sheetId: 'PV-12' },
  // { src: '/cut-sheets/ecofasten-corruslide.pdf', title: 'EcoFasten ClickFit + CorruSlide Mounting', sheetId: 'PV-13' },
  // { src: '/cut-sheets/cantex-bar.pdf', title: 'Cantex High-Current Distribution Bar', sheetId: 'PV-14' },
]

export function SheetCutSheets({ data: _data }: { data: PlansetData }) {
  return (
    <>
      {CUT_SHEETS.map(cs => (
        <div
          key={cs.src}
          data-cut-sheet={cs.sheetId}
          className="sheet"
          style={{
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
            border: '2px solid #000',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '8pt',
            width: '16.5in',
            height: '10.5in',
            overflow: 'hidden',
            position: 'relative',
            pageBreakBefore: 'always',
          }}
        >
          {/* Header bar matching other sheets */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            borderBottom: '1px solid #ccc',
            background: '#f5f5f5',
          }}>
            <span style={{
              fontSize: '7pt',
              fontWeight: 'bold',
              background: '#111',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '2px',
            }}>
              {cs.sheetId}
            </span>
            <h2 style={{
              margin: 0,
              fontSize: '8pt',
              fontWeight: 'bold',
              color: '#111',
              textTransform: 'uppercase' as const,
            }}>
              {cs.title}
            </h2>
            <span style={{ marginLeft: 'auto', fontSize: '6pt', color: '#888' }}>
              MANUFACTURER CUT SHEET
            </span>
          </div>

          {/* Full-height PDF embed */}
          <embed
            src={cs.src}
            type="application/pdf"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      ))}
    </>
  )
}
