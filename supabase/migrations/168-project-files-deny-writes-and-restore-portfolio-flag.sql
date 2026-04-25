-- 168 — Codify project_files write lockdown + restore signed_edge_contract file check
--
-- BACKGROUND
-- 023-document-management.sql created three permissive policies on project_files:
--   project_files_select  (USING true)
--   project_files_insert  (WITH CHECK true)
--   project_files_update  (USING true / WITH CHECK true)
--
-- 043-org-rls-enforcement.sql tightened SELECT to org-scoped (pfiles_select_v2)
-- but never touched INSERT/UPDATE. Sometime after that the permissive
-- INSERT/UPDATE policies were dropped out-of-band; today's pg_policy state
-- shows only the SELECT policy. With RLS on and no permissive write policy,
-- INSERTs are denied by default — verified at runtime with `SET ROLE
-- authenticated; INSERT INTO project_files...` returning
-- `42501 new row violates row-level security policy for table "project_files"`.
--
-- This migration:
-- 1. Codifies that runtime state in migration history (idempotent DROP IF EXISTS)
-- 2. Adds explicit RESTRICTIVE deny-all policies for INSERT/UPDATE/DELETE on
--    authenticated + anon. Defense-in-depth so a future migration that
--    accidentally creates a permissive `WITH CHECK (true)` write policy still
--    can't punch through (RESTRICTIVE policies AND together with permissive).
-- 3. Restores the file-existence check on v_edge_portfolio.signed_edge_contract.
--    With writes locked down to service_role only (Drive sync), an authenticated
--    user can no longer forge a row in '03 Installation Agreement' to fake
--    contract status.
--
-- The legitimate writer is scripts/upload-drive-files.ts running with
-- SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
--
-- closes greg_actions #291

-- ── 1. Drop any vestige of the old permissive policies (idempotent) ──
DROP POLICY IF EXISTS "project_files_insert" ON public.project_files;
DROP POLICY IF EXISTS "project_files_update" ON public.project_files;
DROP POLICY IF EXISTS "project_files_delete" ON public.project_files;

-- ── 2. Explicit deny-all RESTRICTIVE policies for writes ──
CREATE POLICY pfiles_deny_insert ON public.project_files
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY pfiles_deny_update ON public.project_files
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY pfiles_deny_delete ON public.project_files
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);

-- ── 3. Restore the file-existence check on v_edge_portfolio ──
CREATE OR REPLACE VIEW public.v_edge_portfolio
WITH (security_invoker = true) AS
SELECT
  p.id, p.name, p.address, p.city, p.state, p.zip,
  p.utility, p.ahj, p.financier, p.financing_type,
  p.disposition, p.stage, p.stage_date, p.sale_date,
  p.pm, p.pm_id, p.contract,
  NULLIF(regexp_replace(coalesce(p.systemkw, ''), '[^0-9.]', '', 'g'), '')::numeric AS system_size_kw,
  NULLIF(regexp_replace(coalesce(p.battery_qty, ''), '[^0-9.]', '', 'g'), '')::numeric AS battery_qty_num,
  p.battery_kwh_per_unit,
  CASE
    WHEN p.battery_kwh_per_unit IS NOT NULL
     AND NULLIF(regexp_replace(coalesce(p.battery_qty, ''), '[^0-9.]', '', 'g'), '') IS NOT NULL
    THEN p.battery_kwh_per_unit * NULLIF(regexp_replace(coalesce(p.battery_qty, ''), '[^0-9.]', '', 'g'), '')::numeric
    ELSE NULL
  END AS total_battery_kwh,
  p.energy_community,
  p.domestic_content,
  -- signed_edge_contract: requires financier=EDGE, sale_date present, AND
  -- a real signed agreement file in '03 Installation Agreement'. Now safe to
  -- trust because project_files writes are locked to service_role
  -- (the Drive sync — see policies above).
  --
  -- INVARIANT: this view is security_invoker, so the EXISTS subquery re-applies
  -- pfiles_select_v2. That policy and the projects RLS both gate on
  -- auth_user_org_ids(), so for normal authenticated users they match. If a
  -- future view, RPC, or role exposes projects MORE broadly than project_files,
  -- this flag will silently under-count (return false when files exist).
  -- Either keep pfiles SELECT scope ⊇ projects SELECT scope, or wrap the
  -- EXISTS in a SECURITY DEFINER helper.
  (
    p.financier = 'EDGE'
    AND p.sale_date IS NOT NULL
    AND p.sale_date <> ''
    AND EXISTS (
      SELECT 1 FROM public.project_files pf
      WHERE pf.project_id = p.id
        AND pf.folder_name = '03 Installation Agreement'
    )
  ) AS signed_edge_contract,
  p.org_id,
  p.created_at
FROM public.projects p;
