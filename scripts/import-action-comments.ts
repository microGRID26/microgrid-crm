/**
 * Import NetSuite action comments from CSV files into a JSON file
 * ready for upload to the notes table.
 *
 * Usage: npx tsx scripts/import-action-comments.ts --output /tmp/action_comments.json
 */

import * as fs from 'fs'
import * as crypto from 'crypto'

// --- Task mapping from NetSuite Action Template to NOVA task_id ---

const TASK_MAP: Record<string, string> = {
  'Welcome Call': 'welcome',
  'IA Confirmation': 'ia',
  'UB Confirmation': 'ub',
  'Schedule Site Survey': 'sched_survey',
  'NTP Procedure': 'ntp',
  'Site Survey Complete': 'site_survey',
  'Survey Review': 'survey_review',
  'Pre-Scrub': 'pre_scrub',
  'Loan Confirmation': 'loan_confirm',
  'Project Data Approval': 'proj_data',
  'Contract Audit': 'contract_audit',
  'Build Design': 'build_design',
  'CAD Design': 'build_design',
  'Build Engineering': 'build_eng',
  'Engineering Approval': 'eng_approval',
  'Stamps Required': 'stamps',
  'City Permit Approval': 'city_permit',
  'Utility Permit Approval': 'util_permit',
  'HOA Approval': 'hoa',
  'Check Point 1': 'checkpoint1',
  'Inventory Allocation': 'inv_alloc',
  'O&M Review': 'om_review',
  'Schedule Installation': 'sched_install',
  'Install Complete': 'install_done',
  'Inspection Review': 'insp_review',
  'City Inspection Complete': 'city_insp',
  'Schedule City Inspection': 'city_insp',
  'Utility Inspection Complete': 'util_insp',
  'Schedule Utility Inspection': 'util_insp',
  'PTO Received': 'pto',
  'PTO Call': 'pto',
  'In Service': 'in_service',
  'Design Complete Call': 'design_call',
  'Activation Email': 'activation',
}

// --- CSV files to process ---

const CSV_DIR = '/Users/gregkelsch/Desktop/NetSuite/Project Records'
const CSV_FILES = [
  'ProjectAction_evaluationstage_1.29.26.csv',
  'ProjectAction_projectassessmentstage_1.29.26.csv',
  'Projectaction_designstage_1.29.26.csv',
  'projectaction_permittingstage_1.29.26.csv',
  'Projectaction_installstage_1.29.26.csv',
  'Projectaction_completionstage_1.29.26.csv',
  'ProjectAction_servicestage_1.29.26.csv',
]

// --- Types ---

interface NoteRecord {
  project_id: string
  task_id: string | null
  content: string
  author: string
  created_at: string
}

// --- CSV parsing (handles quoted fields with commas/newlines) ---

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

/**
 * Read a CSV file and return rows as arrays of strings.
 * Handles BOM, quoted fields with embedded commas, and \r\n line endings.
 * Also handles multi-line quoted fields.
 */
function readCSV(filePath: string): { headers: string[]; rows: string[][] } {
  const raw = fs.readFileSync(filePath, 'utf-8')
  // Remove BOM if present
  const content = raw.replace(/^\uFEFF/, '')

  // Split into logical lines, handling multi-line quoted fields
  const logicalLines: string[] = []
  let currentLine = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      currentLine += ch
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      // Skip \n after \r
      if (ch === '\r' && content[i + 1] === '\n') i++
      if (currentLine.trim()) {
        logicalLines.push(currentLine)
      }
      currentLine = ''
    } else {
      currentLine += ch
    }
  }
  if (currentLine.trim()) {
    logicalLines.push(currentLine)
  }

  if (logicalLines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCSVLine(logicalLines[0]).map(h => h.trim())
  const rows = logicalLines.slice(1).map(line => parseCSVLine(line))

  return { headers, rows }
}

// --- Comment parsing ---

const COMMENT_RE = /^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*([^:]+):\s*(.+)$/

