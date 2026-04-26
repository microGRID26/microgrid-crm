import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getEvalContext } from './context'
import { serviceClient } from './helpers/clients'

/**
 * Behavioral eval — partner_idempotency_keys composite-PK contract.
 *
 * The Partner API guarantees "retry on a flaky uplink will not create a
 * duplicate lead" (see lib/partner-api/idempotency.ts). That guarantee rests
 * entirely on the (api_key_id, idempotency_key) composite primary key on
 * partner_idempotency_keys: a second insert with the same composite key MUST
 * fail. If a future migration drops or relaxes that constraint, dedupe
 * silently breaks. This eval catches that.
 *
 * Note: this tests the DB contract only, not the full HTTP path. The full
 * HTTP-path partner-signup eval is deferred to v2 because the route writes
 * new projects under MG's canonical EPC tenant (`org_id = MG_ENERGY_ORG_ID`),
 * which is real production data; safely testing it requires Supabase branching.
 */
describe('eval: partner_idempotency', () => {
  it('rejects a second insert with the same (api_key_id, idempotency_key)', async () => {
    const { partnerApiKeyId } = getEvalContext()
    const svc = serviceClient()
    const idempKey = `eval-idemp-${randomUUID()}`

    const first = await svc.from('partner_idempotency_keys').insert({
      api_key_id: partnerApiKeyId,
      idempotency_key: idempKey,
      request_hash: 'h1',
      response_status: 201,
      response_body: { ok: true, id: 'first' },
    })
    expect(first.error, `first insert: ${first.error?.message}`).toBeNull()

    const second = await svc.from('partner_idempotency_keys').insert({
      api_key_id: partnerApiKeyId,
      idempotency_key: idempKey,
      request_hash: 'h2',
      response_status: 201,
      response_body: { ok: true, id: 'second' },
    })
    expect(
      second.error,
      'second insert with same (api_key_id, idempotency_key) MUST fail — composite PK is what makes the API idempotent',
    ).not.toBeNull()
    // PostgreSQL unique violation = SQLSTATE 23505
    expect(second.error?.code).toBe('23505')
  })

  it('allows a different idempotency_key under the same api_key_id', async () => {
    const { partnerApiKeyId } = getEvalContext()
    const svc = serviceClient()
    const keyOne = `eval-idemp-${randomUUID()}`
    const keyTwo = `eval-idemp-${randomUUID()}`

    const a = await svc.from('partner_idempotency_keys').insert({
      api_key_id: partnerApiKeyId,
      idempotency_key: keyOne,
      request_hash: 'a',
      response_status: 201,
      response_body: {},
    })
    expect(a.error).toBeNull()

    const b = await svc.from('partner_idempotency_keys').insert({
      api_key_id: partnerApiKeyId,
      idempotency_key: keyTwo,
      request_hash: 'b',
      response_status: 201,
      response_body: {},
    })
    expect(b.error).toBeNull()
  })

  it('exercises the FK ON DELETE CASCADE end-to-end', async () => {
    // Provision a *throwaway* partner_api_keys row, insert an idempotency
    // child, delete the parent, assert the child is gone. This actually
    // exercises CASCADE rather than just describing it.
    const { partnerOrgId } = getEvalContext()
    const svc = serviceClient()
    const fakeHash = 'eval-cascade-' + 'x'.repeat(51) // 64 chars; not valid sha256 hex
    const idempKey = `eval-idemp-cascade-${randomUUID()}`

    const { data: tmpKey, error: keyErr } = await svc
      .from('partner_api_keys')
      .insert({
        org_id: partnerOrgId,
        name: `cascade-probe-${randomUUID().slice(0, 8)}`,
        key_hash: fakeHash,
        key_prefix: 'eval_cascade',
        scopes: [],
        rate_limit_tier: 'standard',
        customer_pii_scope: false,
      })
      .select('id')
      .single()
    expect(keyErr).toBeNull()
    const tmpKeyId = tmpKey!.id as string

    const { error: idempInsErr } = await svc.from('partner_idempotency_keys').insert({
      api_key_id: tmpKeyId,
      idempotency_key: idempKey,
      request_hash: 'fk',
      response_status: 200,
      response_body: {},
    })
    expect(idempInsErr).toBeNull()

    // Delete the parent.
    const { error: delErr } = await svc.from('partner_api_keys').delete().eq('id', tmpKeyId)
    expect(delErr).toBeNull()

    // Child should be gone via CASCADE.
    const { data: orphan } = await svc
      .from('partner_idempotency_keys')
      .select('idempotency_key')
      .eq('idempotency_key', idempKey)
      .maybeSingle()
    expect(
      orphan,
      'idempotency row survived parent delete — partner_api_keys → partner_idempotency_keys CASCADE has been relaxed',
    ).toBeNull()
  })
})
