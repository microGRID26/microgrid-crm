import type { PlansetData } from '@/lib/planset-types'
import { TitleBlockHtml } from './TitleBlockHtml'

/**
 * PV-4: Equipment Detail (Detail A)
 * Physical arrangement of electrical equipment on exterior wall — PV Load Center,
 * Main Breaker / RSD, PV Disconnect, Main Service Panel, Service Disconnect,
 * Utility Meter, Sub Panel, Junction Box, conduit runs, and trenching annotations.
 *
 * Previously rendered inline on PV-3 as DetailA(). Moved here in Task 3.5 so
 * PV-3 is overall site plan only and PV-4 is the dedicated detail page.
 * Renders unconditionally for every project (not enhanced-only).
 */
export function SheetPV4({ data }: { data: PlansetData }) {
  return (
    <div className="sheet" style={{
      width: '16.5in', height: '10.5in', display: 'grid',
      gridTemplateColumns: '1fr 2.5in', border: '2px solid #000',
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt',
      overflow: 'hidden', position: 'relative',
    }}>
      <div className="sheet-content" style={{ padding: '0.15in 0.2in', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sheet title */}
        <div style={{ marginBottom: '0.1in' }}>
          <div className="sheet-title">EQUIPMENT DETAIL</div>
          <div className="sheet-subtitle">DETAIL-A — SCALE: NTS</div>
        </div>

        {/* Main content area — Detail A SVG centered on the page */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 700 400" style={{ width: '100%', height: '100%' }}>
            {/* Title */}
            <text x="350" y="18" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#111">DETAIL-A</text>
            <text x="350" y="30" textAnchor="middle" fontSize="7" fill="#666">SCALE: NTS</text>

            {/* Ground line */}
            <line x1="20" y1="340" x2="680" y2="340" stroke="#555" strokeWidth="1.5" />

            {/* ── Left side: PV Load Center + PV Disconnect ── */}
            {/* PV Load Center */}
            <rect x="40" y="180" width="80" height="100" fill="none" stroke="#333" strokeWidth="1.5" />
            <text x="80" y="220" textAnchor="middle" fontSize="6" fill="#333" fontWeight="bold">(N) PV LOAD CENTER</text>
            <text x="80" y="232" textAnchor="middle" fontSize="5" fill="#666">BRP12L125R 125A</text>
            <text x="80" y="242" textAnchor="middle" fontSize="5" fill="#666">RATED 100A MAIN</text>
            <text x="80" y="252" textAnchor="middle" fontSize="5" fill="#666">NEMA3R, UL LISTED</text>

            {/* Conduit from PV Load Center to main flow */}
            <line x1="80" y1="280" x2="80" y2="310" stroke="#333" strokeWidth="1" />
            <line x1="80" y1="310" x2="200" y2="310" stroke="#333" strokeWidth="1" strokeDasharray="4,2" />
            <text x="140" y="305" textAnchor="middle" fontSize="4" fill="#666">CONDUIT TO EQUIPMENT</text>

            {/* 1" EMT conduit run label */}
            <text x="20" y="170" fontSize="6" fill="#444">1&quot; EMT CONDUIT RUN</text>
            <line x1="80" y1="175" x2="80" y2="180" stroke="#333" strokeWidth="1" strokeDasharray="3,2" />

            {/* ── Center: Backfeed Breaker (per inverter, lives in MSP) ──
                Previously labeled "(N) MAIN BREAKER / RAPID SHUTDOWN DEVICE" which
                conflated two different pieces of equipment. The IMO RSD has its own
                box on the right side; the main breaker is inside the MSP. This box
                is the backfeed breaker. */}
            <rect x="200" y="180" width="90" height="50" fill="none" stroke="#333" strokeWidth="1.5" />
            <text x="245" y="200" textAnchor="middle" fontSize="6" fill="#333" fontWeight="bold">(N) BACKFEED BREAKER</text>
            <text x="245" y="212" textAnchor="middle" fontSize="5" fill="#666">{data.backfeedBreakerA}A, 2P, 240V</text>
            <text x="245" y="222" textAnchor="middle" fontSize="5" fill="#666">PER INVERTER (×{data.inverterCount})</text>

            {/* Conduit from backfeed breaker down to PV Disconnect — labels derive from data. */}
            <line x1="245" y1="230" x2="245" y2="260" stroke="#333" strokeWidth="1" />
            <text x="300" y="244" fontSize="4" fill="#444">{data.acConduit}</text>
            <text x="300" y="252" fontSize="4" fill="#444">{data.acWireToPanel}</text>

            {/* ── PV Disconnect / Non-Fused ── */}
            <rect x="200" y="260" width="90" height="50" fill="none" stroke="#333" strokeWidth="1.5" />
            <text x="245" y="278" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">(N) PV DISCONNECT /</text>
            <text x="245" y="288" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">NON-FUSIBLE</text>
            <text x="245" y="300" textAnchor="middle" fontSize="5" fill="#666">200A, 2P, 240V (N)</text>
            <text x="245" y="316" textAnchor="middle" fontSize="4" fill="#999">VISIBLE, LOCKABLE</text>

            {/* ── Right-center: Main Service Panel ── */}
            <rect x="380" y="140" width="100" height="120" fill="none" stroke="#333" strokeWidth="2" />
            <text x="430" y="170" textAnchor="middle" fontSize="6" fill="#333" fontWeight="bold">(E) MAIN SERVICE PANEL</text>
            <text x="430" y="182" textAnchor="middle" fontSize="5" fill="#666">200A RATED, 240V,</text>
            <text x="430" y="192" textAnchor="middle" fontSize="5" fill="#666">200A MAIN</text>
            <text x="430" y="210" textAnchor="middle" fontSize="5" fill="#555">(EXTERIOR MOUNTED)</text>

            {/* Service Disconnect */}
            <rect x="380" y="280" width="100" height="50" fill="none" stroke="#333" strokeWidth="1.5" />
            <text x="430" y="298" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">(N) SERVICE DISCONNECT</text>
            <text x="430" y="310" textAnchor="middle" fontSize="5" fill="#666">VISIBLE, LOCKABLE,</text>
            <text x="430" y="320" textAnchor="middle" fontSize="5" fill="#666">LABELED DISCONNECT</text>

            {/* Wire from MSP to Service Disc */}
            <line x1="430" y1="260" x2="430" y2="280" stroke="#333" strokeWidth="1" />

            {/* Conduit from PV Disc to MSP */}
            <line x1="290" y1="285" x2="380" y2="200" stroke="#333" strokeWidth="1" />

            {/* ── Far right: Utility Meter ── */}
            <circle cx="580" cy="230" r="25" fill="none" stroke="#333" strokeWidth="2" />
            <text x="580" y="226" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#333">M</text>
            <text x="580" y="237" textAnchor="middle" fontSize="6" fill="#333">kWh</text>
            <text x="580" y="200" textAnchor="middle" fontSize="6" fill="#666">(E) {data.utility?.toUpperCase() || 'UTILITY'} METER</text>
            <text x="580" y="270" textAnchor="middle" fontSize="5" fill="#666">ESID NUMBER:</text>
            <text x="580" y="280" textAnchor="middle" fontSize="5" fill="#666">{data.esid || 'N/A'}</text>

            {/* Conduit from service disc to meter */}
            <line x1="480" y1="305" x2="555" y2="235" stroke="#333" strokeWidth="1" />

            {/* Trenching annotation. Labels the service-entrance run (250 kcmil
                feeder, utility pole → service disconnect → meter) — uses
                serviceEntranceConduit, not acConduit. acConduit is the
                inverter→MSP run on the wall above and is a different size. */}
            <text x="500" y="310" fontSize="5" fill="#444">{data.serviceEntranceConduit} TYPE CONDUIT</text>
            <text x="500" y="320" fontSize="5" fill="#444">ROUGHLY {data.acRunLengthFt} FEET</text>
            <text x="500" y="330" fontSize="5" fill="#444">(DIRT/ROCK) TRENCHING</text>
            <text x="500" y="340" fontSize="5" fill="#444">FROM UTILITY POLE TO</text>
            <text x="500" y="350" fontSize="5" fill="#444">HOME WALL</text>

            {/* IMO Rapid Shutdown */}
            <rect x="530" y="130" width="80" height="35" fill="none" stroke="#333" strokeWidth="1" />
            <text x="570" y="148" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">(N) IMO RAPID</text>
            <text x="570" y="158" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">SHUTDOWN DEVICE</text>

            {/* Surge Protector */}
            <rect x="530" y="85" width="80" height="30" fill="none" stroke="#333" strokeWidth="1" />
            <text x="570" y="103" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">(N) SURGE PROTECTOR</text>

            {/* Expansion fittings callout */}
            <text x="430" y="360" textAnchor="middle" fontSize="5.5" fill="#333" fontWeight="bold">(N) EXPANSION FITTINGS</text>
            <text x="430" y="370" textAnchor="middle" fontSize="5" fill="#666">REQUIRED ON BOTH ENDS OF THE {data.serviceEntranceConduit} PIPE</text>

            {/* Within 10 feet label */}
            <text x="430" y="385" textAnchor="middle" fontSize="5" fill="#666">WITHIN 10 FEET FROM THE {data.utility?.toUpperCase() || 'UTILITY'} METER</text>

            {/* Sub Panel (if applicable) */}
            <rect x="380" y="50" width="100" height="70" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4,2" />
            <text x="430" y="75" textAnchor="middle" fontSize="6" fill="#666">(E) SUB PANEL</text>
            <text x="430" y="87" textAnchor="middle" fontSize="5" fill="#999">200A RATED, 240V,</text>
            <text x="430" y="97" textAnchor="middle" fontSize="5" fill="#999">200A MAIN</text>
            <text x="430" y="110" textAnchor="middle" fontSize="5" fill="#999">(INTERIOR MOUNTED)</text>

            {/* Conduit from MSP up to Sub Panel */}
            <line x1="430" y1="120" x2="430" y2="140" stroke="#333" strokeWidth="1" strokeDasharray="3,2" />

            {/* Junction Box */}
            <rect x="40" y="80" width="80" height="30" fill="none" stroke="#333" strokeWidth="1" />
            <text x="80" y="98" textAnchor="middle" fontSize="6" fill="#333" fontWeight="bold">(N) JUNCTION BOX</text>

            {/* Roof array wiring from JB up */}
            <line x1="80" y1="80" x2="80" y2="50" stroke="#333" strokeWidth="1" strokeDasharray="3,2" />
            <text x="80" y="45" textAnchor="middle" fontSize="5" fill="#444">ROOF ARRAY WIRING</text>
            <text x="80" y="55" textAnchor="middle" fontSize="5" fill="#444">#10 AWG, PV TRUNK CABLE</text>
            <text x="80" y="65" textAnchor="middle" fontSize="5" fill="#444">INSTALLED IN CONDUIT</text>

            {/* Wire from JB down to PV LC */}
            <line x1="80" y1="110" x2="80" y2="180" stroke="#333" strokeWidth="1" />
          </svg>
        </div>

        {/* Scale label */}
        <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '8pt', fontWeight: 'bold' }}>
          <span style={{ fontSize: '12pt' }}>1</span> EQUIPMENT DETAIL — DETAIL-A
          <div style={{ fontSize: '7pt', fontWeight: 'normal' }}>SCALE: NTS</div>
        </div>
      </div>

      <TitleBlockHtml data={data} sheetName="EQUIPMENT DETAIL" sheetNumber="PV-4" />
    </div>
  )
}
