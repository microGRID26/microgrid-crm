// lib/partner-api/admin/actors.ts — Admin-only CRUD for partner_actors.
//
// partner_actors rows are the rep-level sub-identities beneath an org-level
// API key. Solicit's API key is shared across their sales org; each rep's
// activity is attributed via the X-MG-Actor header which must resolve to one
// of these rows.
//
// This helper module is called from app/api/admin/partner-actors/*; the admin
// UI hasn't been built yet (Phase 4 polish). For now the CRUD is API-only.

import { partnerApiAdmin } from '../supabase-admin'

export interface CreateActorInput {
  orgId: string
  externalId: string          // the partner's own rep id, e.g. "rep_abc123"
  displayName?: string | null
  email?: string | null
}

export interface ActorRow {
  id: string
  org_id: string
  external_id: string
  display_name: string | null
  email: string | null
  active: boolean
  created_at: string
}

export async function createActor(input: CreateActorInput): Promise<ActorRow> {
  if (!input.externalId.trim()) {
    throw new Error('external_id is required')
  }
  const sb = partnerApiAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('partner_actors')
    .insert({
      org_id: input.orgId,
      external_id: input.externalId.trim(),
      display_name: input.displayName?.trim() || null,
      email: input.email?.trim() || null,
      active: true,
    })
    .select('id, org_id, external_id, display_name, email, active, created_at')
    .single()
  if (error) {
    throw new Error(`Failed to create actor: ${(error as { message?: string }).message ?? 'unknown'}`)
  }
  return data as ActorRow
}

export async function listActors(opts?: { orgId?: string; includeInactive?: boolean }): Promise<ActorRow[]> {
  const sb = partnerApiAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (sb as any)
    .from('partner_actors')
    .select('id, org_id, external_id, display_name, email, active, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (opts?.orgId) q = q.eq('org_id', opts.orgId)
  if (!opts?.includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw new Error(`Failed to list actors: ${(error as { message?: string }).message ?? 'unknown'}`)
  return ((data as ActorRow[] | null) ?? [])
}

export async function deactivateActor(id: string): Promise<{ already_inactive: boolean }> {
  const sb = partnerApiAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = sb as any
  const { data: existing, error: readErr } = await client
    .from('partner_actors')
    .select('id, active')
    .eq('id', id)
    .maybeSingle()
  if (readErr) throw new Error(`Failed to read actor: ${(readErr as { message?: string }).message ?? 'unknown'}`)
  if (!existing) throw new Error(`Actor ${id} not found`)
  if (!(existing as { active: boolean }).active) return { already_inactive: true }

  const { error } = await client
    .from('partner_actors')
    .update({ active: false })
    .eq('id', id)
  if (error) throw new Error(`Failed to deactivate: ${(error as { message?: string }).message ?? 'unknown'}`)
  return { already_inactive: false }
}
