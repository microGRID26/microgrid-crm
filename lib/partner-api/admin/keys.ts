// lib/partner-api/admin/keys.ts — Admin-only helpers for managing partner keys.
//
// createKey returns the plaintext bearer EXACTLY ONCE. After this function
// returns, the plaintext is gone — only the SHA-256 hash persists. Same rule
// if/when we add signing-secret support.

import { generateBearerKey } from '../auth'
import { setRevokedRedis } from '../auth'
import { isValidScope, type Scope } from '../scopes'
import { partnerApiAdmin } from '../supabase-admin'

export interface CreateKeyInput {
  orgId: string
  name: string                                   // human label for admin UI
  scopes: readonly string[]                      // will be validated against SCOPES
  rateLimitTier?: 'standard' | 'premium' | 'unlimited'
  customerPiiScope?: boolean
  dpaVersion?: string | null
  expiresAt?: string | null                      // ISO; omit to use DB default (+1 year)
  createdById: string                            // users.id of admin creating the key
}

export interface CreateKeyOutput {
  id: string
  plaintext: string                              // return to admin UI; NEVER persisted
  prefix: string
  expires_at: string
}

export async function createKey(input: CreateKeyInput): Promise<CreateKeyOutput> {
  // Validate scopes up front
  const invalid = input.scopes.filter((s) => !isValidScope(s))
  if (invalid.length > 0) {
    throw new Error(`Invalid scope(s): ${invalid.join(', ')}`)
  }
  if (!input.name.trim()) {
    throw new Error('Key name cannot be empty')
  }

  const bearer = generateBearerKey()
  const sb = partnerApiAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = sb as any
  const insertRow: Record<string, unknown> = {
    org_id: input.orgId,
    name: input.name.trim(),
    key_prefix: bearer.prefix,
    key_hash: bearer.hash,
    scopes: input.scopes as Scope[],
    rate_limit_tier: input.rateLimitTier ?? 'standard',
    customer_pii_scope: input.customerPiiScope ?? false,
    dpa_version: input.dpaVersion ?? null,
    created_by_id: input.createdById,
  }
  if (input.expiresAt) insertRow.expires_at = input.expiresAt

  const { data, error } = await client
    .from('partner_api_keys')
    .insert(insertRow)
    .select('id, expires_at')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create API key: ${(error as { message?: string } | null)?.message ?? 'unknown'}`)
  }
  const row = data as { id: string; expires_at: string }

  return {
    id: row.id,
    plaintext: bearer.plaintext,
    prefix: bearer.prefix,
    expires_at: row.expires_at,
  }
}

export interface RevokeKeyInput {
  keyId: string
  revokedById: string
  reason?: string
}

export interface RevokeResult {
  already_revoked: boolean
}

export async function revokeKey(input: RevokeKeyInput): Promise<RevokeResult> {
  const sb = partnerApiAdmin()
  // R1 fix (Medium): surface already-revoked as a distinct result instead of
  // silently no-oping. Two-step: read current state, then update if needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: readErr } = await (sb as any)
    .from('partner_api_keys')
    .select('id, revoked_at')
    .eq('id', input.keyId)
    .maybeSingle()
  if (readErr) {
    throw new Error(`Failed to read key: ${(readErr as { message?: string }).message ?? 'unknown'}`)
  }
  if (!existing) {
    throw new Error(`Key ${input.keyId} not found`)
  }
  if ((existing as { revoked_at: string | null }).revoked_at) {
    return { already_revoked: true }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('partner_api_keys')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_id: input.revokedById,
      revoke_reason: input.reason && input.reason.trim() ? input.reason.trim() : null,
    })
    .eq('id', input.keyId)
    .is('revoked_at', null)
  if (error) {
    throw new Error(`Failed to revoke key: ${(error as { message?: string }).message ?? 'unknown'}`)
  }
  // Fire-and-forget Redis bit for instant kill
  void setRevokedRedis(input.keyId)
  return { already_revoked: false }
}

export interface KeyRow {
  id: string
  org_id: string
  org_name: string | null
  org_slug: string | null
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit_tier: string
  customer_pii_scope: boolean
  dpa_version: string | null
  created_at: string
  last_used_at: string | null
  expires_at: string
  revoked_at: string | null
  revoke_reason: string | null
}

export async function listKeys(opts?: { includeRevoked?: boolean }): Promise<KeyRow[]> {
  const sb = partnerApiAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (sb as any)
    .from('partner_api_keys')
    .select(`id, org_id, name, key_prefix, scopes, rate_limit_tier, customer_pii_scope,
             dpa_version, created_at, last_used_at, expires_at, revoked_at, revoke_reason,
             organizations:org_id (name, slug)`)
    .order('created_at', { ascending: false })
    .limit(500)
  if (!opts?.includeRevoked) {
    q = q.is('revoked_at', null)
  }
  const { data, error } = await q
  if (error) throw new Error(`Failed to list keys: ${(error as { message?: string }).message ?? 'unknown'}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    org_id: r.org_id,
    org_name: r.organizations?.name ?? null,
    org_slug: r.organizations?.slug ?? null,
    name: r.name,
    key_prefix: r.key_prefix,
    scopes: r.scopes ?? [],
    rate_limit_tier: r.rate_limit_tier,
    customer_pii_scope: r.customer_pii_scope,
    dpa_version: r.dpa_version,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    revoked_at: r.revoked_at,
    revoke_reason: r.revoke_reason,
  }))
}
