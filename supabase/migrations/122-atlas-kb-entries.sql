-- ============================================================
-- Atlas in-app KB: role-gated entries, approval workflow, vector search
-- Target: MicroGRID Supabase (hzymsezqfxzpbcqryeim)
-- Depends on: public.users(email, role) with values
--   super_admin | admin | finance | manager | user | sales
-- ============================================================

create extension if not exists vector;

-- ---------- TABLE ----------

create table public.atlas_kb_entries (
  id bigserial primary key,

  title                 text not null,
  question_phrasings    text[] not null default '{}',
  answer_md             text not null,
  escalation_conditions text,
  red_flags             text,

  audience text not null check (audience in ('all', 'sales', 'cio')),

  owner           text not null,
  source_of_truth text,

  status text not null default 'draft'
    check (status in ('draft', 'approved', 'stale', 'archived')),
  last_reviewed_at timestamptz,
  approved_by      uuid references auth.users(id),
  approved_at      timestamptz,

  embedding vector(1536),
  tags      text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ---------- INDEXES ----------

create index idx_kb_audience_status on public.atlas_kb_entries(audience, status);
create index idx_kb_owner           on public.atlas_kb_entries(owner);
create index idx_kb_tags_gin        on public.atlas_kb_entries using gin(tags);
create index idx_kb_phrasings_gin   on public.atlas_kb_entries using gin(question_phrasings);
create index idx_kb_embedding_hnsw  on public.atlas_kb_entries
  using hnsw (embedding vector_cosine_ops);

-- ---------- updated_at TRIGGER ----------

create or replace function public.atlas_kb_entries_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_atlas_kb_entries_updated_at
  before update on public.atlas_kb_entries
  for each row execute function public.atlas_kb_entries_touch_updated_at();

-- ---------- RLS ----------

alter table public.atlas_kb_entries enable row level security;

create policy kb_cio_full on public.atlas_kb_entries
  for all to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.email = auth.jwt() ->> 'email' and u.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.email = auth.jwt() ->> 'email' and u.role = 'super_admin'
    )
  );

create policy kb_employees_read on public.atlas_kb_entries
  for select to authenticated
  using (
    status = 'approved'
    and (
      audience = 'all'
      or (
        audience = 'sales'
        and exists (
          select 1 from public.users u
          where u.email = auth.jwt() ->> 'email'
            and u.role in ('super_admin', 'admin', 'sales')
        )
      )
    )
  );

-- ---------- RETRIEVAL RPC ----------

create or replace function public.atlas_kb_search(
  p_query_embedding vector(1536),
  p_user_role       text,
  p_limit           int   default 5,
  p_min_similarity  float default 0.7
)
returns table (
  id bigint,
  title text,
  answer_md text,
  owner text,
  source_of_truth text,
  escalation_conditions text,
  similarity float
)
language sql stable security definer as $$
  select
    e.id, e.title, e.answer_md, e.owner, e.source_of_truth, e.escalation_conditions,
    1 - (e.embedding <=> p_query_embedding) as similarity
  from public.atlas_kb_entries e
  where e.status = 'approved'
    and e.embedding is not null
    and case
      when p_user_role = 'super_admin'       then true
      when p_user_role in ('admin', 'sales') then e.audience in ('all', 'sales')
      else                                        e.audience = 'all'
    end
    and 1 - (e.embedding <=> p_query_embedding) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit p_limit;
$$;

-- ---------- STALENESS VIEW ----------

create or replace view public.atlas_kb_stale_candidates as
select
  id, title, owner, last_reviewed_at, status,
  now() - last_reviewed_at as age
from public.atlas_kb_entries
where status = 'approved'
  and (last_reviewed_at is null or last_reviewed_at < now() - interval '180 days')
order by last_reviewed_at asc nulls first;
