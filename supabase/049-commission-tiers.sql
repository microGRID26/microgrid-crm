-- 049-commission-tiers.sql — Commission tiers, geo modifiers, and team hierarchy
-- Extends the flat commission_rates system with:
--   Volume tiers: hit X deals or X watts in a period → rate increases
--   Geo modifiers: market/territory/state rate multipliers
--   Team hierarchy: multi-level override chain (rep → closer → team lead → manager → regional)

-- ── Commission Tiers (volume-based rate increases) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id UUID NOT NULL REFERENCES public.commission_rates(id) ON DELETE CASCADE,
  min_deals INTEGER,
  max_deals INTEGER,
  min_watts NUMERIC(12,2),
  max_watts NUMERIC(12,2),
  rate NUMERIC(10,4) NOT NULL,
  label TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Geo Modifiers (market-specific rate adjustments) ───────────────────────

CREATE TABLE IF NOT EXISTS public.commission_geo_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT,
  city TEXT,
  region TEXT,
  modifier NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  label TEXT,
  active BOOLEAN DEFAULT true,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Team Hierarchy (override commission chain) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.commission_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT,
  role_key TEXT NOT NULL,
  parent_id UUID REFERENCES public.commission_hierarchy(id),
  team_name TEXT,
  active BOOLEAN DEFAULT true,
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_comm_tiers_rate ON commission_tiers(rate_id);
CREATE INDEX IF NOT EXISTS idx_comm_tiers_sort ON commission_tiers(rate_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_comm_geo_state ON commission_geo_modifiers(state);
CREATE INDEX IF NOT EXISTS idx_comm_geo_city ON commission_geo_modifiers(city);
CREATE INDEX IF NOT EXISTS idx_comm_geo_org ON commission_geo_modifiers(org_id);
CREATE INDEX IF NOT EXISTS idx_comm_geo_active ON commission_geo_modifiers(active);

CREATE INDEX IF NOT EXISTS idx_comm_hier_user ON commission_hierarchy(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_hier_parent ON commission_hierarchy(parent_id);
CREATE INDEX IF NOT EXISTS idx_comm_hier_org ON commission_hierarchy(org_id);
CREATE INDEX IF NOT EXISTS idx_comm_hier_role ON commission_hierarchy(role_key);
CREATE INDEX IF NOT EXISTS idx_comm_hier_active ON commission_hierarchy(active);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_geo_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_hierarchy ENABLE ROW LEVEL SECURITY;

-- Tiers: all authenticated read, admin write
CREATE POLICY comm_tiers_select ON commission_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY comm_tiers_insert ON commission_tiers FOR INSERT TO authenticated WITH CHECK (auth_is_admin());
CREATE POLICY comm_tiers_update ON commission_tiers FOR UPDATE TO authenticated USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY comm_tiers_delete ON commission_tiers FOR DELETE TO authenticated USING (auth_is_admin());

-- Geo modifiers: all authenticated read, admin write
CREATE POLICY comm_geo_select ON commission_geo_modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY comm_geo_insert ON commission_geo_modifiers FOR INSERT TO authenticated WITH CHECK (auth_is_admin());
CREATE POLICY comm_geo_update ON commission_geo_modifiers FOR UPDATE TO authenticated USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY comm_geo_delete ON commission_geo_modifiers FOR DELETE TO authenticated USING (auth_is_admin());

-- Hierarchy: all authenticated read, admin write
CREATE POLICY comm_hier_select ON commission_hierarchy FOR SELECT TO authenticated USING (true);
CREATE POLICY comm_hier_insert ON commission_hierarchy FOR INSERT TO authenticated WITH CHECK (auth_is_admin());
CREATE POLICY comm_hier_update ON commission_hierarchy FOR UPDATE TO authenticated USING (auth_is_admin()) WITH CHECK (auth_is_admin());
CREATE POLICY comm_hier_delete ON commission_hierarchy FOR DELETE TO authenticated USING (auth_is_admin());

-- ── Updated_at Trigger (hierarchy only) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.comm_hierarchy_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS comm_hierarchy_updated_at_trigger ON commission_hierarchy;
CREATE TRIGGER comm_hierarchy_updated_at_trigger BEFORE UPDATE ON commission_hierarchy FOR EACH ROW EXECUTE FUNCTION public.comm_hierarchy_updated_at();
