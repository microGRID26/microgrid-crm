-- Migration 166 — finance-audit Medium #4 fix (2026-04-25 push-stack audit).
--
-- paul_accept_recommendation (migration 161) accepts a caller-supplied
-- p_accepted_by text and persists it verbatim into chairman_verdict
-- audit JSON. Today the only caller is Paul HQ's
-- /api/morning-review/rec-accept route running with a service-role key
-- behind a Paul/Greg-only middleware gate, so the trust boundary is
-- well-defined. But the value lands in audit JSON Paul reads as ground
-- truth — if grants ever drift OR another caller is added later that
-- passes a wrong literal, attribution silently misrepresents who
-- accepted the rec.
--
-- Fix (defense in depth): derive `accepted_by` from auth.email() when
-- the caller has one, fall back to the supplied parameter only when
-- auth.email() is NULL (service-role + cron paths). Treat the
-- parameter as a hint; the JWT email is authoritative when present.
--
-- Signature + return shape preserved verbatim (uuid p_review_id,
-- priority/title/body for atlas_add_greg_action, returns TABLE
-- (greg_action_id, accepted_at, status)).

CREATE OR REPLACE FUNCTION public.paul_accept_recommendation(
  p_review_id      uuid,
  p_rec_id         text,
  p_priority       text,
  p_title          text,
  p_body_md        text,
  p_accepted_by    text,
  p_source_session text
)
RETURNS TABLE(greg_action_id bigint, accepted_at timestamp with time zone, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_verdict       jsonb;
  v_recs          jsonb;
  v_rec           jsonb;
  v_idx           int;
  v_action_id     bigint;
  v_now           timestamptz := now();
  v_authoritative text;
BEGIN
  IF p_priority NOT IN ('P0', 'P1', 'P2', 'question') THEN
    RAISE EXCEPTION 'invalid priority' USING ERRCODE = '22023';
  END IF;

  -- Authoritative attribution: prefer the JWT-derived email when the
  -- caller has a real session; fall back to the supplied parameter
  -- for service-role / cron callers (auth.email() is NULL there).
  v_authoritative := coalesce(auth.email(), p_accepted_by);

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
               'accepted_by',    to_jsonb(v_authoritative),
               'greg_action_id', to_jsonb(v_action_id)
             )
           )
         )
   WHERE id = p_review_id;

  RETURN QUERY SELECT v_action_id, v_now, 'accepted'::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.paul_accept_recommendation(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.paul_accept_recommendation(uuid, text, text, text, text, text, text) TO service_role;
