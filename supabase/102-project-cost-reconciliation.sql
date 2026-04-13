-- 102-project-cost-reconciliation.sql — Project Cost Reconciliation & Basis (Tier 2 Phase 2.1)
--
-- Background (from 2026-04-13 Mark Bench meeting):
--   Mark introduced a "Project Cost Reconciliation and Basis" form that lives
--   on every project as a SECURE tab, segregated from the rest of the project
--   page. It contains the per-line-item cost breakdown (raw cost, distro markup,
--   EPC price, battery/PV allocation, ITC eligibility, proof-of-payment status)
--   that EDGE uses to substantiate its basis for the ITC step-up.
--
--   Mark's spec from the meeting:
--     • Columns D through I shown by default
--     • Columns J / K / L / M hidden by default (raw cost + markup ladder)
--     • Columns N through X always shown (EPC price + per-watt + per-kWh)
--     • Summary table at I34:M39 with PV / Battery / GPU breakdown + ITC eligibility
--
--   This migration adds three tables and a view:
--
--     project_cost_line_item_templates
--       The catalog of ~30 line items pulled from the proforma. Each row is a
--       template (raw cost + markup + battery/PV % + section + ITC eligibility)
--       that can be instantiated per project. Greg or Paul can adjust catalog
--       values without touching code.
--
--     project_cost_line_items
--       Per-project instances of catalog rows. Each project has ~30 rows. The
--       backfill script (scripts/backfill-project-cost-line-items.ts) seeds
--       these from the catalog, scaling raw_cost by project size where the
--       template specifies a per_kw or per_kwh unit basis. Phase 3+ will let
--       admin users override per-project values directly.
--
--     project_cost_basis_summary  (view)
--       Aggregates the per-project line items into the I34:M39 summary block:
--       total basis, ITC-eligible basis, ITC-eligible percentage, plus the
--       PV / Battery / GPU split. Cheap to query — no materialization needed.
--
-- RLS gating per Mark + the meeting-plan visibility decision:
--   Internal-only: members of platform / direct_supply_equity_corp orgs see
--   the full reconciliation. EPC tenants get a filtered view via SECURITY
--   DEFINER RPC (added later when external EPC users come online).
--
-- Idempotent: safe to re-run.

-- ── 1. Catalog: project_cost_line_item_templates ────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_cost_line_item_templates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order                  INTEGER NOT NULL DEFAULT 0,
  section                     TEXT NOT NULL,           -- 'Major Equipment' | 'BOS / Service Equipment' | 'Eng / Permitting / Compliance' | 'Field Execution / Installation / Closeout' | 'Commercial / Conditional / Reconciliation'
  category                    TEXT,                    -- 'Equipment' | 'Electrical' | 'Engineering' | 'Labor' | 'PM' | 'Commercial' | 'Conditional' | 'Residual'
  system_bucket               TEXT NOT NULL DEFAULT 'Both' CHECK (system_bucket IN ('Battery', 'PV', 'GPU', 'Both')),
  item_name                   TEXT NOT NULL,
  default_raw_cost            NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_unit_basis          TEXT NOT NULL DEFAULT 'flat' CHECK (default_unit_basis IN ('flat', 'per_kw', 'per_kwh')),
  default_markup_to_distro    NUMERIC(8,4) NOT NULL DEFAULT 1.0,   -- multiplier applied to raw_cost (e.g. 1.2x, 4.0x)
  default_markup_distro_to_epc NUMERIC(8,4) NOT NULL DEFAULT 0.005, -- 0.5% added by NewCo to EPC
  default_battery_pct         NUMERIC(5,4) NOT NULL DEFAULT 0,     -- % of cost allocated to battery (0..1)
  default_pv_pct              NUMERIC(5,4) NOT NULL DEFAULT 0,     -- % of cost allocated to PV (0..1)
  default_proof_type          TEXT NOT NULL DEFAULT 'Bank Transaction' CHECK (default_proof_type IN ('Bank Transaction', 'EPC-Attestation')),
  default_basis_eligibility   TEXT NOT NULL DEFAULT 'Yes' CHECK (default_basis_eligibility IN ('Yes', 'Partial', 'No', 'TBD')),
  default_paid_from_org_type  TEXT NOT NULL DEFAULT 'newco_distribution',
  default_paid_to_org_type    TEXT NOT NULL DEFAULT 'epc',
  is_epc_internal             BOOLEAN NOT NULL DEFAULT false,      -- labor/overhead lines that have no external proof of payment
  is_itc_excluded             BOOLEAN NOT NULL DEFAULT false,      -- GPU and other non-ITC items
  active                      BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcli_templates_item_name ON project_cost_line_item_templates(item_name);
CREATE INDEX IF NOT EXISTS idx_pcli_templates_section ON project_cost_line_item_templates(section);
CREATE INDEX IF NOT EXISTS idx_pcli_templates_active ON project_cost_line_item_templates(active);

