import { serviceClient } from './helpers/clients'
import { EVAL_ORG_SLUGS } from './helpers/fixtures'

interface CleanupArgs {
  orgAId: string
  orgBId: string
  /** Optional — if present, scrub partner_idempotency_keys rows for this key. */
  partnerApiKeyId?: string
}

const EVAL_ORG_NAMES = ['Evals Org A', 'Evals Org B']

/**
 * Delete eval-created rows from the two eval orgs only.
 *
 * Safety contract (load-bearing — DO NOT relax without R1 sign-off):
 *   1. Each delete is scoped to org_id IN (orgAId, orgBId). Cannot touch real org data.
 *   2. We re-verify both org IDs resolve to the canonical eval slugs AND names before
 *      deleting. If a caller hands us the wrong UUIDs, we throw instead of nuking real data.
 *   3. We never delete from the `organizations`, `users`, or `auth.users` tables here —
 *      those fixtures persist across runs (idempotent setup re-uses them).
 *
 * FK CONTRACT — IMPORTANT FOR PHASE 2 SCENARIOS:
 *   `projects` has 19 FK children. Today this cleanup only deletes from
 *   `wo_checklist_items`, `work_orders`, `projects`. If a future eval scenario
 *   creates rows in any other FK child table (`change_orders`, `ntp_requests`,
 *   `invoices`, `tickets`, `jsa`, `material_requests`, `engineering_assignments`,
 *   `commission_records`, `time_entries`, `entity_profit_transfers`, etc.), the
 *   `projects` delete here will fail with an FK violation. afterAll re-throws
 *   that failure (by design — silent cleanup failures = stranded prod rows).
 *
 *   When you add a scenario that creates a new FK child, ALSO add a delete here
 *   in dependency order, scoped to org_id IN orgIds (or join via project_id).
 */
export async function cleanupEvalRows(args: CleanupArgs): Promise<void> {
  const svc = serviceClient()

  // Defensive: confirm the two UUIDs we were handed actually point at our eval orgs.
  const { data: orgs, error: verifyErr } = await svc
    .from('organizations')
    .select('id, slug, name')
    .in('id', [args.orgAId, args.orgBId])
  if (verifyErr) throw new Error(`cleanup verify failed: ${verifyErr.message}`)
  if (!orgs || orgs.length !== 2) {
    throw new Error(`cleanup verify: expected 2 orgs, got ${orgs?.length ?? 0}`)
  }
  for (const org of orgs) {
    if (!EVAL_ORG_SLUGS.includes(org.slug as (typeof EVAL_ORG_SLUGS)[number])) {
      throw new Error(
        `cleanup refuses to operate: org ${org.id} has slug "${org.slug}" — not an eval org`,
      )
    }
    if (!EVAL_ORG_NAMES.includes(org.name as string)) {
      throw new Error(
        `cleanup refuses to operate: org ${org.id} has name "${org.name}" — not an eval org`,
      )
    }
  }

  const orgIds = [args.orgAId, args.orgBId]

  // Deleting in dependency order. Each is scoped to org_id IN orgIds — nothing else can be touched.

  // Work-order checklist items live by work_order_id; cascade through work_orders.
  const { data: woRows, error: woFetchErr } = await svc
    .from('work_orders')
    .select('id, project_id')
    .in('project_id', await projectIdsForOrgs(orgIds))
  if (woFetchErr) throw new Error(`cleanup fetch work_orders failed: ${woFetchErr.message}`)
  const woIds = (woRows ?? []).map(r => r.id as string)
  if (woIds.length > 0) {
    const { error: chkErr } = await svc.from('wo_checklist_items').delete().in('work_order_id', woIds)
    if (chkErr) throw new Error(`cleanup wo_checklist_items failed: ${chkErr.message}`)
    const { error: woErr } = await svc.from('work_orders').delete().in('id', woIds)
    if (woErr) throw new Error(`cleanup work_orders failed: ${woErr.message}`)
  }

  // Projects
  const { error: projErr } = await svc.from('projects').delete().in('org_id', orgIds)
  if (projErr) throw new Error(`cleanup projects failed: ${projErr.message}`)

  // Partner idempotency rows scoped to our eval partner key only.
  if (args.partnerApiKeyId) {
    const { error: idempErr } = await svc
      .from('partner_idempotency_keys')
      .delete()
      .eq('api_key_id', args.partnerApiKeyId)
    if (idempErr) {
      throw new Error(`cleanup partner_idempotency_keys failed: ${idempErr.message}`)
    }
  }
}

async function projectIdsForOrgs(orgIds: string[]): Promise<string[]> {
  const svc = serviceClient()
  const { data, error } = await svc.from('projects').select('id').in('org_id', orgIds)
  if (error) throw new Error(`projectIdsForOrgs failed: ${error.message}`)
  return (data ?? []).map(r => r.id as string)
}
