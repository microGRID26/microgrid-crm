-- Migration 145: pin search_path on the last 2 atlas_kb_* functions
--
-- Supabase advisor `function_search_path_mutable` flagged:
--   - public.atlas_kb_search (SECURITY DEFINER) — real risk. An attacker
--     who can CREATE FUNCTION in their own schema could shadow `now()`,
--     `similarity()`, or any other unqualified reference the function
--     resolves through search_path.
--   - public.atlas_kb_entries_touch_updated_at (trigger, SECURITY INVOKER).
--     Not directly exploitable but hardening is cheap.
--
-- Fix: ALTER FUNCTION ... SET search_path = public, pg_temp
-- for each. `pg_temp` last means an attacker-placed temp object can never
-- override a public lookup.

begin;

alter function public.atlas_kb_search(
  p_query_embedding vector,
  p_user_role text,
  p_limit integer,
  p_min_similarity double precision
) set search_path = public, pg_temp;

alter function public.atlas_kb_entries_touch_updated_at()
  set search_path = public, pg_temp;

commit;
