-- Migration 207 — Phase 6: cost-events v2 cutover
-- 2026-04-30 · ~/.claude/plans/tingly-honking-pearl.md Phase 6
--
-- Three jobs in one migration (transactional):
--   1. BACKFILL  Fill atlas_cost_events with one row per historical
--                atlas_agent_runs row (Anthropic spend only) so the
--                v2 RPCs have a complete picture pre-deploy.
--   2. v2 RPCs   atlas_list_agents_v2 + atlas_fleet_stats_v2 read
--                cost_today_usd / cost_7d / cost_mtd from cost_events
--                instead of atlas_agent_runs.cost_usd. v1 stays alive
--                for 1 week as rollback path.
--   3. GRANTS    Same REVOKE/GRANT pattern as v1.
--
-- Disjoint-coverage guarantee: backfill stops at the first live
-- cost_events row (2026-04-30 22:21:43 UTC, the Phase 4 deploy
-- moment). Pre-cutoff runs → backfill rows; post-cutoff runs → live
-- rows already written. No double-count.
--
-- Verified pre-apply:
--   9,342 pre-cutoff runs   = $13.2725 (will backfill)
--      15 post-cutoff runs  = $0.0107  (live already covers, +$0.002 extra
--                                       from 2 ambient calls dropped from
--                                       atlas_agent_runs but caught in
--                                       cost_events — net richer data)
-- Sum after cutover should be ≥ pre-cutover and < +5% drift.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. BACKFILL: one cost_event per historical run with cost_usd > 0
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.atlas_cost_events (
  agent_slug, vendor, units, unit_label, unit_cost_usd,
  pricing_version, ts, run_id, source, idempotency_key, metadata
)
SELECT
  r.agent_slug,
  'anthropic',
  -- units = total tokens consumed. GREATEST(...,1) avoids divide-by-zero
  -- for runs that recorded cost but no token breakdown (rare).
  GREATEST(
    COALESCE(r.input_tokens, 0)
    + COALESCE(r.output_tokens, 0)
    + COALESCE((r.metadata -> 'usage_breakdown' ->> 'cache_read_tokens')::bigint, 0)
    + COALESCE((r.metadata -> 'usage_breakdown' ->> 'cache_creation_tokens')::bigint, 0),
    1
  )::numeric,
  'tokens',
  -- unit_cost_usd = cost / units when token data is present, else
  -- cost_usd directly (paired with units=1). The total_cost_usd
  -- generated column reproduces r.cost_usd either way.
  CASE
    WHEN COALESCE(r.input_tokens, 0)
       + COALESCE(r.output_tokens, 0)
       + COALESCE((r.metadata -> 'usage_breakdown' ->> 'cache_read_tokens')::bigint, 0)
       + COALESCE((r.metadata -> 'usage_breakdown' ->> 'cache_creation_tokens')::bigint, 0) > 0
    THEN r.cost_usd / (
        COALESCE(r.input_tokens, 0)
      + COALESCE(r.output_tokens, 0)
      + COALESCE((r.metadata -> 'usage_breakdown' ->> 'cache_read_tokens')::bigint, 0)
      + COALESCE((r.metadata -> 'usage_breakdown' ->> 'cache_creation_tokens')::bigint, 0)
    )
    ELSE r.cost_usd
  END,
  '2026-04-16',  -- current PRICING_VERSION; backfill stamps the only
                 -- rate version we know about. Phase 8 reconciliation
                 -- will surface drift if Anthropic raised rates pre-
                 -- 2026-04-16 below this floor.
  r.started_at, -- preserve historical timestamp for /intel chart fidelity
  r.id,         -- correlate cost_events back to atlas_agent_runs row
  'backfill',
  -- Idempotency key namespaced under 'backfill:' so re-running the
  -- migration is safe; no collision with live keys (which use the
  -- Anthropic message_id namespace).
  'backfill:' || r.agent_slug || ':run-' || r.id,
  jsonb_build_object(
    'backfilled_at', now(),
    'source_run_id', r.id,
    'input_tokens', r.input_tokens,
    'output_tokens', r.output_tokens,
    'cache_read_tokens', (r.metadata -> 'usage_breakdown' ->> 'cache_read_tokens')::bigint,
    'cache_creation_tokens', (r.metadata -> 'usage_breakdown' ->> 'cache_creation_tokens')::bigint
  )
FROM public.atlas_agent_runs r
WHERE r.cost_usd > 0
  AND r.started_at < '2026-04-30 22:21:43+00'::timestamptz
