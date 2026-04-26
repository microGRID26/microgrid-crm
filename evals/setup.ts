import path from 'node:path'
import fs from 'node:fs'
import { beforeAll, afterAll } from 'vitest'

const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

import { serviceClient } from './helpers/clients'
import {
  EVAL_ORG_A_NAME,
  EVAL_ORG_A_SLUG,
  EVAL_ORG_B_NAME,
  EVAL_ORG_B_SLUG,
  EVAL_PARTNER_KEY_NAME,
  EVAL_PARTNER_ORG_NAME,
  EVAL_PARTNER_ORG_SLUG,
  EVAL_PASSWORD,
  EVAL_USER_A_EMAIL,
  EVAL_USER_A_NAME,
  EVAL_USER_B_EMAIL,
  EVAL_USER_B_NAME,
} from './helpers/fixtures'
import { setEvalContext } from './context'
import { cleanupEvalRows } from './cleanup'

async function ensureOrg(
  slug: string,
  name: string,
  orgType: 'epc' | 'engineering' = 'epc',
): Promise<string> {
  const svc = serviceClient()
  const { data: existing, error: selErr } = await svc
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (selErr) throw new Error(`ensureOrg select(${slug}) failed: ${selErr.message}`)
  if (existing?.id) return existing.id

  const { data: inserted, error: insErr } = await svc
    .from('organizations')
    .insert({ slug, name, org_type: orgType })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`ensureOrg insert(${slug}) failed: ${insErr?.message}`)
  return inserted.id
}

/**
 * Idempotently provision a partner_api_keys row for the partner eval org.
 * The plaintext key is never used (the eval doesn't make HTTP requests);
 * we only need a row whose id we can reference from partner_idempotency_keys.
 */
async function ensurePartnerApiKey(orgId: string, name: string): Promise<string> {
  const svc = serviceClient()
  const { data: existing, error: selErr } = await svc
    .from('partner_api_keys')
    .select('id')
    .eq('org_id', orgId)
    .eq('name', name)
    .maybeSingle()
  if (selErr) throw new Error(`ensurePartnerApiKey select failed: ${selErr.message}`)
  if (existing?.id) return existing.id

  // No HTTP request will be sent against this key; the hash + prefix are
  // populated only to satisfy NOT NULL constraints. The plaintext is never
  // returned — there's no way to authenticate as this key over HTTP.
  const fakeHash = 'eval-' + 'x'.repeat(59) // 64 chars to mimic sha256 length
  const { data: inserted, error: insErr } = await svc
    .from('partner_api_keys')
    .insert({
      org_id: orgId,
      name,
      key_hash: fakeHash,
      key_prefix: 'eval_no_http',
      scopes: [],
      rate_limit_tier: 'standard',
      customer_pii_scope: false,
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    throw new Error(`ensurePartnerApiKey insert failed: ${insErr?.message}`)
  }
  return inserted.id
}

async function ensureAuthUser(email: string, password: string): Promise<string> {
  const svc = serviceClient()
  // listUsers is paginated; for a 2-user fixture we scan first page only.
  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw new Error(`ensureAuthUser listUsers failed: ${listErr.message}`)
  const found = list.users.find(u => u.email === email)
  if (found) {
    // Reset the password every run so changes to EVAL_PASSWORD propagate.
    const { error: updErr } = await svc.auth.admin.updateUserById(found.id, { password })
    if (updErr) throw new Error(`ensureAuthUser update password failed: ${updErr.message}`)
    return found.id
  }
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    throw new Error(`ensureAuthUser createUser(${email}) failed: ${createErr?.message}`)
  }
  return created.user.id
}

async function ensurePublicUser(id: string, email: string, name: string): Promise<void> {
  const svc = serviceClient()
  const { data: existing, error: selErr } = await svc
    .from('users')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (selErr) throw new Error(`ensurePublicUser select(${email}) failed: ${selErr.message}`)
  if (existing?.id) return
  // role: 'user' is required for `auth_is_internal_writer()` RLS (work_orders
  // INSERT, etc.). The downside: the `organizations_grant_staff_on_new_epc`
  // trigger will auto-add this user to every new EPC org Greg creates.
  // Defenses (in order): purgeEvalUserForeignMemberships scrubs them on every
  // run; assertEvalUserMembershipsScoped refuses to run if any leak.
  const { error: insErr } = await svc
    .from('users')
    .insert({ id, email, name, active: true, is_active: true, role: 'user' })
  if (insErr) throw new Error(`ensurePublicUser insert(${email}) failed: ${insErr.message}`)
}

