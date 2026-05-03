-- 221: Customer-table RLS fixes — Phase 2 audit findings
--
-- Addresses red-teamer audit findings from 2026-05-03 against the native
-- customer app (mobile/) ahead of unified-app public launch:
--
-- CRITICAL #1: customer_accounts UPDATE policy had WITH CHECK = NULL (Postgres
-- treats this as permissive), letting a customer rewrite their own row's
-- project_id to any other customer's project_id. After that swap every
-- downstream policy keyed on "project_id IN (SELECT FROM customer_accounts
-- WHERE auth_user_id = auth.uid())" granted full access to the victim's
-- project (projects, tickets, schedule, customer_messages, project_files,
-- equipment_warranties, etc.).
--
-- HIGH #2: customer_messages INSERT pinned author_type='customer' but let the
-- client supply any author_name. A customer could post messages signed as
-- "MicroGRID PM" or "Tessa" → phishing surface in the staff inbox.
--
-- HIGH #3: cm_customer_update_read let customer flip read_at on ANY row in
-- their project (including their own outbound messages, columns other than
-- read_at) → could mark inbound PM messages "read" before staff sees them.
--
-- HIGH #4: storage.buckets.customer-feedback had NULL file_size_limit + NULL
-- allowed_mime_types. ticket-attachments was already configured correctly.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. customer_accounts — replace the over-broad UPDATE policy + add a trigger
-- that blocks customers from mutating immutable columns.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS customer_accounts_admin_update ON public.customer_accounts;

-- (a) Customers can update their own row. The trigger below restricts WHICH
-- columns a non-admin can change.
CREATE POLICY customer_accounts_self_update ON public.customer_accounts
  FOR UPDATE
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- (b) Admins can update any row.
CREATE POLICY customer_accounts_admin_update ON public.customer_accounts
  FOR UPDATE
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

CREATE OR REPLACE FUNCTION public.customer_accounts_protect_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role tooling (admin endpoints, backfills, support impersonation)
  -- bypasses the column allowlist entirely. The service-role JWT has
  -- claims.role = 'service_role'.
  IF coalesce(
       current_setting('request.jwt.claim.role', true),
       (current_setting('request.jwt.claims', true)::jsonb)->>'role'
     ) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins (via the public.users role enum) can change anything.
  IF auth_is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin (customer self-updating) — block changes to immutable columns.
  -- Mutable columns: name, phone, notification_prefs, push_token,
  --                  nps_prompts_shown, last_login_at, updated_at
  -- Immutable from customer side: id, auth_user_id, email, project_id, status,
  --                                invited_by, invited_at, created_at
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'cannot change customer_accounts.id'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'cannot change customer_accounts.auth_user_id'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'cannot change customer_accounts.email'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'cannot change customer_accounts.project_id'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'cannot change customer_accounts.status'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
    RAISE EXCEPTION 'cannot change customer_accounts.invited_by'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.invited_at IS DISTINCT FROM OLD.invited_at THEN
    RAISE EXCEPTION 'cannot change customer_accounts.invited_at'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'cannot change customer_accounts.created_at'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_accounts_protect_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS customer_accounts_protect_columns_trg ON public.customer_accounts;
CREATE TRIGGER customer_accounts_protect_columns_trg
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_accounts_protect_columns();

-- ──────────────────────────────────────────────────────────────────────────
-- 2. customer_messages — pin author_name on customer-authored inserts.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.customer_messages_pin_author_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_real_name TEXT;
BEGIN
  -- Only enforce on customer-authored inserts. PM/system inserts come through
  -- the staff side which is allowed to set the author_name freely.
  IF NEW.author_type IS DISTINCT FROM 'customer' THEN
    RETURN NEW;
  END IF;

  -- Staff impersonating a customer for support? auth_is_admin() bypass keeps
  -- the door open for legitimate admin tooling.
  IF auth_is_admin() THEN
    RETURN NEW;
  END IF;

  -- Look up the real customer name from customer_accounts. Must match the
  -- caller's auth.uid() AND the project_id being inserted into.
  SELECT name INTO v_real_name
  FROM customer_accounts
  WHERE auth_user_id = (SELECT auth.uid())
    AND project_id = NEW.project_id
  LIMIT 1;

  IF v_real_name IS NULL THEN
    RAISE EXCEPTION 'cannot insert customer_messages: no matching customer_account for auth.uid() + project_id'
      USING ERRCODE = '42501';
  END IF;

  -- Override whatever the client supplied with the real name.
  NEW.author_name := v_real_name;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_messages_pin_author_name() FROM PUBLIC;

DROP TRIGGER IF EXISTS customer_messages_pin_author_name_trg ON public.customer_messages;
CREATE TRIGGER customer_messages_pin_author_name_trg
  BEFORE INSERT ON public.customer_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_messages_pin_author_name();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. customer_messages — tighten cm_customer_update_read so customers can only
-- mark inbound (PM/system) messages as read, and only the read_at column
-- changes.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS cm_customer_update_read ON public.customer_messages;

CREATE POLICY cm_customer_update_read ON public.customer_messages
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM customer_accounts
      WHERE auth_user_id = (SELECT auth.uid())
    )
    AND author_type IN ('pm', 'system')
  )
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM customer_accounts
      WHERE auth_user_id = (SELECT auth.uid())
    )
    AND author_type IN ('pm', 'system')
  );

-- Trigger enforces column-level immutability on customer-side updates.
CREATE OR REPLACE FUNCTION public.customer_messages_restrict_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role bypass (admin tooling, support impersonation).
  IF coalesce(
       current_setting('request.jwt.claim.role', true),
       (current_setting('request.jwt.claims', true)::jsonb)->>'role'
     ) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Internal users / admins (via public.users role enum) can change anything.
  IF auth_is_admin() OR auth_is_internal_writer() THEN
    RETURN NEW;
  END IF;

  -- Customer caller — only read_at can change.
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'cannot edit customer_messages.message' USING ERRCODE = '42501';
  END IF;
  IF NEW.author_type IS DISTINCT FROM OLD.author_type THEN
    RAISE EXCEPTION 'cannot change customer_messages.author_type' USING ERRCODE = '42501';
  END IF;
  IF NEW.author_name IS DISTINCT FROM OLD.author_name THEN
    RAISE EXCEPTION 'cannot change customer_messages.author_name' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'cannot change customer_messages.created_at' USING ERRCODE = '42501';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'cannot change customer_messages.project_id' USING ERRCODE = '42501';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'cannot change customer_messages.org_id' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'cannot change customer_messages.id' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_messages_restrict_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS customer_messages_restrict_columns_trg ON public.customer_messages;
CREATE TRIGGER customer_messages_restrict_columns_trg
  BEFORE UPDATE ON public.customer_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_messages_restrict_columns();

-- ──────────────────────────────────────────────────────────────────────────
-- 4. storage bucket customer-feedback — add file_size_limit + MIME allowlist.
-- ticket-attachments was already configured correctly (10 MB + safe MIMEs).
-- ──────────────────────────────────────────────────────────────────────────

UPDATE storage.buckets
SET file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/gif',
      'application/pdf'
    ]
WHERE id = 'customer-feedback';

COMMIT;
