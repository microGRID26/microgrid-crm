-- 028-edge-sync.sql — EDGE sync log for NOVA ↔ EDGE webhook integration
-- Tracks all webhook events (outbound to EDGE, inbound from EDGE)

CREATE TABLE IF NOT EXISTS public.edge_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'outbound' or 'inbound'
  payload JSONB,
  status TEXT DEFAULT 'sent', -- sent, delivered, failed
  response_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_edge_sync_project ON edge_sync_log(project_id);
CREATE INDEX idx_edge_sync_event ON edge_sync_log(event_type);
CREATE INDEX idx_edge_sync_created ON edge_sync_log(created_at DESC);

ALTER TABLE edge_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edge_sync_select" ON edge_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "edge_sync_insert" ON edge_sync_log FOR INSERT TO authenticated WITH CHECK (true);
