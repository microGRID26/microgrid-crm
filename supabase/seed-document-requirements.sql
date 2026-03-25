-- seed-document-requirements.sql
-- Seed data for document_requirements table
-- Standard required documents per pipeline stage for solar installation projects
--
-- Run after 023-document-management.sql has been applied.
-- Safe to re-run: uses ON CONFLICT to avoid duplicates.

-- Clear existing seed data (optional — comment out if appending)
-- DELETE FROM document_requirements;

-- ── Evaluation Stage ────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('evaluation', 'ia',           'Installation Agreement / Contract', '03 Installation Agreement', '%agreement%',        true,  'Signed installation agreement or contract between customer and MicroGRID', 10, true),
  ('evaluation', 'ub',           'Utility Bill',                      '05 Utility Bill',           '%utility%bill%',     true,  'Recent utility bill used to verify service address, meter number, and usage', 20, true),
  ('evaluation', 'welcome',      'Welcome Call Recording',            '04 Welcome Call',           '%welcome%call%',     true,  'Recording or notes from the customer welcome call', 30, true)

ON CONFLICT DO NOTHING;

-- ── Survey Stage ────────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('survey', 'site_survey',   'Site Survey Report',   '07 Site Survey', '%survey%report%',   true, 'Completed site survey report with measurements and observations', 10, true),
  ('survey', 'site_survey',   'Site Survey Photos',   '07 Site Survey', '%survey%photo%',    true, 'Photos of roof, electrical panel, meter, and surrounding area', 20, true),
  ('survey', 'site_survey',   'Roof Measurement',     '07 Site Survey', '%roof%measur%',     true, 'Roof measurement data from drone or manual survey', 30, true)

ON CONFLICT DO NOTHING;

-- ── Design Stage ────────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('design', 'build_design',  'System Design / CAD Drawing', '08 Design', '%design%',          true, 'CAD drawing or system design layout showing panel placement and electrical', 10, true),
  ('design', 'stamps',        'Engineering Stamp',           '08 Design', '%stamp%',            true, 'PE-stamped engineering documents required for permit submission', 20, true),
  ('design', 'build_eng',     'Structural Letter',           '08 Design', '%structural%',       true, 'Structural engineering letter certifying roof load capacity', 30, true),
  ('design', 'build_design',  'Production Estimate',         '08 Design', '%production%estim%', true, 'Estimated annual energy production for the designed system', 40, true)

ON CONFLICT DO NOTHING;

-- ── Permit Stage ────────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('permit', 'city_permit',  'City Permit Application',     '10 Permits', '%city%permit%app%',     true,  'Submitted city permit application package', 10, true),
  ('permit', 'util_permit',  'Utility Permit Application',  '10 Permits', '%util%permit%app%',     true,  'Submitted utility interconnection application', 20, true),
  ('permit', 'city_permit',  'Signed City Permit',          '10 Permits', '%city%permit%sign%',    true,  'Approved and signed city permit document', 30, true),
  ('permit', 'util_permit',  'Signed Utility Permit',       '10 Permits', '%util%permit%sign%',    true,  'Approved and signed utility interconnection permit', 40, true),
  ('permit', 'hoa',          'HOA Approval',                '06 HOA',     '%hoa%approv%',          false, 'HOA approval letter — only required if property is in an HOA', 50, true)

ON CONFLICT DO NOTHING;

-- ── Install Stage ───────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('install', 'install_done',  'Installation Photos',   '12 Installation', '%install%photo%',     true, 'Photos documenting the completed installation (panels, inverter, wiring)', 10, true),
  ('install', 'install_done',  'Electrical Inspection',  '12 Installation', '%electric%inspect%',  true, 'Electrical inspection results from the installation', 20, true),
  ('install', 'install_done',  'As-Built Drawing',       '08 Design',       '%as%built%',          true, 'As-built drawing reflecting any field changes from original design', 30, true)

ON CONFLICT DO NOTHING;

-- ── Inspection Stage ────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('inspection', 'city_insp',  'City Inspection Report',    '14 Inspection', '%city%inspect%report%', true, 'City inspection pass/fail report', 10, true),
  ('inspection', 'util_insp',  'Utility Inspection Report', '14 Inspection', '%util%inspect%report%', true, 'Utility inspection pass/fail report', 20, true),
  ('inspection', 'util_insp',  'PTO Letter',                '14 Inspection', '%pto%',                 true, 'Permission to Operate letter from the utility', 30, true)

ON CONFLICT DO NOTHING;

-- ── Complete Stage ──────────────────────────────────────────────────────────────

INSERT INTO document_requirements (stage, task_id, document_type, folder_name, filename_pattern, required, description, sort_order, active)
VALUES
  ('complete', 'pto',         'Final Inspection Certificate',      '14 Inspection', '%final%inspect%cert%',  true, 'Final inspection certificate confirming system passed all inspections', 10, true),
  ('complete', 'in_service',  'Monitoring Setup Confirmation',     '16 Monitoring', '%monitor%setup%',       true, 'Confirmation that system monitoring is active and reporting', 20, true),
  ('complete', 'in_service',  'Customer Handoff Document',         '01 Proposal',   '%handoff%',             true, 'Customer-facing handoff document with system details, warranty info, and support contacts', 30, true)

ON CONFLICT DO NOTHING;
