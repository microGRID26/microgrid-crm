-- Migration 054: Tighten RLS write policies on reference tables
-- Currently hoas, financiers, equipment, and task_reasons allow INSERT/UPDATE
-- for all authenticated users. These should be admin-only.
-- DELETE policies already use auth_is_super_admin() — those stay as-is.

-- ── HOAs ────────────────────────────────────────────────────────────────────

-- Drop permissive INSERT/UPDATE policies
DROP POLICY IF EXISTS "hoas_insert" ON hoas;
DROP POLICY IF EXISTS "hoas_update" ON hoas;

-- Recreate with admin check
CREATE POLICY "hoas_insert" ON hoas FOR INSERT
  TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY "hoas_update" ON hoas FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- ── Financiers ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "financiers_insert" ON financiers;
DROP POLICY IF EXISTS "financiers_update" ON financiers;

CREATE POLICY "financiers_insert" ON financiers FOR INSERT
  TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY "financiers_update" ON financiers FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- ── Equipment ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "equipment_insert" ON equipment;
DROP POLICY IF EXISTS "equipment_update" ON equipment;

CREATE POLICY "equipment_insert" ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY "equipment_update" ON equipment FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- ── Task Reasons ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "task_reasons_insert" ON task_reasons;
DROP POLICY IF EXISTS "task_reasons_update" ON task_reasons;

CREATE POLICY "task_reasons_insert" ON task_reasons FOR INSERT
  TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY "task_reasons_update" ON task_reasons FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());
