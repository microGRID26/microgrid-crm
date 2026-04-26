// lib/planset-topology.ts
// Helpers for system topology discrimination in SLD rendering.

export type SystemTopology = 'string-mppt' | 'micro-inverter'

/**
 * Forward-proofing for future Hambrick-style legacy SLD rendering.
 *
 * The current MG SLD renderer is string-mppt-only and never emits
 * DPCRGM / DTU / CT / Ethernet / PLC tokens. If a future SheetPVx
 * adds a Hambrick-style legacy SLD branch, gate its rendering on
 * `shouldRenderMicroInverterComponent(data.systemTopology)`.
 *
 * Until then, the `systemTopology` field on PlansetData is a data-shape
 * carrier only — useful for future migration tooling and persisted
 * planset records.
 */
export const MICROINVERTER_COMPONENTS = [
  'DPCRGM',
  'DTU',
  'CT',
  'ETHERNET',
  'PLC',
] as const

export function shouldRenderMicroInverterComponent(topology: SystemTopology): boolean {
  return topology === 'micro-inverter'
}
