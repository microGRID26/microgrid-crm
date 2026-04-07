-- 084: Customer Direct Messages — PM ↔ Customer chat
-- Real-time messaging between customers and their project managers

CREATE TABLE IF NOT EXISTS customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'pm', 'system')),
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customer_messages_project ON customer_messages(project_id);
CREATE INDEX idx_customer_messages_created ON customer_messages(created_at DESC);
CREATE INDEX idx_customer_messages_unread ON customer_messages(project_id, author_type, read_at) WHERE read_at IS NULL;

-- Enable realtime
ALTER TABLE customer_messages REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;

-- Customers read/write their own project messages
CREATE POLICY cm_customer_select ON customer_messages
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY cm_customer_insert ON customer_messages
  FOR INSERT WITH CHECK (
    author_type = 'customer' AND
    project_id IN (
      SELECT project_id FROM customer_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- CRM users: org-scoped read/write
CREATE POLICY cm_org_select ON customer_messages
  FOR SELECT USING (
    org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user()
  );

CREATE POLICY cm_org_insert ON customer_messages
  FOR INSERT WITH CHECK (
    org_id IS NULL OR org_id = ANY(auth_user_org_ids()) OR auth_is_platform_user()
  );

-- Mark messages read (customers + CRM)
CREATE POLICY cm_update_read ON customer_messages
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Enable Supabase Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE customer_messages;
