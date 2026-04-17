-- B→A: SubHub webhook idempotency was (name, address) — typo in either
-- field created a duplicate project. SubHub sends `subhub_id` on every
-- payload but the column didn't exist in MG. Adding it now + unique
-- partial index so double-delivery of the same subhub event becomes a
-- no-op at the DB level even if the code path misses the check.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS subhub_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_subhub_id
  ON public.projects (subhub_id)
  WHERE subhub_id IS NOT NULL;

COMMENT ON COLUMN public.projects.subhub_id IS
  'SubHub source id. Primary idempotency key for /api/webhooks/subhub — DB unique when present.';
