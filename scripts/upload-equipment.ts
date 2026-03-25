/**
 * Upload equipment JSON to Supabase
 *
 * Reads the output from import-equipment.ts and bulk upserts
 * into the equipment table in batches of 500.
 *
 * Usage:
 *   npx tsx scripts/upload-equipment.ts /tmp/equipment.json
 */

import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 500

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/upload-equipment.ts <input.json>')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  console.log(`Reading ${inputPath}...`)
  const raw = fs.readFileSync(inputPath, 'utf-8')
  const data = JSON.parse(raw)
  const equipment: Record<string, unknown>[] = data.equipment || []

  console.log(`Found ${equipment.length} equipment records to upload.\n`)

  let inserted = 0
  let errors = 0

  for (let i = 0; i < equipment.length; i += BATCH_SIZE) {
    const batch = equipment.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('equipment')
      .insert(batch)

    if (error) {
      console.error(`  ERROR batch ${i}-${i + batch.length}: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= equipment.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, equipment.length)} / ${equipment.length} (${inserted} inserted, ${errors} errors)`)
    }
  }

  console.log(`\n=== Upload Complete ===`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Errors:   ${errors}`)
}

main()
