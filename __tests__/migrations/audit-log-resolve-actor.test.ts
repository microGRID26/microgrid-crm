import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'

// Static guards for migration 214's audit_log spoof-prevention trigger (#462).
//
// `audit_log_resolve_actor` overrides client-supplied changed_by_id with
// the auth-resolved actor on every authenticated INSERT into audit_log.
// Closes #453 — without it, ~10 INSERT call sites across the codebase let
// any authenticated user spoof the actor by passing another user's id.
//
// This test pins the function body, the trigger statement, AND a
// cross-file scan for hostile DROP / DISABLE / RENAME patterns that would
// neutralize the trigger without modifying its source. Static-inspection
// style — runtime DB-level coverage would need integration test infra
// the project doesn't have today.

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
// drops the convention (ISO-date prefixes, etc.), revisit.
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

async function latestTriggerStatement(triggerName: string): Promise<{ file: string; body: string } | null> {
  const all = await readAllMigrations()
  for (let i = all.length - 1; i >= 0; i--) {
    const re = new RegExp(`\\bCREATE\\s+TRIGGER\\s+${triggerName}\\b[\\s\\S]*?;`, 'gi')
    const m = re.exec(all[i].sql)
    if (m) return { file: all[i].file, body: m[0] }
  }
  return null
}

describe('audit_log_resolve_actor anti-spoof trigger', () => {
  it('function exists and overrides changed_by_id with the auth-resolved actor', async () => {
    const def = await latestFunctionBody('audit_log_resolve_actor')
    expect(def).not.toBeNull()
    if (!def) return

    // Body must call public.auth_user_id() (schema-qualified — bare
    // `auth_user_id()` could be shadowed by a privesc shim in another
    // schema with a search_path manipulation).
    expect(def.body).toMatch(/\bpublic\.auth_user_id\s*\(\s*\)|\bauth\.uid\s*\(\s*\)/i)

    // The actual override line must assign auth-resolved id back into NEW.
    // Red-teamer flagged that NEW.changed_by_id := NEW.changed_by_id; or
    // wrapping in IF false THEN would still match a loose regex. Pin both:
    //   - the assignment target is NEW.changed_by_id
    //   - the right-hand side references v_uid (the local that gets the
    //     auth-resolved value), not NEW.* (which is the spoofed input)
    expect(def.body).toMatch(/\bNEW\.changed_by_id\s*:=\s*v_uid\b/i)
  })

  it('function early-returns when no auth session (preserves service_role / cron writes)', async () => {
    const def = await latestFunctionBody('audit_log_resolve_actor')
    expect(def).not.toBeNull()
    if (!def) return

    // If the auth-null branch is removed, every cron / DEFINER-function
    // INSERT into audit_log has its actor blanked out. Verify the
    // early-return when public.auth_user_id() resolves to null.
    expect(def.body).toMatch(/\bIF\s+v_uid\s+IS\s+NULL\b[\s\S]{0,200}?\bRETURN\s+NEW\b/i)
  })

  it('trigger is BEFORE INSERT FOR EACH ROW on public.audit_log', async () => {
    const stmt = await latestTriggerStatement('audit_log_resolve_actor_trg')
    expect(stmt).not.toBeNull()
    if (!stmt) return

    // BEFORE INSERT is load-bearing (AFTER INSERT can't mutate NEW —
    // would silently turn the trigger into a no-op logger). FOR EACH ROW
    // is also required (statement-level triggers don't get NEW). Bind to
    // public.audit_log specifically.
    expect(stmt.body).toMatch(/\bBEFORE\s+INSERT\b/i)
    expect(stmt.body).toMatch(/\bFOR\s+EACH\s+ROW\b/i)
    expect(stmt.body).toMatch(/\bON\s+(?:public\.)?audit_log\b/i)
    expect(stmt.body).toMatch(
      /\bEXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?audit_log_resolve_actor\s*\(/i,
    )
  })

  it('no later migration neutralizes the trigger via DROP / DISABLE / RENAME / GRANT bypass', async () => {
    const all = await readAllMigrations()
    // Cross-file scan: catches the red-teamer's "300-cleanup.sql DROPs the
    // trigger after 214" attack that the latest-CREATE walk above can't
    // see. Also catches DISABLE TRIGGER (trigger source intact, runtime
    // dead) and RENAME TO …_disabled.
    const violations: { file: string; pattern: string }[] = []
    const dropTriggerRe =
      /\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?audit_log_resolve_actor_trg\b/i
    const dropFunctionRe =
      /\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?audit_log_resolve_actor\b/i
    const disableRe =
      /\bALTER\s+TABLE\s+(?:public\.)?audit_log\s+DISABLE\s+TRIGGER\s+audit_log_resolve_actor_trg\b/i
    const renameRe = /\bALTER\s+TRIGGER\s+audit_log_resolve_actor_trg\b[\s\S]{0,80}?\bRENAME\b/i
    // Constrain to same statement via [^;]* so the case-insensitive PUBLIC
    // can't match the bare `public.` schema qualifier on a following COMMENT
    // ON FUNCTION line.
    const grantPublicRe =
      /\bGRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?audit_log_resolve_actor[^;]*\bTO[^;]*\b(?:PUBLIC|anon)\b/i

    for (const m of all) {
      // The canonical migration 214 contains its own DROP TRIGGER IF EXISTS
      // immediately before the CREATE TRIGGER — that's idempotency, not an
      // attack. Whitelist it by skipping the file that defines the trigger
      // in the first place.
      const definesTrigger = /\bCREATE\s+TRIGGER\s+audit_log_resolve_actor_trg\b/i.test(m.sql)

      if (!definesTrigger && dropTriggerRe.test(m.sql))
        violations.push({ file: m.file, pattern: 'DROP TRIGGER audit_log_resolve_actor_trg' })
      if (dropFunctionRe.test(m.sql))
        violations.push({ file: m.file, pattern: 'DROP FUNCTION audit_log_resolve_actor' })
      if (disableRe.test(m.sql))
        violations.push({ file: m.file, pattern: 'DISABLE TRIGGER audit_log_resolve_actor_trg' })
      if (renameRe.test(m.sql))
        violations.push({ file: m.file, pattern: 'ALTER TRIGGER ... RENAME' })
      if (grantPublicRe.test(m.sql))
        violations.push({
          file: m.file,
          pattern: 'GRANT EXECUTE ON audit_log_resolve_actor TO PUBLIC|anon',
        })
    }
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
})
