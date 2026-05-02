-- Migration 213b — hotfix R2 finding on migration 213 role gate
--
-- R2 caught: 213 used auth_is_org_admin(v_org_id) (org_memberships.org_role)
-- when it should have used auth_is_manager() (public.users.role). Different
-- namespaces. The 213 swap dropped 3 prod users (tpratt, aaron, drivera)
-- whose user-role is manager/finance but who have no owner/admin org
-- memberships. This recreates the function with the corrected gate.
--
-- Result: RPC role gate now matches the existing projects_update_v2 RLS
-- policy exactly — anyone who could direct-UPDATE projects.stage before
-- can call this RPC.

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
  IF p_target_stage IS NULL OR NOT (p_target_stage = ANY (v_stages)) THEN
    RAISE EXCEPTION 'invalid_stage: %', p_target_stage USING ERRCODE = '22023';
  END IF;

  v_actor_id := public.auth_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  SELECT name INTO v_actor_name FROM public.users WHERE id = v_actor_id;

  SELECT p.org_id, p.pm_id INTO v_org_id, v_pm_id
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found: %', p_project_id USING ERRCODE = '02000';
  END IF;

  IF NOT (
    (v_org_id = ANY (public.auth_user_org_ids()))
    OR public.auth_is_platform_user()
  ) THEN
    RAISE EXCEPTION 'forbidden_org' USING ERRCODE = '42501';
  END IF;

  -- Role gate: PM of this project, OR user-table manager+ (matches existing
  -- projects_update_v2 RLS), OR platform user. The auth_is_manager() check
  -- (role_level >= 2) covers manager/finance/admin/super_admin user roles.
  IF NOT (
    lower(coalesce(v_pm_id, '')) = lower(v_actor_id::text)
    OR public.auth_is_manager()
    OR public.auth_is_platform_user()
  ) THEN
    RAISE EXCEPTION 'forbidden_role' USING ERRCODE = '42501';
  END IF;

  v_cur_idx := array_position(v_stages, p_expected_stage);
  v_tgt_idx := array_position(v_stages, p_target_stage);

  IF v_cur_idx IS NULL THEN
    RAISE EXCEPTION 'invalid_expected_stage: %', p_expected_stage USING ERRCODE = '22023';
  END IF;

  IF p_force THEN
    IF NOT public.auth_is_admin() THEN
      RAISE EXCEPTION 'force_requires_admin' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_tgt_idx <> v_cur_idx + 1 THEN
      RAISE EXCEPTION 'invalid_transition: % -> % requires p_force=true (admin only)',
        p_expected_stage, p_target_stage USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.projects
  SET stage = p_target_stage,
      stage_date = v_today
  WHERE projects.id = p_project_id
    AND projects.stage = p_expected_stage;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'stage_changed_concurrently' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.stage_history (project_id, stage, entered)
  VALUES (p_project_id, p_target_stage, v_today);

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

  RETURN QUERY
    SELECT projects.id, projects.stage, projects.stage_date
    FROM public.projects
    WHERE projects.id = p_project_id;
END;
$$;

ALTER FUNCTION public.set_project_stage(text, text, text, text, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_project_stage(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_stage(text, text, text, text, boolean) TO authenticated;
