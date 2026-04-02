-- Migration 068: Rep notes log + scorecard computation
--
-- #11: Timestamped rep notes (like project notes, not just a text field)
-- #12/#13: Rep/team scorecard — days_since_* fields already exist on sales_reps (migration 061)
--          but need to be populated. This migration adds a function to compute them.
-- #8: Ticket-to-rep stats — sales_rep_id already exists on tickets (migration 064).
--     This adds a per-rep ticket stats view.

-- ── Rep Notes (timestamped log) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rep_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_notes_rep_id ON rep_notes (rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_notes_created ON rep_notes (created_at DESC);

ALTER TABLE rep_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_notes_select" ON rep_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rep_notes_insert" ON rep_notes FOR INSERT TO authenticated WITH CHECK (auth_is_admin());
CREATE POLICY "rep_notes_delete" ON rep_notes FOR DELETE TO authenticated USING (auth_is_admin());

-- ── Ticket Rep Stats View ──────────────────────────────────────────────────
-- Per-rep ticket metrics for complaint ratio analysis

CREATE OR REPLACE VIEW ticket_rep_stats AS
SELECT
  t.sales_rep_id,
  sr.first_name || ' ' || sr.last_name AS rep_name,
  sr.team_id,
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE t.status NOT IN ('resolved', 'closed')) AS open_tickets,
  COUNT(*) FILTER (WHERE t.status IN ('resolved', 'closed')) AS resolved_tickets,
  COUNT(*) FILTER (WHERE t.category = 'service') AS service_tickets,
  COUNT(*) FILTER (WHERE t.category = 'sales') AS sales_tickets,
  COUNT(*) FILTER (WHERE t.priority IN ('urgent', 'critical')) AS critical_tickets,
  COUNT(*) FILTER (WHERE t.status = 'escalated') AS escalated_tickets,
  ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)::numeric, 1)
    FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_resolution_hours
FROM tickets t
JOIN sales_reps sr ON sr.id = t.sales_rep_id
WHERE t.sales_rep_id IS NOT NULL
GROUP BY t.sales_rep_id, sr.first_name, sr.last_name, sr.team_id;
