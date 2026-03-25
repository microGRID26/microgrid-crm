-- Migration 024: Equipment catalog table
-- Stores equipment items (modules, inverters, batteries, etc.) for autocomplete dropdowns

CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  category TEXT NOT NULL, -- 'module', 'inverter', 'battery', 'optimizer', 'racking', 'electrical'
  watts INTEGER, -- panel wattage or inverter/battery capacity
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_equipment_name ON equipment USING GIN(name gin_trgm_ops);
CREATE INDEX idx_equipment_active ON equipment(active) WHERE active = true;

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_select" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_insert" ON equipment FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "equipment_update" ON equipment FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "equipment_delete" ON equipment FOR DELETE TO authenticated USING (auth_is_super_admin());
