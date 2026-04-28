// ── Planset Export Readiness ───────────────────────────────────────────────
// Single chokepoint that decides whether the planset is allowed to export to PDF.
//
// Background (R1 audit 2026-04-28): the codebase had three separate compliance
// checks (`loadSideBackfeedCompliant`, max-system-voltage, cut-sheet availability)
// each computed and rendered as a banner on a sheet, but `handlePrintAll` did
// not consult any of them — designers could click "Download as PDF" with a red
// FAIL banner on the cover sheet and the file generated regardless. The pattern
// "compute-and-display without compute-and-block" let known-noncompliant
// plansets ship to AHJ.
//
// This module collapses those checks to one function with one return shape.
// The export button must consult `canExport` (or the user must explicitly
// override a critical failure) before invoking the print handler. Adding a new
// compliance rule = one entry here, not one new banner + one new gate.

import type { PlansetData } from './planset-types'
import { CUT_SHEETS } from '@/components/planset/SheetCutSheets'

export type ExportFailureRule =
  | 'NEC_705_12_BACKFEED'
  | 'NEC_690_7_MAX_VOLTAGE'
  | 'CUT_SHEET_MISSING'
  | 'BATTERY_DC_UNVERIFIED'

export interface ExportFailure {
  rule: ExportFailureRule
  title: string
  detail: string
  // Whether the designer is allowed to override + ship anyway with an
  // explicit "AHJ has approved" justification. Asset-availability failures
  // (missing PDF) cannot be overridden — designer fixes the file.
  overridable: boolean
}

export interface ExportReadiness {
  canExport: boolean
  failures: ExportFailure[]
  // True if every failure has overridable=true. UI uses this to decide
  // whether to render the "Override and download anyway" affordance.
  allOverridable: boolean
}

export type CutSheetStatus = 'pending' | 'ok' | 'missing'

export interface ExportReadinessInput {
  data: PlansetData
  // Map keyed by CUT_SHEETS[i].sheetId. Sheets in 'pending' state count as
  // not-yet-verified and block export until they resolve (we don't ship
  // plansets with cut sheets in unknown state).
  cutSheetStatus: Map<string, CutSheetStatus>
}

export function evaluateExportReadiness(input: ExportReadinessInput): ExportReadiness {
  const { data, cutSheetStatus } = input
  const failures: ExportFailure[] = []

  if (!data.loadSideBackfeedCompliant) {
    failures.push({
      rule: 'NEC_705_12_BACKFEED',
      title: '120% backfeed rule failure (NEC 705.12)',
      detail:
        `${data.totalBackfeedA}A total backfeed exceeds ${data.maxAllowableBackfeedA}A max allowable ` +
        `(${data.mspBusRating}A bus × 1.2 − ${data.mainBreaker} main). ` +
        `Use a line-side tap, sub-panel feeder, PCS-limited output (NEC 705.13), ` +
        `or upsize the bus before AHJ submittal. Override only if the AHJ has approved an alternate method.`,
      overridable: true,
    })
  }

  if (!data.maxSystemVoltageCompliant) {
    failures.push({
      rule: 'NEC_690_7_MAX_VOLTAGE',
      title: 'Max system voltage exceeded (NEC 690.7)',
      detail:
        `Max string Voc-cold = ${data.maxStringVocCold.toFixed(1)}V exceeds the inverter input limit ` +
        `of ${data.inverterMaxVoc}V. Reduce modules per string in the longest string before AHJ submittal. ` +
        `This will damage the inverter on the first cold morning if shipped uncorrected.`,
      overridable: true,
    })
  }

  for (const cs of CUT_SHEETS) {
    const status = cutSheetStatus.get(cs.sheetId)
    if (status === 'missing') {
      failures.push({
        rule: 'CUT_SHEET_MISSING',
        title: `Cut sheet missing: ${cs.sheetId} ${cs.title}`,
        detail:
          `${cs.src} returned a non-OK response. The PDF file is not deployed. ` +
          `Verify the file exists in public/cut-sheets/ and that the latest deploy includes it. ` +
          `Cannot be overridden — without the file the planset is incomplete.`,
        overridable: false,
      })
    } else if (status === 'pending' || status === undefined) {
      failures.push({
        rule: 'CUT_SHEET_MISSING',
        title: `Cut sheet status pending: ${cs.sheetId}`,
        detail:
          `Cut sheet availability check has not yet completed for ${cs.src}. ` +
          `Wait a moment and retry. If this persists, reload the page.`,
        overridable: false,
      })
    }
  }

  if (!data.batteryDcSizingVerified) {
    failures.push({
      rule: 'BATTERY_DC_UNVERIFIED',
      title: 'Battery DC conductor sizing unverified (NEC 706.30 / 690.8)',
      detail:
        `The current battery conductor sizing on ${data.inverterModel} uses batteryMaxCurrentA = ` +
        `${data.batteryMaxCurrentA}A, which is the AC-equivalent of the inverter output (kW / 240V), ` +
        `not the DC bus current. NEC 706.30 + 690.8 require the battery conductor to be sized to 125% ` +
        `of the maximum continuous DC current the inverter pulls from the battery stack. ` +
        `Pending PE confirmation of the actual ${data.inverterModel} battery-port DC max continuous current. ` +
        `Override only when the rendered ${data.batteryWire} has been confirmed correct against the ` +
        `manufacturer spec sheet for this specific install.`,
      overridable: true,
    })
  }

  return {
    canExport: failures.length === 0,
    failures,
    allOverridable: failures.length > 0 && failures.every((f) => f.overridable),
  }
}
