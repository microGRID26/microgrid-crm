-- 143-paul-hq-morning-board-review.sql
-- Ships: atlas_assumptions + paul_morning_reviews + paul_assumption_corrections
--        + paul_chairman_disagreements + paul_metric_snapshots
-- Absorbs: greg_action #208 (atlas_assumptions replaces the planned markdown file)
-- Depends on: pgcrypto (gen_random_uuid) — already enabled on this project

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- atlas_assumptions (absorbs #208)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.atlas_assumptions (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null,
  project          text,
  assumption_text  text not null,
  context_md       text,
  tags             text[] not null default '{}'::text[],
  status           text not null default 'open'
                   check (status in ('open', 'corrected', 'confirmed', 'stale')),
  logged_at        timestamptz not null default now(),
  corrected_at     timestamptz,
  corrected_by     text,
  history_json     jsonb not null default '[]'::jsonb
);

create index if not exists atlas_assumptions_status_logged_idx
  on public.atlas_assumptions (status, logged_at desc);
create index if not exists atlas_assumptions_tags_gin_idx
  on public.atlas_assumptions using gin (tags);

-- RPC: add assumption (callable from Atlas sessions via helper script)
create or replace function public.atlas_add_assumption(
  p_session_id text,
  p_project    text,
  p_text       text,
  p_context    text,
  p_tags       text[]
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.atlas_assumptions
    (session_id, project, assumption_text, context_md, tags)
  values
    (p_session_id, p_project, p_text, p_context, coalesce(p_tags, '{}'::text[]))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.atlas_add_assumption(text, text, text, text, text[]) from public;
grant execute on function public.atlas_add_assumption(text, text, text, text, text[])
  to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- paul_morning_reviews
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.paul_morning_reviews (
  id                        uuid primary key default gen_random_uuid(),
  review_date               date not null unique,
  generated_at              timestamptz not null default now(),
  synopsis_md               text not null,
  board_output_json         jsonb,
  chairman_verdict_json     jsonb not null default '{"recommendations":[],"top_3_ids":[]}'::jsonb,
  flagged_assumptions_json  jsonb not null default '[]'::jsonb,
  inputs_snapshot_json      jsonb not null default '{}'::jsonb,
  model_id                  text not null,
  tokens_in                 int,
  tokens_out                int,
  cost_usd                  numeric(10,4),
  opened_at                 timestamptz,
  reviewed_at               timestamptz,
  error_md                  text
);

create index if not exists paul_morning_reviews_date_idx
  on public.paul_morning_reviews (review_date desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- paul_assumption_corrections
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.paul_assumption_corrections (
  id                 uuid primary key default gen_random_uuid(),
  review_id          uuid not null references public.paul_morning_reviews(id) on delete cascade,
  assumption_id      uuid not null references public.atlas_assumptions(id) on delete restrict,
  original_text      text not null,
  paul_correction_md text not null,
  corrected_at       timestamptz not null default now(),
  corrected_by_email text not null
);

create index if not exists paul_assumption_corrections_review_idx
  on public.paul_assumption_corrections (review_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- paul_chairman_disagreements
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.paul_chairman_disagreements (
  id                  uuid primary key default gen_random_uuid(),
  review_id           uuid not null references public.paul_morning_reviews(id) on delete cascade,
  chairman_rec_id     text not null,
  dissenting_persona  text not null,
  paul_reasoning_md   text,
  logged_at           timestamptz not null default now()
);

create index if not exists paul_chairman_disagreements_review_idx
  on public.paul_chairman_disagreements (review_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- paul_metric_snapshots
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.paul_metric_snapshots (
  snapshot_date          date primary key,
  open_ar_cents          bigint,
  pipeline_count         int,
  signed_contracts_count int,
  captured_at            timestamptz not null default now(),
  source_run_id          text
);

-- ──────────────────────────────────────────────────────────────────────────────
-- Grants + RLS
-- ──────────────────────────────────────────────────────────────────────────────
revoke all on table public.atlas_assumptions          from anon, authenticated;
revoke all on table public.paul_morning_reviews       from anon, authenticated;
revoke all on table public.paul_assumption_corrections from anon, authenticated;
revoke all on table public.paul_chairman_disagreements from anon, authenticated;
revoke all on table public.paul_metric_snapshots      from anon, authenticated;

grant select, insert, update on table public.atlas_assumptions           to service_role;
grant select, insert, update on table public.paul_morning_reviews        to service_role;
grant select, insert         on table public.paul_assumption_corrections to service_role;
grant select, insert         on table public.paul_chairman_disagreements to service_role;
grant select, insert, update on table public.paul_metric_snapshots       to service_role;

alter table public.atlas_assumptions            enable row level security;
alter table public.paul_morning_reviews         enable row level security;
alter table public.paul_assumption_corrections  enable row level security;
alter table public.paul_chairman_disagreements  enable row level security;
alter table public.paul_metric_snapshots        enable row level security;

commit;
