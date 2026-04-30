-- Migration 208 — atlas_link_cost_events_to_run
-- 2026-04-30 · greg_action #445 — Phase 7 prep
--
-- Live atlas_cost_events rows currently land with run_id=NULL because
-- callClaude logs the event mid-handler, before reportFleetRun has
-- written the run row. Aggregate sums work fine (verified in Phase 6),
-- but per-run drilldown for Phase 7 needs the run_id back-link.
--
-- Pattern (decided 2026-04-30):
--   1. callClaude logs cost_event with run_id=NULL, returns the event id
--   2. cron handler accumulates the event ids into a local array
--   3. cron handler calls reportFleetRun, which writes the run row and
--      returns the new run_id
--   4. reportFleetRun then calls this RPC with the run_id + event_ids
--      to back-link in one round-trip
--
-- Safety: cross-agent guard. The cost_events being linked MUST all
-- share the same agent_slug as the run. Without this, a buggy caller
-- could pass cost_event ids from agent X into a run row for agent Y,
-- silently mis-attributing cost on /intel.

BEGIN;

CREATE OR REPLACE FUNCTION public.atlas_link_cost_events_to_run(
  p_run_id          bigint,
  p_cost_event_ids  bigint[]
)
RETURNS bigint  -- count of rows actually linked
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run_slug text;
  v_linked   bigint;
BEGIN
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'p_run_id must not be null' USING errcode = '22004';
  END IF;
  IF p_cost_event_ids IS NULL OR array_length(p_cost_event_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  -- Defensive cap. A single Claude turn shouldn't produce more than a
  -- handful of cost_events; 1000 is comfortably above any realistic
  -- chat-loop round count and keeps the UPDATE bounded.
  IF array_length(p_cost_event_ids, 1) > 1000 THEN
    RAISE EXCEPTION 'p_cost_event_ids capped at 1000 entries (got %)', array_length(p_cost_event_ids, 1)
      USING errcode = '22023';
  END IF;

  -- Cross-agent guard. Resolve the run's agent_slug, then UPDATE only
  -- those events that:
  --   (a) match p_cost_event_ids
  --   (b) currently have run_id IS NULL (idempotent — no re-link)
  --   (c) share the run's agent_slug
  -- Mismatched ids silently no-op rather than erroring; a buggy caller
  -- gets a low `linked` count and can investigate.
  SELECT agent_slug INTO v_run_slug
  FROM atlas_agent_runs
  WHERE id = p_run_id;

  IF v_run_slug IS NULL THEN
    RAISE EXCEPTION 'Unknown run id: %', p_run_id USING errcode = '23503';
  END IF;

  UPDATE atlas_cost_events
  SET run_id = p_run_id
  WHERE id = ANY(p_cost_event_ids)
    AND run_id IS NULL
    AND agent_slug = v_run_slug;

  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN v_linked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atlas_link_cost_events_to_run(bigint, bigint[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_link_cost_events_to_run(bigint, bigint[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atlas_link_cost_events_to_run(bigint, bigint[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.atlas_link_cost_events_to_run(bigint, bigint[]) TO service_role;

COMMENT ON FUNCTION public.atlas_link_cost_events_to_run(bigint, bigint[]) IS
  'Back-link cost_events to a run row after the run is written. Cross-agent guard: only links events whose agent_slug matches the run. Idempotent (WHERE run_id IS NULL). Returns count of linked rows. Server-only via REVOKE/GRANT.';

COMMIT;
