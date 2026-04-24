-- Migration 161 — Atomic SECURITY DEFINER RPC for Paul HQ rec-accept.
-- Closes greg_actions #228: concurrent-click race in
-- app/api/morning-review/rec-accept/route.ts (PAUL-HQ).
--
-- Old flow (3 round-trips, no locking): SELECT chairman_verdict_json →
-- atlas_add_greg_action() → UPDATE chairman_verdict_json with greg_action_id.
-- Two concurrent Accepts could both pass the "already accepted?" check, both
-- insert greg_actions rows, and the second UPDATE would clobber the first
-- greg_action_id stamping. Result: orphan greg_actions row not cross-linked
-- in the verdict JSON.
--
-- New flow (atomic, one transaction): SELECT ... FOR UPDATE on the
-- paul_morning_reviews row at the top. A second concurrent call blocks on the
-- lock until the first commits, then reads the already-stamped accepted_at and
-- returns 'already_accepted' before calling atlas_add_greg_action. Zero
-- possibility of a duplicate insert or orphaned row.
--
-- Trust boundary (R1 M1): p_accepted_by, p_title, p_body_md, p_source_session
-- are asserted by the caller, not derived from auth.jwt(). This is safe today
-- because grants below restrict execution to service_role, and the only caller
-- is PAUL-HQ's rec-accept route (which authenticates via gatePaulOrGreg before
-- calling). If a future migration grants execute to authenticated/anon, these
-- inputs become forgeable — don't do that without switching to JWT-derived
-- identity.

CREATE OR REPLACE FUNCTION public.paul_accept_recommendation(
  p_review_id uuid,
  p_rec_id text,
  p_priority text,
  p_title text,
  p_body_md text,
  p_accepted_by text,
  p_source_session text
) RETURNS TABLE (greg_action_id bigint, accepted_at timestamptz, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verdict jsonb;
  v_recs jsonb;
  v_rec jsonb;
  v_idx int;
  v_action_id bigint;
  v_now timestamptz := now();
BEGIN
  IF p_priority NOT IN ('P0', 'P1', 'P2', 'question') THEN
    RAISE EXCEPTION 'invalid priority' USING ERRCODE = '22023';
  END IF;

  SELECT chairman_verdict_json
    INTO v_verdict
    FROM public.paul_morning_reviews
   WHERE id = p_review_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
  END IF;

  v_recs := COALESCE(v_verdict -> 'recommendations', '[]'::jsonb);

  SELECT i - 1
    INTO v_idx
    FROM generate_subscripts(v_recs, 1) AS i
   WHERE (v_recs -> (i - 1)) ->> 'id' = p_rec_id
   LIMIT 1;
  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'rec not found' USING ERRCODE = 'P0002';
  END IF;

  v_rec := v_recs -> v_idx;

  IF (v_rec ->> 'accepted_at') IS NOT NULL THEN
    RETURN QUERY SELECT
      (v_rec ->> 'greg_action_id')::bigint,
      (v_rec ->> 'accepted_at')::timestamptz,
      'already_accepted'::text;
    RETURN;
  END IF;

  v_action_id := public.atlas_add_greg_action(
    p_priority        := p_priority,
    p_title           := p_title,
    p_body_md         := p_body_md,
    p_source_session  := p_source_session,
    p_effort_estimate := NULL,
    p_tags            := ARRAY['paul-morning-review']::text[],
    p_owner           := 'paul'
  );

  UPDATE public.paul_morning_reviews
     SET chairman_verdict_json = jsonb_set(
           v_verdict,
           '{recommendations}',
           jsonb_set(
             v_recs,
             ARRAY[v_idx::text],
             v_rec || jsonb_build_object(
               'accepted_at',    to_jsonb(v_now),
               'accepted_by',    to_jsonb(p_accepted_by),
               'greg_action_id', to_jsonb(v_action_id)
             )
           )
         )
   WHERE id = p_review_id;

  RETURN QUERY SELECT v_action_id, v_now, 'accepted'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paul_accept_recommendation(uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.paul_accept_recommendation(uuid, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.paul_accept_recommendation(uuid, text, text, text, text, text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.paul_accept_recommendation(uuid, text, text, text, text, text, text) TO   service_role;
