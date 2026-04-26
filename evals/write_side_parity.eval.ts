import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getEvalContext } from './context'
import { serviceClient, userClient } from './helpers/clients'
import {
  EVAL_PASSWORD,
  EVAL_USER_A_EMAIL,
  EVAL_USER_B_EMAIL,
  evalProjectId,
} from './helpers/fixtures'

/**
 * Write-side parity eval — brings MG up to match EDGE+SPARK coverage.
 *
 * Existing assign_crew.eval.ts proves WO INSERT works under RLS. This file
 * extends to multi-column UPDATE on both projects and work_orders, plus
 * DELETE coverage on projects and a no-DELETE canary for work_orders.
 *
 * Each scenario seeds via service role under org A, then attempts the
 * mutation as either user A (positive) or user B (negative). Negative cases
 * verify canonical state via service role since RLS may silently no-op an
 * UPDATE that matched no rows.
 */

function evalWoNumber(): string {
  return `WO-EVAL-${randomUUID().slice(0, 8)}`
}

async function seedProjectInOrgA(opts: { pmUserId?: string } = {}): Promise<string> {
  const { orgAId } = getEvalContext()
  const svc = serviceClient()
  const id = evalProjectId()
  const today = new Date().toISOString().slice(0, 10)
  const row: Record<string, unknown> = {
    id,
    org_id: orgAId,
    name: `${id} home`,
    address: '202 Parity Ln',
    stage: 'evaluation',
    stage_date: today,
    sale_date: today,
    created_at: new Date().toISOString(),
  }
  if (opts.pmUserId) row.pm_id = opts.pmUserId
  const { error } = await svc.from('projects').insert(row)
  if (error) throw new Error(`seedProjectInOrgA failed: ${error.message}`)
  return id
}

