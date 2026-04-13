-- 100-invoice-rules-chain.sql — Multi-tenant invoicing chain rules (Tier 2 Phase 1.2)
--
-- Background (from 2026-04-13 Mark Bench + Paul Christodoulou meeting):
--   Mark wants every project to generate a 4-link tax-substantiation invoice chain:
--
--     Direct Supply Equity Corp → NewCo Distribution → EPC → EDGE
--                              + Rush Engineering → EPC
--                              + MicroGRID Sales → EPC
--
--   These chain invoices are NOT fired by the existing milestone trigger
--   (lib/invoices/trigger.ts → /api/invoices/trigger). They are fired explicitly
--   by the chain orchestrator (lib/invoices/chain.ts → /api/invoices/generate-chain)
--   which can run on any project_id at any time, including retroactively for
--   projects that already exist in the system.
--
--   To keep the two trigger paths isolated, this migration adds a `rule_kind`
--   column to invoice_rules. The existing milestone trigger filters
--   `rule_kind = 'milestone'` so chain rules don't get accidentally fired by
--   task completion events. Conversely, the chain orchestrator only loads
--   `rule_kind = 'chain'` rules.
--
-- Idempotent: safe to re-run.

-- ── 1. Add rule_kind column ─────────────────────────────────────────────────

ALTER TABLE public.invoice_rules
  ADD COLUMN IF NOT EXISTS rule_kind TEXT NOT NULL DEFAULT 'milestone';