function parseComments(raw: string): { date: string; author: string; message: string }[] {
  if (!raw || !raw.trim()) return []

  const results: { date: string; author: string; message: string }[] = []
  const parts = raw.split(';')

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const match = trimmed.match(COMMENT_RE)
    if (match) {
      const [, dateStr, author, message] = match
      // Parse M/D/YYYY to ISO date
      const [month, day, year] = dateStr.split('/')
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`
      results.push({
        date: isoDate,
        author: author.trim(),
        message: message.trim(),
      })
    }
  }

  return results
}

// --- Deduplication ---

function makeHash(projectId: string, taskId: string | null, content: string): string {
  return crypto
    .createHash('md5')
    .update(`${projectId}|${taskId ?? ''}|${content}`)
    .digest('hex')
}

// --- Main ---

function main() {
  // Parse args
  const outputIdx = process.argv.indexOf('--output')
  if (outputIdx === -1 || !process.argv[outputIdx + 1]) {
    console.error('Usage: npx tsx scripts/import-action-comments.ts --output <output.json>')
    process.exit(1)
  }
  const outputPath = process.argv[outputIdx + 1]

  const allNotes: NoteRecord[] = []
  const seen = new Set<string>()

  let totalRows = 0
  let totalComments = 0
  let totalPermitNotes = 0
  let unmatchedTemplates = new Map<string, number>()
  let duplicates = 0

  for (const csvFile of CSV_FILES) {
    const filePath = `${CSV_DIR}/${csvFile}`
    if (!fs.existsSync(filePath)) {
      console.error(`WARNING: File not found: ${filePath}`)
      continue
    }

    console.error(`Processing ${csvFile}...`)
    const { headers, rows } = readCSV(filePath)

    // Find column indices by header name
    const colProjectId = 0 // First column is always Project ID
    const colActionTemplate = headers.findIndex(h => h === 'Action Template')
    const colCommentHistory = headers.findIndex(h => h === 'Comment History')
    const colCityPermitNotes = headers.findIndex(h => h === 'City Permit Approval Notes')
    const colUtilPermitNotes = headers.findIndex(h => h === 'Utility Permit Approval Notes')

    if (colActionTemplate === -1) {
      console.error(`  WARNING: No "Action Template" column found, skipping`)
      continue
    }
    if (colCommentHistory === -1) {
      console.error(`  WARNING: No "Comment History" column found, skipping`)
      continue
    }

    let fileComments = 0
    let filePermitNotes = 0

    for (const row of rows) {
      totalRows++

      // Clean project ID (remove BOM if present)
      const projectId = (row[colProjectId] || '').replace(/^\uFEFF/, '').trim()
      if (!projectId || !projectId.startsWith('PROJ-')) continue

      const actionTemplate = (row[colActionTemplate] || '').trim()
      const taskId = TASK_MAP[actionTemplate] ?? null

      if (actionTemplate && !TASK_MAP[actionTemplate]) {
        unmatchedTemplates.set(actionTemplate, (unmatchedTemplates.get(actionTemplate) || 0) + 1)
      }

      // Parse Comment History
      const commentRaw = row[colCommentHistory] || ''
      const comments = parseComments(commentRaw)

      for (const comment of comments) {
        const content = `[NS] ${comment.message}`
        const hash = makeHash(projectId, taskId, content)

        if (!seen.has(hash)) {
          seen.add(hash)
          allNotes.push({
            project_id: projectId,
            task_id: taskId,
            content,
            author: comment.author,
            created_at: comment.date,
          })
          fileComments++
          totalComments++
        } else {
          duplicates++
        }
      }

      // City Permit Approval Notes (permitting CSV only)
      if (colCityPermitNotes !== -1) {
        const cityNotes = (row[colCityPermitNotes] || '').trim()
        if (cityNotes) {
          const content = `[NS] ${cityNotes}`
          const hash = makeHash(projectId, 'city_permit', content)
          if (!seen.has(hash)) {
            seen.add(hash)
            allNotes.push({
              project_id: projectId,
              task_id: 'city_permit',
              content,
              author: 'NetSuite',
              created_at: '2025-01-29T12:00:00.000Z',
            })
            filePermitNotes++
            totalPermitNotes++
          } else {
            duplicates++
          }
        }
      }

      // Utility Permit Approval Notes (permitting CSV only)
      if (colUtilPermitNotes !== -1) {
        const utilNotes = (row[colUtilPermitNotes] || '').trim()
        if (utilNotes) {
          const content = `[NS] ${utilNotes}`
          const hash = makeHash(projectId, 'util_permit', content)
          if (!seen.has(hash)) {
            seen.add(hash)
            allNotes.push({
              project_id: projectId,
              task_id: 'util_permit',
              content,
              author: 'NetSuite',
              created_at: '2025-01-29T12:00:00.000Z',
            })
            filePermitNotes++
            totalPermitNotes++
          } else {
            duplicates++
          }
        }
      }
    }

    console.error(`  Rows: ${rows.length}, Comments: ${fileComments}, Permit Notes: ${filePermitNotes}`)
  }

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(allNotes, null, 2))

  // Print stats
  console.error(`\n=== Import Complete ===`)
  console.error(`Total CSV rows processed: ${totalRows}`)
  console.error(`Total comment notes:      ${totalComments}`)
  console.error(`Total permit notes:       ${totalPermitNotes}`)
  console.error(`Total notes output:       ${allNotes.length}`)
  console.error(`Duplicates skipped:       ${duplicates}`)

  if (unmatchedTemplates.size > 0) {
    console.error(`\nUnmatched Action Templates:`)
    const sorted = [...unmatchedTemplates.entries()].sort((a, b) => b[1] - a[1])
    for (const [template, count] of sorted) {
      console.error(`  ${template}: ${count}`)
    }
  }

  console.error(`\nOutput written to: ${outputPath}`)
}

main()
