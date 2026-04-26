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
 * Behavioral eval — assign_crew (work order creation).
 *
 * Mirrors lib/api/work-orders.ts:222 createWorkOrder() — the same insert
 * shape the app uses when a user creates a work order from ProjectPanel.
 * Asserts: WO row exists, fields persisted, RLS blocks cross-org WO writes.
 */
function evalWoNumber(): string {
  return `WO-EVAL-${randomUUID().slice(0, 8)}`
}

async function seedProjectInOrgA(): Promise<string> {
  const { orgAId } = getEvalContext()
  const svc = serviceClient()
  const id = evalProjectId()
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await svc.from('projects').insert({
    id,
    org_id: orgAId,
    name: `${id} home`,
    address: '101 Crew St',
    stage: 'evaluation',
    stage_date: today,
    sale_date: today,
    created_at: new Date().toISOString(),
  })
  if (error) throw new Error(`seedProjectInOrgA failed: ${error.message}`)
  return id
}

describe('eval: assign_crew', () => {
  it('user A can create a work order against an org A project; fields persist', async () => {
    const projectId = await seedProjectInOrgA()
    const userA = await userClient(EVAL_USER_A_EMAIL, EVAL_PASSWORD)
    const wo = {
      project_id: projectId,
      wo_number: evalWoNumber(),
      type: 'install',
      status: 'assigned',
      assigned_crew: 'Eval Crew Alpha',
      priority: 'normal',
      description: 'eval install WO',
    }

    const { data: inserted, error: insertErr } = await userA
      .from('work_orders')
      .insert(wo)
      .select('id, project_id, wo_number, type, status, assigned_crew, priority')
      .single()
    expect(insertErr, `insert error: ${insertErr?.message}`).toBeNull()
    expect(inserted).not.toBeNull()
    expect(inserted?.project_id).toBe(projectId)
    expect(inserted?.wo_number).toBe(wo.wo_number)
    expect(inserted?.type).toBe('install')
    expect(inserted?.status).toBe('assigned')
    expect(inserted?.assigned_crew).toBe('Eval Crew Alpha')
    expect(inserted?.priority).toBe('normal')

    // Read back through RLS — user A should see their own WO.
    const { data: read, error: readErr } = await userA
      .from('work_orders')
      .select('id, assigned_crew')
      .eq('id', inserted!.id)
      .maybeSingle()
    expect(readErr).toBeNull()
    expect(read?.assigned_crew).toBe('Eval Crew Alpha')
  })

  it('user B cannot create a work order against an org A project (RLS write isolation)', async () => {
    const projectId = await seedProjectInOrgA()
    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)
    const wo = {
      project_id: projectId,
      wo_number: evalWoNumber(),
      type: 'install',
      status: 'draft',
    }

    const { data: inserted, error: insertErr } = await userB
      .from('work_orders')
      .insert(wo)
      .select('id')
      .maybeSingle()

    if (!insertErr) {
      // No error returned — RLS may have made the row invisible. Re-check via service role.
      const svc = serviceClient()
      const woId = inserted?.id
      if (woId) {
        const { data: leaked } = await svc.from('work_orders').select('id').eq('id', woId).maybeSingle()
        expect(leaked, 'RLS allowed cross-org WO write — leaked into org A').toBeNull()
      }
    } else {
      expect(insertErr.message).toBeTruthy()
    }
  })

  it('user B cannot read user A\'s work orders (RLS read isolation)', async () => {
    const projectId = await seedProjectInOrgA()
    const svc = serviceClient()
    const woNumber = evalWoNumber()
    const { error: seedErr } = await svc.from('work_orders').insert({
      project_id: projectId,
      wo_number: woNumber,
      type: 'install',
      status: 'assigned',
      assigned_crew: 'Hidden Crew',
    })
    expect(seedErr).toBeNull()

    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)
    const { data: leaked } = await userB
      .from('work_orders')
      .select('id')
      .eq('wo_number', woNumber)
      .maybeSingle()
    expect(leaked).toBeNull()
  })
})
