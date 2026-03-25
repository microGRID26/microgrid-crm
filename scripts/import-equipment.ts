/**
 * Import equipment from NetSuite CSV into JSON format
 *
 * Reads: ~/Desktop/NetSuite/Customizations/Customizations_InventoryItems_1.29.26.csv
 * Maps columns to equipment table schema
 *
 * Usage:
 *   npx tsx scripts/import-equipment.ts --output /tmp/equipment.json
 */

import * as fs from 'fs'
import * as path from 'path'

const CSV_PATH = path.join(
  process.env.HOME || '~',
  'Desktop/NetSuite/Customizations/Customizations_InventoryItems_1.29.26.csv'
)

// Category mapping from NetSuite "Item Category" to our categories
const CATEGORY_MAP: Record<string, string> = {
  'modules': 'module',
  'module': 'module',
  'inverters': 'inverter',
  'inverter': 'inverter',
  'batteries': 'battery',
  'battery': 'battery',
  'optimizers': 'optimizer',
  'optimizer': 'optimizer',
  'racking': 'racking',
  'electrical': 'electrical',
  'adder': 'adder',
  'adders': 'adder',
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function mapCategory(itemCategory: string): string {
  const lower = (itemCategory || '').toLowerCase().trim()
  return CATEGORY_MAP[lower] || 'other'
}

function parseWatts(watts: string): number | null {
  if (!watts || watts.trim() === '') return null
  const n = parseInt(watts.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

function main() {
  const args = process.argv.slice(2)
  const outputIdx = args.indexOf('--output')
  const outputPath = outputIdx >= 0 && args[outputIdx + 1] ? args[outputIdx + 1] : '/tmp/equipment.json'

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: CSV not found at ${CSV_PATH}`)
    process.exit(1)
  }

  console.log(`Reading ${CSV_PATH}...`)
  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim())

  // Parse header — handle BOM
  const headerLine = lines[0].replace(/^\uFEFF/, '')
  const headers = parseCSVLine(headerLine)

  // Find column indices
  const nameIdx = headers.indexOf('Name') >= 0 ? headers.indexOf('Name') : 0
  const displayNameIdx = headers.indexOf('Display Name')
  const descIdx = headers.indexOf('Description')
  const categoryIdx = headers.indexOf('Item Category')
  const statusIdx = headers.indexOf('Item Status')
  const manufacturerIdx = headers.indexOf('Manufacturer')
  const wattsIdx = headers.indexOf('Watts')

  console.log(`Found ${lines.length - 1} data rows`)
  console.log(`Columns: Name=${nameIdx}, DisplayName=${displayNameIdx}, Category=${categoryIdx}, Status=${statusIdx}, Manufacturer=${manufacturerIdx}, Watts=${wattsIdx}`)

  const equipment: Record<string, unknown>[] = []
  const stats = {
    total: 0,
    active: 0,
    inactive: 0,
    byCategory: {} as Record<string, number>,
    skipped: 0,
  }

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length < 6) { stats.skipped++; continue }

    stats.total++

    const name = (fields[nameIdx] || '').replace(/^"+|"+$/g, '').trim()
    const displayName = displayNameIdx >= 0 ? (fields[displayNameIdx] || '').trim() : ''
    const description = descIdx >= 0 ? (fields[descIdx] || '').trim() : ''
    const itemCategory = categoryIdx >= 0 ? fields[categoryIdx] : ''
    const itemStatus = statusIdx >= 0 ? fields[statusIdx] : ''
    const manufacturer = manufacturerIdx >= 0 ? (fields[manufacturerIdx] || '').trim() : ''
    const watts = wattsIdx >= 0 ? fields[wattsIdx] : ''

    if (!name) { stats.skipped++; continue }

    const category = mapCategory(itemCategory)
    const isActive = (itemStatus || '').toLowerCase().includes('active')

    if (isActive) stats.active++
    else stats.inactive++

    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1

    // Try to extract model from display name or name
    let model: string | null = null
    if (displayName && displayName !== name) {
      model = displayName
    }

    equipment.push({
      name: displayName || name,
      manufacturer: manufacturer || null,
      model,
      category,
      watts: parseWatts(watts),
      description: description || null,
      active: isActive,
      sort_order: 0,
    })
  }

  console.log('\n=== Import Stats ===')
  console.log(`Total rows:  ${stats.total}`)
  console.log(`Active:      ${stats.active}`)
  console.log(`Inactive:    ${stats.inactive}`)
  console.log(`Skipped:     ${stats.skipped}`)
  console.log('\nBy category:')
  for (const [cat, count] of Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`)
  }

  const output = { equipment, stats }
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${equipment.length} equipment records to ${outputPath}`)
}

main()
