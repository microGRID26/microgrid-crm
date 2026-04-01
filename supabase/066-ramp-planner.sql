-- Migration 066: Install Ramp-Up Planner
-- Scheduling, readiness tracking, and route optimization for install crews

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PROJECT READINESS — checklist per project for install readiness
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  equipment_ready BOOLEAN DEFAULT false,
  homeowner_confirmed BOOLEAN DEFAULT false,
  permit_clear BOOLEAN DEFAULT false,
  utility_approved BOOLEAN DEFAULT false,
  hoa_approved BOOLEAN DEFAULT false,
  redesign_complete BOOLEAN DEFAULT false,
  crew_available BOOLEAN DEFAULT true,
  blocker_notes TEXT,
  readiness_score INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_readiness_project ON project_readiness(project_id);
CREATE INDEX IF NOT EXISTS idx_readiness_score ON project_readiness(readiness_score DESC);

CREATE TRIGGER project_readiness_updated_at
  BEFORE UPDATE ON project_readiness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_readiness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readiness_select" ON project_readiness FOR SELECT TO authenticated USING (true);
CREATE POLICY "readiness_insert" ON project_readiness FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "readiness_update" ON project_readiness FOR UPDATE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RAMP SCHEDULE — crew install assignments by week
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ramp_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  crew_id TEXT,
  crew_name TEXT,
  scheduled_week DATE NOT NULL,        -- Monday of the scheduled week
  scheduled_day DATE,                  -- Actual install date (nullable until confirmed)
  slot INTEGER DEFAULT 1 CHECK (slot IN (1, 2)),  -- 1st or 2nd job of the week
  status TEXT NOT NULL DEFAULT 'planned',  -- planned, confirmed, in_progress, completed, cancelled, rescheduled
  priority_score NUMERIC(6,2) DEFAULT 0,
  drive_minutes INTEGER,               -- Estimated drive time from warehouse or previous job
  distance_miles NUMERIC(6,1),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ramp_schedule_week ON ramp_schedule(scheduled_week);
CREATE INDEX IF NOT EXISTS idx_ramp_schedule_crew ON ramp_schedule(crew_id, scheduled_week);
CREATE INDEX IF NOT EXISTS idx_ramp_schedule_project ON ramp_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_ramp_schedule_status ON ramp_schedule(status);

CREATE TRIGGER ramp_schedule_updated_at
  BEFORE UPDATE ON ramp_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ramp_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ramp_select" ON ramp_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "ramp_insert" ON ramp_schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ramp_update" ON ramp_schedule FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ramp_delete" ON ramp_schedule FOR DELETE TO authenticated USING (auth_is_admin());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RAMP CONFIG — planner settings
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ramp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ramp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ramp_config_select" ON ramp_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "ramp_config_write" ON ramp_config FOR INSERT TO authenticated WITH CHECK (auth_is_admin());
CREATE POLICY "ramp_config_update" ON ramp_config FOR UPDATE TO authenticated USING (auth_is_admin());

INSERT INTO ramp_config (config_key, value, description) VALUES
  ('warehouse_lat', '29.9902', 'Warehouse latitude'),
  ('warehouse_lng', '-95.4152', 'Warehouse longitude'),
  ('warehouse_address', '600 Northpark Central Dr, Suite 140, Houston TX 77073', 'Warehouse address'),
  ('crews_count', '2', 'Number of active install crews'),
  ('installs_per_crew_per_week', '2', 'Target installs per crew per week'),
  ('weight_readiness', '0.40', 'Priority score weight for readiness'),
  ('weight_proximity', '0.30', 'Priority score weight for proximity to warehouse'),
  ('weight_cluster', '0.15', 'Priority score weight for geographic clustering'),
  ('weight_value', '0.15', 'Priority score weight for contract value'),
  ('primary_market', 'Houston', 'Primary market focus'),
  ('secondary_market', 'DFW', 'Secondary market focus')
ON CONFLICT (config_key) DO NOTHING;
