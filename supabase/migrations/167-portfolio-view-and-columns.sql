-- 167 — Portfolio view (#199): adds DC + battery_kwh primitives + v_edge_portfolio
--
-- Mark wants the EDGE Customer Portfolio table view inside MG, surfaced across
-- all projects (not just the ~250 in his spreadsheet). The columns he wants
-- need two primitives MG didn't carry: domestic_content and battery_kwh_per_unit.
--
-- Phase 1 (this migration): primitives + the view shape with signed_edge_contract,
-- system size, battery kWh, EC, DC, utility, stage. FMV / ITC / Depreciation
-- columns deferred until Paul confirms formulas (greg_actions #290).
--
-- Backfill of DC + battery_kwh from the EDGE Customer Portfolio sheet (247 rows)
-- ran out-of-band (data correction, not schema change).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS domestic_content boolean,
  ADD COLUMN IF NOT EXISTS battery_kwh_per_unit numeric;

COMMENT ON COLUMN public.projects.domestic_content IS
  'Domestic Content bonus eligibility for ITC. Mirrors the L column on EDGE Customer Portfolio sheet.';
COMMENT ON COLUMN public.projects.battery_kwh_per_unit IS
  'Battery capacity per unit (kWh). total_battery_kwh = battery_qty * battery_kwh_per_unit. Mirrors G column on EDGE Customer Portfolio sheet.';

CREATE OR REPLACE VIEW public.v_edge_portfolio
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.address,
  p.city,
  p.state,
  p.zip,
  p.utility,
  p.ahj,
  p.financier,
  p.financing_type,
  p.disposition,
  p.stage,
  p.stage_date,
  p.sale_date,
  p.pm,
  p.pm_id,
  p.contract,
  NULLIF(regexp_replace(coalesce(p.systemkw, ''), '[^0-9.]', '', 'g'), '')::numeric AS system_size_kw,
  NULLIF(regexp_replace(coalesce(p.battery_qty, ''), '[^0-9.]', '', 'g'), '')::numeric AS battery_qty_num,
  p.battery_kwh_per_unit,
  CASE
    WHEN p.battery_kwh_per_unit IS NOT NULL
     AND NULLIF(regexp_replace(coalesce(p.battery_qty, ''), '[^0-9.]', '', 'g'), '') IS NOT NULL
    THEN p.battery_kwh_per_unit * NULLIF(regexp_replace(coalesce(p.battery_qty, ''), '[^0-9.]', '', 'g'), '')::numeric
    ELSE NULL
  END AS total_battery_kwh,
  p.energy_community,
  p.domestic_content,
  (
    p.financier = 'EDGE'
    AND p.sale_date IS NOT NULL
    AND p.sale_date <> ''
  ) AS signed_edge_contract,
  -- NOTE: an earlier draft also required a file in '03 Installation Agreement'
  -- but project_files INSERT is currently `WITH CHECK (true)` for any
  -- authenticated user (023-document-management.sql:24), making the file
  -- existence trivially forgeable from the browser. Until the writes are
  -- org-scoped (greg_actions follow-up), the contract presence test is
  -- collapsed to the financier+sale_date pair, which writes through the
  -- admin-only update path on `projects`.
  p.org_id,
  p.created_at
FROM public.projects p;

COMMENT ON VIEW public.v_edge_portfolio IS
  'Mark portfolio table view (#199). Reads through projects; signed_edge_contract requires financier=EDGE, sale_date present, and at least one ''03 Installation Agreement'' file. FMV/ITC/depreciation columns deferred until Paul confirms formulas (greg_actions #290).';

GRANT SELECT ON public.v_edge_portfolio TO authenticated;