ON CONFLICT (idempotency_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2. v2 RPCs reading from cost_events
-- ─────────────────────────────────────────────────────────────────────

-- atlas_list_agents_v2 — same return shape as v1. cost_today_usd /
-- cost_7d / cost_mtd / day_usage_pct / month_usage_pct sum from
-- atlas_cost_events. cache_hit_rate_24h + token aggregates still read
-- atlas_agent_runs since the ledger doesn't store per-bucket token
-- counts (Phase 4 M4 deferred work — split into 4 events per call).

CREATE OR REPLACE FUNCTION public.atlas_list_agents_v2()
RETURNS TABLE(
  slug text, name text, type text, owner_project text, description text,
  schedule text, repo_url text, trigger_url text, enabled boolean,
  auto_disable_on_breach boolean, created_at timestamptz,
  last_run_at timestamptz, last_status text, last_items integer,
  last_duration_ms integer,
  runs_24h bigint, errors_24h bigint,
  cost_mtd numeric, cost_7d numeric,
  daily_budget_usd numeric, monthly_budget_usd numeric,
  cost_alert_email text, last_breach_level text, last_breach_alerted_at timestamptz,
  cost_today_usd numeric, day_usage_pct numeric, month_usage_pct numeric,
  cache_hit_rate_24h numeric, cache_read_tokens_24h bigint, input_tokens_24h bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (agent_slug)
      agent_slug, started_at, finished_at, status, items_processed
    FROM atlas_agent_runs
    ORDER BY agent_slug, started_at DESC
  ),
  today_usage AS (
    SELECT agent_slug, COALESCE(sum(total_cost_usd), 0) AS cost_today
    FROM atlas_cost_events
    WHERE ts >= date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
    GROUP BY agent_slug
  ),
  week_usage AS (
    SELECT agent_slug, COALESCE(sum(total_cost_usd), 0) AS cost_7d
    FROM atlas_cost_events
    WHERE ts > now() - interval '7 days'
    GROUP BY agent_slug
  ),
  month_usage AS (
    SELECT agent_slug, COALESCE(sum(total_cost_usd), 0) AS cost_mtd
    FROM atlas_cost_events
    WHERE ts >= date_trunc('month', now())
    GROUP BY agent_slug
  ),
  -- cache breakdown still comes from atlas_agent_runs (cost_events
  -- doesn't store per-bucket token counts today)
  cache_rollup AS (
    SELECT
      agent_slug,
      COALESCE(sum((metadata -> 'usage_breakdown' ->> 'cache_read_tokens')::bigint), 0) AS cache_read_tokens,
      COALESCE(sum(input_tokens), 0) AS input_tokens
    FROM atlas_agent_runs
    WHERE started_at > now() - interval '24 hours'
    GROUP BY agent_slug
  )
  SELECT
    a.slug, a.name, a.type, a.owner_project, a.description,
    a.schedule, a.repo_url, a.trigger_url, a.enabled, a.auto_disable_on_breach, a.created_at,
    l.started_at AS last_run_at, l.status AS last_status, l.items_processed AS last_items,
    CASE WHEN l.finished_at IS NOT NULL AND l.started_at IS NOT NULL
      THEN extract(epoch FROM (l.finished_at - l.started_at))::int * 1000
    END AS last_duration_ms,
    COALESCE((SELECT count(*) FROM atlas_agent_runs r
              WHERE r.agent_slug = a.slug AND r.started_at > now() - interval '24 hours'), 0) AS runs_24h,
    COALESCE((SELECT count(*) FROM atlas_agent_runs r
              WHERE r.agent_slug = a.slug AND r.started_at > now() - interval '24 hours' AND r.status = 'error'), 0) AS errors_24h,
    COALESCE(m.cost_mtd, 0) AS cost_mtd,
    COALESCE(w.cost_7d, 0) AS cost_7d,
    a.daily_budget_usd, a.monthly_budget_usd,
    a.cost_alert_email, a.last_breach_level, a.last_breach_alerted_at,
    COALESCE(t.cost_today, 0) AS cost_today_usd,
    CASE WHEN a.daily_budget_usd IS NOT NULL AND a.daily_budget_usd > 0
      THEN round((COALESCE(t.cost_today, 0) / a.daily_budget_usd * 100)::numeric, 2)
    END AS day_usage_pct,
    CASE WHEN a.monthly_budget_usd IS NOT NULL AND a.monthly_budget_usd > 0
      THEN round((COALESCE(m.cost_mtd, 0) / a.monthly_budget_usd * 100)::numeric, 2)
    END AS month_usage_pct,
    CASE WHEN c.input_tokens + c.cache_read_tokens > 0
      THEN round((c.cache_read_tokens::numeric / (c.input_tokens + c.cache_read_tokens) * 100), 2)
    END AS cache_hit_rate_24h,
    COALESCE(c.cache_read_tokens, 0) AS cache_read_tokens_24h,
    COALESCE(c.input_tokens, 0) AS input_tokens_24h
  FROM atlas_agents a
  LEFT JOIN latest      l ON l.agent_slug = a.slug
  LEFT JOIN today_usage t ON t.agent_slug = a.slug
  LEFT JOIN week_usage  w ON w.agent_slug = a.slug
  LEFT JOIN month_usage m ON m.agent_slug = a.slug
  LEFT JOIN cache_rollup c ON c.agent_slug = a.slug
  ORDER BY a.owner_project, a.slug;
$$;

REVOKE EXECUTE ON FUNCTION public.atlas_list_agents_v2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_list_agents_v2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.atlas_list_agents_v2() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_list_agents_v2() TO service_role;

COMMENT ON FUNCTION public.atlas_list_agents_v2() IS
  'Phase 6 cutover: same return shape as atlas_list_agents but reads cost_today_usd / cost_7d / cost_mtd / usage_pct from atlas_cost_events instead of atlas_agent_runs.cost_usd. Owner-only via RPC.';

-- atlas_fleet_stats_v2 — fleet-wide rollup. Same shape as v1.

CREATE OR REPLACE FUNCTION public.atlas_fleet_stats_v2()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'total_agents', (SELECT count(*) FROM atlas_agents WHERE enabled = true),
    'runs_24h',     (SELECT count(*) FROM atlas_agent_runs WHERE started_at > now() - interval '24 hours'),
    'errors_24h',   (SELECT count(*) FROM atlas_agent_runs WHERE started_at > now() - interval '24 hours' AND status = 'error'),
    'cost_mtd',     (SELECT COALESCE(sum(total_cost_usd), 0) FROM atlas_cost_events WHERE ts >= date_trunc('month', now()))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.atlas_fleet_stats_v2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_fleet_stats_v2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.atlas_fleet_stats_v2() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_fleet_stats_v2() TO service_role;

COMMENT ON FUNCTION public.atlas_fleet_stats_v2() IS
  'Phase 6 cutover: same shape as atlas_fleet_stats but cost_mtd sums atlas_cost_events instead of atlas_agent_runs.cost_usd.';

COMMIT;
