#!/usr/bin/env node
// scripts/generate-codebase-stats.mjs — walks the repo at build time and writes
// lib/infographic/codebase-stats.ts with a typed CODEBASE_STATS constant. Runs:
//   • postinstall (so fresh clones can typecheck)
//   • pre-build  (so Vercel deploys always have current numbers)
//   • pre-dev    (so local dev mirrors prod)
//
// The output file is gitignored — regenerated every run. Never commit it.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
// Generic excludes — applied at every depth
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', '.expo', 'ios', 'android',
  'build', 'dist', '.vercel', '.turbo', 'coverage', 'out', '.gitnexus',
])
// Absolute path excludes — only applied at the repo root.
// `mobile/` at the repo root is the Expo companion app (not part of the Next.js build).
// But `app/mobile/` contains legitimate web routes — do NOT exclude that.
const EXCLUDE_PATHS = new Set([
  path.join(ROOT, 'mobile'),
])

function walk(root, onFile) {
  if (!fs.existsSync(root)) return
  if (EXCLUDE_PATHS.has(root)) return
  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    if (EXCLUDE_DIRS.has(e.name)) continue
    const p = path.join(root, e.name)
    if (EXCLUDE_PATHS.has(p)) continue
    if (e.isDirectory()) walk(p, onFile)
    else onFile(p)
  }
}

