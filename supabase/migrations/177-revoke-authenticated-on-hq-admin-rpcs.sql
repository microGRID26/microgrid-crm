-- 177: Close the cross-tenant leak on HQ admin RPCs (greg_actions #294, P1).
-- Audit-rotation 2026-04-25 / security-definer-rpcs surface, follow-up to 172.
--
-- 172 covered the PROVABLY-server-only subset. 177 covers the rest by
-- A) switching the /api/users routes to service_role + p_caller plumbing
--    (already shipped in this commit), then
-- B) revoking authenticated EXECUTE on the now-server-only RPCs.
--
-- Three classes of fix here:
--
--   1. atlas_hq_list_users / atlas_hq_create_user / atlas_hq_update_user
--      - Drop + recreate with p_caller uuid as a leading required arg.
--      - Internal check switches from auth.uid() -> p_caller, so service_role
--        can call them on behalf of an owner (route already verified the
--        owner via cookie + middleware-sanitized headers).
--      - REVOKE EXECUTE FROM authenticated; GRANT only to service_role.
--
--   2. atlas_hq_get_user_role
--      - Stays granted to authenticated because middleware needs it on every
--        page load (auth.uid() is set there). Fix the leak inside the body:
--        WHERE-clause self-check via auth.uid() that excludes other-user
--        lookups. service_role / postgres callers (no auth.uid()) bypass.
--
--   3. atlas_set_feedback_fix_dispatched / atlas_set_feedback_pr_url /
--      atlas_kb_entries_touch_updated_at
--      - Already called only from server contexts (feedback-fixer routes use
--        MICROGRID_SUPABASE_SERVICE_KEY directly; touch_updated_at is a
--        trigger). No code change needed; just REVOKE from authenticated.

-- ── 1a. atlas_hq_list_users(p_caller uuid) ────────────────────────────────
DROP FUNCTION IF EXISTS public.atlas_hq_list_users();

CREATE OR REPLACE FUNCTION public.atlas_hq_list_users(p_caller uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_result json;
BEGIN
  IF NOT public.atlas_hq_is_owner(p_caller) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json)
  INTO v_result
  FROM (
    SELECT id, email, name, role, active, created_at, last_sign_in_at, auth_user_id
    FROM atlas_hq_users
    ORDER BY created_at ASC
  ) t;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.atlas_hq_list_users(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.atlas_hq_list_users(uuid) TO service_role;

-- ── 1b. atlas_hq_create_user(p_caller, p_email, p_role, p_name) ───────────
DROP FUNCTION IF EXISTS public.atlas_hq_create_user(text, text, text);

CREATE OR REPLACE FUNCTION public.atlas_hq_create_user(
  p_caller uuid,
  p_email  text,
  p_role   text,
  p_name   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_row atlas_hq_users%ROWTYPE;
BEGIN
  IF NOT public.atlas_hq_is_owner(p_caller) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('owner', 'work', 'viewer') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  INSERT INTO atlas_hq_users (email, name, role, active, invited_by)
  VALUES (lower(trim(p_email)), p_name, p_role, true, p_caller)
  ON CONFLICT (email) DO UPDATE
    SET role   = EXCLUDED.role,
        name   = COALESCE(EXCLUDED.name, atlas_hq_users.name),
        active = true
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.atlas_hq_create_user(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.atlas_hq_create_user(uuid, text, text, text) TO service_role;

-- ── 1c. atlas_hq_update_user(p_caller, p_id, p_role, p_active) ────────────
DROP FUNCTION IF EXISTS public.atlas_hq_update_user(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.atlas_hq_update_user(
  p_caller uuid,
  p_id     uuid,
  p_role   text    DEFAULT NULL,
  p_active boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_row    atlas_hq_users%ROWTYPE;
  v_target atlas_hq_users%ROWTYPE;
BEGIN
  IF NOT public.atlas_hq_is_owner(p_caller) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target FROM atlas_hq_users WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Anti-lockout: if the caller is editing themselves, they can't demote
  -- their role or deactivate themselves. They'd lose access immediately
  -- and there might be no other owners left.
  IF v_target.auth_user_id = p_caller THEN
    IF p_role IS NOT NULL AND p_role <> 'owner' THEN
      RAISE EXCEPTION 'cannot_demote_self' USING ERRCODE = '42501';
    END IF;
    IF p_active IS NOT NULL AND p_active = false THEN
      RAISE EXCEPTION 'cannot_deactivate_self' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('owner', 'work', 'viewer') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  UPDATE atlas_hq_users
  SET role   = COALESCE(p_role,   role),
      active = COALESCE(p_active, active)
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.atlas_hq_update_user(uuid, uuid, text, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.atlas_hq_update_user(uuid, uuid, text, boolean) TO service_role;

-- ── 2. atlas_hq_get_user_role(p_email) — WHERE-clause self-check ──────────
-- Same signature, language, return type. Adds a self-check so authenticated
-- callers can only retrieve their own role; cross-account lookups silently
-- return NULL (indistinguishable from "email not in HQ users"). service_role
-- / postgres callers (auth.uid() IS NULL) bypass and still get the row.
CREATE OR REPLACE FUNCTION public.atlas_hq_get_user_role(p_email text)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT json_build_object(
    'role',         role,
    'active',       active,
    'name',         name,
    'id',           id,
    'auth_user_id', auth_user_id,
    'scope',        scope
  )
  FROM public.atlas_hq_users
  WHERE lower(email) = lower(p_email)
    AND (
      auth.uid() IS NULL
      OR lower((SELECT email FROM auth.users WHERE id = auth.uid())) = lower(p_email)
    )
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.atlas_hq_get_user_role(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.atlas_hq_get_user_role(text) TO authenticated, service_role;

-- ── 3. Server-only RPCs that authenticated has no business calling ────────
REVOKE EXECUTE ON FUNCTION public.atlas_set_feedback_fix_dispatched(bigint, text)       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atlas_set_feedback_pr_url(bigint, text, text)         FROM authenticated;
-- Trigger function — fired by the table, not by API callers.
REVOKE EXECUTE ON FUNCTION public.atlas_kb_entries_touch_updated_at()                   FROM authenticated;
