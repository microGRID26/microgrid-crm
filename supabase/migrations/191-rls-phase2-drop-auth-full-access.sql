-- ============================================================================
-- 191-rls-phase2-drop-auth-full-access.sql
-- Phase 2 of 7 — Multi-tenant RLS hardening
-- Plan:    docs/plans/2026-04-28-multi-tenant-rls-hardening-plan.md
-- Closes:  greg_action #351 (auth_full_access bypass on 11 tables)
-- Rollup:  greg_action #364
-- Prereq:  Phase 1 (mig 189) applied. All NULL org_id rows backfilled (verified
--          2026-04-29: 0 NULL rows on the 9 tables Phase 1 touched).
--
-- WHAT
-- ----
-- 11 tables today carry a permissive policy named `auth_full_access`
-- (qual = wc = (auth.role() = 'authenticated')). RLS OR's permissive policies,
-- so the carefully-scoped v2 policies on these tables are silently bypassed —
-- every authenticated user reads AND writes every row across every org.
-- This phase drops the bypass.
--
-- 7 of the 11 tables already have v2 SELECT + write policies (notes,
-- task_state, project_folders, schedule, service_calls, stage_history, crews).
-- The other 4 are NAKED — `auth_full_access` is their ONLY policy. Dropping
-- it without coverage would lock everyone out. This migration adds full
-- v2 SELECT/INSERT/UPDATE/DELETE on those 4 BEFORE the drops, using the new
-- `auth_can_see_project()` helper (also created here).
--
-- LOCK PROFILE
-- ------------
-- Each `CREATE POLICY` and `DROP POLICY` takes a brief `ACCESS EXCLUSIVE` lock
-- on the policy catalog row, NOT a full table rewrite. Sub-millisecond per op.
-- Table sizes for awareness only:
--   notes              182,386 rows / 46 MB
--   task_state          30,384 rows / 5 MB
--   project_folders     27,571 rows / 4.5 MB
--   stage_history        1,130 rows / 272 kB
--   service_calls          912 rows / 376 kB
--   schedule                23 rows / 128 kB
--   crews                    5 rows / 48 kB
--   task_due_dates           1 row  / 48 kB
--   project_boms             1 row  / 48 kB
--   funding_events           0 rows / 32 kB
--   service_call_notes       0 rows / 24 kB
--
-- PRE-APPLY GATES (mandatory, per plan §Phase 2)
-- ----------------------------------------------
-- 1. Apply to a Supabase branch first (NOT prod).
-- 2. `npm test` against the branch — must pass.
-- 3. Manual smoke matrix:
--      a) admin: create note + folder + schedule entry on any project
--      b) manager: same as (a)
--      c) `user` role: write note on a project where they ARE the PM
--      d) `user` role: write note on a project where they are NOT PM
--         → expected to FAIL after this migration. If your team needs this
--           to succeed, broaden notes_write / folders_write / schedule_write /
--           service_calls_write / stage_history_write to
--           `auth_is_internal_writer()` in a follow-up commit BEFORE prod.
--      e) customer portal /portal/[token]: schedule + stage_history render
-- 4. Diff `get_advisors(type='security')` before vs after on the branch.
--    Flag any new ERROR-level lint.
--
-- HIGH-SEVERITY CAVEAT (per migration-planner R1)
-- -----------------------------------------------
-- v2 write policies on notes/folders/schedule/service_calls/stage_history use
-- `auth_is_manager() OR pm_id = auth_user_id()`. They EXCLUDE non-PM writes
-- from `user` / `sales` / `finance` roles. If any client-side (anon-key)
-- writes from those roles exist on these tables, they will start failing
-- 403 after this migration. MG's standard pattern is server-route writes
-- via the service-role key (which bypasses RLS), so most paths are safe —
-- but step (d) of the smoke matrix is what proves this.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper: auth_can_see_project(p_project_id text)
--    Used by the 4 naked-table v2 policies below and by future Phase 5
--    internal-writer policies. SECURITY DEFINER so it doesn't recursively
--    apply RLS on the lookups it does internally.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_can_see_project(p_project_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.auth_is_platform_user()
    OR EXISTS (SELECT 1 FROM public.projects p
               WHERE p.id = p_project_id AND p.org_id = ANY(public.auth_user_org_ids()))
    OR (public.auth_is_internal_writer()
        AND EXISTS (SELECT 1 FROM public.legacy_projects lp WHERE lp.id = p_project_id))
    OR EXISTS (SELECT 1 FROM public.customer_accounts ca
               WHERE ca.project_id = p_project_id
                 AND ca.auth_user_id = (SELECT auth.uid())
                 AND ca.status = 'active');
$$;
GRANT EXECUTE ON FUNCTION public.auth_can_see_project(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Naked-table coverage — add v2 SELECT/INSERT/UPDATE/DELETE BEFORE
--    dropping auth_full_access. These 4 tables have no other policy today.
-- ----------------------------------------------------------------------------

-- 2a. funding_events  (project_id text NOT NULL)
CREATE POLICY funding_events_select_v2 ON public.funding_events
  FOR SELECT TO authenticated
  USING (public.auth_can_see_project(project_id));
CREATE POLICY funding_events_insert_v2 ON public.funding_events
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_can_see_project(project_id));
CREATE POLICY funding_events_update_v2 ON public.funding_events
  FOR UPDATE TO authenticated
  USING (public.auth_can_see_project(project_id))
  WITH CHECK (public.auth_can_see_project(project_id));
CREATE POLICY funding_events_delete_v2 ON public.funding_events
  FOR DELETE TO authenticated
  USING (public.auth_can_see_project(project_id));

-- 2b. project_boms  (project_id text NOT NULL)
CREATE POLICY project_boms_select_v2 ON public.project_boms
  FOR SELECT TO authenticated
  USING (public.auth_can_see_project(project_id));
CREATE POLICY project_boms_insert_v2 ON public.project_boms
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_can_see_project(project_id));
CREATE POLICY project_boms_update_v2 ON public.project_boms
  FOR UPDATE TO authenticated
  USING (public.auth_can_see_project(project_id))
  WITH CHECK (public.auth_can_see_project(project_id));
