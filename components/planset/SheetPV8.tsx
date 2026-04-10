import type { PlansetData } from '@/lib/planset-types'
import { TitleBlockHtml } from './TitleBlockHtml'

export function SheetPV8({ data }: { data: PlansetData }) {
  const stringCount = data.strings.length
  const panelImp = data.panelImp
  const fla125 = panelImp * 1.25
  const stringOcpd = Math.ceil(fla125 / 5) * 5
  const ambientTemp = 37
  const tempFactor = 0.91
  const conduitFillFactor = 0.70

  const string10Ampacity = 40
  const stringCorrected = parseFloat((string10Ampacity * conduitFillFactor * tempFactor).toFixed(1))
  const string75CMax = 30
  const stringUsable = Math.min(stringCorrected, string75CMax)

  // Derive battery FLA from capacity: P(W) / V(nom) per stack
  // batteryCapacity is per unit in kWh, batteriesPerStack units per stack, 51.2V nominal
  const battFla = parseFloat(((data.batteryCapacity * 1000 * data.batteriesPerStack) / 51.2).toFixed(2))
  const battFla125 = parseFloat((battFla * 1.25).toFixed(1))
  const batt4Ampacity = 95
  const battCorrected = parseFloat((batt4Ampacity * conduitFillFactor * tempFactor).toFixed(1))
  const batt75CMax = 85
  const battUsable = Math.min(battCorrected, batt75CMax)

  const invFla = parseFloat((data.inverterAcPower * 1000 / 240).toFixed(1))
  const invFla125 = parseFloat((invFla * 1.25).toFixed(1))
  const inv1Ampacity = 145
  const invCorrected = parseFloat((inv1Ampacity * conduitFillFactor * tempFactor).toFixed(1))
  const inv75CMax = 130
  const invUsable = Math.min(invCorrected, inv75CMax)

  const genFla = 100
  const genFla125 = 125

  type CondRow = string[]

  const condRows: CondRow[] = []

  condRows.push([
    'RSD', 'RSD DEVICES', 'N/A', 'N/A', 'N/A',
    String(stringCount * 2), '#10 AWG', '1', '#6 AWG BARE', 'PV WIRE', 'FREE AIR',
    String(string10Ampacity), String(ambientTemp), String(tempFactor), String(stringCorrected),
    String(string75CMax), String(stringUsable),
  ])

  data.strings.forEach((s) => {
    condRows.push([
      `S${s.id}`, `STRING ${s.id} (${s.modules} MOD)`,
      panelImp.toFixed(1), fla125.toFixed(1), String(stringOcpd),
      '8', '#10 AWG', '1', '#8 AWG', 'THWN-2', '3/4" EMT',
      String(string10Ampacity), String(ambientTemp), String(tempFactor), String(stringCorrected),
      String(string75CMax), String(stringUsable),
    ])
  })

  if (data.batteryCount > 0) {
    condRows.push([
      'BATT', `BATTERY (${data.batteryCount}x ${data.batteryModel})`,
      battFla.toFixed(1), battFla125.toFixed(1), '80',
      '3', '#4 AWG', '1', '#6 AWG', 'THWN-2', '3/4" EMT',
      String(batt4Ampacity), String(ambientTemp), String(tempFactor), String(battCorrected),
      String(batt75CMax), String(battUsable),
    ])
  }

  condRows.push([
    'INV', `INVERTER (${data.inverterCount}x ${data.inverterModel.split(' ').slice(0, 3).join(' ')})`,
    invFla.toFixed(1), invFla125.toFixed(1), '100',
    '3', '#1 AWG', '1', '#6 AWG', 'THWN-2', '1-1/4" EMT',
    String(inv1Ampacity), String(ambientTemp), String(tempFactor), String(invCorrected),
    String(inv75CMax), String(invUsable),
  ])

  // Generation disconnect — only for systems with utility interconnection
  if (data.inverterCount > 0) {
    condRows.push([
      'GEN', 'GENERATION DISCONNECT',
      String(genFla), String(genFla125), '125',
      '3', '#1 AWG', '1', '#6 AWG', 'THWN-2', '1-1/4" EMT',
      String(inv1Ampacity), String(ambientTemp), String(tempFactor), String(invCorrected),
      String(inv75CMax), String(invUsable),
    ])
  }

  const condColHeaders = [
    'TAG', 'CIRCUIT ORIGIN', 'FLA (A)', 'FLA\u00D71.25', 'OCPD (A)',
    '# WIRES', 'WIRE SIZE', '# GND', 'GND SIZE', 'WIRE TYPE', 'CONDUIT',
    'AMPACITY', 'AMB \u00B0C', 'TEMP CF', 'CORR AMP', '75\u00B0C MAX', 'USABLE',
  ]

  const bomRows: [string, string, string][] = [
    ['SOLAR PV MODULE', String(data.panelCount), data.panelModel],
    ['RAPID SHUTDOWN DEVICE', String(data.panelCount), 'APSMART RSD-D-20'],
    ['EMERGENCY POWER OFF', '1', 'DURACELL EMERGENCY STOP BUTTON'],
    ['INVERTER', String(data.inverterCount), data.inverterModel],
    ['BATTERY', String(data.batteryCount), data.batteryModel],
    ['JUNCTION BOX', '2', 'JUNCTION BOXES'],
    ['AC DISCONNECT', '1', '200A/2P NON-FUSIBLE DISCONNECT 240V N3R'],
    ['ATTACHMENT', String(data.racking.attachmentCount), data.racking.attachmentModel],
    ['RAIL CLICKER', String(data.racking.attachmentCount), 'IronRidge XR100 Rail Clicker'],
    ['RAIL', String(data.racking.railCount), data.racking.railModel],
    ['RAIL SPLICE', String(data.racking.railSpliceCount), 'CF RAIL SPLICE SS 2012013'],
    ['MID CLAMPS', String(data.racking.midClampCount), 'MID CLAMP ASSEMBLY'],
    ['END CLAMPS', String(data.racking.endClampCount), 'END CLAMP ASSEMBLY'],
    ['GROUNDING LUG', String(data.racking.groundingLugCount), 'GROUNDING LUGS'],
  ]

  return (
    <div className="sheet" style={{ display: 'grid', gridTemplateColumns: '1fr 2.5in', border: '2px solid #000', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt', width: '16.5in', height: '10.5in', overflow: 'hidden', position: 'relative' }}>
      <div className="sheet-content" style={{ padding: '0.1in 0.15in', overflow: 'hidden' }}>
        <div style={{ fontWeight: 'bold', fontSize: '7pt', color: '#111' }}>CONDUCTOR AND CONDUIT SCHEDULE WITH AMPACITY CALCULATIONS</div>
        <div style={{ fontSize: '5pt', color: '#555', marginBottom: '4px' }}>
          WIRES ARE 90&deg;C RATED THWN-2 @ 30&deg;C (CU) | CONDUIT HEIGHT ABOVE ROOF IS OVER 7/8&quot; | NEC 310.12 (83% RULE)
        </div>

        {/* Conductor schedule table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '5.5pt', marginBottom: '10px' }}>
          <thead>
            <tr style={{ background: '#111' }}>
              {condColHeaders.map((h, i) => (
                <th key={i} style={{ color: 'white', padding: '2px 3px', textAlign: 'left', fontWeight: 'bold', fontSize: '5pt', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {condRows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? '#f9f9f9' : 'white' }}>
                {row.map((val, ci) => (
                  <td key={ci} style={{ padding: '1px 3px', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' as const }}>{val}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* BOM */}
        <div style={{ fontWeight: 'bold', fontSize: '10pt', color: '#111', marginBottom: '4px' }}>BILL OF MATERIALS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt' }}>
          <thead>
            <tr style={{ background: '#111' }}>
              <th style={{ color: 'white', padding: '3px 6px', textAlign: 'left', fontWeight: 'bold', fontSize: '6.5pt' }}>EQUIPMENT</th>
              <th style={{ color: 'white', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', fontSize: '6.5pt', width: '60px' }}>QTY</th>
              <th style={{ color: 'white', padding: '3px 6px', textAlign: 'left', fontWeight: 'bold', fontSize: '6.5pt' }}>DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {bomRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9f9' : 'white' }}>
                <td style={{ padding: '2px 6px', fontWeight: 'bold', color: '#111', borderBottom: '1px solid #ddd' }}>{row[0]}</td>
                <td style={{ padding: '2px 6px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>{row[1]}</td>
                <td style={{ padding: '2px 6px', color: '#333', borderBottom: '1px solid #ddd' }}>{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TitleBlockHtml sheetName="CONDUCTOR SCHEDULE & BOM" sheetNumber="PV-8" data={data} />
    </div>
  )
}
