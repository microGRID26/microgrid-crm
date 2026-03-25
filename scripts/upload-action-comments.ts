/**
 * Upload action comment notes to Supabase notes table
 *
 * Usage: npx tsx scripts/upload-action-comments.ts /tmp/action_comments.json
 */

import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 500

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/upload-action-comments.ts <input.json>')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars')
    console.error('Set them in .env.local or export them before running.')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  console.log(`Reading ${inputPath}...`)
  const notes: { project_id: string; task_id: string | null; content: string; author: string; created_at: string }[] =
    JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  console.log(`Found ${notes.length} notes to upload.\n`)

  if (notes.length === 0) {
    console.log('Nothing to upload.')
    return
  }

  let inserted = 0
  let errors = 0

  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE)

    // notes table columns: project_id, task_id, text (not content), pm (not author), time (not created_at)
    const rows = batch.map(n => ({
      project_id: n.project_id,
      task_id: n.task_id,
      text: n.content,
      pm: n.author,
      time: n.created_at,
    }))

    const { error } = await supabase.from('notes').insert(rows)

    if (error) {
      errors += batch.length
      if (errors <= 2000) {
        console.error(`  ERROR batch ${i}-${i + batch.length}: ${error.message}`)
      }
    } else {
      inserted += batch.length
    }

    if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= notes.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, notes.length)} / ${notes.length} (${inserted} inserted, ${errors} errors)`)
    }
  }

  console.log(`\n=== Upload Complete ===`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Errors:   ${errors}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
