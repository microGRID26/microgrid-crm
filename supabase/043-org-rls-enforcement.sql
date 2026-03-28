-- 043-org-rls-enforcement.sql — Org-scoped RLS policies
-- Phase 4: Replace permissive read-all with org-scoped SELECT policies.
-- Write policies retain existing role checks (pm_id, manager+, admin, super_admin).
-- Platform users (EDGE org_type) can see all orgs' data.
--
-- IMPORTANT: Each DROP targets the ACTUAL policy name from the original migration
-- that created it. If the old permissive policy is not dropped, it survives
-- alongside the new restrictive one, and Postgres OR-combines them — meaning
-- the org scope is completely bypassed.

-- ═══════════════════════════════════════════════════════════════════════════
-- PERFORMANCE: Composite index for the EXISTS subquery pattern
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_projects_id_org ON projects(id, org_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES WITH DIRECT org_id (projects, crews, warehouse_stock, vendors,
-- task_reasons, notification_rules, queue_sections, document_requirements)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── projects ──────────────────────────────────────────────────────────────
-- Original SELECT: "projects_read" (rls-migration.sql)
DROP POLICY IF EXISTS "projects_read" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_select_v2" ON projects;
CREATE POLICY "projects_select_v2" ON projects FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- UPDATE: add org membership check alongside existing pm_id/manager+ check
-- Original UPDATE: "projects_update" (011-rls-roles.sql)
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_update_v2" ON projects;
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
-- Original INSERT: "projects_insert" (rls-migration.sql)
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_insert_v2" ON projects;
CREATE POLICY "projects_insert_v2" ON projects FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- DELETE: keep super_admin only
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "projects_delete_v2" ON projects;
CREATE POLICY "projects_delete_v2" ON projects FOR DELETE TO authenticated
  USING (auth_is_super_admin());

-- ── crews ─────────────────────────────────────────────────────────────────
-- Original SELECT: "crews_read" (rls-migration.sql)
DROP POLICY IF EXISTS "crews_read" ON crews;
DROP POLICY IF EXISTS "crews_select" ON crews;
DROP POLICY IF EXISTS "crews_select_v2" ON crews;
CREATE POLICY "crews_select_v2" ON crews FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── warehouse_stock ───────────────────────────────────────────────────────
-- Original SELECT: "warehouse_stock_select" (025-inventory.sql)
DROP POLICY IF EXISTS "warehouse_stock_select" ON warehouse_stock;
DROP POLICY IF EXISTS "ws_select" ON warehouse_stock;
DROP POLICY IF EXISTS "ws_select_v2" ON warehouse_stock;
CREATE POLICY "ws_select_v2" ON warehouse_stock FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── vendors ─────────────────────────────────────────────────────────────
-- Original SELECT: "vendors_select" (029-vendors.sql)
-- Got org_id in migration 040 — needs org-scoped SELECT
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_select_v2" ON vendors;
CREATE POLICY "vendors_select_v2" ON vendors FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── task_reasons ──────────────────────────────────────────────────────────
-- Original SELECT: "task_reasons_select" (018-configurable-reasons.sql)
DROP POLICY IF EXISTS "task_reasons_select" ON task_reasons;
DROP POLICY IF EXISTS "tr_select_v2" ON task_reasons;
CREATE POLICY "tr_select_v2" ON task_reasons FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── notification_rules ────────────────────────────────────────────────────
-- Original SELECT: "notification_rules_select" (019-notification-rules.sql)
DROP POLICY IF EXISTS "notification_rules_select" ON notification_rules;
DROP POLICY IF EXISTS "nr_select_v2" ON notification_rules;
CREATE POLICY "nr_select_v2" ON notification_rules FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── queue_sections ────────────────────────────────────────────────────────
-- Original SELECT: "queue_sections_select" (020-queue-config.sql)
DROP POLICY IF EXISTS "queue_sections_select" ON queue_sections;
DROP POLICY IF EXISTS "qs_select_v2" ON queue_sections;
CREATE POLICY "qs_select_v2" ON queue_sections FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ── document_requirements ─────────────────────────────────────────────────
-- Original SELECT: "doc_requirements_select" (023-document-management.sql)
DROP POLICY IF EXISTS "doc_requirements_select" ON document_requirements;
DROP POLICY IF EXISTS "dr_select_v2" ON document_requirements;
CREATE POLICY "dr_select_v2" ON document_requirements FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES INHERITING org_id VIA project_id (EXISTS subquery pattern)
-- Checks the parent project's org membership. org_id IS NULL = backward compat.
-- Write policies stay unchanged — they already check pm_id/manager+ and the
-- project's RLS gates reads anyway.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── task_state ────────────────────────────────────────────────────────────
-- Original SELECT: "task_state_read" (rls-migration.sql)
DROP POLICY IF EXISTS "task_state_read" ON task_state;
DROP POLICY IF EXISTS "task_state_select" ON task_state;
DROP POLICY IF EXISTS "ts_select_v2" ON task_state;
CREATE POLICY "ts_select_v2" ON task_state FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = task_state.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── notes ─────────────────────────────────────────────────────────────────
-- Original SELECT: "notes_read" (rls-migration.sql)
DROP POLICY IF EXISTS "notes_read" ON notes;
DROP POLICY IF EXISTS "notes_select" ON notes;
DROP POLICY IF EXISTS "notes_select_v2" ON notes;
CREATE POLICY "notes_select_v2" ON notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = notes.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── schedule ──────────────────────────────────────────────────────────────
-- Original SELECT: "schedule_read" (rls-migration.sql)
DROP POLICY IF EXISTS "schedule_read" ON schedule;
DROP POLICY IF EXISTS "schedule_select" ON schedule;
DROP POLICY IF EXISTS "schedule_select_v2" ON schedule;
CREATE POLICY "schedule_select_v2" ON schedule FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = schedule.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── stage_history ─────────────────────────────────────────────────────────
-- Original SELECT: "stage_history_read" (rls-migration.sql)
DROP POLICY IF EXISTS "stage_history_read" ON stage_history;
DROP POLICY IF EXISTS "stage_history_select" ON stage_history;
DROP POLICY IF EXISTS "sh_select_v2" ON stage_history;
CREATE POLICY "sh_select_v2" ON stage_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = stage_history.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_funding ───────────────────────────────────────────────────────
-- Original SELECT: "funding_read" (rls-migration.sql)
DROP POLICY IF EXISTS "funding_read" ON project_funding;
DROP POLICY IF EXISTS "funding_select" ON project_funding;
DROP POLICY IF EXISTS "pf_select_v2" ON project_funding;
CREATE POLICY "pf_select_v2" ON project_funding FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_funding.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── audit_log ─────────────────────────────────────────────────────────────
-- Original SELECT: "audit_read" (009-audit-log.sql)
DROP POLICY IF EXISTS "audit_read" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "al_select_v2" ON audit_log;
CREATE POLICY "al_select_v2" ON audit_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = audit_log.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── service_calls ─────────────────────────────────────────────────────────
-- Original SELECT: "service_calls_read" (rls-migration.sql)
DROP POLICY IF EXISTS "service_calls_read" ON service_calls;
DROP POLICY IF EXISTS "sc_select_v2" ON service_calls;
CREATE POLICY "sc_select_v2" ON service_calls FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = service_calls.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_folders ─────────────────────────────────────────────────────
-- Original SELECT: "folders_read" (rls-migration.sql)
DROP POLICY IF EXISTS "folders_read" ON project_folders;
DROP POLICY IF EXISTS "pf2_select_v2" ON project_folders;
CREATE POLICY "pf2_select_v2" ON project_folders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_folders.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_adders ──────────────────────────────────────────────────────
-- Original SELECT: "adders_read" (013-adders.sql)
DROP POLICY IF EXISTS "adders_read" ON project_adders;
DROP POLICY IF EXISTS "pa_select_v2" ON project_adders;
CREATE POLICY "pa_select_v2" ON project_adders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_adders.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── change_orders ───────────────────────────────────────────────────────
-- Original SELECT: permissive USING (true) — exact policy name may vary
-- (table created directly in production, no migration file)
DROP POLICY IF EXISTS "change_orders_read" ON change_orders;
DROP POLICY IF EXISTS "change_orders_select" ON change_orders;
DROP POLICY IF EXISTS "Allow authenticated read" ON change_orders;
DROP POLICY IF EXISTS "co_select_v2" ON change_orders;
CREATE POLICY "co_select_v2" ON change_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = change_orders.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_materials ───────────────────────────────────────────────────
-- Original SELECT: "project_materials_select" (025-inventory.sql)
DROP POLICY IF EXISTS "project_materials_select" ON project_materials;
DROP POLICY IF EXISTS "pm_select_v2" ON project_materials;
CREATE POLICY "pm_select_v2" ON project_materials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_materials.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── purchase_orders ─────────────────────────────────────────────────────
-- Original SELECT: "po_select" (026-purchase-orders.sql)
-- project_id is optional on POs — NULL project_id = globally visible
DROP POLICY IF EXISTS "po_select" ON purchase_orders;
DROP POLICY IF EXISTS "po_select_v2" ON purchase_orders;
CREATE POLICY "po_select_v2" ON purchase_orders FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = purchase_orders.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── po_line_items ───────────────────────────────────────────────────────
-- Original SELECT: "po_items_select" (026-purchase-orders.sql)
-- Inherits visibility from parent purchase_order
DROP POLICY IF EXISTS "po_items_select" ON po_line_items;
DROP POLICY IF EXISTS "poli_select_v2" ON po_line_items;
CREATE POLICY "poli_select_v2" ON po_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_line_items.po_id
      AND (
        po.project_id IS NULL
        OR EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = po.project_id
          AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
        )
      )
    )
  );