CREATE POLICY project_boms_delete_v2 ON public.project_boms
  FOR DELETE TO authenticated
  USING (public.auth_can_see_project(project_id));

-- 2c. task_due_dates  (project_id text NOT NULL; no id column — composite key)
CREATE POLICY task_due_dates_select_v2 ON public.task_due_dates
  FOR SELECT TO authenticated
  USING (public.auth_can_see_project(project_id));
CREATE POLICY task_due_dates_insert_v2 ON public.task_due_dates
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_can_see_project(project_id));
CREATE POLICY task_due_dates_update_v2 ON public.task_due_dates
  FOR UPDATE TO authenticated
  USING (public.auth_can_see_project(project_id))
  WITH CHECK (public.auth_can_see_project(project_id));
CREATE POLICY task_due_dates_delete_v2 ON public.task_due_dates
  FOR DELETE TO authenticated
  USING (public.auth_can_see_project(project_id));

-- 2d. service_call_notes  (no project_id; svc_id → service_calls.id → project_id)
CREATE POLICY service_call_notes_select_v2 ON public.service_call_notes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_calls sc
    WHERE sc.id = service_call_notes.svc_id
      AND public.auth_can_see_project(sc.project_id)
  ));
CREATE POLICY service_call_notes_insert_v2 ON public.service_call_notes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.service_calls sc
    WHERE sc.id = service_call_notes.svc_id
      AND public.auth_can_see_project(sc.project_id)
  ));
