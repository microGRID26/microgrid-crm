-- 096-qa-daily-driver.sql
-- Daily QA driver: hand each tester one specific test case per day on the
-- /command dashboard. Builds on the existing test_plans / test_cases /
-- test_results / test_assignments tables (085).
--
-- Already applied to production via Supabase MCP apply_migration on
-- 2026-04-09. This file is the source-of-truth copy.

create table qa_runs (
  id              uuid primary key default gen_random_uuid(),
  -- text to match the existing test_results.tester_id convention (= users.id)
  tester_id       text not null,
  test_case_id    uuid not null references test_cases(id) on delete cascade,
  status          text not null default 'started'
                  check (status in ('started','pass','fail','blocked','skipped','abandoned')),
  star_rating     int  check (star_rating between 1 and 5),
  notes           text,
  screenshot_url  text,
  device_type     text,
  user_agent      text,
  viewport_width  int,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  duration_ms     int,
  test_result_id  uuid references test_results(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index qa_runs_tester_id_idx       on qa_runs(tester_id);
create index qa_runs_test_case_id_idx    on qa_runs(test_case_id);
create index qa_runs_status_idx          on qa_runs(status);
create index qa_runs_started_at_idx      on qa_runs(started_at desc);
-- Composite for the "has tester X done a run today?" hot query.
-- (Note: a (started_at::date) functional index is not allowed because the
-- timestamptz->date cast is not IMMUTABLE.)
create index qa_runs_tester_started_idx  on qa_runs(tester_id, started_at desc);

create table qa_run_events (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references qa_runs(id) on delete cascade,
  event_type  text not null,
  url         text,
  message     text,
  metadata    jsonb,
  elapsed_ms  int not null,
  created_at  timestamptz not null default now()
);

create index qa_run_events_run_id_idx     on qa_run_events(run_id);
create index qa_run_events_event_type_idx on qa_run_events(event_type);

-- RLS — mirror existing test_results pattern (permissive read/write for
-- authenticated users; sensitive ops are gated at the API layer).
alter table qa_runs       enable row level security;
alter table qa_run_events enable row level security;

create policy "qa_runs_read"   on qa_runs       for select to authenticated using (true);
create policy "qa_runs_insert" on qa_runs       for insert to authenticated with check (true);
create policy "qa_runs_update" on qa_runs       for update to authenticated using (true);

create policy "qa_run_events_read"   on qa_run_events for select to authenticated using (true);
create policy "qa_run_events_insert" on qa_run_events for insert to authenticated with check (true);

-- Admins can also manage everything explicitly via auth_is_admin().
create policy "qa_runs_admin"       on qa_runs       for all to authenticated using (auth_is_admin()) with check (auth_is_admin());
create policy "qa_run_events_admin" on qa_run_events for all to authenticated using (auth_is_admin()) with check (auth_is_admin());
