-- 134-org-memberships-scope-select.sql
-- ============================================================================
-- Tighten public.org_memberships SELECT policy from "any internal writer"
-- to "member of the row's org (or platform / super_admin)".
--
-- Context (greg_actions #154, filed 2026-04-21 during R1 on migration 133):
--
-- Prior state (as of 2026-04-21, per live pg_policies query against
-- hzymsezqfxzpbcqryeim):
--   orgm_select  SELECT  USING (auth_is_internal_writer())
--   orgm_insert  INSERT  WITH CHECK (auth_is_admin())
--   orgm_update  UPDATE  USING / CHECK (auth_is_admin())
--   orgm_delete  DELETE  USING (auth_is_admin())
--
-- 039-organizations.sql in-tree still shows the original USING(true); that
-- statement was superseded by migration 117's sweep. R1 on this migration
-- caught an earlier header that misstated the prior state as USING(true) —
-- corrected below.
--
-- What changes: orgm_select scopes to "org you belong to" instead of
-- "anyone with an internal-writer role." Today's 12 active users all pass
-- auth_is_internal_writer(), so they currently see the full 20-row
-- user-to-org directory regardless of their org. That's an enumeration
-- vector for phishing / admin-identification even though no single exploit
-- depends on it. After 134, internal writers see only memberships of orgs
-- they themselves belong to. Platform (EDGE) and super_admin unchanged.
--
-- Behavior deltas to watch for:
--   (a) Internal-writer users with ZERO memberships lose SELECT access.
--       Today none exist (12/12 have at least one membership). Latent
--       risk: a future new hire whose domain doesn't match any
--       allowed_domains could be left without memberships and see zero
--       rows — but they'd have the same problem under every other
--       org-scoped table, so this is not unique to org_memberships.
--   (b) Non-internal-writer users (role NULL / 'customer' / 'viewer') who
--       happen to have a membership row today see nothing under prior
--       policy (auth_is_internal_writer = false) and would see their own
--       org's roster under the new policy. Today: zero such users in prod
--       (verified). Latent only.
--
-- Call sites audited 2026-04-21 against prod shape:
--   - app/api/invoices/[id]/send/route.ts:83-87 — reads own memberships
--     via .eq('user_id', public.users.id). Keyed correctly. Works under
--     both prior and new policy.
--   - components/admin/OrgManager.tsx — rendered only inside /system,
--     which is super_admin-gated. Super_admin bypass in the new policy
--     covers it. INSERT / UPDATE / DELETE unchanged.
--   - lib/hooks/useOrg.tsx:68 — reads memberships via
--     .eq('user_id', auth.uid()). This key is wrong (org_memberships
--     stores public.users.id, which differs from auth.uid() for users
--     provisioned post-migration-132) and has been returning zero rows
--     for real users — the hardcoded DEFAULT_ORG_ID fallback masks the
--     bug. Migration 134 does NOT fix this. Filed as a separate P1
--     follow-up action for the useOrg resolver.
--
-- INSERT / UPDATE / DELETE policies unchanged — all admin-only, handled
-- by migration 117.
-- ============================================================================

DROP POLICY IF EXISTS orgm_select ON public.org_memberships;

CREATE POLICY orgm_select ON public.org_memberships
  FOR SELECT TO authenticated
  USING (
    org_id = ANY(public.auth_user_org_ids())
    OR public.auth_is_platform_user()
    OR public.auth_is_super_admin()
  );

COMMENT ON POLICY orgm_select ON public.org_memberships IS
  'Session callers see memberships of orgs they belong to (via auth_user_org_ids, which resolves via email per migration 132). Platform and super_admin see all. Tightens the prior auth_is_internal_writer() policy that let any internal-role user harvest the full user-to-org directory. Sibling tables that gate on membership should use auth_user_org_ids() rather than raw om.user_id = auth.uid() subqueries (several of which are dead-branched due to the two-UUID-space bug — see greg_actions #144). See greg_actions #154.';