-- Drop + re-add the CHECK constraint (Postgres can't modify CHECK in place)
ALTER TABLE public.invoice_rules DROP CONSTRAINT IF EXISTS invoice_rules_rule_kind_check;
ALTER TABLE public.invoice_rules ADD CONSTRAINT invoice_rules_rule_kind_check
  CHECK (rule_kind IN ('milestone', 'chain', 'monthly'));

-- Backfill: existing 'monthly' milestone rules become rule_kind='monthly'
UPDATE public.invoice_rules SET rule_kind = 'monthly' WHERE milestone = 'monthly' AND rule_kind = 'milestone';

CREATE INDEX IF NOT EXISTS idx_inv_rules_kind ON invoice_rules(rule_kind);

COMMENT ON COLUMN public.invoice_rules.rule_kind IS
  'Discriminator for which orchestrator fires this rule. milestone (default) = task completion via lib/invoices/trigger.ts. chain = explicit project-scoped chain via lib/invoices/chain.ts. monthly = recurring VPP/Light Energy via cron (not yet wired).';

-- ── 2. Seed the 5 chain rules ───────────────────────────────────────────────
--
-- Each rule's `line_items` JSONB encodes the proforma reference values
-- (raw_cost, markup, distro_price, epc_price, battery_pct, pv_pct) so the
-- chain calculator can compute consistent amounts for any project. In Phase 2
-- the calculator will switch to reading per-project values from the new
-- project_cost_line_items table; until then, every project's chain matches
-- the proforma sample exactly. Mark + Paul can review the shape of the
-- generated invoices against the proforma to validate format before we
-- backfill per-project precision.
--
-- Source: 'EDGE Model 5 year proforma 3.5B MB 4.06.26.xlsx' → 'Project Cost
-- Reconciliation & Basis' sheet, columns I (Item), J (Raw Cost), K (Markup),
-- L (Distro Price), M (Distro→EPC Markup, 0.005 flat), N (EPC Price).

-- Rule 1: Direct Supply Equity Corp → NewCo Distribution
-- DSE buys raw materials from upstream suppliers, sells to NewCo at marked-up
-- price (column L = raw × markup). This is where the bulk of the chain profit
-- is generated and what flows into SPE2 as tax equity (Phase 3.2).
INSERT INTO public.invoice_rules (name, milestone, from_org_type, to_org_type, line_items, active, rule_kind) VALUES
('Chain — DSE Corp → NewCo Distribution (Equipment)', 'chain',
 'direct_supply_equity_corp', 'newco_distribution',
 '[
   {"description":"Battery Modules","category":"Major Equipment","system_bucket":"Battery","raw_cost":37452.80,"markup":1.2,"unit_price":44943.36,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Hybrid Inverters","category":"Major Equipment","system_bucket":"Both","raw_cost":13496.60,"markup":1.5,"unit_price":20244.90,"battery_pct":0.55,"pv_pct":0.45},
   {"description":"PV Modules","category":"Major Equipment","system_bucket":"PV","raw_cost":7260.00,"markup":4.0,"unit_price":29040.00,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"PV Mounting Hardware","category":"Major Equipment","system_bucket":"PV","raw_cost":2904.00,"markup":3.0,"unit_price":8712.00,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Battery Mounting / Brackets / ESS Mounting Hardware","category":"Major Equipment","system_bucket":"Battery","raw_cost":2500.00,"markup":2.25,"unit_price":5625.00,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Gateway / Controls Interface","category":"Major Equipment","system_bucket":"Both","raw_cost":1221.00,"markup":2.25,"unit_price":2747.25,"battery_pct":0.40,"pv_pct":0.60},
   {"description":"Battery ACC KT PCW","category":"Major Equipment","system_bucket":"Battery","raw_cost":1056.00,"markup":2.25,"unit_price":2376.00,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Module-Level Electronics RSD","category":"Major Equipment","system_bucket":"PV","raw_cost":1375.00,"markup":2.25,"unit_price":3093.75,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Monitoring / Communications Hardware","category":"Major Equipment","system_bucket":"Both","raw_cost":919.16,"markup":3.0,"unit_price":2757.48,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Equipment Delivery Fee","category":"Major Equipment","system_bucket":"Both","raw_cost":1000.00,"markup":4.0,"unit_price":4000.00,"battery_pct":0.35,"pv_pct":0.65},
   {"description":"Service Panel / Meter-Main / Enclosures","category":"BOS / Service Equipment","system_bucket":"Both","raw_cost":145.00,"markup":2.25,"unit_price":326.25,"battery_pct":0.60,"pv_pct":0.40},
   {"description":"Conductors / Wiring","category":"BOS / Service Equipment","system_bucket":"Both","raw_cost":1192.09,"markup":3.5,"unit_price":4172.32,"battery_pct":0.40,"pv_pct":0.60},
   {"description":"AC/DC Disconnects","category":"BOS / Service Equipment","system_bucket":"Both","raw_cost":2044.26,"markup":4.0,"unit_price":8177.04,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Breakers / OCPD","category":"BOS / Service Equipment","system_bucket":"Both","raw_cost":208.00,"markup":4.0,"unit_price":832.00,"battery_pct":0.70,"pv_pct":0.30},
   {"description":"GPU","category":"Major Equipment","system_bucket":"GPU","raw_cost":29000.00,"markup":1.0,"unit_price":58000.00,"battery_pct":0.0,"pv_pct":0.0,"itc_excluded":true}
 ]'::jsonb,
 true, 'chain'),

-- Rule 2: NewCo Distribution → EPC
-- NewCo sells the same equipment to the installer with a flat 0.5% markup.
-- This is the column N (EPC Price) values from the proforma — what each EPC
-- sees on its bill of materials.
('Chain — NewCo Distribution → EPC (Equipment + 0.5% Markup)', 'chain',
 'newco_distribution', 'epc',
 '[
   {"description":"Battery Modules","category":"Major Equipment","system_bucket":"Battery","unit_price":45168.07,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Hybrid Inverters","category":"Major Equipment","system_bucket":"Both","unit_price":20346.13,"battery_pct":0.55,"pv_pct":0.45},
   {"description":"PV Modules","category":"Major Equipment","system_bucket":"PV","unit_price":29185.20,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"PV Mounting Hardware","category":"Major Equipment","system_bucket":"PV","unit_price":8755.56,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Battery Mounting / Brackets / ESS Mounting Hardware","category":"Major Equipment","system_bucket":"Battery","unit_price":5653.13,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Gateway / Controls Interface","category":"Major Equipment","system_bucket":"Both","unit_price":2760.99,"battery_pct":0.40,"pv_pct":0.60},
   {"description":"Battery ACC KT PCW","category":"Major Equipment","system_bucket":"Battery","unit_price":2387.88,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Module-Level Electronics RSD","category":"Major Equipment","system_bucket":"PV","unit_price":3109.22,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Monitoring / Communications Hardware","category":"Major Equipment","system_bucket":"Both","unit_price":2771.27,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Equipment Delivery Fee","category":"Major Equipment","system_bucket":"Both","unit_price":4020.00,"battery_pct":0.35,"pv_pct":0.65},
   {"description":"Service Panel / Meter-Main / Enclosures","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":327.88,"battery_pct":0.60,"pv_pct":0.40},
   {"description":"Conductors / Wiring","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":4193.18,"battery_pct":0.40,"pv_pct":0.60},
   {"description":"AC/DC Disconnects","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":8217.93,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Breakers / OCPD","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":836.16,"battery_pct":0.70,"pv_pct":0.30},
   {"description":"GPU","category":"Major Equipment","system_bucket":"GPU","unit_price":58290.00,"battery_pct":0.0,"pv_pct":0.0,"itc_excluded":true}
 ]'::jsonb,
 true, 'chain'),

-- Rule 3: Rush Engineering → EPC
-- Rush invoices the EPC directly for engineering services — no markup chain.
-- These are flat-rate values per project regardless of system size.
('Chain — Rush Engineering → EPC (Engineering Services)', 'chain',
 'engineering', 'epc',
 '[
   {"description":"Engineering / CAD / Design / Stamps","category":"Eng / Permitting / Compliance","system_bucket":"PV","unit_price":10000.00,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Third-Party Inspection / Plan Review","category":"Eng / Permitting / Compliance","system_bucket":"PV","unit_price":3500.00,"battery_pct":0.0,"pv_pct":1.0}
 ]'::jsonb,
 true, 'chain'),

-- Rule 4: MicroGRID Energy (Sales Originator) → EPC
-- MicroGRID Energy invoices the installer EPC for the sales commission per
-- project. Per Mark in the meeting: "MicroGRID Energy is going to invoice the
-- EPC for sales commissions" → "this technically should be paid from EPC to
-- micro grid." Direction: invoice from MG Energy, money flows EPC → MG.
-- Self-invoice skip: when MG Energy IS the EPC on a project, the chain
-- orchestrator skips this rule (no self-invoicing).
('Chain — MicroGRID Sales → EPC (Sales Dealer Commission)', 'chain',
 'sales', 'epc',
 '[
   {"description":"Customer Acquisition / Origination (Sales Commission)","category":"Commercial / Conditional / Reconciliation","system_bucket":"Both","unit_price":15730.00,"battery_pct":0.30,"pv_pct":0.70}
 ]'::jsonb,
 true, 'chain'),

-- Rule 5: EPC → EDGE (the "full boat")
-- The EPC builds the final invoice for EDGE that includes ALL items above
-- (DSE/NewCo equipment at EPC price, Rush engineering, MicroGRID sales) PLUS
-- the EPC's internal labor/overhead costs (which are EPC-attestation only,
-- no proof of payment — covered by the EPC certification language at the
-- bottom of the invoice). Plus 8.25% Texas sales tax on the full subtotal.
-- Mark in the meeting: "this is the full boat" — column N row 33 of proforma.
('Chain — EPC → EDGE (Full Project Invoice + TX Sales Tax)', 'chain',
 'epc', 'platform',
 '[
   {"description":"Battery Modules","category":"Major Equipment","system_bucket":"Battery","unit_price":45168.07,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Hybrid Inverters","category":"Major Equipment","system_bucket":"Both","unit_price":20346.13,"battery_pct":0.55,"pv_pct":0.45},
   {"description":"PV Modules","category":"Major Equipment","system_bucket":"PV","unit_price":29185.20,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"PV Mounting Hardware","category":"Major Equipment","system_bucket":"PV","unit_price":8755.56,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Battery Mounting / Brackets / ESS Mounting Hardware","category":"Major Equipment","system_bucket":"Battery","unit_price":5653.13,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Gateway / Controls Interface","category":"Major Equipment","system_bucket":"Both","unit_price":2760.99,"battery_pct":0.40,"pv_pct":0.60},
   {"description":"Battery ACC KT PCW","category":"Major Equipment","system_bucket":"Battery","unit_price":2387.88,"battery_pct":1.0,"pv_pct":0.0},
   {"description":"Module-Level Electronics RSD","category":"Major Equipment","system_bucket":"PV","unit_price":3109.22,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Monitoring / Communications Hardware","category":"Major Equipment","system_bucket":"Both","unit_price":2771.27,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Equipment Delivery Fee","category":"Major Equipment","system_bucket":"Both","unit_price":4020.00,"battery_pct":0.35,"pv_pct":0.65},
   {"description":"Service Panel / Meter-Main / Enclosures","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":327.88,"battery_pct":0.60,"pv_pct":0.40},
   {"description":"Conductors / Wiring","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":4193.18,"battery_pct":0.40,"pv_pct":0.60},
   {"description":"AC/DC Disconnects","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":8217.93,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Breakers / OCPD","category":"BOS / Service Equipment","system_bucket":"Both","unit_price":836.16,"battery_pct":0.70,"pv_pct":0.30},
   {"description":"Engineering / CAD / Design / Stamps","category":"Eng / Permitting / Compliance","system_bucket":"PV","unit_price":10000.00,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Third-Party Inspection / Plan Review","category":"Eng / Permitting / Compliance","system_bucket":"PV","unit_price":3500.00,"battery_pct":0.0,"pv_pct":1.0},
   {"description":"Battery Installation Labor","category":"Field Execution / Installation / Closeout","system_bucket":"Battery","unit_price":13000.00,"battery_pct":1.0,"pv_pct":0.0,"epc_internal":true},
   {"description":"PV Installation Labor","category":"Field Execution / Installation / Closeout","system_bucket":"PV","unit_price":10010.00,"battery_pct":0.0,"pv_pct":1.0,"epc_internal":true},
   {"description":"Project Management / Supervision","category":"Field Execution / Installation / Closeout","system_bucket":"Both","unit_price":5850.00,"battery_pct":0.40,"pv_pct":0.60,"epc_internal":true},
   {"description":"Electrical Service Panel Upgrade Labor","category":"Field Execution / Installation / Closeout","system_bucket":"Both","unit_price":13000.00,"battery_pct":0.60,"pv_pct":0.40,"epc_internal":true},
   {"description":"Commissioning / Startup / Programming","category":"Field Execution / Installation / Closeout","system_bucket":"Both","unit_price":1625.00,"battery_pct":0.50,"pv_pct":0.50,"epc_internal":true},
   {"description":"Inspection Coordination / Closeout","category":"Field Execution / Installation / Closeout","system_bucket":"Both","unit_price":1300.00,"battery_pct":0.50,"pv_pct":0.50,"epc_internal":true},
   {"description":"Site Survey","category":"Field Execution / Installation / Closeout","system_bucket":"Both","unit_price":1300.00,"battery_pct":0.50,"pv_pct":0.50,"epc_internal":true},
   {"description":"Customer Acquisition / Origination (Sales Commission)","category":"Commercial / Conditional / Reconciliation","system_bucket":"Both","unit_price":15730.00,"battery_pct":0.30,"pv_pct":0.70},
   {"description":"Warranty and Service Contract","category":"Commercial / Conditional / Reconciliation","system_bucket":"Both","unit_price":20000.00,"battery_pct":0.30,"pv_pct":0.70},
   {"description":"Change Order / Addtl SOW (if applicable)","category":"Commercial / Conditional / Reconciliation","system_bucket":"Both","unit_price":812.50,"battery_pct":0.50,"pv_pct":0.50},
   {"description":"Assumed EPC Overhead/Profit/Residual","category":"Commercial / Conditional / Reconciliation","system_bucket":"Both","unit_price":26134.55,"battery_pct":0.40,"pv_pct":0.60,"epc_internal":true},
   {"description":"GPU","category":"Major Equipment","system_bucket":"GPU","unit_price":58290.00,"battery_pct":0.0,"pv_pct":0.0,"itc_excluded":true}
 ]'::jsonb,
 true, 'chain')

ON CONFLICT (name) DO NOTHING;

-- ── 3. Mark this rule's apply_sales_tax flag via settings extension ─────────
--
-- The EPC → EDGE rule needs an 8.25% Texas sales tax applied at calc time.
-- All other chain rules are resale-exempt (EPCs sign tax-free reseller IDs).
-- We encode the tax flag in the rule's name suffix '+ TX Sales Tax' so the
-- chain calculator can detect it without needing a new column.

-- (No-op for migration — the calculator detects sales tax application by
-- looking at the rule's to_org_type='platform' AND from_org_type='epc'.)
