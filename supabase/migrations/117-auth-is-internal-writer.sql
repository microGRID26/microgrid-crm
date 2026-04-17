-- B→A: helper function gating writes to internal (active + role-assigned)
-- users. Replaces the 89 rls_policy_always_true policies that currently
-- resolve `USING(true)`. Models the auth_is_admin() email-linkage pattern
-- (auth.email() → public.users.email).
--
-- Tighter than `authenticated` role alone: a deactivated employee with a
-- warm session still passes `authenticated` but fails this check because
-- their users row has active=false.
--
-- Part A: helper function.
-- Part B: DO-block replacement of the 89 flagged policies.

CREATE OR REPLACE FUNCTION public.auth_is_internal_writer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT
       COALESCE(u.active, true) = true
       AND u.role IS NOT NULL
       AND u.role IN ('super_admin', 'admin', 'finance', 'manager', 'user', 'sales')
     FROM public.users u
     WHERE u.email = auth.email()
     LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_internal_writer() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.auth_is_internal_writer() FROM anon, PUBLIC;

COMMENT ON FUNCTION public.auth_is_internal_writer() IS
  'RLS helper: true when auth.email() maps to an active public.users row with a CRM role. Replaces USING(true) on internal-write policies flagged by Supabase advisor as rls_policy_always_true.';

-- Policy rewrite. Preserves cmd, roles, permissive flag; swaps any `true`
-- qual or with_check expression to public.auth_is_internal_writer().
-- Atomic within this migration's transaction, so there is no window where
-- a table sits without a policy.

DO $$
DECLARE
  pol record;
  new_using text;
  new_check text;
  roles_sql text;
  cmd_sql text;
  create_sql text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, cmd, roles,
           qual::text AS qual_txt, with_check::text AS check_txt
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual::text = 'true' OR with_check::text = 'true')
  LOOP
    IF pol.qual_txt = 'true' THEN
      new_using := 'public.auth_is_internal_writer()';
    ELSIF pol.qual_txt IS NOT NULL THEN
      new_using := pol.qual_txt;
    ELSE
      new_using := NULL;
    END IF;

    IF pol.check_txt = 'true' THEN
      new_check := 'public.auth_is_internal_writer()';
    ELSIF pol.check_txt IS NOT NULL THEN
      new_check := pol.check_txt;
    ELSE
      new_check := NULL;
    END IF;

    roles_sql := (
      SELECT string_agg(quote_ident(r), ', ')
      FROM unnest(pol.roles) r
    );
    IF roles_sql IS NULL OR roles_sql = '' THEN
      roles_sql := 'PUBLIC';
    END IF;

    cmd_sql := pol.cmd;

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policyname, pol.schemaname, pol.tablename,
      pol.permissive, cmd_sql, roles_sql
    );

    IF cmd_sql IN ('SELECT', 'DELETE') THEN
      IF new_using IS NOT NULL THEN
        create_sql := create_sql || format(' USING (%s)', new_using);
      END IF;
    ELSIF cmd_sql = 'INSERT' THEN
      IF new_check IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', new_check);
      END IF;
    ELSE
      IF new_using IS NOT NULL THEN
        create_sql := create_sql || format(' USING (%s)', new_using);
      END IF;
      IF new_check IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', new_check);
      END IF;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    EXECUTE create_sql;
  END LOOP;
END $$;