CREATE POLICY service_call_notes_update_v2 ON public.service_call_notes
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_calls sc
    WHERE sc.id = service_call_notes.svc_id
      AND public.auth_can_see_project(sc.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.service_calls sc
    WHERE sc.id = service_call_notes.svc_id
      AND public.auth_can_see_project(sc.project_id)
  ));
CREATE POLICY service_call_notes_delete_v2 ON public.service_call_notes
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_calls sc
    WHERE sc.id = service_call_notes.svc_id
      AND public.auth_can_see_project(sc.project_id)
  ));

-- ----------------------------------------------------------------------------
-- 3. Legacy-projects fallback for notes + project_folders + stage_history.
--    DRIFT-CHECK 2026-04-29 found that notes_select_v2 / pf2_select_v2 /
--    sh_select_v2 only join `projects`, not `legacy_projects`. Without these
--    fallback policies the drop would silently blackhole 113,913 NetSuite-
--    imported notes + 15,292 project_folders + 16 stage_history rows for
--    every non-platform internal user (manager, finance, sales, user roles).
--    Real examples that go dark on legacy projects: Ann Flores customer
--    threads, Jennifer Harper engineering notes, NetSuite-revision history
--    from 2023-2024 on PROJ-NaN, PROJ-2232, PROJ-1656, PROJ-1955, PROJ-2235.
--
--    Permissive policies OR with existing v2 — additive, no data loss risk
--    if rolled back.
--
--    Cross-org guard: the legacy fallback ONLY fires when the project lives
--    purely in legacy_projects (i.e., NOT also present in `projects` with an
--    org_id). Today MG is single-tenant so there's no cross-org leak risk
--    even without this guard, but when MG onboards a second dealer org the
--    268 dual-presence projects (in both legacy_projects AND projects) must
--    NOT be readable by non-org internal writers. This NOT EXISTS clause
--    enforces that boundary now so the future migration doesn't have to.
-- ----------------------------------------------------------------------------
CREATE POLICY notes_select_legacy_internal ON public.notes
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_writer()
    AND EXISTS (SELECT 1 FROM public.legacy_projects lp WHERE lp.id = notes.project_id)
    AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = notes.project_id AND p.org_id IS NOT NULL)
  );
CREATE POLICY project_folders_select_legacy_internal ON public.project_folders
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_writer()
    AND EXISTS (SELECT 1 FROM public.legacy_projects lp WHERE lp.id = project_folders.project_id)
    AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_folders.project_id AND p.org_id IS NOT NULL)
  );
CREATE POLICY stage_history_select_legacy_internal ON public.stage_history
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_writer()
    AND EXISTS (SELECT 1 FROM public.legacy_projects lp WHERE lp.id = stage_history.project_id)
    AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = stage_history.project_id AND p.org_id IS NOT NULL)
  );

-- ----------------------------------------------------------------------------
-- 4. Drop the 11 auth_full_access permissive policies. Order doesn't matter
--    since each is independent; alphabetical for readability.
--    The other 7 tables (crews, notes, project_folders, schedule,
--    service_calls, stage_history, task_state) already have v2 SELECT + write
--    policies (legacy fallback for notes/folders/stage_history added in §3
--    above). After drop, those become the only effective policies.
-- ----------------------------------------------------------------------------
DROP POLICY auth_full_access ON public.crews;
DROP POLICY auth_full_access ON public.funding_events;
DROP POLICY auth_full_access ON public.notes;
DROP POLICY auth_full_access ON public.project_boms;
DROP POLICY auth_full_access ON public.project_folders;
DROP POLICY auth_full_access ON public.schedule;
DROP POLICY auth_full_access ON public.service_call_notes;
DROP POLICY auth_full_access ON public.service_calls;
DROP POLICY auth_full_access ON public.stage_history;
DROP POLICY auth_full_access ON public.task_due_dates;
DROP POLICY auth_full_access ON public.task_state;

COMMIT;

