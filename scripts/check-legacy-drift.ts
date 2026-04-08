/**
 * Drift check: compare overlapping rows in `projects` and `legacy_projects`
 * for disagreements on name, contract, and systemkw.
 *
 * Usage:
 *   npx tsx scripts/check-legacy-drift.ts          # text report
 *   npx tsx scripts/check-legacy-drift.ts --json   # JSON output
 *
 * Background: on 2026-04-06, ~15,090 rows were bulk-imported from
 * `legacy_projects` into `projects` with disposition='In Service'. The two
 * tables now hold shadow copies of the same data with no FK or trigger to
 * keep them in sync. This script catches drift before it causes confusion.
 *
 * Exit code: 0 if no drift, 1 if disagreements found.
 */

import { createClient } from '@supabase/supabase-js'
import { detectDrift, type DriftRow } from '../lib/legacy-drift'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars')
    process.exit(2)
  }

  const supabase = createClient(url, key)

  if (!jsonOutput) console.log('Loading projects (disposition=In Service)…')
  const { data: projectsRows, error: pErr } = await supabase
    .from('projects')
    .select('id, name, contract, systemkw')
    .eq('disposition', 'In Service')
    .limit(50000)

  if (pErr) {
    console.error('ERROR loading projects:', pErr.message)
    process.exit(2)
  }

  if (!jsonOutput) console.log('Loading legacy_projects (disposition=In Service)…')
  const { data: legacyRows, error: lErr } = await supabase
    .from('legacy_projects')
    .select('id, name, contract, systemkw')
    .eq('disposition', 'In Service')
    .limit(50000)

  if (lErr) {
    console.error('ERROR loading legacy_projects:', lErr.message)
    process.exit(2)
  }

  const report = detectDrift(
    (projectsRows ?? []) as DriftRow[],
    (legacyRows ?? []) as DriftRow[],
  )

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('')
    console.log(`projects (In Service):        ${(projectsRows ?? []).length.toLocaleString()}`)
    console.log(`legacy_projects (In Service): ${(legacyRows ?? []).length.toLocaleString()}`)
    console.log(`overlap (id match):           ${report.overlapCount.toLocaleString()}`)
    console.log(`only in projects:             ${report.onlyInProjects.length.toLocaleString()}`)
    console.log(`only in legacy_projects:      ${report.onlyInLegacy.length.toLocaleString()}`)
    console.log('')
    if (report.disagreements.length === 0) {
      console.log('✓ No drift detected — overlapping rows agree on name, contract, systemkw.')
    } else {
      console.log(`✗ ${report.disagreements.length} field disagreement(s) found:`)
      console.log('')
      // Print up to 25 examples
      const sample = report.disagreements.slice(0, 25)
      for (const d of sample) {
        console.log(`  ${d.id} [${d.field}]: projects=${JSON.stringify(d.projects)}  legacy=${JSON.stringify(d.legacy)}`)
      }
      if (report.disagreements.length > 25) {
        console.log(`  … and ${report.disagreements.length - 25} more`)
      }
    }
    console.log('')
  }

  process.exit(report.disagreements.length === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(2)
})
