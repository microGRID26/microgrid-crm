-- 048-commissions.sql — Commission rate configuration and commission records
-- Solar: system watts × per-watt rate by role
-- Adder: percentage of adder revenue
-- Referral: flat bonus per referral
-- All rates admin-configurable, org-scoped

-- ── Commission Rates (admin-managed) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('per_watt', 'percentage', 'flat')),
  rate NUMERIC(10,4) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default rates
INSERT INTO commission_rates (role_key, label, rate_type, rate, description, sort_order) VALUES
  ('sales_rep', 'Sales Rep', 'per_watt', 0.50, 'Per-watt commission for sales representatives', 1),
  ('closer', 'Closer', 'per_watt', 0.25, 'Per-watt commission for closers', 2),
  ('team_leader', 'Team Leader Override', 'per_watt', 0.10, 'Per-watt override for team leaders', 3),
  ('manager', 'Manager Override', 'per_watt', 0.05, 'Per-watt override for managers', 4),
  ('adder', 'Adder Commission', 'percentage', 10.00, 'Percentage of adder revenue', 5),
  ('referral', 'Referral Bonus', 'flat', 500.00, 'Flat bonus per referral resulting in signed contract', 6)
ON CONFLICT (role_key) DO NOTHING;

-- ── Commission Records (per project per role) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT,
  user_name TEXT,
  role_key TEXT NOT NULL,
  system_watts NUMERIC(10,2),
  rate NUMERIC(10,4) NOT NULL,
  adder_revenue NUMERIC(12,2),
  referral_count INTEGER DEFAULT 0,
  solar_commission NUMERIC(12,2) DEFAULT 0,
  adder_commission NUMERIC(12,2) DEFAULT 0,
  referral_commission NUMERIC(12,2) DEFAULT 0,
  total_commission NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  milestone TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_comm_rates_role ON commission_rates(role_key);
CREATE INDEX IF NOT EXISTS idx_comm_rates_org ON commission_rates(org_id);
CREATE INDEX IF NOT EXISTS idx_comm_records_project ON commission_records(project_id);
CREATE INDEX IF NOT EXISTS idx_comm_records_user ON commission_records(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_records_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_comm_records_org ON commission_records(org_id);
CREATE INDEX IF NOT EXISTS idx_comm_records_created ON commission_records(created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;

-- Rates: all authenticated read, admin write
CREATE POLICY comm_rates_select ON commission_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY comm_rates_insert ON commission_rates FOR INSERT TO authenticated WITH CHECK (auth_is_admin());
CREATE POLICY comm_rates_update ON commission_rates FOR UPDATE TO authenticated USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY comm_rates_delete ON commission_rates FOR DELETE TO authenticated USING (auth_is_admin());

-- Records: org-scoped read, org-scoped write (manager+ enforced in app layer)
CREATE POLICY comm_records_select ON commission_records FOR SELECT TO authenticated
  USING (
    org_id = ANY(auth_user_org_ids())
    OR org_id IS NULL
    OR auth_is_platform_user()
  );

CREATE POLICY comm_records_insert ON commission_records FOR INSERT TO authenticated
  WITH CHECK (
    org_id = ANY(auth_user_org_ids())
    OR org_id IS NULL
    OR auth_is_platform_user()
  );

CREATE POLICY comm_records_update ON commission_records FOR UPDATE TO authenticated
  USING (
    org_id = ANY(auth_user_org_ids())
    OR org_id IS NULL
    OR auth_is_platform_user()
  )
  WITH CHECK (
    org_id = ANY(auth_user_org_ids())
    OR org_id IS NULL
    OR auth_is_platform_user()
  );

CREATE POLICY comm_records_delete ON commission_records FOR DELETE TO authenticated
  USING (auth_is_platform_user() OR auth_is_super_admin());

-- ── Updated_at Triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.comm_rates_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS comm_rates_updated_at_trigger ON commission_rates;
CREATE TRIGGER comm_rates_updated_at_trigger BEFORE UPDATE ON commission_rates FOR EACH ROW EXECUTE FUNCTION public.comm_rates_updated_at();

CREATE OR REPLACE FUNCTION public.comm_records_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS comm_records_updated_at_trigger ON commission_records;
CREATE TRIGGER comm_records_updated_at_trigger BEFORE UPDATE ON commission_records FOR EACH ROW EXECUTE FUNCTION public.comm_records_updated_at();