-- ── 2. Per-project instances: project_cost_line_items ──────────────────────

CREATE TABLE IF NOT EXISTS public.project_cost_line_items (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id              UUID REFERENCES public.project_cost_line_item_templates(id) ON DELETE SET NULL,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  section                  TEXT NOT NULL,
  category                 TEXT,
  system_bucket            TEXT NOT NULL DEFAULT 'Both' CHECK (system_bucket IN ('Battery', 'PV', 'GPU', 'Both')),
  item_name                TEXT NOT NULL,
  raw_cost                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  markup_to_distro         NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  distro_price             NUMERIC(12,2) NOT NULL DEFAULT 0,    -- raw_cost * markup_to_distro
  markup_distro_to_epc     NUMERIC(8,4) NOT NULL DEFAULT 0.005,
  epc_price                NUMERIC(12,2) NOT NULL DEFAULT 0,    -- distro_price * (1 + markup_distro_to_epc)
  battery_pct              NUMERIC(5,4) NOT NULL DEFAULT 0,
  pv_pct                   NUMERIC(5,4) NOT NULL DEFAULT 0,
  battery_cost             NUMERIC(12,2) NOT NULL DEFAULT 0,    -- epc_price * battery_pct
  pv_cost                  NUMERIC(12,2) NOT NULL DEFAULT 0,    -- epc_price * pv_pct
  proof_of_payment_status  TEXT NOT NULL DEFAULT 'Pending' CHECK (proof_of_payment_status IN ('Pending', 'Yes', 'No', 'TBD')),
  proof_type               TEXT NOT NULL DEFAULT 'Bank Transaction' CHECK (proof_type IN ('Bank Transaction', 'EPC-Attestation')),
  basis_eligibility        TEXT NOT NULL DEFAULT 'Yes' CHECK (basis_eligibility IN ('Yes', 'Partial', 'No', 'TBD')),
  paid_from_org_id         UUID REFERENCES public.organizations(id),
  paid_to_org_id           UUID REFERENCES public.organizations(id),
  is_epc_internal          BOOLEAN NOT NULL DEFAULT false,
  is_itc_excluded          BOOLEAN NOT NULL DEFAULT false,
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One catalog template per project to prevent duplicate-row drift on re-backfill.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcli_project_template ON project_cost_line_items(project_id, template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcli_project ON project_cost_line_items(project_id);
CREATE INDEX IF NOT EXISTS idx_pcli_section ON project_cost_line_items(project_id, section, sort_order);

-- ── 3. Updated_at triggers ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pcli_templates_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pcli_templates_updated_at_trigger ON project_cost_line_item_templates;
CREATE TRIGGER pcli_templates_updated_at_trigger
  BEFORE UPDATE ON project_cost_line_item_templates FOR EACH ROW EXECUTE FUNCTION public.pcli_templates_updated_at();

CREATE OR REPLACE FUNCTION public.pcli_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pcli_updated_at_trigger ON project_cost_line_items;
CREATE TRIGGER pcli_updated_at_trigger
  BEFORE UPDATE ON project_cost_line_items FOR EACH ROW EXECUTE FUNCTION public.pcli_updated_at();

-- ── 4. Basis summary view ───────────────────────────────────────────────────
--
-- Aggregates per-project line items into the I34:M39 summary block from the
-- proforma. Fields:
--   project_id          — the project this summary applies to
--   total_basis         — SUM(epc_price) across all line items
--   pv_basis            — SUM(pv_cost) — the portion allocated to PV
--   battery_basis       — SUM(battery_cost) — the portion allocated to Battery
--   gpu_basis           — SUM(epc_price) WHERE system_bucket = 'GPU' (excluded from ITC)
--   itc_eligible_basis  — total_basis minus GPU lines and any explicitly-excluded items
--   itc_eligible_pct    — itc_eligible_basis / total_basis (the 85.108% in proforma)
--   pv_basis_pct        — pv_basis / total_basis
--   battery_basis_pct   — battery_basis / total_basis
--   gpu_basis_pct       — gpu_basis / total_basis

CREATE OR REPLACE VIEW public.project_cost_basis_summary AS
SELECT
  pcli.project_id,
  ROUND(SUM(pcli.epc_price)::numeric, 2)                                                    AS total_basis,
  ROUND(SUM(pcli.pv_cost)::numeric, 2)                                                      AS pv_basis,
  ROUND(SUM(pcli.battery_cost)::numeric, 2)                                                 AS battery_basis,
  ROUND(SUM(CASE WHEN pcli.system_bucket = 'GPU' THEN pcli.epc_price ELSE 0 END)::numeric, 2) AS gpu_basis,
  ROUND(SUM(CASE WHEN pcli.is_itc_excluded THEN 0 ELSE pcli.epc_price END)::numeric, 2)     AS itc_eligible_basis,
  CASE WHEN SUM(pcli.epc_price) > 0
       THEN ROUND((SUM(CASE WHEN pcli.is_itc_excluded THEN 0 ELSE pcli.epc_price END) / SUM(pcli.epc_price))::numeric, 4)
       ELSE 0
  END AS itc_eligible_pct,
  CASE WHEN SUM(pcli.epc_price) > 0
       THEN ROUND((SUM(pcli.pv_cost) / SUM(pcli.epc_price))::numeric, 4)
       ELSE 0
  END AS pv_basis_pct,
  CASE WHEN SUM(pcli.epc_price) > 0
       THEN ROUND((SUM(pcli.battery_cost) / SUM(pcli.epc_price))::numeric, 4)
       ELSE 0
  END AS battery_basis_pct,
  CASE WHEN SUM(pcli.epc_price) > 0
       THEN ROUND((SUM(CASE WHEN pcli.system_bucket = 'GPU' THEN pcli.epc_price ELSE 0 END) / SUM(pcli.epc_price))::numeric, 4)
       ELSE 0
  END AS gpu_basis_pct,
  COUNT(*) AS line_item_count
FROM public.project_cost_line_items pcli
GROUP BY pcli.project_id;

COMMENT ON VIEW public.project_cost_basis_summary IS
  'Per-project basis summary mirroring the I34:M39 block in the proforma (EDGE Project Cost Reconciliation & Basis sheet). Cheap query, no materialization. ITC-eligible total excludes any line marked is_itc_excluded (typically GPU rows) per Mark Bench 2026-04-13 meeting.';

-- ── 5. RLS — internal-only via platform / DSE Corp org membership ──────────
--
-- The Project Cost Reconciliation tab is internal-only per the meeting plan.
-- Members of platform OR direct_supply_equity_corp orgs (currently MicroGRID
-- staff) can SELECT / INSERT / UPDATE per-project rows. EPC and customer
-- tenants get NO access at the table level. When external EPC user accounts
-- come online (Phase 4+), a SECURITY DEFINER RPC will return a filtered slice
-- of just the EPC's own line items. Until then, EPCs see nothing.
--
-- Catalog table is readable by any authenticated user (so admins can see it
-- in /admin), writable by admins only.

ALTER TABLE project_cost_line_item_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcli_templates_select ON project_cost_line_item_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pcli_templates_write ON project_cost_line_item_templates
  FOR ALL TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

ALTER TABLE project_cost_line_items ENABLE ROW LEVEL SECURITY;

-- Helper expression: is the current user a member of an internal org
-- (platform or direct_supply_equity_corp)? Used by all 3 policies below.
-- Rather than a SQL function, we inline the EXISTS check so it's clear at the
-- policy level what the gate is.

CREATE POLICY pcli_select ON project_cost_line_items
  FOR SELECT TO authenticated
  USING (
    auth_is_platform_user()
    OR EXISTS (
      SELECT 1 FROM organizations o
      JOIN org_memberships om ON om.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND o.org_type IN ('platform', 'direct_supply_equity_corp')
        AND o.active = true
    )
  );

CREATE POLICY pcli_insert ON project_cost_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_is_platform_user()
    OR EXISTS (
      SELECT 1 FROM organizations o
      JOIN org_memberships om ON om.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND o.org_type IN ('platform', 'direct_supply_equity_corp')
        AND o.active = true
    )
  );

CREATE POLICY pcli_update ON project_cost_line_items
  FOR UPDATE TO authenticated
  USING (
    auth_is_platform_user()
    OR EXISTS (
      SELECT 1 FROM organizations o
      JOIN org_memberships om ON om.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND o.org_type IN ('platform', 'direct_supply_equity_corp')
        AND o.active = true
    )
  )
  WITH CHECK (
    auth_is_platform_user()
    OR EXISTS (
      SELECT 1 FROM organizations o
      JOIN org_memberships om ON om.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND o.org_type IN ('platform', 'direct_supply_equity_corp')
        AND o.active = true
    )
  );

CREATE POLICY pcli_delete ON project_cost_line_items
  FOR DELETE TO authenticated
  USING (auth_is_platform_user() OR auth_is_super_admin());

-- The view inherits RLS from the underlying table when used in a query, so
-- no separate policy needed on project_cost_basis_summary.

COMMENT ON TABLE public.project_cost_line_item_templates IS
  'Catalog of ~30 line items pulled from the proforma. Each row is a template that the backfill script instantiates per project, scaling raw_cost by project size for per_kw / per_kwh items.';

COMMENT ON TABLE public.project_cost_line_items IS
  'Per-project instances of catalog rows. Internal-only RLS (platform + DSE Corp org members). One row per (project_id, template_id) enforced by unique partial index.';
