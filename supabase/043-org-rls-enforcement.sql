-- 043-org-rls-enforcement.sql — Org-scoped RLS policies
-- Phase 4: Replace permissive read-all with org-scoped SELECT policies.
-- Write policies retain existing role checks (pm_id, manager+, admin, super_admin).
-- Platform users (EDGE org_type) can see all orgs' data.

-- ═══════════════════════════════════════════════════════════════════════════
-- PERFORMANCE: Composite index for the EXISTS subquery pattern
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_projects_id_org ON projects(id, org_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES WITH DIRECT org_id (projects, crews, warehouse_stock,
-- task_reasons, notification_rules, queue_sections, document_requirements)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── projects ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "Allow authenticated read" ON projects;
CREATE POLICY "projects_select_v2" ON projects FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- Keep existing write policies — they already check pm_id/manager+/super_admin
-- Just add org membership check to UPDATE
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update_v2" ON projects FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    AND (pm_id = auth_user_id() OR auth_is_manager())
  )
  WITH CHECK (
    (org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    AND (pm_id = auth_user_id() OR auth_is_manager())
  );

-- INSERT: must be member of the org being inserted into
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "Allow authenticated insert" ON projects;
CREATE POLICY "projects_insert_v2" ON projects FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- DELETE: keep super_admin only
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete_v2" ON projects FOR DELETE TO authenticated
  USING (auth_is_super_admin());

-- ── crews ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "crews_select" ON crews;
DROP POLICY IF EXISTS "Allow authenticated read" ON crews;
CREATE POLICY "crews_select_v2" ON crews FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── warehouse_stock ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ws_select" ON warehouse_stock;
DROP POLICY IF EXISTS "Allow authenticated read" ON warehouse_stock;
CREATE POLICY "ws_select_v2" ON warehouse_stock FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── task_reasons ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON task_reasons;
CREATE POLICY "tr_select_v2" ON task_reasons FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── notification_rules ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON notification_rules;
CREATE POLICY "nr_select_v2" ON notification_rules FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── queue_sections ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON queue_sections;
CREATE POLICY "qs_select_v2" ON queue_sections FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── document_requirements ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON document_requirements;
CREATE POLICY "dr_select_v2" ON document_requirements FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES INHERITING org_id VIA project_id
-- Uses EXISTS subquery to check project's org membership.
-- org_id IS NULL on project = backward compat (pre-backfill data).
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: checks if user can see the project referenced by a project_id field.
-- Used in all inherited-org RLS policies below.
-- NOTE: We keep existing write policies unchanged — they already check
-- pm_id/manager+ and the project's RLS gates reads anyway.

-- ── task_state ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_state_select" ON task_state;
DROP POLICY IF EXISTS "Allow authenticated read" ON task_state;
CREATE POLICY "ts_select_v2" ON task_state FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = task_state.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── notes ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_select" ON notes;
DROP POLICY IF EXISTS "Allow authenticated read" ON notes;
CREATE POLICY "notes_select_v2" ON notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = notes.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── schedule ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedule_select" ON schedule;
DROP POLICY IF EXISTS "Allow authenticated read" ON schedule;
CREATE POLICY "schedule_select_v2" ON schedule FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = schedule.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── stage_history ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stage_history_select" ON stage_history;
DROP POLICY IF EXISTS "Allow authenticated read" ON stage_history;
CREATE POLICY "sh_select_v2" ON stage_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stage_history.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_funding ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "funding_select" ON project_funding;
DROP POLICY IF EXISTS "Allow authenticated read" ON project_funding;
CREATE POLICY "pf_select_v2" ON project_funding FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_funding.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── audit_log ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "Allow authenticated read" ON audit_log;
CREATE POLICY "al_select_v2" ON audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = audit_log.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- GLOBAL TABLES — NO CHANGES (stay globally readable)
-- ahjs, utilities, equipment, hoas, financiers, nonfunded_codes,
-- sla_thresholds, feature_flags
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- USER-SCOPED TABLES — NO CHANGES (stay user-scoped)
-- user_preferences, mention_notifications, user_sessions, email_onboarding
-- ═══════════════════════════════════════════════════════════════════════════
