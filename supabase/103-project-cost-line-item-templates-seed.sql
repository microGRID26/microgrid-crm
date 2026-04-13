-- 103-project-cost-line-item-templates-seed.sql — Catalog seed (Tier 2 Phase 2.2)
--
-- Seeds the 28-row line item catalog from the proforma's Project Cost
-- Reconciliation & Basis sheet. Source values are columns J (Raw Cost),
-- K (Markup factor — ADDITIONAL on top of raw, NOT total multiplier),
-- M (NewCo→EPC markup, also additional), O (Battery %), Q (PV %).
--
-- Pricing math used by lib/cost/calculator.ts buildProjectLineItem():
--   distro_price = raw_cost × (1 + default_markup_to_distro)
--   epc_price    = distro_price × (1 + default_markup_distro_to_epc)
--
-- Example (Battery Modules, proforma row 3):
--   J=37,452.80 raw, K=1.2 markup → L=82,396.16 distro (= 37,452.80 × 2.2)
--   M=0.005 → N=82,808.14 epc (= 82,396.16 × 1.005)
--
-- Unit basis explanation:
--   • 'flat'    — raw_cost stays constant per project
--   • 'per_kw'  — dollars per PV kW; multiplied by project.systemkw
--   • 'per_kwh' — dollars per kWh of battery; multiplied by project's battery kWh
--
-- Sample project for the per_kw / per_kwh ratios: 24.2 kW PV / 80 kWh battery.
-- Calling buildProjectLineItem() at this sizing reproduces the proforma row
-- column N values exactly (within 1¢ rounding).
--
-- Sales tax is NOT in this catalog — it lives in the chain orchestrator
-- (lib/invoices/chain.ts), applied only on the EPC → EDGE chain link at 8.25%.
-- The basis subtotal stays pre-tax.
--
-- Idempotent via ON CONFLICT (item_name) DO NOTHING.

INSERT INTO public.project_cost_line_item_templates (
  sort_order, section, category, system_bucket, item_name,
  default_raw_cost, default_unit_basis, default_markup_to_distro,
  default_markup_distro_to_epc, default_battery_pct, default_pv_pct,
  default_proof_type, default_basis_eligibility,
  default_paid_from_org_type, default_paid_to_org_type,
  is_epc_internal, is_itc_excluded, active
) VALUES

