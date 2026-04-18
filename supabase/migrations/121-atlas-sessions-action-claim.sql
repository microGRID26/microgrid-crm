-- Parallel-session action-claim coordination.
--
-- Atlas runs 3-4 concurrent Claude Code sessions. Before this migration,
-- nothing prevented two sessions from picking up the same greg_actions row
-- and duplicating the work. This adds an optimistic-lock claim on
-- atlas_sessions with a 30-minute staleness rule: if the claimer stops
-- heartbeating, another session can steal the claim.
--
-- Applied via MCP 2026-04-18. File kept as the canonical source of truth.

ALTER TABLE public.atlas_sessions
  ADD COLUMN IF NOT EXISTS claimed_action_id bigint REFERENCES public.greg_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS atlas_sessions_claimed_action_idx
  ON public.atlas_sessions(claimed_action_id)
  WHERE claimed_action_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.atlas_claim_action(
  p_session_id    text,
  p_action_id     bigint,
  p_stale_minutes integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action_status text;
  v_other_session text;
  v_other_hb      timestamptz;
  v_minutes_ago   integer;
BEGIN
  SELECT status INTO v_action_status FROM public.greg_actions WHERE id = p_action_id;
  IF v_action_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action_not_found');
  END IF;
  IF v_action_status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'action_not_open', 'status', v_action_status);
  END IF;

  SELECT session_id, last_heartbeat_at
    INTO v_other_session, v_other_hb
    FROM public.atlas_sessions
   WHERE claimed_action_id = p_action_id
     AND session_id <> p_session_id
     AND last_heartbeat_at > now() - make_interval(mins => p_stale_minutes)
   ORDER BY last_heartbeat_at DESC
   LIMIT 1;

  IF v_other_session IS NOT NULL THEN
    v_minutes_ago := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_other_hb))::int / 60);
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'already_claimed',
      'claimed_by_session', v_other_session,
      'claimed_minutes_ago', v_minutes_ago
    );
  END IF;

  INSERT INTO public.atlas_sessions (session_id, claimed_action_id, claimed_at, last_heartbeat_at, started_at)
  VALUES (p_session_id, p_action_id, now(), now(), now())
  ON CONFLICT (session_id) DO UPDATE
    SET claimed_action_id = EXCLUDED.claimed_action_id,
        claimed_at        = EXCLUDED.claimed_at,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at;

  UPDATE public.atlas_sessions
     SET claimed_action_id = NULL, claimed_at = NULL
   WHERE claimed_action_id = p_action_id
     AND session_id <> p_session_id;

  RETURN jsonb_build_object('ok', true, 'reason', 'claimed');
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_release_action(
  p_session_id text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.atlas_sessions
     SET claimed_action_id = NULL,
         claimed_at        = NULL
   WHERE session_id = p_session_id
     AND claimed_action_id IS NOT NULL;
$$;

DROP FUNCTION IF EXISTS public.atlas_list_sessions(integer);
CREATE OR REPLACE FUNCTION public.atlas_list_sessions(
  p_limit integer DEFAULT 50
) RETURNS TABLE (
  id                   bigint,
  session_id           text,
  project              text,
  cwd                  text,
  branch               text,
  current_task         text,
  last_action          text,
  started_at           timestamptz,
  last_heartbeat_at    timestamptz,
  ended_at             timestamptz,
  claimed_action_id    bigint,
  claimed_action_title text,
  claimed_at           timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.session_id,
    s.project,
    s.cwd,
    s.branch,
    s.current_task,
    s.last_action,
    s.started_at,
    s.last_heartbeat_at,
    s.ended_at,
    s.claimed_action_id,
    a.title AS claimed_action_title,
    s.claimed_at
  FROM public.atlas_sessions s
  LEFT JOIN public.greg_actions a ON a.id = s.claimed_action_id
  ORDER BY s.last_heartbeat_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

DROP FUNCTION IF EXISTS public.atlas_session_heartbeat(text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.atlas_session_heartbeat(
  p_session_id        text,
  p_project           text,
  p_cwd               text,
  p_branch            text,
  p_current_task      text,
  p_last_action       text,
  p_claimed_action_id bigint DEFAULT NULL
) RETURNS SETOF public.atlas_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.atlas_sessions AS s (
    session_id, project, cwd, branch, current_task, last_action,
    started_at, last_heartbeat_at, claimed_action_id, claimed_at
  )
  VALUES (
    p_session_id, p_project, p_cwd, p_branch, p_current_task, p_last_action,
    now(), now(),
    p_claimed_action_id,
    CASE WHEN p_claimed_action_id IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (session_id) DO UPDATE
    SET project           = COALESCE(EXCLUDED.project, s.project),
        cwd               = COALESCE(EXCLUDED.cwd, s.cwd),
        branch            = COALESCE(EXCLUDED.branch, s.branch),
        current_task      = COALESCE(EXCLUDED.current_task, s.current_task),
        last_action       = COALESCE(EXCLUDED.last_action, s.last_action),
        last_heartbeat_at = now(),
        claimed_action_id = COALESCE(EXCLUDED.claimed_action_id, s.claimed_action_id),
        claimed_at        = CASE
          WHEN EXCLUDED.claimed_action_id IS NOT NULL
               AND EXCLUDED.claimed_action_id IS DISTINCT FROM s.claimed_action_id
            THEN now()
          ELSE s.claimed_at
        END
  RETURNING s.*;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_claim_action(text,bigint,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atlas_release_action(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_claim_action(text,bigint,integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_release_action(text) TO service_role, authenticated;
