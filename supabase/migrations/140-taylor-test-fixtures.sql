-- Migration 140: Taylor Pratt funding-sheet test fixtures
-- 3 fake EDGE-financed projects + reseed RPC.
-- IDs: TEST-TAYLOR-01/02/03. Safe by prefix isolation. Drift-checked: 0 real projects match.

-- ── Reseed RPC (finance/admin only, sole writer of TEST-TAYLOR-* rows) ──────
CREATE OR REPLACE FUNCTION public.atlas_reseed_taylor_test_projects()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role        text;
  v_active      boolean;
  v_org_id      uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;  -- MicroGRID Energy
  v_today       date := current_date;
  v_inserted    integer := 0;
  v_caller      text := lower(auth.email());
BEGIN
  IF v_caller IS NULL OR v_caller = '' THEN
    RAISE EXCEPTION 'atlas_reseed_taylor_test_projects: no caller email'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gate: caller must be finance/admin/super_admin AND active (case-insensitive email per mig 132)
  SELECT role, COALESCE(active, true) INTO v_role, v_active
    FROM public.users
   WHERE lower(email) = v_caller
   LIMIT 1;

  IF v_role IS NULL OR v_active = false
     OR v_role NOT IN ('finance','admin','super_admin') THEN
    RAISE EXCEPTION 'atlas_reseed_taylor_test_projects: forbidden (role=%, active=%)',
      v_role, v_active
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Hard-prefix delete: only TEST-TAYLOR-* rows are ever touched
  DELETE FROM public.project_funding WHERE project_id LIKE 'TEST-TAYLOR-%';
  DELETE FROM public.projects        WHERE id         LIKE 'TEST-TAYLOR-%';

  -- ── Project 01: Brand-new sale, M1 ready to collect ──────────────────────
  INSERT INTO public.projects
    (id, name, financier, disposition, stage, org_id,
     address, city, state, zip, email, phone,
     systemkw, module_qty, battery_qty, inverter_qty, contract,
     sale_date, financing_type)
  VALUES
    ('TEST-TAYLOR-01', 'TEST: Taylor Alpha (M1 Ready)',
     'EDGE', 'Sale', 'evaluation', v_org_id,
     '100 Test Lane', 'Houston', 'TX', '77002',
     'taylor.alpha@example.test', '+15555550101',
     '10.0', '23', '2', '1', '45000',
     to_char(v_today - 7,  'YYYY-MM-DD'), 'EDGE');

  -- ── Project 02: Mid-flight, M1 funded, M2 submitted-and-aging (>30d stale) ──
  INSERT INTO public.projects
    (id, name, financier, disposition, stage, org_id,
     address, city, state, zip, email, phone,
     systemkw, module_qty, battery_qty, inverter_qty, contract,
     sale_date, install_complete_date, financing_type)
  VALUES
    ('TEST-TAYLOR-02', 'TEST: Taylor Bravo (M2 Submitted, Aging)',
     'EDGE', 'Sale', 'install', v_org_id,
     '200 Test Lane', 'Houston', 'TX', '77002',
     'taylor.bravo@example.test', '+15555550202',
     '10.0', '23', '2', '1', '45000',
     to_char(v_today - 90, 'YYYY-MM-DD'),
     to_char(v_today - 40, 'YYYY-MM-DD'), 'EDGE');

  -- ── Project 03: PTO done, M3 Pending Resolution + nonfunded code ─────────
  INSERT INTO public.projects
    (id, name, financier, disposition, stage, org_id,
     address, city, state, zip, email, phone,
     systemkw, module_qty, battery_qty, inverter_qty, contract,
     sale_date, install_complete_date, pto_date, financing_type)
  VALUES
    ('TEST-TAYLOR-03', 'TEST: Taylor Charlie (M3 Pending Resolution)',
     'EDGE', 'Sale', 'inspection', v_org_id,
     '300 Test Lane', 'Houston', 'TX', '77002',
     'taylor.charlie@example.test', '+15555550303',
     '10.0', '23', '2', '1', '45000',
     to_char(v_today - 150, 'YYYY-MM-DD'),
     to_char(v_today - 60,  'YYYY-MM-DD'),
     to_char(v_today - 15,  'YYYY-MM-DD'), 'EDGE');

  -- Funding rows (project_funding columns are TEXT)
  -- 10kW × $4.50/W = $45K contract.  M1=30%, M2=50%, M3=20%.
  INSERT INTO public.project_funding
    (project_id, m1_amount, m1_status,
     m2_amount, m2_status,
     m3_amount, m3_status)
  VALUES
    ('TEST-TAYLOR-01', '13500', 'Ready To Start',
                       '22500', NULL,
                       '9000',  NULL);

  INSERT INTO public.project_funding
    (project_id,
     m1_amount, m1_status, m1_funded_date, m1_submitted_date,
     m2_amount, m2_status,                 m2_submitted_date,
     m3_amount, m3_status)
  VALUES
    ('TEST-TAYLOR-02',
     '13500', 'Funded',    to_char(v_today - 80, 'YYYY-MM-DD'), to_char(v_today - 85, 'YYYY-MM-DD'),
     '22500', 'Submitted',                                       to_char(v_today - 35, 'YYYY-MM-DD'),
     '9000',  NULL);

  INSERT INTO public.project_funding
    (project_id,
     m1_amount, m1_status, m1_funded_date, m1_submitted_date,
     m2_amount, m2_status, m2_funded_date, m2_submitted_date,
     m3_amount, m3_status,                 m3_submitted_date,
     nonfunded_code_1, m3_nonfunded_code_1, m3_notes)
  VALUES
    ('TEST-TAYLOR-03',
     '13500', 'Funded', to_char(v_today - 140, 'YYYY-MM-DD'), to_char(v_today - 145, 'YYYY-MM-DD'),
     '22500', 'Funded', to_char(v_today - 50,  'YYYY-MM-DD'), to_char(v_today - 55,  'YYYY-MM-DD'),
     '9000',  'Pending Resolution',                            to_char(v_today - 10,  'YYYY-MM-DD'),
     'ACH',   'ACH',  'TEST FIXTURE — Customer ACH form not yet returned. Reach out to consultant.');

  v_inserted := 3;

  RETURN jsonb_build_object(
    'ok',         true,
    'projects',   v_inserted,
    'reseeded_at', now(),
    'caller',     v_caller
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_reseed_taylor_test_projects() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.atlas_reseed_taylor_test_projects() TO authenticated;

COMMENT ON FUNCTION public.atlas_reseed_taylor_test_projects() IS
  'Deletes TEST-TAYLOR-* projects + funding rows, re-creates 3 fixtures covering M1-Ready / M2-Submitted-Aging / M3-Pending-Resolution scenarios. Finance/admin only. Safe by prefix isolation — does not touch real data.';

-- Initial seed (call as platform; bypass the RPC gate for the install-time seed)
DO $$
DECLARE
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_today  date := current_date;
BEGIN
  DELETE FROM public.project_funding WHERE project_id LIKE 'TEST-TAYLOR-%';
  DELETE FROM public.projects        WHERE id         LIKE 'TEST-TAYLOR-%';

  INSERT INTO public.projects
    (id, name, financier, disposition, stage, org_id, address, city, state, zip,
     email, phone, systemkw, module_qty, battery_qty, inverter_qty, contract,
     sale_date, financing_type)
  VALUES
    ('TEST-TAYLOR-01', 'TEST: Taylor Alpha (M1 Ready)',
     'EDGE', 'Sale', 'evaluation', v_org_id, '100 Test Lane', 'Houston', 'TX', '77002',
     'taylor.alpha@example.test', '+15555550101', '10.0', '23', '2', '1', '45000',
     to_char(v_today - 7, 'YYYY-MM-DD'), 'EDGE');

  INSERT INTO public.projects
    (id, name, financier, disposition, stage, org_id, address, city, state, zip,
     email, phone, systemkw, module_qty, battery_qty, inverter_qty, contract,
     sale_date, install_complete_date, financing_type)
  VALUES
    ('TEST-TAYLOR-02', 'TEST: Taylor Bravo (M2 Submitted, Aging)',
     'EDGE', 'Sale', 'install', v_org_id, '200 Test Lane', 'Houston', 'TX', '77002',
     'taylor.bravo@example.test', '+15555550202', '10.0', '23', '2', '1', '45000',
     to_char(v_today - 90, 'YYYY-MM-DD'), to_char(v_today - 40, 'YYYY-MM-DD'), 'EDGE');

  INSERT INTO public.projects
    (id, name, financier, disposition, stage, org_id, address, city, state, zip,
     email, phone, systemkw, module_qty, battery_qty, inverter_qty, contract,
     sale_date, install_complete_date, pto_date, financing_type)
  VALUES
    ('TEST-TAYLOR-03', 'TEST: Taylor Charlie (M3 Pending Resolution)',
     'EDGE', 'Sale', 'inspection', v_org_id, '300 Test Lane', 'Houston', 'TX', '77002',
     'taylor.charlie@example.test', '+15555550303', '10.0', '23', '2', '1', '45000',
     to_char(v_today - 150, 'YYYY-MM-DD'), to_char(v_today - 60, 'YYYY-MM-DD'),
     to_char(v_today - 15, 'YYYY-MM-DD'), 'EDGE');

  INSERT INTO public.project_funding
    (project_id, m1_amount, m1_status, m2_amount, m3_amount)
  VALUES
    ('TEST-TAYLOR-01', '13500', 'Ready To Start', '22500', '9000');

  INSERT INTO public.project_funding
    (project_id,
     m1_amount, m1_status, m1_funded_date, m1_submitted_date,
     m2_amount, m2_status, m2_submitted_date, m3_amount)
  VALUES
    ('TEST-TAYLOR-02',
     '13500', 'Funded', to_char(v_today - 80, 'YYYY-MM-DD'), to_char(v_today - 85, 'YYYY-MM-DD'),
     '22500', 'Submitted', to_char(v_today - 35, 'YYYY-MM-DD'),
     '9000');

  INSERT INTO public.project_funding
    (project_id,
     m1_amount, m1_status, m1_funded_date, m1_submitted_date,
     m2_amount, m2_status, m2_funded_date, m2_submitted_date,
     m3_amount, m3_status, m3_submitted_date,
     nonfunded_code_1, m3_nonfunded_code_1, m3_notes)
  VALUES
    ('TEST-TAYLOR-03',
     '13500', 'Funded', to_char(v_today - 140, 'YYYY-MM-DD'), to_char(v_today - 145, 'YYYY-MM-DD'),
     '22500', 'Funded', to_char(v_today - 50,  'YYYY-MM-DD'), to_char(v_today - 55,  'YYYY-MM-DD'),
     '9000',  'Pending Resolution', to_char(v_today - 10, 'YYYY-MM-DD'),
     'ACH', 'ACH', 'TEST FIXTURE — Customer ACH form not yet returned. Reach out to consultant.');
END $$;
