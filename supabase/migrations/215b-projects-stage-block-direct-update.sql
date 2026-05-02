-- Migration 215b — block direct UPDATE on projects.stage / stage_date (closes #459)
--
-- 215 attempted column-level REVOKE but had no effect: table-level UPDATE
-- on public.projects is granted to authenticated, which preempts column-
-- level revokes. (Postgres semantics: column-level grants apply only when
-- table-level grant is absent.)
--
-- 215b: BEFORE UPDATE trigger that blocks any change to projects.stage or
-- projects.stage_date unless the caller is inside set_project_stage RPC
-- (which sets a transaction-local GUC). Service-role and unauthenticated
-- contexts bypass the trigger; only `auth.role() = 'authenticated'` is
-- guarded — the RPC's SECURITY DEFINER body still runs with the original
-- caller's auth.role() so the guard fires there too, but the RPC sets
-- the GUC first → passes.

CREATE OR REPLACE FUNCTION public.projects_block_direct_stage_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF (NEW.stage IS DISTINCT FROM OLD.stage)
     OR (NEW.stage_date IS DISTINCT FROM OLD.stage_date) THEN
    IF current_setting('app.via_set_project_stage', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'projects.stage / stage_date cannot be UPDATEd directly; use set_project_stage(...) RPC'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.projects_block_direct_stage_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.projects_block_direct_stage_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.projects_block_direct_stage_update() TO authenticated;

DROP TRIGGER IF EXISTS projects_block_direct_stage_update_trg ON public.projects;
CREATE TRIGGER projects_block_direct_stage_update_trg
BEFORE UPDATE OF stage, stage_date ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.projects_block_direct_stage_update();

-- Update set_project_stage RPC to set the bypass GUC inside the function
-- body (transaction-local). The RPC's SECURITY DEFINER body retains the
-- original caller's auth.role() = 'authenticated', so the trigger would
-- otherwise reject its own UPDATE.

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

  -- Bypass the projects_block_direct_stage_update_trg trigger for THIS
  -- transaction only. Third arg = true → transaction-local; resets at COMMIT.
  PERFORM set_config('app.via_set_project_stage', 'true', true);

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
