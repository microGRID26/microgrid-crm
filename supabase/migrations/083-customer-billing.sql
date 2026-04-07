-- 083: Customer Billing — Monthly kWh statements, payment methods (Stripe), payment history
-- Separate from B2B invoices table — this is customer-facing billing at $0.12/kWh

-- ── Customer Billing Statements (monthly) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_billing_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  kwh_consumed NUMERIC(10,2) DEFAULT 0,
  rate_per_kwh NUMERIC(6,4) DEFAULT 0.1200,
  amount_due NUMERIC(10,2) GENERATED ALWAYS AS (kwh_consumed * rate_per_kwh) STORED,
  utility_comparison NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cbs_customer ON customer_billing_statements(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_cbs_project ON customer_billing_statements(project_id);
CREATE INDEX IF NOT EXISTS idx_cbs_status ON customer_billing_statements(status);
CREATE INDEX IF NOT EXISTS idx_cbs_period ON customer_billing_statements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cbs_org ON customer_billing_statements(org_id);

-- RLS
ALTER TABLE customer_billing_statements ENABLE ROW LEVEL SECURITY;

-- Customers read own statements
CREATE POLICY cbs_customer_select ON customer_billing_statements
  FOR SELECT USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Org-scoped read for CRM users
CREATE POLICY cbs_org_select ON customer_billing_statements
  FOR SELECT USING (
    org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user()
  );

-- CRM users can insert/update within their org
CREATE POLICY cbs_org_insert ON customer_billing_statements
  FOR INSERT WITH CHECK (
    org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user()
  );

CREATE POLICY cbs_org_update ON customer_billing_statements
  FOR UPDATE USING (
    org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user()
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cbs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cbs_updated_at
  BEFORE UPDATE ON customer_billing_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_cbs_updated_at();

COMMENT ON TABLE customer_billing_statements IS 'Monthly customer billing statements — kWh consumption at fixed rate';

-- ── Customer Payment Methods (Stripe) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT true,
  autopay_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cpm_customer ON customer_payment_methods(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_cpm_stripe_customer ON customer_payment_methods(stripe_customer_id);

-- RLS
ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;

-- Customers read own payment methods
CREATE POLICY cpm_customer_select ON customer_payment_methods
  FOR SELECT USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Customers can insert their own payment methods
CREATE POLICY cpm_customer_insert ON customer_payment_methods
  FOR INSERT WITH CHECK (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Customers can update their own payment methods (toggle autopay, default)
CREATE POLICY cpm_customer_update ON customer_payment_methods
  FOR UPDATE USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Customers can delete their own payment methods
CREATE POLICY cpm_customer_delete ON customer_payment_methods
  FOR DELETE USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Platform/CRM users can read all (for support)
CREATE POLICY cpm_platform_select ON customer_payment_methods
  FOR SELECT USING (auth_is_platform_user());

COMMENT ON TABLE customer_payment_methods IS 'Stripe payment methods for customer autopay/billing';

-- ── Customer Payments (transaction history) ────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES customer_billing_statements(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cp_customer ON customer_payments(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_cp_statement ON customer_payments(statement_id);
CREATE INDEX IF NOT EXISTS idx_cp_status ON customer_payments(status);
CREATE INDEX IF NOT EXISTS idx_cp_paid_at ON customer_payments(paid_at);

-- RLS
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

-- Customers read own payments
CREATE POLICY cp_customer_select ON customer_payments
  FOR SELECT USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Org-scoped read for CRM users (via statement -> org_id)
CREATE POLICY cp_org_select ON customer_payments
  FOR SELECT USING (
    customer_account_id IN (
      SELECT ca.id FROM customer_accounts ca
      JOIN customer_billing_statements cbs ON cbs.customer_account_id = ca.id
      WHERE cbs.org_id IS NULL OR cbs.org_id = ANY(auth_user_org_ids())
    )
    OR auth_is_platform_user()
  );

-- CRM/platform can insert payments (webhook handlers, manual)
CREATE POLICY cp_platform_insert ON customer_payments
  FOR INSERT WITH CHECK (auth_is_platform_user());

-- CRM/platform can update payment status (refunds, etc.)
CREATE POLICY cp_platform_update ON customer_payments
  FOR UPDATE USING (auth_is_platform_user());

COMMENT ON TABLE customer_payments IS 'Customer payment transactions — linked to Stripe payment intents';
