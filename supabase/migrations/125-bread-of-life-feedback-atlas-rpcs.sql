-- Atlas HQ was blind to bread_of_life_feedback. The table has no public
-- read policy, so the only way to pull it from HQ is via SECURITY DEFINER
-- RPCs — same pattern as spoke_feedback (`atlas_list_spoke_feedback` /
-- `atlas_resolve_spoke_feedback`, migrations 108-style).
--
-- `atlas_list_bread_of_life_feedback` feeds both the /feedback page and the
-- overnight briefing / compact alert bar. `atlas_resolve_bread_of_life_feedback`
-- flips the existing `read` boolean so Greg can dismiss a note from HQ.
--
-- EXECUTE is revoked from anon + authenticated to match the post-#94 policy
-- (migration 113). Only service_role (HQ's sb_secret_* key) can call these.

CREATE OR REPLACE FUNCTION public.atlas_list_bread_of_life_feedback(
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
) RETURNS TABLE (
  id uuid,
  message text,
  read boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT f.id, f.message, f.read, f.created_at
  FROM public.bread_of_life_feedback f
  WHERE (p_since IS NULL OR f.created_at >= p_since)
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

CREATE OR REPLACE FUNCTION public.atlas_resolve_bread_of_life_feedback(
  p_id uuid,
  p_read boolean DEFAULT true
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.bread_of_life_feedback
     SET read = p_read
   WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.atlas_list_bread_of_life_feedback(timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.atlas_resolve_bread_of_life_feedback(uuid, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atlas_list_bread_of_life_feedback(timestamptz, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_resolve_bread_of_life_feedback(uuid, boolean) FROM anon, authenticated, PUBLIC;
