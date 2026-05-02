-- Migration 213 — set_project_stage RPC (closes #454 + #455)
--
-- Why: today projects.stage is updated via direct UPDATE from the client. The
-- canAdvance task gate is enforced ONLY in JS — a PM (pm_id matches) or manager
-- can DevTools-skip stages, and the new admin "set stage manually" dropdown is
-- cosmetic for the same reason. Plus the 3-write transition (projects /
-- stage_history / audit_log) is non-atomic — partial failures leave history
-- gaps (#455).
--
-- Fix: all stage transitions must go through this SECURITY DEFINER RPC. The
-- RPC enforces (a) project access, (b) role-based authorization (PM/manager
-- can advance forward by exactly 1; admin/super_admin can set arbitrary), and
-- (c) atomic 3-write transition. The companion REVOKE on projects.stage cols
-- is in migration 214 (split so the code rollout sits between, no prod break).
--
-- R1 audit fixes baked in:
--   - PM check uses case-insensitive comparison (audit found pm_id is text;
--     no constraint on canonical-form uuid).
--   - Manager gate scoped to the project's org (auth_is_org_admin(v_org_id))
--     instead of un-scoped auth_is_manager() to prevent cross-org manager bleed.
--   - p_reason is persisted (new audit_log.reason column).
--   - service_role grant dropped — no backend caller needs this; backend can
--     use a separate explicit-actor RPC if ever required.
--   - Explicit OWNER TO postgres so DEFINER bypasses RLS on the writes.

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS reason text;

CREATE OR REPLACE FUNCTION public.set_project_stage(
  p_project_id     text,
  p_target_stage   text,
  p_expected_stage text,
  p_reason         text    DEFAULT NULL,
  p_force          boolean DEFAULT false
)
RETURNS TABLE (
  id         text,
  stage      text,
  stage_date text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_org_id     uuid;
  v_pm_id      text;
  v_today      text := to_char((now() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD');
  v_stages     text[] := ARRAY['evaluation','survey','design','permit','install','inspection','complete'];
  v_cur_idx    int;
  v_tgt_idx    int;
  v_updated    int;
BEGIN
  -- 1) Validate target stage value
  IF p_target_stage IS NULL OR NOT (p_target_stage = ANY (v_stages)) THEN
    RAISE EXCEPTION 'invalid_stage: %', p_target_stage USING ERRCODE = '22023';
  END IF;

  -- 2) Resolve actor (raises if no auth)
  v_actor_id := public.auth_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  SELECT name INTO v_actor_name FROM public.users WHERE id = v_actor_id;

  -- 3) Load project + verify access
  SELECT p.org_id, p.pm_id INTO v_org_id, v_pm_id
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found: %', p_project_id USING ERRCODE = '02000';
  END IF;

  -- Org gate: must be in project's org OR platform user
  IF NOT (
    (v_org_id = ANY (public.auth_user_org_ids()))
    OR public.auth_is_platform_user()
  ) THEN
    RAISE EXCEPTION 'forbidden_org' USING ERRCODE = '42501';
  END IF;

  -- Role gate: must be PM of project OR org-scoped manager+ (or platform user)
  --   pm_id is text holding a uuid string; case-insensitive compare in case
  --   legacy imports stored upper-case or non-canonical form.
  IF NOT (
    lower(coalesce(v_pm_id, '')) = lower(v_actor_id::text)
    OR public.auth_is_org_admin(v_org_id)
    OR public.auth_is_platform_user()
  ) THEN
    RAISE EXCEPTION 'forbidden_role' USING ERRCODE = '42501';
  END IF;

  -- 4) Stage-transition authorization
  v_cur_idx := array_position(v_stages, p_expected_stage);
  v_tgt_idx := array_position(v_stages, p_target_stage);

  IF v_cur_idx IS NULL THEN
    RAISE EXCEPTION 'invalid_expected_stage: %', p_expected_stage USING ERRCODE = '22023';
  END IF;

  IF p_force THEN
    -- Manual set: admin only. Allows arbitrary direction.
    IF NOT public.auth_is_admin() THEN
      RAISE EXCEPTION 'force_requires_admin' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Default path: forward by exactly 1
    IF v_tgt_idx <> v_cur_idx + 1 THEN
      RAISE EXCEPTION 'invalid_transition: % -> % requires p_force=true (admin only)',
        p_expected_stage, p_target_stage USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 5) Optimistic-locked UPDATE
  UPDATE public.projects
  SET stage = p_target_stage,
      stage_date = v_today
  WHERE projects.id = p_project_id
    AND projects.stage = p_expected_stage;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'stage_changed_concurrently' USING ERRCODE = '40001';
  END IF;

  -- 6) stage_history (atomic with the projects update)
  INSERT INTO public.stage_history (project_id, stage, entered)
  VALUES (p_project_id, p_target_stage, v_today);

  -- 7) audit_log (changed_by_id resolved server-side — closes #453 for this path)
  INSERT INTO public.audit_log (
    project_id, field, old_value, new_value, changed_by, changed_by_id, reason
  ) VALUES (
    p_project_id,
    CASE WHEN p_force THEN 'stage_manual' ELSE 'stage' END,
    p_expected_stage,
    p_target_stage,
    v_actor_name,
    v_actor_id::text,
    p_reason
  );

  -- 8) Return the new state
  RETURN QUERY
    SELECT projects.id, projects.stage, projects.stage_date
    FROM public.projects
    WHERE projects.id = p_project_id;
END;
$$;

ALTER FUNCTION public.set_project_stage(text, text, text, text, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_project_stage(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_stage(text, text, text, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.set_project_stage(text, text, text, text, boolean) IS
  'Authoritative stage transition. Org-scoped + PM/org-manager gated; non-admins forward-by-1 only; admin can force arbitrary. Atomic projects + stage_history + audit_log. Closes #454, #455.';
