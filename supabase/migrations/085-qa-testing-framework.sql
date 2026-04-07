-- 085-qa-testing-framework.sql
-- QA Testing Framework: plans, cases, results, assignments, comments
-- Enables structured UAT for Zach, Marlie, Heidi, and future testers

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS test_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  role_filter TEXT NOT NULL DEFAULT 'all',  -- 'all', 'admin', 'manager', 'user'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE test_plans IS 'Groups of related test cases for structured QA';

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  expected_result TEXT,
  page_url TEXT,                            -- deep link e.g. '/pipeline'
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE test_cases IS 'Individual test steps within a plan';

CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  tester_id TEXT NOT NULL,                  -- user email or auth ID
  tester_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pass', 'fail', 'blocked', 'skipped')),
  feedback TEXT,
  screenshot_path TEXT,
  needs_retest BOOLEAN DEFAULT false,
  retest_note TEXT,
  tested_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE test_results IS 'Tester verdict on each case — pass/fail/blocked/skipped';

CREATE TABLE IF NOT EXISTS test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  tester_id TEXT NOT NULL,
  assigned_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(test_case_id, tester_id)
);

COMMENT ON TABLE test_assignments IS 'Assign specific cases to specific testers';

CREATE TABLE IF NOT EXISTS test_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE test_comments IS 'Discussion threads on test results';

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Foreign-key indexes (Postgres doesn't auto-index FK columns)
CREATE INDEX idx_test_cases_plan_id        ON test_cases(plan_id);
CREATE INDEX idx_test_results_case_id      ON test_results(test_case_id);
CREATE INDEX idx_test_results_tester_id    ON test_results(tester_id);
CREATE INDEX idx_test_results_status       ON test_results(status);
CREATE INDEX idx_test_assignments_case_id  ON test_assignments(test_case_id);
CREATE INDEX idx_test_assignments_tester   ON test_assignments(tester_id);
CREATE INDEX idx_test_comments_result_id   ON test_comments(test_result_id);

-- Composite index for "my pending tests" query
CREATE INDEX idx_test_results_tester_status ON test_results(tester_id, status);

-- Sort-order indexes for plan/case ordering
CREATE INDEX idx_test_plans_sort           ON test_plans(sort_order);
CREATE INDEX idx_test_cases_sort           ON test_cases(plan_id, sort_order);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_comments ENABLE ROW LEVEL SECURITY;

-- Plans & Cases: all authenticated users can read
CREATE POLICY "test_plans_read"
  ON test_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "test_plans_admin_write"
  ON test_plans FOR ALL
  TO authenticated
  USING (
    auth_is_admin()
  );

CREATE POLICY "test_cases_read"
  ON test_cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "test_cases_admin_write"
  ON test_cases FOR ALL
  TO authenticated
  USING (
    auth_is_admin()
  );

-- Results: testers can insert/update their own, admins manage all
CREATE POLICY "test_results_read"
  ON test_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "test_results_own_insert"
  ON test_results FOR INSERT
  TO authenticated
  WITH CHECK (
    tester_id = auth.uid()::text
    OR tester_id = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "test_results_own_update"
  ON test_results FOR UPDATE
  TO authenticated
  USING (
    tester_id = auth.uid()::text
    OR tester_id = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "test_results_admin_all"
  ON test_results FOR ALL
  TO authenticated
  USING (
    auth_is_admin()
  );

-- Assignments: all read, admins write
CREATE POLICY "test_assignments_read"
  ON test_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "test_assignments_admin_write"
  ON test_assignments FOR ALL
  TO authenticated
  USING (
    auth_is_admin()
  );

-- Comments: all read, own insert/update
CREATE POLICY "test_comments_read"
  ON test_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "test_comments_own_insert"
  ON test_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()::text
    OR author_id = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "test_comments_own_update"
  ON test_comments FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()::text
    OR author_id = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "test_comments_admin_all"
  ON test_comments FOR ALL
  TO authenticated
  USING (
    auth_is_admin()
  );

-- ============================================================
-- 4. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE test_results;
