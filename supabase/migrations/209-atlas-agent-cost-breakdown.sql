-- Migration 209 — Phase 7: per-agent cost breakdown for /intel drawer
-- 2026-04-30 · ~/.claude/plans/tingly-honking-pearl.md Phase 7
--
-- Two jobs in one BEGIN/COMMIT:
--   1. UPDATE  atlas_agent_cost_daily — switch source from
--              atlas_agent_runs.cost_usd to SUM(atlas_cost_events.total_cost_usd).
--              Same return shape; BurnChart on /intel drawer continues to work
--              but now reflects all 5 vendors, not just Anthropic.
--   2. NEW     atlas_agent_cost_breakdown(p_slug, p_days) returning the
--              per-vendor + per-day breakdown the new AgentCostBreakdown
--              component needs. Owner-only via SECURITY DEFINER + REVOKE/GRANT.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Update atlas_agent_cost_daily to read from atlas_cost_events.
-- ─────────────────────────────────────────────────────────────────────
-- run_count still comes from atlas_agent_runs — cost_events doesn't have
-- a 1:1 "run" concept (multiple events per run post-Phase-5). Hybrid:
-- spend from ledger, run count from runs. Both sliced by the same
-- Chicago-day window for visual consistency.

CREATE OR REPLACE FUNCTION public.atlas_agent_cost_daily(p_slug text, p_days integer DEFAULT 7)
RETURNS TABLE(day date, total_usd numeric, run_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH series AS (
    SELECT (current_date - (n || ' days')::interval)::date AS day
    FROM generate_series(0, GREATEST(p_days, 1) - 1) n
  ),
  daily_spend AS (
    SELECT
      (ts AT TIME ZONE 'America/Chicago')::date AS day,
      COALESCE(sum(total_cost_usd), 0) AS total_usd
    FROM atlas_cost_events
    WHERE agent_slug = p_slug
      AND ts >= (current_date - (p_days - 1 || ' days')::interval) AT TIME ZONE 'America/Chicago'
    GROUP BY 1
  ),
  daily_runs AS (
    SELECT
      (started_at AT TIME ZONE 'America/Chicago')::date AS day,
      count(*) AS run_count
    FROM atlas_agent_runs
    WHERE agent_slug = p_slug
      AND started_at >= (current_date - (p_days - 1 || ' days')::interval) AT TIME ZONE 'America/Chicago'
    GROUP BY 1
  )
  SELECT
    s.day,
    COALESCE(ds.total_usd, 0) AS total_usd,
    COALESCE(dr.run_count, 0) AS run_count
  FROM series s
  LEFT JOIN daily_spend ds ON ds.day = s.day
  LEFT JOIN daily_runs  dr ON dr.day = s.day
  ORDER BY s.day ASC;
$$;

-- Grants are unchanged from prior atlas_agent_cost_daily, but re-asserted
-- defensively in case of drift.
REVOKE EXECUTE ON FUNCTION public.atlas_agent_cost_daily(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_agent_cost_daily(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atlas_agent_cost_daily(text, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.atlas_agent_cost_daily(text, integer) TO service_role;

COMMENT ON FUNCTION public.atlas_agent_cost_daily(text, integer) IS
  'Last N days of spend for one agent. Phase 7 cutover (2026-04-30) — total_usd now sums atlas_cost_events.total_cost_usd (all vendors), not atlas_agent_runs.cost_usd (Anthropic only). run_count still from atlas_agent_runs. Owner-only via service_role.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. NEW atlas_agent_cost_breakdown — vendor + per-day stack.
-- ─────────────────────────────────────────────────────────────────────
-- Returns one jsonb document so the API route can pass it through to
-- the React component without N+1 queries. Shape:
--
--   {
--     "totals":   { "total_7d": numeric, "total_mtd": numeric, "run_count_7d": bigint },
--     "vendors":  [ { "vendor": text, "total_7d": numeric, "total_mtd": numeric }, ... ],
--     "days":     [ { "day": date, "total": numeric, "per_vendor": { "<vendor>": numeric, ... } }, ... ]
--   }

CREATE OR REPLACE FUNCTION public.atlas_agent_cost_breakdown(p_slug text, p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH window_start AS (
    SELECT
      ((current_date - (GREATEST(p_days, 1) - 1 || ' days')::interval) AT TIME ZONE 'America/Chicago')::timestamptz AS day_floor,
      -- R1 H1 fix: month_floor MUST anchor to Chicago to match day_floor
      -- and atlas_agent_cost_daily semantics. date_trunc on UTC `now()`
      -- mis-attributes ~5 hours around each month boundary (UTC midnight
      -- vs Chicago midnight).
      (date_trunc('month', (now() AT TIME ZONE 'America/Chicago'))) AT TIME ZONE 'America/Chicago' AS month_floor
  ),
  events_window AS (
    SELECT e.vendor, e.ts, e.total_cost_usd
    FROM atlas_cost_events e, window_start w
    WHERE e.agent_slug = p_slug
      AND e.ts >= LEAST(w.day_floor, w.month_floor)
  ),
  vendors_agg AS (
    SELECT
      vendor,
      COALESCE(sum(total_cost_usd) FILTER (WHERE ts >= (SELECT day_floor FROM window_start)), 0) AS total_7d,
      COALESCE(sum(total_cost_usd) FILTER (WHERE ts >= (SELECT month_floor FROM window_start)), 0) AS total_mtd
    FROM events_window
    GROUP BY vendor
  ),
  series AS (
    SELECT (current_date - (n || ' days')::interval)::date AS day
    FROM generate_series(0, GREATEST(p_days, 1) - 1) n
  ),
  per_day_vendor AS (
    SELECT
      (e.ts AT TIME ZONE 'America/Chicago')::date AS day,
      e.vendor,
      COALESCE(sum(e.total_cost_usd), 0) AS total
    FROM events_window e
    WHERE e.ts >= (SELECT day_floor FROM window_start)
    GROUP BY 1, 2
  ),
  per_day AS (
    SELECT
      s.day,
      COALESCE((SELECT sum(total) FROM per_day_vendor pdv WHERE pdv.day = s.day), 0) AS total,
      COALESCE(
        (SELECT jsonb_object_agg(pdv.vendor, pdv.total)
         FROM per_day_vendor pdv WHERE pdv.day = s.day),
        '{}'::jsonb
      ) AS per_vendor
    FROM series s
  ),
  totals_agg AS (
    SELECT
      COALESCE((SELECT sum(total_cost_usd) FROM events_window WHERE ts >= (SELECT day_floor FROM window_start)), 0) AS total_7d,
      COALESCE((SELECT sum(total_cost_usd) FROM events_window WHERE ts >= (SELECT month_floor FROM window_start)), 0) AS total_mtd,
      -- Renamed from run_count_7d (R1 M2 fix): the value is computed
      -- against day_floor which honors the caller's p_days param, so the
      -- "_7d" suffix was misleading at p_days != 7.
      COALESCE((SELECT count(*) FROM atlas_agent_runs r
                WHERE r.agent_slug = p_slug
                  AND r.started_at >= (SELECT day_floor FROM window_start)), 0) AS run_count_window
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(totals_agg) FROM totals_agg),
    'vendors', COALESCE(
      (SELECT jsonb_agg(to_jsonb(va) ORDER BY va.total_mtd DESC) FROM vendors_agg va),
      '[]'::jsonb
    ),
    'days', COALESCE(
      (SELECT jsonb_agg(to_jsonb(pd) ORDER BY pd.day ASC) FROM per_day pd),
      '[]'::jsonb
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.atlas_agent_cost_breakdown(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_agent_cost_breakdown(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atlas_agent_cost_breakdown(text, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.atlas_agent_cost_breakdown(text, integer) TO service_role;

COMMENT ON FUNCTION public.atlas_agent_cost_breakdown(text, integer) IS
  'Per-agent cost breakdown for /intel drawer (Phase 7). Returns jsonb {totals, vendors[], days[]} sourced from atlas_cost_events. Owner-only via service_role.';

COMMIT;
