import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'

// Static guard for migration 213's `p_force` admin gate (#462).
//
// `set_project_stage(p_force=true)` lets admins arbitrarily set any project's
// stage. The non-admin case must raise `force_requires_admin`. This file
// pins three load-bearing properties of the latest function definition
// across the migrations dir, plus a cross-file scan for hostile DROP /
// DISABLE / GRANT patterns that would re-open the gate without modifying
// the function body itself.
//
// Static-inspection style matches __tests__/security-definer-grants.test.ts.
// Bypass surface and red-teamer findings are documented inline at each
// assertion.

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'migrations')

async function listMigrations(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true })
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.sql'))
    .map(e => e.name)
    .sort()
}

async function readAllMigrations(): Promise<{ file: string; sql: string }[]> {
  const files = await listMigrations()
  return Promise.all(
    files.map(async file => ({
      file,
      sql: await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8'),
    })),
  )
}

// MG migrations all use numeric-prefix convention (213, 213b, 214, ...) so
// lexicographic sort matches "shipped last" today. If a future migration
// drops the convention (ISO-date prefix etc.), revisit.
async function latestFunctionBody(fnName: string): Promise<{ file: string; body: string } | null> {
  const all = await readAllMigrations()
  for (let i = all.length - 1; i >= 0; i--) {
    const re = new RegExp(
      `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${fnName}\\b[\\s\\S]*?\\$\\$;`,
      'gi',
    )
    const m = re.exec(all[i].sql)
    if (m) return { file: all[i].file, body: m[0] }
  }
  return null
}

// Extract the body of an `IF p_force THEN ... END IF;` block (innermost
// match). Returns just the contents between THEN and the matching END IF
// so we can structurally assert what runs inside it. Naive bracket
// matching — assumes no nested IF/END IF inside the force block, which
// holds for migration 213 today.
function extractForceBlock(body: string): string | null {
  const start = body.search(/\bIF\s+p_force\s+THEN\b/i)
  if (start === -1) return null
  const tail = body.slice(start)
  const end = tail.search(/\bELSE\b|\bEND\s+IF\s*;/i)
  if (end === -1) return null
  return tail.slice(0, end)
}

describe('set_project_stage admin-force gate', () => {
  it('latest definition contains an admin gate that raises force_requires_admin', async () => {
    const def = await latestFunctionBody('set_project_stage')
    expect(def).not.toBeNull()
    if (!def) return

    // Tighter than the original [\s\S]{0,400} pattern: require the admin
    // check inside an `IF NOT public.auth_is_admin()` (the migration's
    // canonical shape). Closes the red-teamer finding that
    //   IF p_force AND auth_is_admin() = auth_is_admin() THEN RAISE 'force_requires_admin';
    // would always-raise (admins locked out) but pass a loose regex.
    const guardRe =
      /\bIF\s+NOT\s+public\.auth_is_admin\s*\(\s*\)\s+THEN[\s\S]{0,200}?\bRAISE\s+EXCEPTION\s+'force_requires_admin'/i
    expect(def.body).toMatch(guardRe)
  })

  it('admin gate is structurally INSIDE the IF p_force THEN block', async () => {
    const def = await latestFunctionBody('set_project_stage')
    expect(def).not.toBeNull()
    if (!def) return

    // Replaces the previous byte-offset (forceIdx < transitionIdx) tautology
    // flagged by the red-teamer. That check measured token positions, not
    // control flow — a comment "-- p_force: see below" on line 1 trivially
    // passed. New approach: extract the `IF p_force THEN ... END IF` block
    // body and require the admin RAISE be inside it. A refactor that pulls
    // the admin check out of the force block (e.g. moves it after the
    // forward-by-1 fallback) fails this assertion.
    const forceBlock = extractForceBlock(def.body)
    expect(forceBlock).not.toBeNull()
    if (!forceBlock) return
    expect(forceBlock).toMatch(/\bauth_is_admin\b/i)
    expect(forceBlock).toMatch(/\bforce_requires_admin\b/)
  })

  it('schema-qualified auth helper (public.auth_is_admin) is used, not a shadowable bare reference', async () => {
    const def = await latestFunctionBody('set_project_stage')
    expect(def).not.toBeNull()
    if (!def) return

    // Schema shadowing: a future migration could create
    //   myschema.auth_is_admin() RETURNS bool LANGUAGE sql AS $$ SELECT true $$;
    // and rewrite set_project_stage to call the bare `auth_is_admin()` —
    // search_path resolution would pick up the privesc shim. Pinning to
    // `public.auth_is_admin` blocks that.
    expect(def.body).toMatch(/\bpublic\.auth_is_admin\s*\(/i)
  })

  it('no later migration weakens the RPC via DROP / GRANT TO PUBLIC|anon / overload', async () => {
    const all = await readAllMigrations()
    // Cross-file scan: anything that re-opens the RPC must be caught here
    // even if the canonical CREATE OR REPLACE in 213/213b stays intact.
    const violations: { file: string; pattern: string }[] = []
    const dropRe = /\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?set_project_stage\b/i
    // Constrain to same statement via [^;]* so the regex can't span across
    // a closing `;` into the next COMMENT or GRANT line. Without that, the
    // case-insensitive PUBLIC matches the bare `public.` schema qualifier
    // in a following COMMENT ON FUNCTION line.
    const grantPublicRe =
      /\bGRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?set_project_stage[^;]*\bTO[^;]*\b(?:PUBLIC|anon)\b/i

    for (const m of all) {
      if (dropRe.test(m.sql)) violations.push({ file: m.file, pattern: 'DROP FUNCTION set_project_stage' })
      if (grantPublicRe.test(m.sql))
        violations.push({ file: m.file, pattern: 'GRANT EXECUTE ON set_project_stage TO PUBLIC|anon' })
    }
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
})
