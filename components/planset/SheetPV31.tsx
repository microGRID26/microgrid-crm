import type { PlansetData } from '@/lib/planset-types'
import { TitleBlockHtml } from './TitleBlockHtml'

/**
 * PV-3.1: Equipment Elevation
 * Annotated site photos showing electrical equipment locations.
 * Up to 4 uploaded photos with equipment callout labels.
 */

const PHOTO_TITLES = ['EXTERIOR ELECTRICAL WALL', 'EXTERIOR ELECTRICAL WALL', 'INTERIOR ELECTRICAL WALL', 'EQUIPMENT DETAIL']

export function SheetPV31({ data, equipmentPhotos }: { data: PlansetData; equipmentPhotos: (string | null)[] }) {
  const hasAnyPhoto = equipmentPhotos.some(p => p !== null)
  const utilityLabel = data.utility?.toUpperCase() || 'UTILITY'
  const EQUIPMENT_LABELS: string[][] = [
    // Exterior Wall 1
    ['(N) PV LOAD CENTER', '(N) PV DISCONNECT\nVISIBLE LOCKABLE\nLABELED DISCONNECT', `(E) ${utilityLabel} METER\nESID NUMBER`],
    // Exterior Wall 2
    [`(N) SERVICE DISCONNECT\nVISIBLE LOCKABLE\nLABELED DISCONNECT\nWITHIN 10 FEET FROM\nTHE ${utilityLabel} METER`, '(N) IMO RAPID\nSHUTDOWN DEVICE'],
    // Interior Wall
    ['(E) MAIN SERVICE PANEL', '(E) SUB PANEL'],
    // Equipment Detail
    ['(N) MAX HYBRID 5 INVERTER', '(N) BATTERY COMBINER', '(N) DURACELL BATTERIES'],
  ]

  return (
    <div className="sheet" style={{
      width: '16.5in', height: '10.5in', display: 'grid',
      gridTemplateColumns: '1fr 2.5in', border: '2px solid #000',
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt',
      overflow: 'hidden', position: 'relative',
    }}>
      <div className="sheet-content" style={{ padding: '0.15in 0.2in', display: 'flex', flexDirection: 'column' }}>
        {/* STC header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.1in' }}>
          <div style={{ border: '1px solid #000', padding: '4px 8px', fontSize: '6.5pt', textAlign: 'right' }}>
            {data.meter && <div>METER NUMBER: {data.meter}</div>}
            {data.esid && <div>ESID NUMBER: {data.esid}</div>}
            <div style={{ fontWeight: 'bold' }}>MODULES: {data.panelCount} x {data.panelWattage} = {data.systemDcKw.toFixed(3)} kW DC</div>
            <div>TOTAL kW AC = {data.systemAcKw.toFixed(3)} kW AC</div>
          </div>
        </div>

        {hasAnyPhoto ? (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '0.15in' }}>
            {equipmentPhotos.slice(0, 4).map((photoUrl, i) => (
              <div key={i} style={{ border: '1px solid #000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Photo title */}
                <div style={{ background: '#111', color: '#fff', padding: '3px 8px', fontWeight: 'bold', fontSize: '7pt', textAlign: 'center' }}>
                  {PHOTO_TITLES[i]}
                </div>
                {photoUrl ? (
                  <div style={{ flex: 1, position: 'relative' }}>
                    <img
                      src={photoUrl}
                      alt={PHOTO_TITLES[i]}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f5f5f5' }}
                    />
                    {/* Equipment label overlays */}
                    <div style={{ position: 'absolute', bottom: '4px', left: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {EQUIPMENT_LABELS[i]?.map((label, li) => (
                        <div key={li} style={{
                          background: 'rgba(255,255,255,0.92)',
                          border: '1px solid #000',
                          padding: '2px 6px',
                          fontSize: '5.5pt',
                          fontWeight: 'bold',
                          lineHeight: '1.3',
                          whiteSpace: 'pre-line',
                        }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '7pt', background: '#f9f9f9' }}>
                    No photo uploaded
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '8px' }}>EQUIPMENT ELEVATION</div>
              <div style={{ fontSize: '10pt' }}>Upload equipment photos in the Overrides panel</div>
              <div style={{ fontSize: '8pt', marginTop: '4px' }}>Equipment Photos (PV-3.1) &mdash; up to 4 photos</div>
            </div>
          </div>
        )}

        {/* Scale note */}
        <div style={{ textAlign: 'center', marginTop: '0.1in', fontSize: '8pt', fontWeight: 'bold' }}>
          <span style={{ fontSize: '12pt' }}>1</span> EQUIPMENT ELEVATION
          <div style={{ fontSize: '7pt', fontWeight: 'normal' }}>NOT TO SCALE</div>
        </div>
      </div>

      <TitleBlockHtml data={data} sheetName="EQUIPMENT ELEVATION" sheetNumber="PV-3.1" />
    </div>
  )
}
