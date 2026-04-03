-- Job costing schema for analytics
-- These tables will be populated from work order completion flow

-- Labor cost tracking per project
CREATE TABLE IF NOT EXISTS job_cost_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  work_order_id UUID,
  crew_id TEXT,
  worker_name TEXT,
  hours NUMERIC(6,2) NOT NULL,
  hourly_rate NUMERIC(8,2) NOT NULL,
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  work_date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'install',
  notes TEXT,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Material cost tracking per project
CREATE TABLE IF NOT EXISTS job_cost_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC(8,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  vendor TEXT,
  po_number TEXT,
  notes TEXT,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permit and overhead costs per project
CREATE TABLE IF NOT EXISTS job_cost_overhead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  vendor TEXT,
  notes TEXT,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crew hourly rate configuration
CREATE TABLE IF NOT EXISTS crew_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id TEXT NOT NULL,
  crew_name TEXT,
  role TEXT NOT NULL DEFAULT 'installer',
  hourly_rate NUMERIC(8,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN DEFAULT true,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE job_cost_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_overhead ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_rates ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users)
CREATE POLICY "job_cost_labor_read" ON job_cost_labor FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_cost_materials_read" ON job_cost_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_cost_overhead_read" ON job_cost_overhead FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew_rates_read" ON crew_rates FOR SELECT TO authenticated USING (true);

-- Write policies (admin only)
CREATE POLICY "job_cost_labor_write" ON job_cost_labor FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "job_cost_materials_write" ON job_cost_materials FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "job_cost_overhead_write" ON job_cost_overhead FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
CREATE POLICY "crew_rates_write" ON crew_rates FOR ALL TO authenticated USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());
