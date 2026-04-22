-- Migration 141d (incl. 141e/141f fixups): CFO panel RPCs for Paul HQ.
-- Two SECURITY DEFINER service-role-only functions backing the CFO panel:
--   - paul_hq_recent_edge_projects(p_limit) — last N EDGE-financed projects with cost basis
--   - paul_hq_recent_edge_invoices(p_limit) — last N invoices to/from EDGE org
-- Replaces seed data on the Job Costing + Partnership Math cards.

CREATE OR REPLACE FUNCTION public.paul_hq_recent_edge_projects(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v FROM (
    SELECT p.id, p.name, p.stage, p.systemkw, p.created_at,
           s.total_basis, s.itc_eligible_basis, s.itc_eligible_pct, s.line_item_count
      FROM public.projects p
      JOIN public.project_cost_basis_summary s ON s.project_id = p.id
     WHERE p.financier = 'EDGE'
       AND p.id NOT LIKE 'TEST-%'
       AND p.id NOT LIKE 'PROJ-TEST-%'
       AND p.name NOT ILIKE 'TEST%'
       AND s.total_basis IS NOT NULL
     ORDER BY p.created_at DESC
     LIMIT GREATEST(LEAST(p_limit, 50), 1)
  ) r;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.paul_hq_recent_edge_invoices(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_edge uuid := '1f82d049-8e2b-46d5-9fe2-efd8664a91a5';
  v jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v FROM (
    SELECT i.invoice_number, i.project_id, i.status, i.milestone, i.total,
           i.due_date, i.paid_at, i.created_at,
           CASE WHEN i.from_org = v_edge THEN 'outbound' ELSE 'inbound' END AS direction
      FROM public.invoices i
     WHERE i.from_org = v_edge OR i.to_org = v_edge
     ORDER BY i.created_at DESC
     LIMIT GREATEST(LEAST(p_limit, 50), 1)
  ) r;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.paul_hq_recent_edge_projects(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paul_hq_recent_edge_projects(int) TO service_role;

REVOKE ALL ON FUNCTION public.paul_hq_recent_edge_invoices(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paul_hq_recent_edge_invoices(int) TO service_role;
