-- Migration 056: Welcome call log table for SubHub VWC webhook data
-- Phase 1: Raw payload storage for inspection and backfill
-- Phase 2: Once payload shape is known, add structured columns

CREATE TABLE IF NOT EXISTS welcome_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT,                    -- SubHub ID (subhub_id, proposal_id, etc.)
  customer_name TEXT,                -- Customer name from payload
  event_type TEXT DEFAULT 'unknown', -- Survey type / event name
  payload JSONB NOT NULL,            -- Full raw webhook payload
  project_id TEXT,                   -- MicroGRID project ID (matched after receipt)
  processed BOOLEAN DEFAULT false,   -- Whether data has been extracted to structured storage
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS idx_wcl_source_id ON welcome_call_logs (source_id);
CREATE INDEX IF NOT EXISTS idx_wcl_project_id ON welcome_call_logs (project_id);
CREATE INDEX IF NOT EXISTS idx_wcl_processed ON welcome_call_logs (processed);
CREATE INDEX IF NOT EXISTS idx_wcl_received ON welcome_call_logs (received_at DESC);

-- RLS
ALTER TABLE welcome_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wcl_read" ON welcome_call_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wcl_insert" ON welcome_call_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "wcl_admin_update" ON welcome_call_logs
  FOR UPDATE TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());
