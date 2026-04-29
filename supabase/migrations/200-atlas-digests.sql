-- Atlas Digests: weekly leadership email + daily personal brief

-- ── Weekly digest (leadership email) ─────────────────────────────────────
create table public.atlas_weekly_digests (
  id                bigserial primary key,
  week_start        date not null,
  week_end          date not null,
  composed_at       timestamptz not null default now(),
  draft_gmail_id    text,
  sent_at           timestamptz,
  edited_at_review  boolean,
  highlights_json   jsonb not null,
  platform_notes_json jsonb not null,
  under_the_hood_count int not null default 0,
  warnings_json     jsonb not null default '[]'::jsonb,
  created_by        text not null default 'atlas-weekly-cron',
  unique (week_start)
);

create index atlas_weekly_digests_week_start_idx
  on public.atlas_weekly_digests (week_start desc);

-- ── Weekly recipient list (config) ───────────────────────────────────────
create table public.atlas_weekly_recipients (
  id           bigserial primary key,
  email        text not null unique,
  display_name text not null,
  role_label   text,
  active       boolean not null default true,
  added_at     timestamptz not null default now()
);

-- ── Daily brief (HQ home page) ───────────────────────────────────────────
create table public.atlas_daily_briefs (
  id            bigserial primary key,
  brief_date    date not null unique,
  composed_at   timestamptz not null default now(),
  total_commits int not null,
  user_visible  int not null,
  backend_only  int not null,
  noise_count   int not null,
  sections_json jsonb not null,
  warnings_json jsonb not null default '[]'::jsonb,
  created_by    text not null default 'atlas-daily-cron'
);

create index atlas_daily_briefs_date_idx
  on public.atlas_daily_briefs (brief_date desc);

-- ── Daily brief repo config ──────────────────────────────────────────────
create table public.atlas_daily_brief_repos (
  id            bigserial primary key,
  repo_slug     text not null unique,
  github_owner  text not null,
  github_repo   text not null,
  display_name  text not null,
  brand_color   text,
  prod_url      text,
  bucket        text not null check (bucket in ('work_web', 'work_other', 'personal')),
  active        boolean not null default true,
  added_at      timestamptz not null default now()
);

-- ── RPCs ─────────────────────────────────────────────────────────────────

-- Owner-check helper (per R1 red-team 2026-04-29). SECURITY DEFINER bypasses
-- RLS, so every RPC must guard explicitly. Service role (cron) bypasses the
-- check via session_user; everyone else must carry Greg's email in JWT.
create or replace function public.atlas_assert_owner()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if session_user = 'service_role' then
    return;
  end if;
  if coalesce(auth.jwt() ->> 'email', '') <> 'greg@gomicrogridenergy.com' then
    raise exception 'atlas_digests: owner only' using errcode = '42501';
  end if;
end $$;

