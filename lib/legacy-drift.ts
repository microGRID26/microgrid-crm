/**
 * Drift detection for the projects ↔ legacy_projects shadow-copy issue.
 *
 * Background: on 2026-04-06, ~15,090 rows from `legacy_projects` were bulk-
 * imported into the main `projects` table with `disposition='In Service'`.
 * No FK, trigger, or sync keeps them aligned. If a customer's contract or
 * system size is updated in one table but not the other, they silently
 * disagree.
 *
 * This helper compares two arrays of rows by id and reports any field
 * disagreements. Pure logic — no database calls — so it can be unit-tested
 * with fixtures and reused by `scripts/check-legacy-drift.ts` against the
 * live database.
 */

export interface DriftRow {
  id: string
  name?: string | null
  contract?: number | string | null
  systemkw?: number | string | null
}

export interface FieldDisagreement {
  id: string
  field: 'name' | 'contract' | 'systemkw'
  projects: unknown
  legacy: unknown
}

export interface DriftReport {
  /** Number of ids present in both arrays */
  overlapCount: number
  /** Ids in `projects` but not in `legacy_projects` */
  onlyInProjects: string[]
  /** Ids in `legacy_projects` but not in `projects` */
  onlyInLegacy: string[]
  /** Per-field disagreements for overlapping ids */
  disagreements: FieldDisagreement[]
}

/** Coerce numeric-ish values to a normalized string for tolerant comparison. */
function normalizeNumeric(v: unknown): string | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (Number.isNaN(n)) return null
  // Round to 2 decimals to absorb cosmetic differences (27360 vs 27360.00)
  return n.toFixed(2)
}

function normalizeString(v: unknown): string | null {
  if (v == null) return null
  return String(v).trim()
}

/**
 * Compare two row arrays (by id) and report disagreements.
 *
 * Compares: name, contract (numeric, 2dp), systemkw (numeric, 2dp).
 * Ignores: created_at, updated_at, dates, anything else.
 */
export function detectDrift(projectsRows: DriftRow[], legacyRows: DriftRow[]): DriftReport {
  const projectsById = new Map<string, DriftRow>()
  for (const r of projectsRows) projectsById.set(r.id, r)

  const legacyById = new Map<string, DriftRow>()
  for (const r of legacyRows) legacyById.set(r.id, r)

  const onlyInProjects: string[] = []
  for (const id of projectsById.keys()) {
    if (!legacyById.has(id)) onlyInProjects.push(id)
  }

  const onlyInLegacy: string[] = []
  for (const id of legacyById.keys()) {
    if (!projectsById.has(id)) onlyInLegacy.push(id)
  }

  const disagreements: FieldDisagreement[] = []
  let overlapCount = 0

  for (const [id, p] of projectsById.entries()) {
    const l = legacyById.get(id)
    if (!l) continue
    overlapCount++

    const pName = normalizeString(p.name)
    const lName = normalizeString(l.name)
    if (pName !== lName) {
      disagreements.push({ id, field: 'name', projects: pName, legacy: lName })
    }

    const pContract = normalizeNumeric(p.contract)
    const lContract = normalizeNumeric(l.contract)
    if (pContract !== lContract) {
      disagreements.push({ id, field: 'contract', projects: pContract, legacy: lContract })
    }

    const pKw = normalizeNumeric(p.systemkw)
    const lKw = normalizeNumeric(l.systemkw)
    if (pKw !== lKw) {
      disagreements.push({ id, field: 'systemkw', projects: pKw, legacy: lKw })
    }
  }

  return { overlapCount, onlyInProjects, onlyInLegacy, disagreements }
}
