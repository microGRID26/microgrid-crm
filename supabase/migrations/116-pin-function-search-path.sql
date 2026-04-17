-- B→A: pin search_path on 17 functions flagged by the Supabase advisor
-- as `function_search_path_mutable`. An attacker with CREATE privilege on
-- a schema earlier in the caller's search_path could shadow an unqualified
-- name (e.g. `users` or `now()`) and have the function resolve to their
-- shadow. Pinning search_path = public, extensions, pg_catalog closes
-- this. Includes `extensions` for any future trgm-using refactor and
-- `pg_catalog` explicitly matches Supabase's documented recommendation.

DO $$
DECLARE
  fn_names text[] := ARRAY[
    'comm_advances_updated_at',
    'comm_config_updated_at',
    'update_customer_referrals_updated_at',
    'link_customer_account_on_signup',
    'update_updated_at',
    'update_feedback_updated_at',
    'touch_ticket_on_comment',
    'aggregate_earnings',
    'validate_milestone_progression',
    'update_sdr_updated_at',
    'update_euf_updated_at',
    'update_wc_updated_at',
    'update_fd_updated_at',
    'pcli_templates_updated_at',
    'pcli_updated_at',
    'backfill_project_cost_line_items',
    'partner_webhook_subs_updated_at'
  ];
  fn_row record;
  fn_signature text;
BEGIN
  FOR fn_row IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(fn_names)
  LOOP
    fn_signature := format('public.%I(%s)', fn_row.proname, fn_row.args);
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO public, extensions, pg_catalog',
      fn_signature
    );
  END LOOP;
END $$;
