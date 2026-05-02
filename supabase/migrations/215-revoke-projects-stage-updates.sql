-- Migration 215 — REVOKE direct UPDATE on projects.stage cols (closes #459)
--
-- Companion to 213/213b/214 today: now that all 4 client call sites are
-- switched to set_project_stage RPC, lock down direct UPDATE on stage
-- and stage_date so the bypass surface is closed.
--
-- Audit (red-teamer 2026-05-01) found that without this, today's RPC is
-- defense-in-depth but the primary bypass remains: a manager can still
-- `supabase.from('projects').update({stage:'complete'}).eq(...)` and skip
-- canAdvance, the audit_log row, the stage_history row, and the optimistic
-- lock entirely.
--
-- Column-level grants take precedence over RLS — Postgres rejects the
-- write before policy evaluation. The set_project_stage RPC runs as
-- SECURITY DEFINER (owner = postgres) so it bypasses these grants.
--
-- Deploy ordering: this should ship in the same deploy as f30996f. With
-- the code already calling the RPC, in-flight clients on stale code that
-- still attempt direct UPDATE will get permission_denied — they get a
-- toast and refresh, recovers in seconds. Acceptable.

REVOKE UPDATE (stage, stage_date) ON public.projects FROM authenticated;
REVOKE UPDATE (stage, stage_date) ON public.projects FROM anon;

COMMENT ON COLUMN public.projects.stage IS
  'Stage column. Direct UPDATE revoked from authenticated/anon. Use set_project_stage(...) RPC. (#459 lockdown 2026-05-01.)';
COMMENT ON COLUMN public.projects.stage_date IS
  'Stage transition date. Maintained by set_project_stage RPC; direct UPDATE revoked. (#459 lockdown 2026-05-01.)';
