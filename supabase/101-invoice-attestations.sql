-- 101-invoice-attestations.sql — EPC attestation capture (Tier 2 Phase 1.6)
--
-- Per Mark Bench in the 2026-04-13 meeting, the EPC → EDGE invoice carries
-- a certification block at the bottom that the EPC signs to attest that
-- their internal cost allocations (labor, project management, overhead) are
-- accurate, since those rows have no external proof of payment.
--
-- Mark's exact language (rendered on the PDF in lib/invoices/pdf.tsx):
--   "EPC certifies that the internal allocations shown for this project are
--    derived from its project cost records and reasonably reflect costs
--    incurred in originating, engineering, procuring, constructing,
--    commissioning, and delivering the completed project invoice to EDGE."
--
-- This migration adds the table that captures the signed attestations so
-- they're auditable per project. The signing flow (POST /api/invoices/[id]/attest)
-- writes a row here when an EPC user signs an invoice via signed link.

CREATE TABLE IF NOT EXISTS public.invoice_attestations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  attesting_org_id    UUID NOT NULL REFERENCES public.organizations(id),
  attesting_user_id   UUID,                       -- nullable: external EPC users may not have a CRM user row
  attesting_name      TEXT NOT NULL,              -- printed name as typed by signer
  attesting_title     TEXT,
  attestation_text    TEXT NOT NULL,              -- snapshot of the language at sign time (tracks future text changes)
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_method    TEXT NOT NULL DEFAULT 'typed'
                      CHECK (signature_method IN ('typed', 'drawn', 'uploaded')),
  signature_data      TEXT,                       -- base64 PNG for drawn/uploaded; null for typed
  ip_address          TEXT,                       -- captured for audit
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One attestation per invoice — replacing requires explicit user action.
-- Uniqueness lets us treat the table as "is this invoice attested?" via
-- a single row lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_attestations_invoice
  ON public.invoice_attestations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_attestations_org
  ON public.invoice_attestations(attesting_org_id);

CREATE INDEX IF NOT EXISTS idx_invoice_attestations_signed_at
  ON public.invoice_attestations(signed_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same visibility model as the parent invoice: members of from_org or to_org
-- can see attestations for their own invoices; platform users see all.

ALTER TABLE invoice_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_attestations_select ON invoice_attestations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_id
    AND (i.from_org = ANY(auth_user_org_ids()) OR i.to_org = ANY(auth_user_org_ids()) OR auth_is_platform_user())
  ));

CREATE POLICY invoice_attestations_insert ON invoice_attestations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices i WHERE i.id = invoice_id
    AND (i.from_org = ANY(auth_user_org_ids()) OR auth_is_platform_user())
  ));

CREATE POLICY invoice_attestations_delete ON invoice_attestations
  FOR DELETE TO authenticated
  USING (auth_is_platform_user() OR auth_is_super_admin());

-- No UPDATE policy: attestations are append-only. To replace, delete + re-insert.

COMMENT ON TABLE public.invoice_attestations IS
  'EPC certification signatures captured per invoice (typically the EPC → EDGE chain link). Append-only; one attestation per invoice via unique index.';
