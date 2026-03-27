-- 035-fleet-management.sql
-- Fleet/vehicle management for crew trucks and company vehicles

-- ── Vehicles table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number  TEXT NOT NULL,
  vin             TEXT,
  year            INTEGER,
  make            TEXT,
  model           TEXT,
  license_plate   TEXT,
  color           TEXT,
  assigned_crew   TEXT,
  assigned_driver TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  odometer        INTEGER,
  insurance_expiry     DATE,
  registration_expiry  DATE,
  last_inspection_date DATE,
  next_inspection_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT vehicles_status_check CHECK (status IN ('active', 'maintenance', 'out_of_service', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles (status);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_crew ON vehicles (assigned_crew);

-- RLS: SELECT/INSERT/UPDATE for authenticated, DELETE for super_admin
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_select ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY vehicles_insert ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vehicles_update ON vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY vehicles_delete ON vehicles FOR DELETE TO authenticated USING (auth_is_super_admin());


-- ── Vehicle Maintenance table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  description       TEXT,
  date              DATE,
  odometer          INTEGER,
  cost              NUMERIC,
  vendor            TEXT,
  next_due_date     DATE,
  next_due_odometer INTEGER,
  performed_by      TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT vm_type_check CHECK (type IN ('oil_change', 'tire_rotation', 'brake_service', 'inspection', 'repair', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_vm_vehicle_id ON vehicle_maintenance (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vm_date ON vehicle_maintenance (date);
CREATE INDEX IF NOT EXISTS idx_vm_type ON vehicle_maintenance (type);

-- RLS: SELECT/INSERT/UPDATE for authenticated
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY vm_select ON vehicle_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY vm_insert ON vehicle_maintenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vm_update ON vehicle_maintenance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