-- ── project_files ───────────────────────────────────────────────────────
-- Original SELECT: "project_files_select" (023-document-management.sql)
DROP POLICY IF EXISTS "project_files_select" ON project_files;
DROP POLICY IF EXISTS "pfiles_select_v2" ON project_files;
CREATE POLICY "pfiles_select_v2" ON project_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_files.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_documents ───────────────────────────────────────────────────
-- Original SELECT: "project_documents_select" (023-document-management.sql)
DROP POLICY IF EXISTS "project_documents_select" ON project_documents;
DROP POLICY IF EXISTS "pdocs_select_v2" ON project_documents;
CREATE POLICY "pdocs_select_v2" ON project_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_documents.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── work_orders ─────────────────────────────────────────────────────────
-- Original SELECT: "wo_select" (030-work-orders.sql)
DROP POLICY IF EXISTS "wo_select" ON work_orders;
DROP POLICY IF EXISTS "wo_select_v2" ON work_orders;
CREATE POLICY "wo_select_v2" ON work_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = work_orders.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── wo_checklist_items ──────────────────────────────────────────────────
-- Original SELECT: "woci_select" (030-work-orders.sql)
-- Inherits visibility from parent work_order
DROP POLICY IF EXISTS "woci_select" ON wo_checklist_items;
DROP POLICY IF EXISTS "woci_select_v2" ON wo_checklist_items;
CREATE POLICY "woci_select_v2" ON wo_checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      JOIN projects p ON p.id = wo.project_id
      WHERE wo.id = wo_checklist_items.work_order_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── equipment_warranties ────────────────────────────────────────────────