async function seedWorkOrderInOrgA(projectId: string): Promise<{ id: string; woNumber: string }> {
  const svc = serviceClient()
  const woNumber = evalWoNumber()
  const { data, error } = await svc
    .from('work_orders')
    .insert({
      project_id: projectId,
      wo_number: woNumber,
      type: 'install',
      status: 'assigned',
      assigned_crew: 'Original Crew',
      priority: 'normal',
      description: 'original description',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedWorkOrderInOrgA failed: ${error?.message}`)
  return { id: data.id as string, woNumber }
}

describe('eval: write_side_parity', () => {
  it('user A can multi-column UPDATE own work_order (status+priority+crew+description)', async () => {
    const projectId = await seedProjectInOrgA()
    const { id: woId } = await seedWorkOrderInOrgA(projectId)
    const userA = await userClient(EVAL_USER_A_EMAIL, EVAL_PASSWORD)

    const newCrew = `Eval Crew ${randomUUID().slice(0, 6)}`
    const { error: updErr } = await userA
      .from('work_orders')
      .update({
        status: 'completed',
        priority: 'urgent',
        assigned_crew: newCrew,
        description: 'updated description',
      })
      .eq('id', woId)
    expect(updErr, `update error: ${updErr?.message}`).toBeNull()

    const svc = serviceClient()
    const { data: row } = await svc
      .from('work_orders')
      .select('status, priority, assigned_crew, description')
      .eq('id', woId)
      .maybeSingle()
    expect(row?.status).toBe('completed')
    expect(row?.priority).toBe('urgent')
    expect(row?.assigned_crew).toBe(newCrew)
    expect(row?.description).toBe('updated description')
  })

  it('user B CANNOT UPDATE user A\'s work_order (RLS write isolation)', async () => {
    // R1 finding (HIGH): negative tests must assert RLS rejected the write,
    // not just that post-state happens to match seed. Supabase JS returns
    // an empty data array when RLS denies an UPDATE with .select() chained.
    // Belt-and-suspenders: verify both the rejection AND post-state.
    const projectId = await seedProjectInOrgA()
    const { id: woId } = await seedWorkOrderInOrgA(projectId)
    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)

    const { data: affected } = await userB
      .from('work_orders')
      .update({ status: 'cancelled', description: 'rep-b-injection' })
      .eq('id', woId)
      .select('id')
    expect(
      affected ?? [],
      'RLS leak: user B UPDATE on user A work_order returned affected rows',
    ).toHaveLength(0)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('work_orders')
      .select('status, description')
      .eq('id', woId)
      .maybeSingle()
    expect(row?.status).toBe('assigned')
    expect(row?.description).toBe('original description')
  })

  it('user A as PM can multi-column UPDATE own project (stage+stage_date+name)', async () => {
    // projects_update_v2 requires (org_match) AND (pm_id = auth_user_id() OR manager).
    // Seed with pm_id = userA so the eval user qualifies as PM.
    const { userAId } = getEvalContext()
    const projectId = await seedProjectInOrgA({ pmUserId: userAId })
    const userA = await userClient(EVAL_USER_A_EMAIL, EVAL_PASSWORD)

    const newName = `EVAL renamed ${randomUUID().slice(0, 6)}`
    const newStageDate = '2030-01-15'
    const { error: updErr } = await userA
      .from('projects')
      .update({ stage: 'design', stage_date: newStageDate, name: newName })
      .eq('id', projectId)
    expect(updErr, `update error: ${updErr?.message}`).toBeNull()

    const svc = serviceClient()
    const { data: row } = await svc
      .from('projects')
      .select('stage, stage_date, name')
      .eq('id', projectId)
      .maybeSingle()
    expect(row?.stage).toBe('design')
    expect(row?.stage_date).toBe(newStageDate)
    expect(row?.name).toBe(newName)
  })

  it('user B CANNOT UPDATE user A\'s project (RLS write isolation)', async () => {
    const { userAId } = getEvalContext()
    const projectId = await seedProjectInOrgA({ pmUserId: userAId })
    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)

    const { data: affected } = await userB
      .from('projects')
      .update({ stage: 'cancelled', name: 'rep-b-renamed' })
      .eq('id', projectId)
      .select('id')
    expect(
      affected ?? [],
      'RLS leak: user B UPDATE on user A project returned affected rows',
    ).toHaveLength(0)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('projects')
      .select('stage, name')
      .eq('id', projectId)
      .maybeSingle()
    expect(row?.stage).toBe('evaluation')
    expect(row?.name).not.toMatch(/^rep-b-renamed/)
  })

  it('projects_delete_v2 is super_admin-only — user A (PM) blocked', async () => {
    // R1 finding (HIGH): the prior version probed user A and user B against
    // the same row, so user B's probe was meaningless once user A succeeded.
    // Split into two scenarios — each user gets its own row so both policy
    // paths are independently exercised. Also asserts on the rejection
    // signal (`.delete().select()` returns empty array on RLS deny) rather
    // than relying solely on post-state read.
    const { userAId } = getEvalContext()
    const projectId = await seedProjectInOrgA({ pmUserId: userAId })

    const userA = await userClient(EVAL_USER_A_EMAIL, EVAL_PASSWORD)
    const { data: affected } = await userA
      .from('projects')
      .delete()
      .eq('id', projectId)
      .select('id')
    expect(
      affected ?? [],
      'RLS leak: user A (PM, not super_admin) deleted own project. ' +
      'projects_delete_v2 may have been broadened beyond auth_is_super_admin().',
    ).toHaveLength(0)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()
    expect(row?.id).toBe(projectId)
  })

  it('projects_delete_v2 is super_admin-only — user B (cross-org) blocked', async () => {
    const { userAId } = getEvalContext()
    const projectId = await seedProjectInOrgA({ pmUserId: userAId })

    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)
    const { data: affected } = await userB
      .from('projects')
      .delete()
      .eq('id', projectId)
      .select('id')
    expect(
      affected ?? [],
      'RLS leak: user B deleted user A project across org boundary',
    ).toHaveLength(0)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()
    expect(row?.id).toBe(projectId)
  })

  it('work_orders has NO DELETE policy — user A blocked (canary)', async () => {
    // Today there is no DELETE policy on public.work_orders, so RLS denies
    // every authenticated DELETE. If a future migration adds a broad DELETE
    // policy (e.g., qual:true while debugging), this canary fails loud.
    // Split per user so each policy path is independently exercised.
    const projectId = await seedProjectInOrgA()
    const { id: woId } = await seedWorkOrderInOrgA(projectId)

    const userA = await userClient(EVAL_USER_A_EMAIL, EVAL_PASSWORD)
    const { data: affected } = await userA
      .from('work_orders')
      .delete()
      .eq('id', woId)
      .select('id')
    expect(
      affected ?? [],
      'RLS leak: user A deleted own work_order. A new wo_delete policy may have shipped.',
    ).toHaveLength(0)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('work_orders')
      .select('id')
      .eq('id', woId)
      .maybeSingle()
    expect(row?.id).toBe(woId)
  })

  it('work_orders has NO DELETE policy — user B (cross-org) blocked (canary)', async () => {
    const projectId = await seedProjectInOrgA()
    const { id: woId } = await seedWorkOrderInOrgA(projectId)

    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)
    const { data: affected } = await userB
      .from('work_orders')
      .delete()
      .eq('id', woId)
      .select('id')
    expect(
      affected ?? [],
      'RLS leak: user B deleted user A work_order across org boundary',
    ).toHaveLength(0)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('work_orders')
      .select('id')
      .eq('id', woId)
      .maybeSingle()
    expect(row?.id).toBe(woId)
  })
})
