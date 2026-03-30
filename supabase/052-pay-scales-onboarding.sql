-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 052: Pay Scale Stacks + Rep Onboarding
-- Sequifi-inspired commission system: named pay tiers, deductive override
-- calculation, sales team hierarchy, and rep onboarding document tracking.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- PAY SCALE STACKS
-- ═══════════════════════════════════════════════════════════

-- Named pay scale tiers (e.g., Consultant, Pro, Elite, Exclusive)
CREATE TABLE IF NOT EXISTS public.pay_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  per_watt_rate NUMERIC(10,4) NOT NULL,
  adder_percentage NUMERIC(6,2) NOT NULL DEFAULT 10,
  referral_bonus NUMERIC(10,2) NOT NULL DEFAULT 500,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default solar pay scales for MicroGRID
INSERT INTO pay_scales (name, description, per_watt_rate, adder_percentage, referral_bonus, sort_order, org_id) VALUES
  ('Consultant', 'Entry-level sales rep', 0.20, 10, 500, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('Pro', 'Experienced sales rep', 0.25, 10, 500, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('Elite', 'Top performer', 0.30, 10, 500, 3, 'a0000000-0000-0000-0000-000000000001'),
  ('Exclusive', 'Team leader / full stack', 0.40, 10, 500, 4, 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Override distribution config (percentage splits within a stack)
CREATE TABLE IF NOT EXISTS public.pay_distribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL,
  label TEXT NOT NULL,
  percentage NUMERIC(6,2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default distribution (from Zach's spreadsheet)
INSERT INTO pay_distribution (role_key, label, percentage, sort_order, org_id) VALUES
  ('energy_consultant', 'Energy Consultant', 40, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('energy_advisor', 'Energy Advisor', 40, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('incentive_budget', 'Incentive Budget', 2, 3, 'a0000000-0000-0000-0000-000000000001'),
  ('project_manager', 'Project Manager', 3, 4, 'a0000000-0000-0000-0000-000000000001'),
  ('assistant_manager', 'Assistant Manager', 3, 5, 'a0000000-0000-0000-0000-000000000001'),
  ('vp', 'VP', 3, 6, 'a0000000-0000-0000-0000-000000000001'),
  ('regional', 'Regional', 9, 7, 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SALES TEAMS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sales_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vp_user_id TEXT,
  vp_name TEXT,
  regional_user_id TEXT,
  regional_name TEXT,
  manager_user_id TEXT,
  manager_name TEXT,
  assistant_manager_user_id TEXT,
  assistant_manager_name TEXT,
  stack_per_watt NUMERIC(10,4) NOT NULL DEFAULT 0.40,
  active BOOLEAN DEFAULT true,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════
-- SALES REPS (PERSONNEL)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sales_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  auth_user_id UUID,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  team_id UUID REFERENCES public.sales_teams(id),
  pay_scale_id UUID REFERENCES public.pay_scales(id),
  role_key TEXT NOT NULL DEFAULT 'energy_consultant',
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (status IN ('onboarding', 'active', 'inactive', 'terminated')),
  split_percentage NUMERIC(6,2) DEFAULT 100,
  split_partner_id UUID REFERENCES public.sales_reps(id),
  notes TEXT,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════
-- REP ONBOARDING
-- ═══════════════════════════════════════════════════════════

-- Onboarding document requirements (admin-configurable)
CREATE TABLE IF NOT EXISTS public.onboarding_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default requirements
INSERT INTO onboarding_requirements (name, description, required, sort_order, org_id) VALUES
  ('Offer Letter', 'Employment offer letter — must be signed', true, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('W9', 'IRS W-9 form for tax reporting', true, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('Background Check Authorization', 'Authorization form for background check', true, 3, 'a0000000-0000-0000-0000-000000000001'),
  ('Driver License (Front)', 'Photo of front of driver license', true, 4, 'a0000000-0000-0000-0000-000000000001'),
  ('Driver License (Back)', 'Photo of back of driver license', true, 5, 'a0000000-0000-0000-0000-000000000001'),
  ('Profile Photo', 'Headshot photo for company directory', false, 6, 'a0000000-0000-0000-0000-000000000001'),
  ('Independent Contractor Agreement', 'IC agreement if applicable', false, 7, 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Per-rep document tracking
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES public.sales_reps(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.onboarding_requirements(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'uploaded', 'verified', 'rejected')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

-- pay_scales
CREATE INDEX IF NOT EXISTS idx_pay_scales_org_id ON pay_scales(org_id);
CREATE INDEX IF NOT EXISTS idx_pay_scales_active ON pay_scales(active);
CREATE INDEX IF NOT EXISTS idx_pay_scales_sort ON pay_scales(sort_order);

-- pay_distribution
CREATE INDEX IF NOT EXISTS idx_pay_distribution_org_id ON pay_distribution(org_id);
CREATE INDEX IF NOT EXISTS idx_pay_distribution_active ON pay_distribution(active);

-- sales_teams
CREATE INDEX IF NOT EXISTS idx_sales_teams_org_id ON sales_teams(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_teams_active ON sales_teams(active);

-- sales_reps
CREATE INDEX IF NOT EXISTS idx_sales_reps_team_id ON sales_reps(team_id);
CREATE INDEX IF NOT EXISTS idx_sales_reps_pay_scale_id ON sales_reps(pay_scale_id);
CREATE INDEX IF NOT EXISTS idx_sales_reps_email ON sales_reps(email);
CREATE INDEX IF NOT EXISTS idx_sales_reps_status ON sales_reps(status);
CREATE INDEX IF NOT EXISTS idx_sales_reps_org_id ON sales_reps(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_reps_user_id ON sales_reps(user_id);

-- onboarding_requirements
CREATE INDEX IF NOT EXISTS idx_onboarding_req_org_id ON onboarding_requirements(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_req_active ON onboarding_requirements(active);

-- onboarding_documents
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_rep_id ON onboarding_documents(rep_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_requirement_id ON onboarding_documents(requirement_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_status ON onboarding_documents(status);


-- ═══════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════════

-- Generic trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pay_scales_updated_at
  BEFORE UPDATE ON pay_scales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_teams_updated_at
  BEFORE UPDATE ON sales_teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_reps_updated_at
  BEFORE UPDATE ON sales_reps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_onboarding_documents_updated_at
  BEFORE UPDATE ON onboarding_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ═══════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

ALTER TABLE pay_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;

-- ── pay_scales: all authenticated read, admin write ──────────────────────────

CREATE POLICY pay_scales_select ON pay_scales
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY pay_scales_insert ON pay_scales
  FOR INSERT TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY pay_scales_update ON pay_scales
  FOR UPDATE TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

CREATE POLICY pay_scales_delete ON pay_scales
  FOR DELETE TO authenticated
  USING (auth_is_admin());

-- ── pay_distribution: all authenticated read, admin write ────────────────────

CREATE POLICY pay_distribution_select ON pay_distribution
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY pay_distribution_insert ON pay_distribution
  FOR INSERT TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY pay_distribution_update ON pay_distribution
  FOR UPDATE TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

CREATE POLICY pay_distribution_delete ON pay_distribution
  FOR DELETE TO authenticated
  USING (auth_is_admin());

-- ── sales_teams: org-scoped read, admin write ────────────────────────────────

CREATE POLICY sales_teams_select ON sales_teams
  FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

CREATE POLICY sales_teams_insert ON sales_teams
  FOR INSERT TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY sales_teams_update ON sales_teams
  FOR UPDATE TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

CREATE POLICY sales_teams_delete ON sales_teams
  FOR DELETE TO authenticated
  USING (auth_is_admin());

-- ── sales_reps: org-scoped read, manager+ write ─────────────────────────────

CREATE POLICY sales_reps_select ON sales_reps
  FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = ANY(auth_user_org_ids())
    OR auth_is_platform_user()
  );

CREATE POLICY sales_reps_insert ON sales_reps
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role IN ('manager', 'admin', 'super_admin')
    )
  );

CREATE POLICY sales_reps_update ON sales_reps
  FOR UPDATE TO authenticated
  USING (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role IN ('manager', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role IN ('manager', 'admin', 'super_admin')
    )
  );

CREATE POLICY sales_reps_delete ON sales_reps
  FOR DELETE TO authenticated
  USING (auth_is_admin());

-- ── onboarding_requirements: all read, admin write ──────────────────────────

CREATE POLICY onboarding_requirements_select ON onboarding_requirements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY onboarding_requirements_insert ON onboarding_requirements
  FOR INSERT TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY onboarding_requirements_update ON onboarding_requirements
  FOR UPDATE TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

CREATE POLICY onboarding_requirements_delete ON onboarding_requirements
  FOR DELETE TO authenticated
  USING (auth_is_admin());

-- ── onboarding_documents: org-scoped via rep, manager+ write ────────────────

CREATE POLICY onboarding_documents_select ON onboarding_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_reps sr
      WHERE sr.id = onboarding_documents.rep_id
      AND (
        sr.org_id IS NULL
        OR sr.org_id = ANY(auth_user_org_ids())
        OR auth_is_platform_user()
      )
    )
  );

CREATE POLICY onboarding_documents_insert ON onboarding_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role IN ('manager', 'admin', 'super_admin')
    )
  );

CREATE POLICY onboarding_documents_update ON onboarding_documents
  FOR UPDATE TO authenticated
  USING (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role IN ('manager', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role IN ('manager', 'admin', 'super_admin')
    )
  );

CREATE POLICY onboarding_documents_delete ON onboarding_documents
  FOR DELETE TO authenticated
  USING (auth_is_admin());
