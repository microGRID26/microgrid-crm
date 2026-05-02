-- Migration 214 — audit_log auth-resolution trigger (closes #453)
--
-- Why: today every audit_log INSERT call site supplies `changed_by_id` from
-- the client. A malicious authenticated user can spoof the actor by passing
-- another user's id. Codebase-wide problem (~10 INSERT sites).
--
-- Fix: BEFORE INSERT trigger that overrides changed_by_id + changed_by with
-- the auth-resolved actor when an authenticated user session is active.
-- Service-role / server-to-server contexts (where auth.email() is null) are
-- left as-is so cron / webhooks / DEFINER functions that pass canonical ids
-- still work. SECURITY DEFINER functions (like set_project_stage) called
-- from authenticated users will still resolve to the original caller —
-- auth.email() is JWT-claim-derived, not role-derived.

CREATE OR REPLACE FUNCTION public.audit_log_resolve_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_name text;
BEGIN
  v_uid := public.auth_user_id();

  -- No active user session (service_role / cron / unauthenticated): trust
  -- whatever the caller passed. The RLS policies on audit_log decide
  -- whether the caller is allowed to insert at all; this trigger only
  -- guards against authenticated-user spoofing.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id = v_uid;

  NEW.changed_by_id := v_uid::text;
  NEW.changed_by    := v_name;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.audit_log_resolve_actor() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.audit_log_resolve_actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_log_resolve_actor() TO authenticated;

DROP TRIGGER IF EXISTS audit_log_resolve_actor_trg ON public.audit_log;
CREATE TRIGGER audit_log_resolve_actor_trg
BEFORE INSERT ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_resolve_actor();

COMMENT ON TRIGGER audit_log_resolve_actor_trg ON public.audit_log IS
  'Overrides changed_by_id + changed_by with auth-resolved actor for authenticated sessions to prevent client-side spoofing (#453). Server-to-server contexts (auth.uid() null) are left as-is.';