async function ensureMembership(userId: string, orgId: string): Promise<void> {
  const svc = serviceClient()
  const { data: existing, error: selErr } = await svc
    .from('org_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (selErr) throw new Error(`ensureMembership select failed: ${selErr.message}`)
  if (existing?.id) return
  const { error: insErr } = await svc.from('org_memberships').insert({
    user_id: userId,
    org_id: orgId,
    org_role: 'member',
    is_default: true,
  })
  if (insErr) throw new Error(`ensureMembership insert failed: ${insErr.message}`)
}

/**
 * MicroGRID has a trigger on organizations INSERT that auto-adds existing
 * users to every new org. That leaks eval data to real prod users via RLS.
 * Purge any membership in our eval orgs that doesn't belong to our 2 eval
 * users. Slug-guarded — never runs against a non-eval org.
 */
async function purgeForeignMemberships(orgIds: string[], evalUserIds: string[]): Promise<void> {
  const svc = serviceClient()
  // Re-verify slugs — defensive, in case ensureOrg returned a wrong UUID.
  const { data: orgs, error: verifyErr } = await svc
    .from('organizations')
    .select('id, slug')
    .in('id', orgIds)
  if (verifyErr) throw new Error(`purgeForeignMemberships verify failed: ${verifyErr.message}`)
  const evalSlugs = new Set(['evals-org-a', 'evals-org-b'])
  for (const org of orgs ?? []) {
    if (!evalSlugs.has(org.slug as string)) {
      throw new Error(
        `purgeForeignMemberships refuses to operate: org ${org.id} slug "${org.slug}" not in eval slug set`,
      )
    }
  }
  // PostgREST `.in()` filter with double-quoted UUIDs is not parsed as UUID list — it
  // can match nothing or behave unpredictably. Use unquoted comma list inside parens.
  const { error: delErr } = await svc
    .from('org_memberships')
    .delete()
    .in('org_id', orgIds)
    .not('user_id', 'in', `(${evalUserIds.join(',')})`)
  if (delErr) throw new Error(`purgeForeignMemberships delete failed: ${delErr.message}`)
}

/**
 * Drop any membership rows where one of our eval users is attached to an org
 * OUTSIDE the eval orgs. The `organizations_grant_staff_on_new_epc` trigger
 * will silently bulk-add eval users (role='user') to every new EPC org Greg
 * creates. Run this every setup to auto-heal the leak. Slug-guarded.
 */
async function purgeEvalUserForeignMemberships(args: {
  userAId: string
  userBId: string
  orgAId: string
  orgBId: string
}): Promise<void> {
  const svc = serviceClient()
  // Defensive: confirm both eval orgs still resolve to canonical slugs.
  const { data: orgs, error: verifyErr } = await svc
    .from('organizations')
    .select('id, slug')
    .in('id', [args.orgAId, args.orgBId])
  if (verifyErr) throw new Error(`purgeEvalUserForeignMemberships verify failed: ${verifyErr.message}`)
  const seenSlugs = new Set((orgs ?? []).map(o => o.slug as string))
  if (!seenSlugs.has('evals-org-a') || !seenSlugs.has('evals-org-b')) {
    throw new Error(
      `purgeEvalUserForeignMemberships refuses to operate: eval org slug mismatch (${[...seenSlugs].join(',')})`,
    )
  }
  const { error: delErr } = await svc
    .from('org_memberships')
    .delete()
    .in('user_id', [args.userAId, args.userBId])
    .not('org_id', 'in', `(${[args.orgAId, args.orgBId].join(',')})`)
  if (delErr) {
    throw new Error(`purgeEvalUserForeignMemberships delete failed: ${delErr.message}`)
  }
}

/**
 * Runtime guard: assert that each eval user has memberships ONLY in their
 * assigned eval org. If a future MicroGRID trigger silently adds eval-user-a
 * to a real prod org, we want the eval suite to fail-loud BEFORE running tests
 * that could expose prod data through eval-user-a's JWT.
 */
async function assertEvalUserMembershipsScoped(args: {
  userAId: string
  userBId: string
  orgAId: string
  orgBId: string
}): Promise<void> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('org_memberships')
    .select('user_id, org_id')
    .in('user_id', [args.userAId, args.userBId])
  if (error) throw new Error(`assertEvalUserMembershipsScoped failed: ${error.message}`)
  const aOrgs = (data ?? []).filter(r => r.user_id === args.userAId).map(r => r.org_id as string)
  const bOrgs = (data ?? []).filter(r => r.user_id === args.userBId).map(r => r.org_id as string)
  if (aOrgs.length !== 1 || aOrgs[0] !== args.orgAId) {
    throw new Error(
      `eval-user-a membership leak: expected exactly [${args.orgAId}], got [${aOrgs.join(',')}]. Refusing to run.`,
    )
  }
  if (bOrgs.length !== 1 || bOrgs[0] !== args.orgBId) {
    throw new Error(
      `eval-user-b membership leak: expected exactly [${args.orgBId}], got [${bOrgs.join(',')}]. Refusing to run.`,
    )
  }
}