-- ── MAJOR EQUIPMENT ─────────────────────────────────────────────────────────
-- 1. Battery Modules — $37,452.80 / 80 kWh = $468.16/kWh raw, K=1.2
(10, 'Major Equipment', 'Equipment', 'Battery', 'Battery Modules',
 468.16, 'per_kwh', 1.2, 0.005, 1.0000, 0.0000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 2. Hybrid Inverters — $13,496.60 / 24.2 kW = $557.71/kW raw, K=1.5
(20, 'Major Equipment', 'Equipment', 'Both', 'Hybrid Inverters',
 557.71, 'per_kw', 1.5, 0.005, 0.5500, 0.4500,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 3. PV Modules — $7,260 / 24.2 kW = $300.00/kW raw, K=4.0
(30, 'Major Equipment', 'Equipment', 'PV', 'PV Modules',
 300.00, 'per_kw', 4.0, 0.005, 0.0000, 1.0000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 4. PV Mounting Hardware — $2,904 / 24.2 kW = $120.00/kW raw, K=3.0
(40, 'Major Equipment', 'Equipment', 'PV', 'PV Mounting Hardware',
 120.00, 'per_kw', 3.0, 0.005, 0.0000, 1.0000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 5. Battery Mounting / Brackets — $2,500 raw, K=2.25
(50, 'Major Equipment', 'Equipment', 'Battery', 'Battery Mounting / Brackets / ESS Mounting Hardware',
 2500.00, 'flat', 2.25, 0.005, 1.0000, 0.0000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 6. Gateway / Controls Interface — $1,221 raw, K=2.25
(60, 'Major Equipment', 'Equipment', 'Both', 'Gateway / Controls Interface',
 1221.00, 'flat', 2.25, 0.005, 0.4000, 0.6000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 7. Battery ACC KT PCW — $1,056 raw, K=2.25
(70, 'Major Equipment', 'Equipment', 'Battery', 'Battery ACC KT PCW',
 1056.00, 'flat', 2.25, 0.005, 1.0000, 0.0000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 8. Module-Level Electronics RSD — $1,375 raw, K=2.25
(80, 'Major Equipment', 'Equipment', 'PV', 'Module-Level Electronics RSD',
 1375.00, 'flat', 2.25, 0.005, 0.0000, 1.0000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 9. Monitoring / Communications Hardware — $919.16 raw, K=3.0
(90, 'Major Equipment', 'Equipment', 'Both', 'Monitoring / Communications Hardware',
 919.16, 'flat', 3.0, 0.005, 0.5000, 0.5000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 10. Equipment Delivery Fee — $1,000 raw, K=4.0
(100, 'Major Equipment', 'Freight', 'Both', 'Equipment Delivery Fee',
 1000.00, 'flat', 4.0, 0.005, 0.3500, 0.6500,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- ── BOS / SERVICE EQUIPMENT ─────────────────────────────────────────────────
-- 11. Service Panel / Meter-Main — $145 raw, K=2.25
(110, 'BOS / Service Equipment', 'Electrical', 'Both', 'Service Panel / Meter-Main / Enclosures',
 145.00, 'flat', 2.25, 0.005, 0.6000, 0.4000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 12. Conductors / Wiring — $1,192.09 raw, K=3.5
(120, 'BOS / Service Equipment', 'Electrical', 'Both', 'Conductors / Wiring',
 1192.09, 'flat', 3.5, 0.005, 0.4000, 0.6000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 13. AC/DC Disconnects — $2,044.26 raw, K=4.0
(130, 'BOS / Service Equipment', 'Electrical', 'Both', 'AC/DC Disconnects',
 2044.26, 'flat', 4.0, 0.005, 0.5000, 0.5000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- 14. Breakers / OCPD — $208 raw, K=4.0
(140, 'BOS / Service Equipment', 'Electrical', 'Both', 'Breakers / OCPD',
 208.00, 'flat', 4.0, 0.005, 0.7000, 0.3000,
 'Bank Transaction', 'Yes', 'newco_distribution', 'epc', false, false, true),

-- ── ENGINEERING / PERMITTING / COMPLIANCE (Rush Engineering invoice) ───────
-- 15. Engineering / CAD / Stamps — $100 raw, K=99 → $10,000 (no Distro→EPC markup)
(150, 'Eng / Permitting / Compliance', 'Engineering', 'Both', 'Engineering / CAD / Design / Stamps',
 100.00, 'flat', 99.0, 0.0, 0.0000, 1.0000,
 'Bank Transaction', 'Yes', 'engineering', 'epc', false, false, true),

-- 16. Third-Party Inspection — $350 raw, K=9 → $3,500
(160, 'Eng / Permitting / Compliance', 'Compliance', 'Both', 'Third-Party Inspection / Plan Review',
 350.00, 'flat', 9.0, 0.0, 0.0000, 1.0000,
 'Bank Transaction', 'Yes', 'engineering', 'epc', false, false, true),

-- ── FIELD EXECUTION / INSTALLATION / CLOSEOUT (EPC INTERNAL, no markup chain) ─
-- These are EPC internal cost rows. Raw is the proforma column J value, K=2.25
-- markup. No NewCo step (distro_to_epc=0). Covered by EPC attestation, no proof
-- of payment on file.

-- 17. Battery Installation Labor — $4,000 raw, K=2.25 → $13,000 epc
(170, 'Field Execution / Installation / Closeout', 'Labor', 'Battery', 'Battery Installation Labor',
 4000.00, 'flat', 2.25, 0.0, 1.0000, 0.0000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 18. PV Installation Labor — $3,080 raw, K=2.25 → $10,010 epc
(180, 'Field Execution / Installation / Closeout', 'Labor', 'PV', 'PV Installation Labor',
 3080.00, 'flat', 2.25, 0.0, 0.0000, 1.0000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 19. Project Management — $1,800 raw, K=2.25 → $5,850 epc
(190, 'Field Execution / Installation / Closeout', 'PM', 'Both', 'Project Management / Supervision',
 1800.00, 'flat', 2.25, 0.0, 0.4000, 0.6000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 20. Service Panel Upgrade Labor — $4,000 raw, K=2.25 → $13,000 epc
(200, 'Field Execution / Installation / Closeout', 'Labor', 'Both', 'Electrical Service Panel Upgrade Labor',
 4000.00, 'flat', 2.25, 0.0, 0.6000, 0.4000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 21. Commissioning / Startup — $500 raw, K=2.25 → $1,625 epc
(210, 'Field Execution / Installation / Closeout', 'Labor', 'Both', 'Commissioning / Startup / Programming',
 500.00, 'flat', 2.25, 0.0, 0.5000, 0.5000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 22. Inspection Coordination — $400 raw, K=2.25 → $1,300 epc
(220, 'Field Execution / Installation / Closeout', 'Labor', 'Both', 'Inspection Coordination / Closeout',
 400.00, 'flat', 2.25, 0.0, 0.5000, 0.5000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 23. Site Survey — $400 raw, K=2.25 → $1,300 epc
(230, 'Field Execution / Installation / Closeout', 'Labor', 'Both', 'Site Survey',
 400.00, 'flat', 2.25, 0.0, 0.5000, 0.5000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- ── COMMERCIAL / CONDITIONAL / RECONCILIATION ───────────────────────────────
-- 24. Sales Commission — $15,730 flat (no markup, MicroGRID Sales → EPC)
(240, 'Commercial / Conditional / Reconciliation', 'Commercial', 'Both', 'Customer Acquisition / Origination (Sales Commission)',
 15730.00, 'flat', 0.0, 0.0, 0.3000, 0.7000,
 'Bank Transaction', 'TBD', 'sales', 'epc', false, false, true),

-- 25. Warranty & Service Contract — $20,000 flat (no markup)
(250, 'Commercial / Conditional / Reconciliation', 'Commercial', 'Both', 'Warranty and Service Contract',
 20000.00, 'flat', 0.0, 0.0, 0.3000, 0.7000,
 'Bank Transaction', 'TBD', 'newco_distribution', 'epc', false, false, true),

-- 26. Change Order / Addtl SOW — $250 raw, K=2.25 → $812.50 epc
(260, 'Commercial / Conditional / Reconciliation', 'Conditional', 'Both', 'Change Order / Addtl SOW (if applicable)',
 250.00, 'flat', 2.25, 0.0, 0.5000, 0.5000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- 27. EPC Overhead/Profit/Residual — $8,041.40 raw, K=2.25 → $26,134.55 epc
(270, 'Commercial / Conditional / Reconciliation', 'Residual', 'Both', 'Assumed EPC Overhead/Profit/Residual',
 8041.40, 'flat', 2.25, 0.0, 0.4000, 0.6000,
 'EPC-Attestation', 'Yes', 'epc', 'epc', true, false, true),

-- ── EXCLUDED FROM ITC ───────────────────────────────────────────────────────
-- 28. GPU — $29,000 raw, K=1.0 → $58,000 distro → $58,290 epc; NOT ITC eligible
(280, 'Major Equipment', 'Equipment', 'GPU', 'GPU',
 29000.00, 'flat', 1.0, 0.005, 0.0000, 0.0000,
 'Bank Transaction', 'No', 'newco_distribution', 'epc', false, true, true)

ON CONFLICT (item_name) DO NOTHING;
