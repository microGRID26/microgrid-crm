-- ============================================================================
-- RLS Migration for NOVA / MicroGRID CRM
-- Run this entire file in the Supabase SQL Editor.
--
-- BEFORE RUNNING: Verify all PM names have matching users rows:
--   SELECT DISTINCT p.pm FROM projects p
--   LEFT JOIN users u ON u.name = p.pm
--   WHERE p.pm IS NOT NULL AND u.name IS NULL;
-- Fix any mismatches first, otherwise those projects become un-writable.
--
-- ROLLBACK: To disable RLS on any table:
--   ALTER TABLE public.<table_name> DISABLE ROW LEVEL SECURITY;
-- ============================================================================

-- ── Step 1: Indexes ─────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON public.projects (pm);

-- ── Step 2: Helper Functions ────────────────────────────────────────────────

-- Maps auth email → display name from users table
CREATE OR REPLACE FUNCTION public.auth_user_name()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.users WHERE email = auth.email() LIMIT 1;
$$;

-- Checks if current user is admin
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT admin FROM public.users WHERE email = auth.email() LIMIT 1),
    false
  );
$$;

-- Auto-provision new users on first login (called via supabase.rpc)
CREATE OR REPLACE FUNCTION public.provision_user(p_email TEXT, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (email, name, active, admin)
  VALUES (p_email, p_name, true, false)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

-- Cascade user name changes to all pm fields
CREATE OR REPLACE FUNCTION public.cascade_user_name_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE projects SET pm = NEW.name WHERE pm = OLD.name;
    UPDATE notes SET pm = NEW.name WHERE pm = OLD.name;
    UPDATE schedule SET pm = NEW.name WHERE pm = OLD.name;
    UPDATE service_calls SET pm = NEW.name WHERE pm = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_user_name ON public.users;
CREATE TRIGGER trg_cascade_user_name
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.cascade_user_name_change();

-- ── Step 3: RLS on Reference Tables ────────────────────────────────────────
-- All authenticated users can read. Only admins can write.

-- AHJs
ALTER TABLE public.ahjs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ahjs_read" ON public.ahjs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ahjs_write" ON public.ahjs
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Utilities
ALTER TABLE public.utilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "utilities_read" ON public.utilities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "utilities_write" ON public.utilities
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Crews
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crews_read" ON public.crews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "crews_write" ON public.crews
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- SLA Thresholds
ALTER TABLE public.sla_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_read" ON public.sla_thresholds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_write" ON public.sla_thresholds
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Users (all can read for PM dropdowns/avatars; only admins can write)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read" ON public.users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_write" ON public.users
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ── Step 4: RLS on Project-Scoped Tables ───────────────────────────────────
-- All authenticated can read. Write requires pm match or admin.

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_read" ON public.projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE TO authenticated
  USING (pm = public.auth_user_name() OR public.auth_is_admin())
  WITH CHECK (pm = public.auth_user_name() OR public.auth_is_admin());
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_admin());
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE TO authenticated
  USING (public.auth_is_admin());

-- Task State (write gated by project ownership)
ALTER TABLE public.task_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_state_read" ON public.task_state
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_state_write" ON public.task_state
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = task_state.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = task_state.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  );

-- Notes (write gated by project ownership)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_read" ON public.notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "notes_write" ON public.notes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = notes.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = notes.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  );

-- Schedule (write gated by pm field or project ownership)
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_read" ON public.schedule
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_write" ON public.schedule
  FOR ALL TO authenticated
  USING (
    pm = public.auth_user_name() OR public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = schedule.project_id
      AND projects.pm = public.auth_user_name()
    )
  )
  WITH CHECK (
    pm = public.auth_user_name() OR public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = schedule.project_id
      AND projects.pm = public.auth_user_name()
    )
  );

-- Stage History (write gated by project ownership)
ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage_history_read" ON public.stage_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stage_history_write" ON public.stage_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = stage_history.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = stage_history.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  );

-- Project Funding (write gated by project ownership)
ALTER TABLE public.project_funding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funding_read" ON public.project_funding
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "funding_write" ON public.project_funding
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_funding.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_funding.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  );

-- Service Calls (write gated by pm field or project ownership)
ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_calls_read" ON public.service_calls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_calls_write" ON public.service_calls
  FOR ALL TO authenticated
  USING (
    pm = public.auth_user_name() OR public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = service_calls.project_id
      AND projects.pm = public.auth_user_name()
    )
  )
  WITH CHECK (
    pm = public.auth_user_name() OR public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = service_calls.project_id
      AND projects.pm = public.auth_user_name()
    )
  );

-- Project Folders (write gated by project ownership)
ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_read" ON public.project_folders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "folders_write" ON public.project_folders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_folders.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_folders.project_id
      AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
    )
  );

-- Task History (write gated by project ownership)
-- This table may or may not exist yet; safe to skip if it errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_history' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$CREATE POLICY "task_history_read" ON public.task_history FOR SELECT TO authenticated USING (true)$p$;
    EXECUTE $p$CREATE POLICY "task_history_write" ON public.task_history FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = task_history.project_id
          AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.projects
          WHERE projects.id = task_history.project_id
          AND (projects.pm = public.auth_user_name() OR public.auth_is_admin())
        )
      )$p$;
  END IF;
END $$;

-- AHJ/Utility Messages (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ahj_messages' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.ahj_messages ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$CREATE POLICY "ahj_messages_read" ON public.ahj_messages FOR SELECT TO authenticated USING (true)$p$;
    EXECUTE $p$CREATE POLICY "ahj_messages_write" ON public.ahj_messages FOR ALL TO authenticated USING (true) WITH CHECK (true)$p$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'utility_messages' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.utility_messages ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$CREATE POLICY "utility_messages_read" ON public.utility_messages FOR SELECT TO authenticated USING (true)$p$;
    EXECUTE $p$CREATE POLICY "utility_messages_write" ON public.utility_messages FOR ALL TO authenticated USING (true) WITH CHECK (true)$p$;
  END IF;
END $$;

-- ============================================================================
-- Done! Verify with:
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- ============================================================================
