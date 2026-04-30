-- Migration 206 — atlas_cost_events R1 audit fixes
-- 2026-04-30 · ~/.claude/plans/tingly-honking-pearl.md Phases 0-4 R1 audit
--
-- Round-table audit on Phases 0-4 surfaced the following load-bearing
-- gaps in migration 205 + the RPC. This migration ALTERS the schema
-- and replaces the RPC body — no data movement, no downtime.
--
-- Fixes:
--   H3 (red-teamer)   ON CONFLICT DO NOTHING made backfill corrections
--                     impossible. Reworked to allow a backfill row to
--                     supersede a prior live row via per-column CASE WHEN.
--   M1 (red-teamer)   No upper bound on unit_cost_usd → a divide-by-small
--                     bug could log $1M/event. Added CHECK <= 1000.
--   M2 (red-teamer)   `vendor` was free text → typo 'anthopic' silently
--                     fragments rollups. Added enum-shaped CHECK matching
--                     lib/cost-tracking/types.ts CostEventVendor.
--   L2 (red-teamer)   pg_column_size measured TOAST-compressed bytes;
--                     a repetitive 200KB blob could pass the 8KB cap.
--                     Switched to octet_length(metadata::text) for
--                     logical-size enforcement.
--
-- Applied directly via Supabase MCP on hzymsezqfxzpbcqryeim (MicroGRID
-- prod). Filed here for archival + replay-onto-branch.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- M1 + M2 + L2: tighten CHECK constraints on the table.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.atlas_cost_events
  ADD CONSTRAINT atlas_cost_events_unit_cost_usd_max_chk
    CHECK (unit_cost_usd <= 1000);

ALTER TABLE public.atlas_cost_events
  ADD CONSTRAINT atlas_cost_events_vendor_enum_chk
    CHECK (vendor IN (
      'anthropic',
      'resend',
      'screenshotone',
      'vercel',
      'supabase',
      'gemini',
      'openai',
      'twilio',
      'llamaparse',
      'github',
      'posthog',
      'sentry'
    ));

-- L2 — replace pg_column_size (compressed) with octet_length on the
-- JSON text representation. pg_column_size on a highly-repetitive blob
-- can be <8KB after TOAST compression while the logical payload is
-- 200KB+. octet_length(metadata::text) measures the rendered JSON
-- bytes, which is what we actually want to cap.
ALTER TABLE public.atlas_cost_events
  DROP CONSTRAINT IF EXISTS atlas_cost_events_metadata_check;

ALTER TABLE public.atlas_cost_events
  ADD CONSTRAINT atlas_cost_events_metadata_size_chk
    CHECK (metadata IS NULL OR octet_length(metadata::text) < 8192);

-- ─────────────────────────────────────────────────────────────────────
-- H3: rework atlas_log_cost_event so backfills can correct live rows.
-- ─────────────────────────────────────────────────────────────────────
-- Semantics (decided 2026-04-30):
--   live  → live retry      → no-op   (dedup; existing behavior)
--   live  → backfill         → UPDATE  (backfill is canonical correction)
--   backfill → live          → no-op   (backfill data presumed correct)
--   backfill → backfill retry → no-op  (dedup)
--
-- Implementation: ON CONFLICT DO UPDATE always fires (so RETURNING id
-- works), but each SET clause uses CASE WHEN to only swap values when
-- the new row is a backfill superseding a live row. Otherwise the
-- existing values are written back to themselves (true no-op).

CREATE OR REPLACE FUNCTION public.atlas_log_cost_event(
  p_agent_slug      text,
  p_vendor          text,
  p_units           numeric,
  p_unit_cost_usd   numeric,
  p_unit_label      text DEFAULT NULL,
  p_run_id          bigint DEFAULT NULL,
  p_metadata        jsonb DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_pricing_version text DEFAULT NULL,
  p_source          text DEFAULT 'live'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF p_agent_slug IS NULL OR length(p_agent_slug) = 0 THEN
    RAISE EXCEPTION 'agent_slug must be non-empty';
  END IF;
  IF p_units < 0 THEN RAISE EXCEPTION 'units must be >= 0'; END IF;
  IF p_unit_cost_usd < 0 THEN RAISE EXCEPTION 'unit_cost_usd must be >= 0'; END IF;
  IF p_source NOT IN ('live','backfill') THEN
    RAISE EXCEPTION 'source must be live or backfill';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.atlas_cost_events (
      agent_slug, vendor, units, unit_label, unit_cost_usd,
      pricing_version, run_id, source, idempotency_key, metadata
    )
    VALUES (
      p_agent_slug, p_vendor, p_units, p_unit_label, p_unit_cost_usd,
      p_pricing_version, p_run_id, p_source, p_idempotency_key, p_metadata
    )
    ON CONFLICT (idempotency_key) DO UPDATE
      SET
        -- Only swap when a backfill is correcting a live row. Else
        -- write the existing value back (no-op).
        units = CASE
          WHEN EXCLUDED.source = 'backfill' AND atlas_cost_events.source = 'live'
            THEN EXCLUDED.units
          ELSE atlas_cost_events.units
        END,
        unit_cost_usd = CASE
          WHEN EXCLUDED.source = 'backfill' AND atlas_cost_events.source = 'live'
            THEN EXCLUDED.unit_cost_usd
          ELSE atlas_cost_events.unit_cost_usd
        END,
        unit_label = CASE
          WHEN EXCLUDED.source = 'backfill' AND atlas_cost_events.source = 'live'
            THEN EXCLUDED.unit_label
          ELSE atlas_cost_events.unit_label
        END,
        pricing_version = CASE
          WHEN EXCLUDED.source = 'backfill' AND atlas_cost_events.source = 'live'
            THEN EXCLUDED.pricing_version
          ELSE atlas_cost_events.pricing_version
        END,
        metadata = CASE
          WHEN EXCLUDED.source = 'backfill' AND atlas_cost_events.source = 'live'
            THEN EXCLUDED.metadata
          ELSE atlas_cost_events.metadata
        END,
        source = CASE
          WHEN EXCLUDED.source = 'backfill' AND atlas_cost_events.source = 'live'
            THEN 'backfill'
          ELSE atlas_cost_events.source
        END
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.atlas_cost_events (
    agent_slug, vendor, units, unit_label, unit_cost_usd,
    pricing_version, run_id, source, idempotency_key, metadata
  )
  VALUES (
    p_agent_slug, p_vendor, p_units, p_unit_label, p_unit_cost_usd,
    p_pricing_version, p_run_id, p_source, NULL, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grants are unchanged from migration 205, but re-asserted here for
-- defensive consistency in case 205 had drift.
REVOKE EXECUTE ON FUNCTION public.atlas_log_cost_event(text, text, numeric, numeric, text, bigint, jsonb, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_log_cost_event(text, text, numeric, numeric, text, bigint, jsonb, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atlas_log_cost_event(text, text, numeric, numeric, text, bigint, jsonb, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_log_cost_event(text, text, numeric, numeric, text, bigint, jsonb, text, text, text) TO service_role;

COMMENT ON FUNCTION public.atlas_log_cost_event(text, text, numeric, numeric, text, bigint, jsonb, text, text, text) IS
  'Insert a cost event. Idempotent on idempotency_key (race-free via ON CONFLICT). Backfill rows supersede live rows with the same key (Phase 4 R1 H3 fix); same-source retries no-op. Server-only via REVOKE/GRANT.';

COMMIT;
