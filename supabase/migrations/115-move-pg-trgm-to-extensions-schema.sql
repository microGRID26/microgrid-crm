-- B→A: move pg_trgm out of public schema per Supabase security advisor
-- `extension_in_public`. Extensions in public bloat the namespace and
-- let untrusted schema changes accidentally shadow extension names.
--
-- 3 GIN indexes use gin_trgm_ops (idx_legacy_name_trgm, idx_equipment_name,
-- idx_projects_name_trgm) — ALTER EXTENSION SET SCHEMA moves the op class
-- with the extension and the indexes' OID references remain valid, so
-- scans keep working. App code + planner need `extensions` in search_path
-- for % / similarity() / word_similarity() operators to resolve; we set
-- that on the three runtime roles below.
--
-- 0 function bodies reference pg_trgm directly (verified via pg_proc scan),
-- so migration 116 doesn't need to special-case any trgm caller.

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, anon, service_role;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

ALTER ROLE authenticated SET search_path TO public, extensions;
ALTER ROLE anon SET search_path TO public, extensions;
ALTER ROLE service_role SET search_path TO public, extensions;
