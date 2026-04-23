-- Migration 147: drop 9 duplicate indexes flagged by Supabase performance advisor.
--
-- Each pair below contains two indexes that index the exact same column set.
-- Keeping both wastes disk, doubles write-amplification, and clutters plans.
-- Postgres query planner uses whichever it picks first; the other is dead
-- weight. Drop the longer / less-conventional-name of each pair.
--
-- Reversible via `create index <name> on <table> (<col>)`.

begin;

drop index if exists public.idx_audit_log_project;                   -- keep idx_audit_log_project_id
drop index if exists public.idx_comm_records_org;                    -- keep idx_commission_records_org_id
drop index if exists public.idx_comm_records_status;                 -- keep idx_commission_records_status
drop index if exists public.idx_comm_records_user;                   -- keep idx_commission_records_user_id
drop index if exists public.idx_projects_org;                        -- keep idx_projects_org_id
drop index if exists public.idx_stage_history_project;               -- keep idx_stage_history_project_id
drop index if exists public.idx_task_state_project;                  -- keep idx_task_state_project_id
drop index if exists public.idx_ticket_comments_ticket;              -- keep idx_ticket_comments_ticket_id
drop index if exists public.idx_users_email;                         -- keep users_email_key (unique + functionally equivalent)

commit;