create or replace function public.atlas_record_weekly_digest(
  p_week_start date,
  p_week_end date,
  p_highlights jsonb,
  p_platform_notes jsonb,
  p_under_the_hood int,
  p_warnings jsonb default '[]'::jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  perform public.atlas_assert_owner();
  insert into public.atlas_weekly_digests(
    week_start, week_end, highlights_json, platform_notes_json,
    under_the_hood_count, warnings_json
  ) values (
    p_week_start, p_week_end, p_highlights, p_platform_notes, p_under_the_hood, p_warnings
  )
  on conflict (week_start) do update set
    composed_at = now(),
    highlights_json = excluded.highlights_json,
    platform_notes_json = excluded.platform_notes_json,
    under_the_hood_count = excluded.under_the_hood_count,
    warnings_json = excluded.warnings_json
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.atlas_attach_weekly_draft(
  p_id bigint,
  p_gmail_id text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.atlas_assert_owner();
  update public.atlas_weekly_digests set draft_gmail_id = p_gmail_id where id = p_id;
end $$;

create or replace function public.atlas_mark_weekly_sent(
  p_id bigint,
  p_edited boolean
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.atlas_assert_owner();
  update public.atlas_weekly_digests set sent_at = now(), edited_at_review = p_edited where id = p_id;
end $$;

create or replace function public.atlas_list_weekly_recipients()
returns setof public.atlas_weekly_recipients
language plpgsql security definer set search_path = public stable
as $$
begin
  perform public.atlas_assert_owner();
  return query
    select * from public.atlas_weekly_recipients where active = true order by display_name;
end $$;

create or replace function public.atlas_record_daily_brief(
  p_brief_date date,
  p_total int,
  p_user_visible int,
  p_backend int,
  p_noise int,
  p_sections jsonb,
  p_warnings jsonb default '[]'::jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  perform public.atlas_assert_owner();
  insert into public.atlas_daily_briefs(
    brief_date, total_commits, user_visible, backend_only, noise_count,
    sections_json, warnings_json
  ) values (
    p_brief_date, p_total, p_user_visible, p_backend, p_noise, p_sections, p_warnings
  )
  on conflict (brief_date) do update set
    composed_at = now(),
    total_commits = excluded.total_commits,
    user_visible = excluded.user_visible,
    backend_only = excluded.backend_only,
    noise_count = excluded.noise_count,
    sections_json = excluded.sections_json,
    warnings_json = excluded.warnings_json
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.atlas_get_daily_brief(p_date date)
returns public.atlas_daily_briefs
language plpgsql security definer set search_path = public stable
as $$
declare r public.atlas_daily_briefs;
begin
  perform public.atlas_assert_owner();
  select * into r from public.atlas_daily_briefs where brief_date = p_date;
  return r;
end $$;

create or replace function public.atlas_list_daily_brief_dates(p_limit int default 60)
returns table(brief_date date, total_commits int)
language plpgsql security definer set search_path = public stable
as $$
begin
  perform public.atlas_assert_owner();
  return query
    select b.brief_date, b.total_commits
    from public.atlas_daily_briefs b
    order by b.brief_date desc
    limit least(coalesce(p_limit, 60), 365);
end $$;

create or replace function public.atlas_list_daily_brief_repos()
returns setof public.atlas_daily_brief_repos
language plpgsql security definer set search_path = public stable
as $$
begin
  perform public.atlas_assert_owner();
  return query
    select * from public.atlas_daily_brief_repos where active = true order by bucket, display_name;
end $$;

-- ── Lock down EXECUTE per atlas_* convention ─────────────────────────────
revoke execute on function public.atlas_assert_owner() from public;
grant execute on function public.atlas_assert_owner() to authenticated;
revoke execute on function public.atlas_record_weekly_digest(date,date,jsonb,jsonb,int,jsonb) from public;
revoke execute on function public.atlas_attach_weekly_draft(bigint,text) from public;
revoke execute on function public.atlas_mark_weekly_sent(bigint,boolean) from public;
revoke execute on function public.atlas_list_weekly_recipients() from public;
revoke execute on function public.atlas_record_daily_brief(date,int,int,int,int,jsonb,jsonb) from public;
revoke execute on function public.atlas_get_daily_brief(date) from public;
revoke execute on function public.atlas_list_daily_brief_dates(int) from public;
revoke execute on function public.atlas_list_daily_brief_repos() from public;

grant execute on function public.atlas_record_weekly_digest(date,date,jsonb,jsonb,int,jsonb) to authenticated;
grant execute on function public.atlas_attach_weekly_draft(bigint,text) to authenticated;
grant execute on function public.atlas_mark_weekly_sent(bigint,boolean) to authenticated;
grant execute on function public.atlas_list_weekly_recipients() to authenticated;
grant execute on function public.atlas_record_daily_brief(date,int,int,int,int,jsonb,jsonb) to authenticated;
grant execute on function public.atlas_get_daily_brief(date) to authenticated;
grant execute on function public.atlas_list_daily_brief_dates(int) to authenticated;
grant execute on function public.atlas_list_daily_brief_repos() to authenticated;

-- ── RLS — owner-only on the read RPCs and tables ─────────────────────────
alter table public.atlas_weekly_digests enable row level security;
alter table public.atlas_weekly_recipients enable row level security;
alter table public.atlas_daily_briefs enable row level security;
alter table public.atlas_daily_brief_repos enable row level security;

create policy atlas_weekly_digests_owner on public.atlas_weekly_digests
  for all using (auth.jwt() ->> 'email' = 'greg@gomicrogridenergy.com');
create policy atlas_weekly_recipients_owner on public.atlas_weekly_recipients
  for all using (auth.jwt() ->> 'email' = 'greg@gomicrogridenergy.com');
create policy atlas_daily_briefs_owner on public.atlas_daily_briefs
  for all using (auth.jwt() ->> 'email' = 'greg@gomicrogridenergy.com');
create policy atlas_daily_brief_repos_owner on public.atlas_daily_brief_repos
  for all using (auth.jwt() ->> 'email' = 'greg@gomicrogridenergy.com');