/**
 * Strip JWT-shaped strings (anything starting with eyJ followed by base64ish chars)
 * from any error message before re-throwing. Defense against the Supabase SDK
 * including auth headers in error stacks. Loose match — if it looks like a JWT,
 * scrub it. Run on every thrown error from setup/cleanup paths.
 */
function scrubSecrets(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  const scrubbed = msg.replace(/eyJ[A-Za-z0-9_-]{20,}/g, 'eyJ<redacted>')
  if (err instanceof Error) {
    err.message = scrubbed
    if (err.stack) err.stack = err.stack.replace(/eyJ[A-Za-z0-9_-]{20,}/g, 'eyJ<redacted>')
    return err
  }
  return new Error(scrubbed)
}

beforeAll(async () => {
  try {
    const orgAId = await ensureOrg(EVAL_ORG_A_SLUG, EVAL_ORG_A_NAME)
    const orgBId = await ensureOrg(EVAL_ORG_B_SLUG, EVAL_ORG_B_NAME)
    // org_type='engineering' (NOT 'epc') so the bulk-add-staff trigger doesn't fire.
    const partnerOrgId = await ensureOrg(
      EVAL_PARTNER_ORG_SLUG,
      EVAL_PARTNER_ORG_NAME,
      'engineering',
    )
    const partnerApiKeyId = await ensurePartnerApiKey(partnerOrgId, EVAL_PARTNER_KEY_NAME)

    const userAId = await ensureAuthUser(EVAL_USER_A_EMAIL, EVAL_PASSWORD)
    const userBId = await ensureAuthUser(EVAL_USER_B_EMAIL, EVAL_PASSWORD)

    await ensurePublicUser(userAId, EVAL_USER_A_EMAIL, EVAL_USER_A_NAME)
    await ensurePublicUser(userBId, EVAL_USER_B_EMAIL, EVAL_USER_B_NAME)

    await purgeForeignMemberships([orgAId, orgBId], [userAId, userBId])

    await ensureMembership(userAId, orgAId)
    await ensureMembership(userBId, orgBId)

    // Auto-heal the trigger leak: drop any eval-user memberships in non-eval orgs.
    await purgeEvalUserForeignMemberships({ userAId, userBId, orgAId, orgBId })

    // Defense in depth: refuse to run tests if eval-user memberships have
    // leaked beyond the eval orgs. Catches the case where a future trigger
    // bulk-adds eval users to real prod orgs.
    await assertEvalUserMembershipsScoped({ userAId, userBId, orgAId, orgBId })

    setEvalContext({ orgAId, orgBId, userAId, userBId, partnerOrgId, partnerApiKeyId })

    // Clean up anything leftover from a previous failed run before tests start.
    await cleanupEvalRows({ orgAId, orgBId, partnerApiKeyId })
  } catch (err) {
    throw scrubSecrets(err)
  }
}, 60_000)

afterAll(async () => {
  // Cleanup MUST throw on failure. Silent cleanup failures = eval rows
  // strand in prod indefinitely; better to fail the suite loud and force
  // the operator to clean up by hand than to leave junk behind.
  try {
    const ctx = (await import('./context')).getEvalContext()
    await cleanupEvalRows({
      orgAId: ctx.orgAId,
      orgBId: ctx.orgBId,
      partnerApiKeyId: ctx.partnerApiKeyId,
    })
  } catch (err) {
    throw scrubSecrets(err)
  }
}, 60_000)
