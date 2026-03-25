/**
 * Upload Google Drive file metadata to Supabase project_files table.
 *
 * Reads the JSON output from sync-drive-files.py (--dry-run mode)
 * and bulk upserts into project_files via Supabase JS client.
 *
 * Usage:
 *   npx tsx scripts/upload-drive-files.ts /tmp/drive_files.json
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) in env.
 * Load env with: source <(grep -v '^#' .env.local | sed 's/^/export /')
 */

import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 200

interface DriveFileRecord {
  project_id: string
  file_id: string
  file_name: string
  folder_name: string
  file_url: string
  mime_type: string | null
  file_size: number
  created_at: string | null
  updated_at: string | null
  synced_at: string
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/upload-drive-files.ts <drive_files.json>')
    console.error('')
    console.error('Generate the JSON with:')
    console.error('  python3 scripts/sync-drive-files.py --dry-run --output /tmp/drive_files.json')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
    console.error('Load env with: source <(grep -v "^#" .env.local | sed "s/^/export /")')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  console.log(`Reading ${inputPath}...`)
  const raw = fs.readFileSync(inputPath, 'utf-8')
  const records: DriveFileRecord[] = JSON.parse(raw)

  if (!Array.isArray(records) || records.length === 0) {
    console.error('ERROR: No records found in input file')
    process.exit(1)
  }

  console.log(`Found ${records.length} file records to upload.`)

  // Count unique projects
  const projectIds = new Set(records.map(r => r.project_id))
  console.log(`Spanning ${projectIds.size} projects.\n`)

  let inserted = 0
  let errors = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    // Upsert on (project_id, file_id) conflict
    const { error } = await (supabase as any)
      .from('project_files')
      .upsert(batch, { onConflict: 'project_id,file_id' })

    if (error) {
      errors += batch.length
      if (errors <= BATCH_SIZE * 3) {
        console.error(`  ERROR batch ${i}-${i + batch.length}: ${error.message}`)
      }
    } else {
      inserted += batch.length
    }

    // Progress every 1000 records
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(
        `  Progress: ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length} ` +
        `(${inserted} inserted, ${errors} errors)`
      )
    }
  }

  console.log(`\n=== Upload Complete ===`)
  console.log(`Total records: ${records.length}`)
  console.log(`Inserted:      ${inserted}`)
  console.log(`Errors:        ${errors}`)
  console.log(`Projects:      ${projectIds.size}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
