import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getEvalContext } from './context'
import { serviceClient, userClient } from './helpers/clients'
import {
  EVAL_PASSWORD,
  EVAL_USER_B_EMAIL,
  evalProjectId,
} from './helpers/fixtures'

/**
 * Canary eval — for every project-scoped table our app reads through RLS,
 * confirm a user from org B sees ZERO rows belonging to org A. This is the
 * load-bearing check that catches RLS regressions across the surface
 * area, beyond what scenarios 1+2 cover.
 */

describe('eval: rls_org_isolation (canary)', () => {
  it('user B sees zero rows from org A across project-scoped tables', async () => {
    const { orgAId } = getEvalContext()
    const svc = serviceClient()

    // Seed an org-A project + a child row in each canary table.
    const projectId = evalProjectId()
    const today = new Date().toISOString().slice(0, 10)
    const { error: projErr } = await svc.from('projects').insert({
      id: projectId,
      org_id: orgAId,
      name: `${projectId} home`,
      address: '888 Canary Ln',
      stage: 'evaluation',
      stage_date: today,
      sale_date: today,
      created_at: new Date().toISOString(),
    })
    expect(projErr, `seed project: ${projErr?.message}`).toBeNull()

    // Seed a work order under the project.
    const woNumber = `WO-EVAL-${randomUUID().slice(0, 8)}`
    const { error: woErr } = await svc.from('work_orders').insert({
      project_id: projectId,
      wo_number: woNumber,
      type: 'install',
      status: 'assigned',
      assigned_crew: 'Canary Crew',
    })
    expect(woErr, `seed work_order: ${woErr?.message}`).toBeNull()

    // Now sign in as user B (org B) and probe each table.
    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)

    const probes: { table: string; query: () => Promise<{ count: number }> }[] = [
      {
        table: 'projects',
        query: async () => {
          const { data } = await userB
            .from('projects')
            .select('id', { count: 'exact', head: false })
            .eq('id', projectId)
          return { count: data?.length ?? 0 }
        },
      },
      {
        table: 'work_orders',
        query: async () => {
          const { data } = await userB
            .from('work_orders')
            .select('id')
            .eq('wo_number', woNumber)
          return { count: data?.length ?? 0 }
        },
      },
      {
        table: 'projects (broad scan)',
        query: async () => {
          // Even a broad read should not surface the seeded project.
          const { data } = await userB.from('projects').select('id').eq('org_id', orgAId).limit(1)
          return { count: data?.length ?? 0 }
        },
      },
    ]

    for (const probe of probes) {
      const { count } = await probe.query()
      expect(count, `RLS leak: user B saw ${count} rows from ${probe.table}`).toBe(0)
    }
  })
})
