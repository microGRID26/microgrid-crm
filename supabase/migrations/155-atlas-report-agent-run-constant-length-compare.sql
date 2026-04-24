-- Migration 155 — Harden atlas_report_agent_run secret compare.
--
-- Root cause
-- ----------
-- Today's implementation compares the plaintext secret with plpgsql `<>` on
-- text:
--
--   if v_secret is null or v_secret <> p_secret then
--     raise exception 'Invalid fleet report secret' using errcode = '42501';
--   end if;
--
-- plpgsql `<>` on text is not constant-time. It can short-circuit on first
-- byte mismatch. Over the network this is essentially unexploitable (jitter
-- dominates sub-microsecond timing differences) but it's an audit smell on
-- a SECURITY DEFINER function exposed to anon that takes a secret argument.
--
-- Fix
-- ---
-- Hash both the stored secret and the provided secret to fixed-length
-- sha256 digests (32 bytes each) before comparing. This achieves two things:
--
--   1. Compare operates on byte-arrays of identical length, so any residual
--      short-circuit timing leak reveals at most one byte of the DIGEST (not
--      the secret). sha256 is one-way, so knowing a digest byte gives an
--      attacker zero information about the secret itself.
--   2. `digest(coalesce(v_secret, 'invalid'), 'sha256')` runs even when
--      v_secret is NULL, eliminating the "does the row exist" timing
--      side-channel between NULL and wrong-secret paths.
--
-- This is the best we can do in plpgsql without a constant-time XOR loop,
-- and it matches the defense-in-depth pattern used at the application
-- layer (crypto.timingSafeEqual in /api/cron/partner-logs-retention).
--
-- Functional equivalence
-- ----------------------
-- Input/output contract is unchanged. A valid secret still returns the new
-- run id. An invalid secret still raises `42501`. All existing callers
-- (lib/hq-fleet.ts across MG + ATLAS-HQ + EDGE-MODEL) continue to work
-- without code changes because they still send the plaintext secret.
--
-- The pgcrypto `digest()` function lives in the `extensions` schema on
-- Supabase. We keep search_path as the minimal `public, pg_temp` pair
-- (matches the hardening convention across atlas_* functions) and
-- fully-qualify the two `extensions.digest(...)` calls instead.
--
-- Hook notes (~/.claude/hooks/atlas-fn-grant-guard.py):
--   - atlas_* functions must REVOKE from PUBLIC and explicitly GRANT to
--     whichever roles actually need to call them (anon + authenticated for
--     this one because cross-project cron workers use publishable keys).
--   - SECURITY DEFINER functions need SET search_path. Kept as
--     `public, pg_temp` to match the original + every peer.

CREATE OR REPLACE FUNCTION public.atlas_report_agent_run(
  p_secret text,
  p_slug text,
  p_status text,
  p_started_at timestamp with time zone,
  p_finished_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_items_processed integer DEFAULT NULL::integer,
  p_input_tokens integer DEFAULT NULL::integer,
  p_output_tokens integer DEFAULT NULL::integer,
  p_cost_usd numeric DEFAULT NULL::numeric,
  p_output_summary text DEFAULT NULL::text,
  p_error_message text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_secret text;
  v_run_id bigint;
begin
  select value into v_secret from atlas_fleet_config where key = 'report_secret';

  -- Hash both sides to fixed-length digests before comparing. Even when
  -- v_secret is NULL we still run digest() on a placeholder so the rejection
  -- paths take the same number of hashing ops as the success path.
  if extensions.digest(coalesce(v_secret, 'invalid-no-config-row'), 'sha256')
     <> extensions.digest(p_secret, 'sha256') then
    raise exception 'Invalid fleet report secret' using errcode = '42501';
  end if;

  if not exists (select 1 from atlas_agents where slug = p_slug) then
    raise exception 'Unknown agent slug: %', p_slug using errcode = '23503';
  end if;

  insert into atlas_agent_runs (
    agent_slug, started_at, finished_at, status,
    items_processed, input_tokens, output_tokens, cost_usd,
    output_summary, error_message, metadata
  ) values (
    p_slug, p_started_at, p_finished_at, p_status,
    p_items_processed, p_input_tokens, p_output_tokens, p_cost_usd,
    p_output_summary, p_error_message, p_metadata
  ) returning id into v_run_id;

  return v_run_id;
end;
$function$;

-- Lock down grants: default CREATE FUNCTION grants EXECUTE to PUBLIC, which
-- inherits to anon. Revoke and restore only the two roles that legitimately
-- call this (anon + authenticated for publishable-key cron workers across
-- MG + ATLAS-HQ + EDGE-MODEL).
REVOKE EXECUTE ON FUNCTION public.atlas_report_agent_run(
  text, text, text, timestamp with time zone, timestamp with time zone,
  integer, integer, integer, numeric, text, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.atlas_report_agent_run(
  text, text, text, timestamp with time zone, timestamp with time zone,
  integer, integer, integer, numeric, text, text, jsonb
) TO anon, authenticated;
