-- Migration tracking table
-- Run this ONCE to create the log, then use it to track all future migrations

CREATE TABLE IF NOT EXISTS public.migrations_log (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT
);

-- Record all migrations that have already been applied
INSERT INTO migrations_log (name, description) VALUES
  ('001_rls_migration', 'RLS policies, auth functions, cascade trigger, indexes'),
  ('002_funding_migration', 'project_funding notes/status columns, nonfunded_codes table with 218 codes'),
  ('003_perf_indexes', 'Indexes on stage, disposition, financier, schedule.date, service_calls.status'),
  ('004_add_zip_column', 'Add zip column to projects'),
  ('005_add_super_admin', 'Add super_admin column to users, set gkelsch as super admin'),
  ('006_ahj_dedup', 'Merge 183 duplicate AHJ records (Unincorporated X County → X County)'),
  ('007_utility_dedup', 'Merge 4 duplicate utility records (Centerpoint, Brady, El Paso, Xcel)')
ON CONFLICT (name) DO NOTHING;
