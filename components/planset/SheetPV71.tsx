import type { PlansetData } from '@/lib/planset-types'
import { TitleBlockHtml } from './TitleBlockHtml'

export function SheetPV71({ data }: { data: PlansetData }) {
  const stringGroups: Record<number, number> = {}
  for (const s of data.strings) {
    stringGroups[s.modules] = (stringGroups[s.modules] || 0) + 1
  }
  const stringConfigLabel = Object.entries(stringGroups)
    .sort(([, a], [, b]) => b - a)
    .map(([mods, count]) => `${count} STRINGS x ${mods}`)
    .join(' + ')

  interface Placard { title: string; rows: [string, string][] }

  // Extract manufacturer from model name (e.g., "Duracell Power Center Max Hybrid 15kW" → "DURACELL")
  const inverterManufacturer = data.inverterModel.split(' ')[0].toUpperCase()
  const batteryManufacturer = data.batteryModel.split(' ')[0].toUpperCase()

  const placards: Placard[] = [
    {
      title: 'INVERTER PLACARD',
      rows: [
        ['EQUIPMENT', `(${data.inverterCount}) ${data.inverterModel}`],
        ['MANUFACTURER', inverterManufacturer],
        ['TYPE', 'HYBRID INVERTER (PV + ESS)'],
        ['RATED AC OUTPUT', `${data.inverterAcPower} kW PER UNIT (${data.systemAcKw} kW TOTAL)`],
        ['AC VOLTAGE', '240/120V SPLIT PHASE'],
        ['MAX PV INPUT', `${data.maxPvPower.toLocaleString()}W PER UNIT`],
        ['MAX INPUT VOLTAGE', '500V DC'],
        ['MPPT RANGE', '125V \u2014 425V DC'],
        ['MPPT CHANNELS', `${data.mpptsPerInverter} PER UNIT, ${data.stringsPerMppt} STRINGS EACH`],
        ['LISTING', 'UL 1741SA, IEEE 1547, FCC PART 15'],
        ['ENCLOSURE', 'NEMA 3R, OUTDOOR RATED'],
        ['INSTALLATION', 'WALL-MOUNTED, ACCESSIBLE'],
      ],
    },
    {
      title: 'BATTERY PLACARD',
      rows: [
        ['EQUIPMENT', `(${data.batteryCount}) ${data.batteryModel}`],
        ['MANUFACTURER', batteryManufacturer],
        ['CHEMISTRY', 'LITHIUM IRON PHOSPHATE (LiFePO4 / LFP)'],
        ['CAPACITY PER UNIT', `${data.batteryCapacity} kWh`],
        ['TOTAL CAPACITY', `${data.totalStorageKwh} kWh`],
        ['NOMINAL VOLTAGE', '51.2V DC'],
        ['CONFIGURATION', `${data.batteryCount / data.inverterCount} BATTERIES PER INVERTER`],
        ['STACKING', `${data.batteriesPerStack} PER STACK (${Math.ceil(data.batteryCount / data.batteriesPerStack)} STACKS)`],
        ['LISTING', 'UL 9540, UL 9540A'],
        ['ENCLOSURE', 'NEMA 3R, FLOOR/WALL MOUNT'],
        ['THERMAL PROTECTION', 'INTEGRATED BMS'],
        ['INSTALLATION', 'PER MANUFACTURER SPEC, MIN CLEARANCES REQUIRED'],
      ],
    },
    {
      title: 'PV MODULE PLACARD',
      rows: [
        ['MODULE', data.panelModel],
        ['QUANTITY', `${data.panelCount} MODULES`],
        ['WATTAGE', `${data.panelWattage}W STC`],
        ['Voc', `${data.panelVoc}V`],
        ['Vmp', `${data.panelVmp}V`],
        ['Isc', `${data.panelIsc}A`],
        ['Imp', `${data.panelImp}A`],
        ['CONFIGURATION', stringConfigLabel || 'N/A'],
        ['LISTING', 'UL 61730 / IEC 61215'],
        ['RACKING', data.rackingModel],
      ],
    },
    {
      title: 'SYSTEM PLACARD',
      rows: [
        ['SYSTEM DC CAPACITY', `${data.systemDcKw.toFixed(2)} kW DC`],
        ['SYSTEM AC CAPACITY', `${data.systemAcKw} kW AC`],
        ['ENERGY STORAGE', `${data.totalStorageKwh} kWh`],
        ['PV MODULES', `(${data.panelCount}) ${data.panelModel}`],
        ['INVERTERS', `(${data.inverterCount}) ${data.inverterModel}`],
        ['BATTERIES', `(${data.batteryCount}) ${data.batteryModel}`],
        ['RACKING', data.rackingModel],
        ['UTILITY', data.utility],
        ['INTERCONNECTION', 'LINE SIDE TAP / UTILITY INTERACTIVE'],
        ['AHJ', data.ahj || `${data.city}, ${data.state}`],
      ],
    },
  ]

  // NEC 705.12 Interconnection Label — required on main service panel
  const nec705Placard: Placard = {
    title: 'NEC 705.12 INTERCONNECTION LABEL',
    rows: [
      ['WARNING', 'THIS ELECTRICAL PANEL HAS MULTIPLE SOURCES OF POWER'],
      ['SOLAR PV SYSTEM', `${data.systemDcKw.toFixed(2)} kW DC / ${data.systemAcKw} kW AC`],
      ['RATED AC OUTPUT', `${data.systemAcKw * 1000}W @ 240/120V`],
      ['MAX OPERATING CURRENT', `${(data.systemAcKw * 1000 / 240).toFixed(1)}A @ 240V`],
      ['BACKFEED BREAKER', `${Math.ceil((data.systemAcKw * 1000 / 240) * 1.25 / 5) * 5}A, LINE SIDE TAP`],
      ['ENERGY STORAGE', `${data.totalStorageKwh} kWh BATTERY (${data.batteryCount}× ${data.batteryModel})`],
      ['INVERTER LOCATION', 'SEE SITE PLAN (PV-3)'],
      ['AC DISCONNECT', 'ADJACENT TO INVERTER(S), ACCESSIBLE'],
      ['NEC REFERENCE', '705.12(B)(2), 705.12(B)(3), 690.13, 706.15'],
    ],
  }

  const emergencyPlacard: Placard = {
    title: 'EMERGENCY PLACARD',
    rows: [
      ['RAPID SHUTDOWN', 'AC DISCONNECT LOCATION: ADJACENT TO INVERTERS'],
      ['UTILITY DISCONNECT', 'MAIN BREAKER AT ELECTRICAL PANEL'],
      ['AC DISCONNECT', 'WALL-MOUNTED ADJACENT TO INVERTER(S)'],
      ['DC DISCONNECT', 'INTEGRATED IN INVERTER'],
      ['BATTERY DISCONNECT', 'INTERNAL BMS WITH MANUAL ISOLATION'],
      ['FIRE DEPT CONTACT', `911 / ${data.city.toUpperCase()} FIRE DEPARTMENT`],
      ['SOLAR CONTRACTOR', `${data.contractor.name}: ${data.contractor.phone}`],
      ['FIRST RESPONDERS', 'DO NOT CUT OR DAMAGE PV WIRING; DC ENERGIZED WHEN SUN IS UP'],
    ],
  }

  function renderPlacard(placard: Placard, key: number) {
    return (
      <div key={key} style={{ border: '1.5px solid #111', overflow: 'hidden' }}>
        <div style={{ background: '#111', color: 'white', padding: '4px 8px', fontSize: '8pt', fontWeight: 'bold', textAlign: 'center' }}>{placard.title}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
          <tbody>
            {placard.rows.map(([label, value], ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? '#f5f5f5' : 'white' }}>
                <td style={{ fontWeight: 'bold', color: '#111', padding: '2px 6px', width: '30%', borderBottom: '1px solid #eee' }}>{label}</td>
                <td style={{ color: '#333', padding: '2px 6px', borderBottom: '1px solid #eee' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="sheet" style={{ display: 'grid', gridTemplateColumns: '1fr 2.5in', border: '2px solid #000', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt', width: '16.5in', height: '10.5in', overflow: 'hidden', position: 'relative' }}>
      <div className="sheet-content" style={{ padding: '0.15in 0.2in', overflow: 'hidden' }}>
        <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#111' }}>EQUIPMENT IDENTIFICATION PLACARDS</div>
        <div style={{ fontSize: '8pt', color: '#555', marginBottom: '8pt' }}>PLACARDS SHALL BE INSTALLED ON OR ADJACENT TO EACH PIECE OF EQUIPMENT</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {placards.map((p, i) => renderPlacard(p, i))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {renderPlacard(nec705Placard, 50)}
          {renderPlacard(emergencyPlacard, 99)}
        </div>
      </div>
      <TitleBlockHtml sheetName="EQUIPMENT PLACARDS" sheetNumber="PV-7.1" data={data} />
    </div>
  )
}