-- Original SELECT: "ew_select" (034-warranty-tracking.sql)
DROP POLICY IF EXISTS "ew_select" ON equipment_warranties;
DROP POLICY IF EXISTS "ew_select_v2" ON equipment_warranties;
CREATE POLICY "ew_select_v2" ON equipment_warranties FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = equipment_warranties.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── warranty_claims ─────────────────────────────────────────────────────
-- Original SELECT: "wc_select" (034-warranty-tracking.sql)
DROP POLICY IF EXISTS "wc_select" ON warranty_claims;
DROP POLICY IF EXISTS "wc_select_v2" ON warranty_claims;
CREATE POLICY "wc_select_v2" ON warranty_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = warranty_claims.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── edge_sync_log ───────────────────────────────────────────────────────
-- Original SELECT: "edge_sync_select" (028-edge-sync.sql)
DROP POLICY IF EXISTS "edge_sync_select" ON edge_sync_log;
DROP POLICY IF EXISTS "esl_select_v2" ON edge_sync_log;
CREATE POLICY "esl_select_v2" ON edge_sync_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = edge_sync_log.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── warehouse_transactions ──────────────────────────────────────────────
-- Original SELECT: "wht_select" (027-warehouse-transactions.sql)
-- Inherits visibility from parent warehouse_stock (which has direct org_id)
DROP POLICY IF EXISTS "wht_select" ON warehouse_transactions;
DROP POLICY IF EXISTS "wht_select_v2" ON warehouse_transactions;
CREATE POLICY "wht_select_v2" ON warehouse_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_stock ws
      WHERE ws.id = warehouse_transactions.stock_id
      AND (ws.org_id IS NULL OR ws.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── project_boms ────────────────────────────────────────────────────────
-- Original SELECT: permissive USING (true) — exact policy name may vary
-- (table created directly in production, no migration file)
DROP POLICY IF EXISTS "project_boms_read" ON project_boms;
DROP POLICY IF EXISTS "project_boms_select" ON project_boms;
DROP POLICY IF EXISTS "Allow authenticated read" ON project_boms;
DROP POLICY IF EXISTS "pb_select_v2" ON project_boms;
CREATE POLICY "pb_select_v2" ON project_boms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_boms.project_id
      AND (p.org_id IS NULL OR p.org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user())
    )
  );

-- ── task_history ────────────────────────────────────────────────────────
-- Original SELECT: "task_history_read" (011-rls-roles.sql)
-- Has project_id — scope to org via project lookup
DROP POLICY IF EXISTS "task_history_read" ON task_history;
DROP POLICY IF EXISTS "th_select_v2" ON task_history;
CREATE POLICY "th_select_v2" ON task_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = task_history.project_id
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

-- ═══════════════════════════════════════════════════════════════════════════
-- LEGACY TABLES — NO CHANGES (read-only historical data, no org_id)
-- legacy_projects, legacy_notes
-- ═══════════════════════════════════════════════════════════════════════════