-- ============================================================================
-- POST-FLIGHT QUERIES (run after apply)
-- ============================================================================
-- 1. Confirm 0 auth_full_access policies left on the 11 tables:
--    SELECT tablename, count(*) FROM pg_policies
--     WHERE schemaname='public'
--       AND policyname='auth_full_access'
--       AND tablename IN ('crews','funding_events','notes','project_boms',
--                         'project_folders','schedule','service_call_notes',
--                         'service_calls','stage_history','task_due_dates','task_state')
--     GROUP BY tablename;
--    -- expect: 0 rows
--
-- 2. Confirm 4 naked tables now have full v2 coverage (SELECT/INSERT/UPDATE/DELETE):
--    SELECT tablename, cmd, count(*) FROM pg_policies
--     WHERE schemaname='public'
--       AND tablename IN ('funding_events','project_boms','task_due_dates','service_call_notes')
--     GROUP BY tablename, cmd ORDER BY tablename, cmd;
--    -- expect: 4 cmds × 4 tables = 16 rows
--
-- 3. Helper exists & is grantable:
--    SELECT proname, prosecdef FROM pg_proc
--     WHERE proname='auth_can_see_project' AND pronamespace='public'::regnamespace;
--    -- expect: 1 row, prosecdef=true
--
-- 4. Advisor diff: snapshot get_advisors(type='security') before, run after,
--    diff. Any new ERROR-level lint blocks ship.

-- ============================================================================
-- ROLLBACK (paste into a fresh transaction if you need to revert)
-- ============================================================================
-- BEGIN;
--   CREATE POLICY auth_full_access ON public.crews              AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.funding_events     AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.notes              AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.project_boms       AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.project_folders    AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.schedule           AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.service_call_notes AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.service_calls      AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.stage_history      AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.task_due_dates     AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   CREATE POLICY auth_full_access ON public.task_state         AS PERMISSIVE FOR ALL TO public USING ((SELECT auth.role())='authenticated') WITH CHECK ((SELECT auth.role())='authenticated');
--   DROP POLICY IF EXISTS funding_events_select_v2     ON public.funding_events;
--   DROP POLICY IF EXISTS funding_events_insert_v2     ON public.funding_events;
--   DROP POLICY IF EXISTS funding_events_update_v2     ON public.funding_events;
--   DROP POLICY IF EXISTS funding_events_delete_v2     ON public.funding_events;
--   DROP POLICY IF EXISTS project_boms_select_v2       ON public.project_boms;
--   DROP POLICY IF EXISTS project_boms_insert_v2       ON public.project_boms;
--   DROP POLICY IF EXISTS project_boms_update_v2       ON public.project_boms;
--   DROP POLICY IF EXISTS project_boms_delete_v2       ON public.project_boms;
--   DROP POLICY IF EXISTS task_due_dates_select_v2     ON public.task_due_dates;
--   DROP POLICY IF EXISTS task_due_dates_insert_v2     ON public.task_due_dates;
--   DROP POLICY IF EXISTS task_due_dates_update_v2     ON public.task_due_dates;
--   DROP POLICY IF EXISTS task_due_dates_delete_v2     ON public.task_due_dates;
--   DROP POLICY IF EXISTS service_call_notes_select_v2 ON public.service_call_notes;
--   DROP POLICY IF EXISTS service_call_notes_insert_v2 ON public.service_call_notes;
--   DROP POLICY IF EXISTS service_call_notes_update_v2 ON public.service_call_notes;
--   DROP POLICY IF EXISTS service_call_notes_delete_v2 ON public.service_call_notes;
--   DROP POLICY IF EXISTS notes_select_legacy_internal           ON public.notes;
--   DROP POLICY IF EXISTS project_folders_select_legacy_internal ON public.project_folders;
--   DROP POLICY IF EXISTS stage_history_select_legacy_internal   ON public.stage_history;
--   DROP FUNCTION IF EXISTS public.auth_can_see_project(text);
-- COMMIT;