function countLines(file) {
  try {
    const content = fs.readFileSync(file, 'utf8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

// ── 1. Source LOC (TS/TSX only, excluding tests, scripts, mobile) ────────────
const appRoots = ['app', 'lib', 'components', 'types', 'hooks']
let appLoc = 0
let appFiles = 0
for (const root of appRoots) {
  walk(path.join(ROOT, root), (p) => {
    if (!/\.(ts|tsx)$/.test(p)) return
    if (p.endsWith('.tsbuildinfo')) return
    if (path.basename(p) === 'next-env.d.ts') return
    appLoc += countLines(p)
    appFiles += 1
  })
}

// ── 2. Test LOC + file count ─────────────────────────────────────────────────
let testLoc = 0
let testFiles = 0
walk(path.join(ROOT, '__tests__'), (p) => {
  if (!/\.(test|spec)\.(ts|tsx)$/.test(p)) return
  testLoc += countLines(p)
  testFiles += 1
})

// ── 3. Pages (app/**/page.tsx) ───────────────────────────────────────────────
let pages = 0
walk(path.join(ROOT, 'app'), (p) => { if (p.endsWith('/page.tsx')) pages += 1 })

// ── 4. API route handlers (app/**/route.ts) ──────────────────────────────────
let apiRoutes = 0
walk(path.join(ROOT, 'app'), (p) => { if (p.endsWith('/route.ts')) apiRoutes += 1 })

// ── 5. API modules (lib/api/*.ts, excluding index) ───────────────────────────
let apiModules = 0
let apiExports = 0
const apiDir = path.join(ROOT, 'lib/api')
if (fs.existsSync(apiDir)) {
  for (const f of fs.readdirSync(apiDir)) {
    if (!f.endsWith('.ts') || f === 'index.ts') continue
    apiModules += 1
    const content = fs.readFileSync(path.join(apiDir, f), 'utf8')
    // Count `export ` at line start (functions, consts, types)
    const matches = content.match(/^export\s+/gm)
    apiExports += matches ? matches.length : 0
  }
}

// ── 6. Components ────────────────────────────────────────────────────────────
let components = 0
walk(path.join(ROOT, 'components'), (p) => { if (p.endsWith('.tsx')) components += 1 })

// ── 7. Error boundaries (app/**/error.tsx) ───────────────────────────────────
let errorBoundaries = 0
walk(path.join(ROOT, 'app'), (p) => { if (p.endsWith('/error.tsx')) errorBoundaries += 1 })

// ── 8. Migrations ────────────────────────────────────────────────────────────
let migrationFiles = 0
let maxMigrationNumber = 0
walk(path.join(ROOT, 'supabase'), (p) => {
  if (!p.endsWith('.sql')) return
  migrationFiles += 1
  const m = path.basename(p).match(/^(\d{3})-/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n > maxMigrationNumber) maxMigrationNumber = n
  }
})

// ── 9. Test count — vitest for accuracy (skip with STATS_SKIP_VITEST=1) ──────
// `postinstall` + `prebuild` run full vitest (~10s, accurate).
// `predev` sets STATS_SKIP_VITEST=1 to keep iteration fast (heuristic, ~200ms).
let testCount = 0
let testCountSource = 'heuristic'
const skipVitest = process.env.STATS_SKIP_VITEST === '1'
if (!skipVitest) {
  try {
    const out = execSync('npx vitest run --reporter=json --silent', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Vitest's JSON reporter emits a single object at the end. Find the last `{...}`.
    const match = out.match(/\{[\s\S]*\}\s*$/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (typeof parsed.numTotalTests === 'number' && parsed.numTotalTests > 0) {
        testCount = parsed.numTotalTests
        testCountSource = 'vitest'
      }
    }
  } catch (err) {
    console.warn(`[generate-codebase-stats] vitest failed (${err.message}); falling back to heuristic`)
  }
}
if (testCount === 0) {
  // Heuristic: count `test(` / `it(` call sites line-anchored. Undercounts
  // slightly (~8%) but works without running the suite.
  const pattern = /^\s*(test|it)(\.\w+)*\s*\(/gm
  let total = 0
  walk(path.join(ROOT, '__tests__'), (p) => {
    if (!/\.(test|spec)\.(ts|tsx)$/.test(p)) return
    const content = fs.readFileSync(p, 'utf8')
    const matches = content.match(pattern)
    total += matches ? matches.length : 0
  })
  testCount = total
  testCountSource = 'heuristic'
}

// ── 10. Emit the generated file ──────────────────────────────────────────────
const stats = {
  loc_app: appLoc,
  loc_tests: testLoc,
  loc_total: appLoc + testLoc,
  source_files: appFiles + testFiles,
  app_source_files: appFiles,
  test_files: testFiles,
  pages,
  api_routes: apiRoutes,
  api_modules: apiModules,
  api_exports: apiExports,
  components,
  error_boundaries: errorBoundaries,
  migration_files: migrationFiles,
  max_migration_number: maxMigrationNumber,
  test_count: testCount,
  test_count_source: testCountSource,
  generated_at: new Date().toISOString(),
}

const outDir = path.join(ROOT, 'lib/infographic')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// Single-line `//` comments only — block comments are a foot-gun because glob
// patterns like `app/**` close JSDoc blocks early (see feedback memory
// `feedback_jsdoc_block_comment_trap.md`). Keep every doc comment as `//`.
const content = `// AUTO-GENERATED by scripts/generate-codebase-stats.mjs — DO NOT EDIT.
// Regenerated on every postinstall / dev / build. Gitignored.
// If you see stale numbers, run \`npm run generate-stats\`.

export interface CodebaseStats {
  // Total TS/TSX lines in app + lib + components + types + hooks
  // (no tests, no scripts, no mobile companion app).
  loc_app: number
  // TS/TSX lines in the tests directory.
  loc_tests: number
  // loc_app + loc_tests.
  loc_total: number
  // Total TS/TSX files across app code + tests.
  source_files: number
  // App-only source file count (no tests).
  app_source_files: number
  // Count of .test.ts and .test.tsx files under the tests directory.
  test_files: number
  // Count of page.tsx files anywhere under app (Next.js App Router pages).
  pages: number
  // Count of route.ts handlers anywhere under app (Next.js API routes).
  api_routes: number
  // Count of .ts modules in lib/api (excludes index.ts).
  api_modules: number
  // Total \`export\` declarations across lib/api modules.
  api_exports: number
  // Count of .tsx files anywhere under components.
  components: number
  // Count of error.tsx boundaries anywhere under app.
  error_boundaries: number
  // Count of .sql files anywhere under supabase.
  migration_files: number
  // Highest numbered migration — e.g. 107 for 107-warranty-claims-funding-deductions.sql.
  max_migration_number: number
  // Test count from vitest JSON reporter, or heuristic grep fallback.
  test_count: number
  // 'vitest' if the suite was run successfully at generate time, 'heuristic' otherwise.
  test_count_source: 'vitest' | 'heuristic'
  // ISO timestamp of when this file was last generated.
  generated_at: string
}

export const CODEBASE_STATS: CodebaseStats = ${JSON.stringify(stats, null, 2)}
`

fs.writeFileSync(path.join(outDir, 'codebase-stats.ts'), content)
console.log(`[generate-codebase-stats] wrote lib/infographic/codebase-stats.ts`)
console.log(`  loc_app=${stats.loc_app.toLocaleString()}  loc_total=${stats.loc_total.toLocaleString()}`)
console.log(`  pages=${stats.pages}  components=${stats.components}  api_modules=${stats.api_modules}`)
console.log(`  tests=${stats.test_count} (${stats.test_count_source})  migrations=${stats.migration_files} (max #${stats.max_migration_number})`)
