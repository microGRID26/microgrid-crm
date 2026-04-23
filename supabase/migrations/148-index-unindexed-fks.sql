-- Migration 148: add 33 missing covering indexes for foreign keys flagged by
-- Supabase performance advisor `unindexed_foreign_keys`.
--
-- Rationale: Postgres doesn't auto-create indexes for FK columns on the
-- referencing side. Without one, every ON DELETE CASCADE or referential
-- check scans the dependent table. For MG's volume today the impact is
-- small, but these grow linearly with table size — ship the indexes now
-- while tables are still modest.
--
-- `IF NOT EXISTS` makes the migration idempotent and safe to re-run.
-- `apply_migration` runs in a transaction so CONCURRENTLY isn't available;
-- each CREATE INDEX takes an ACCESS EXCLUSIVE lock on the target table
-- briefly. Every targeted table has modest row counts (<100k), so per-index
-- lock time should be sub-second.
--
-- Reversible via `drop index <name>` — all names below follow the
-- idx_<table>_<col> convention and don't collide with anything existing.

begin;

create index if not exists idx_atlas_eval_run_reservations_eval_run_id    on public.atlas_eval_run_reservations (eval_run_id);
create index if not exists idx_atlas_hq_users_invited_by                   on public.atlas_hq_users (invited_by);
create index if not exists idx_atlas_kb_entries_approved_by                on public.atlas_kb_entries (approved_by);
create index if not exists idx_atlas_kb_entries_created_by                 on public.atlas_kb_entries (created_by);
create index if not exists idx_atlas_questions_user_id                     on public.atlas_questions (user_id);
create index if not exists idx_commission_config_org_id                    on public.commission_config (org_id);
create index if not exists idx_customer_billing_statements_org_id          on public.customer_billing_statements (org_id);
create index if not exists idx_customer_messages_org_id                    on public.customer_messages (org_id);
create index if not exists idx_edge_model_scenarios_locked_by              on public.edge_model_scenarios (locked_by);
create index if not exists idx_entity_profit_transfers_project_id          on public.entity_profit_transfers (project_id);
create index if not exists idx_epc_underwriting_fees_invoice_id            on public.epc_underwriting_fees (invoice_id);
create index if not exists idx_epc_underwriting_fees_relationship_id       on public.epc_underwriting_fees (relationship_id);
create index if not exists idx_invoices_rule_id                            on public.invoices (rule_id);
create index if not exists idx_partner_api_keys_created_by_id              on public.partner_api_keys (created_by_id);
create index if not exists idx_partner_api_keys_revoked_by_id              on public.partner_api_keys (revoked_by_id);
create index if not exists idx_partner_webhook_subscriptions_api_key_id    on public.partner_webhook_subscriptions (api_key_id);
create index if not exists idx_paul_assumption_corrections_assumption_id   on public.paul_assumption_corrections (assumption_id);
create index if not exists idx_po_line_items_equipment_id                  on public.po_line_items (equipment_id);
create index if not exists idx_po_line_items_material_id                   on public.po_line_items (material_id);
create index if not exists idx_project_cost_line_items_paid_from_org_id    on public.project_cost_line_items (paid_from_org_id);
create index if not exists idx_project_cost_line_items_paid_to_org_id      on public.project_cost_line_items (paid_to_org_id);
create index if not exists idx_project_cost_line_items_template_id         on public.project_cost_line_items (template_id);
create index if not exists idx_projects_origination_partner_actor_id       on public.projects (origination_partner_actor_id);
create index if not exists idx_qa_runs_test_result_id                      on public.qa_runs (test_result_id);
create index if not exists idx_rep_files_rep_id                            on public.rep_files (rep_id);
create index if not exists idx_rep_licenses_rep_id                         on public.rep_licenses (rep_id);
create index if not exists idx_sales_reps_split_partner_id                 on public.sales_reps (split_partner_id);
create index if not exists idx_ticket_categories_org_id                    on public.ticket_categories (org_id);
create index if not exists idx_ticket_resolution_codes_org_id              on public.ticket_resolution_codes (org_id);
create index if not exists idx_tickets_related_ticket_id                   on public.tickets (related_ticket_id);
create index if not exists idx_time_entries_work_order_id                  on public.time_entries (work_order_id);
create index if not exists idx_workmanship_claims_deployed_epc_id          on public.workmanship_claims (deployed_epc_id);
create index if not exists idx_workmanship_claims_project_id               on public.workmanship_claims (project_id);

commit;
