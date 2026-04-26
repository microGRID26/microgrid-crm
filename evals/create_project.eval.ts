import { describe, it, expect } from 'vitest'
import { getEvalContext } from './context'
import { serviceClient, userClient } from './helpers/clients'
import {
  EVAL_PASSWORD,
  EVAL_USER_A_EMAIL,
  EVAL_USER_B_EMAIL,
  evalProjectId,
} from './helpers/fixtures'

/**
 * Behavioral eval — create_project.
 *
 * Mirrors components/project/NewProjectModal.tsx:182-220 — the same insert
 * shape the browser sends. Authenticates as a real user via signInWithPassword
 * so RLS evaluates with a real JWT.
 */
describe('eval: create_project', () => {
  it('user A can insert a project into org A and read it back through RLS', async () => {
    const { orgAId } = getEvalContext()
    const userA = await userClient(EVAL_USER_A_EMAIL, EVAL_PASSWORD)
    const id = evalProjectId()
    const today = new Date().toISOString().slice(0, 10)

    const project = {
      id,
      org_id: orgAId,
      name: `${id} home`,
      address: '123 Eval St',
      city: 'Houston',
      state: 'TX',
      zip: '77002',
      phone: '5125550100',
      email: 'evalcustomer@example.com',
      sale_date: today,
      stage: 'evaluation',
      stage_date: today,
      disposition: 'Sale',
      dealer: 'Eval Dealer',
      financier: 'Eval Financier',
      created_at: new Date().toISOString(),
    }

    const { error: insertErr } = await userA.from('projects').insert(project)
    expect(insertErr, `insert error: ${insertErr?.message}`).toBeNull()

    const { data: read, error: readErr } = await userA
      .from('projects')
      .select('id, org_id, stage, name, dealer, financier')
      .eq('id', id)
      .maybeSingle()
    expect(readErr).toBeNull()
    expect(read).not.toBeNull()
    expect(read?.id).toBe(id)
    expect(read?.org_id).toBe(orgAId)
    expect(read?.stage).toBe('evaluation')
    expect(read?.dealer).toBe('Eval Dealer')
    expect(read?.financier).toBe('Eval Financier')
  })

  it('user B cannot see user A\'s project (RLS org isolation)', async () => {
    const { orgAId } = getEvalContext()
    const svc = serviceClient()
    const id = evalProjectId()
    const today = new Date().toISOString().slice(0, 10)

    // Seed a project in org A via service role (bypasses RLS), then try to read as user B.
    const { error: seedErr } = await svc.from('projects').insert({
      id,
      org_id: orgAId,
      name: `${id} home`,
      address: '456 Eval St',
      stage: 'evaluation',
      stage_date: today,
      sale_date: today,
      created_at: new Date().toISOString(),
    })
    expect(seedErr, `seed error: ${seedErr?.message}`).toBeNull()

    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)
    const { data: leaked, error: readErr } = await userB
      .from('projects')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    expect(readErr).toBeNull()
    expect(leaked).toBeNull()
  })

  it('user B cannot insert a project into org A (RLS write isolation)', async () => {
    const { orgAId } = getEvalContext()
    const userB = await userClient(EVAL_USER_B_EMAIL, EVAL_PASSWORD)
    const id = evalProjectId()
    const today = new Date().toISOString().slice(0, 10)

    const { error: insertErr } = await userB.from('projects').insert({
      id,
      org_id: orgAId, // user B does NOT belong to org A
      name: `${id} home`,
      address: '789 Eval St',
      stage: 'evaluation',
      stage_date: today,
      sale_date: today,
      created_at: new Date().toISOString(),
    })
    // Expect RLS to either reject the insert OR the row to be invisible to user B on read-back.
    if (!insertErr) {
      // Insert returned no error — verify RLS made it invisible / non-existent.
      const svc = serviceClient()
      const { data: row } = await svc.from('projects').select('id').eq('id', id).maybeSingle()
      expect(row, 'RLS allowed cross-org write — project leaked into org A').toBeNull()
    } else {
      expect(insertErr.message).toBeTruthy()
    }
  })
})
