-- Migration 149: wrap bare auth.uid() / auth.email() / auth.jwt() / auth.role()
-- calls in RLS policy predicates with `(select ...)` so Postgres evaluates them
-- once per query (initplan) instead of once per row.
--
-- Supabase performance advisor flags this as `auth_rls_initplan`. 55 policy
-- predicates affected across ~31 tables. On a table with many rows, the
-- per-row call adds up — a `projects` SELECT that scans 10K rows calls
-- auth.role() 10K times instead of 1.
--
-- Implementation: a PL/pgSQL DO block scans pg_policies, uses regexp_replace
-- to wrap each `auth.<fn>()` in `(select auth.<fn>())`, and emits an
-- ALTER POLICY for every affected policy. This is idempotent — already-
-- wrapped predicates have `(select auth.…)` which the regex skips via a
-- negative lookbehind analog (we only wrap when not preceded by `select `).
--
-- Reversible: the inverse transformation `(select auth.<fn>())` → `auth.<fn>()`
-- runs on the same data structure; not shipping the reverse here since
-- rolling back this perf change is unlikely to be needed.
--
-- Safety: ALTER POLICY only changes USING / WITH CHECK. Role, cmd, and
-- permissive/restrictive attributes are unchanged, so the RLS behavior is
-- preserved exactly — every call-site still reads/writes the same rows.

begin;

do $mig$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
  updated_count int := 0;
begin
  for r in
    select schemaname, tablename, policyname, cmd, permissive,
           qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual is not null and qual ~ 'auth\.(uid|email|jwt|role)\s*\('
             and qual !~ '\(\s*select\s+auth\.(uid|email|jwt|role)')
        or
        (with_check is not null and with_check ~ 'auth\.(uid|email|jwt|role)\s*\('
             and with_check !~ '\(\s*select\s+auth\.(uid|email|jwt|role)')
      )
  loop
    new_qual  := case
      when r.qual is null then null
      else regexp_replace(r.qual,       'auth\.(uid|email|jwt|role)\s*\(\s*\)', '(select auth.\1())', 'g')
    end;
    new_check := case
      when r.with_check is null then null
      else regexp_replace(r.with_check, 'auth\.(uid|email|jwt|role)\s*\(\s*\)', '(select auth.\1())', 'g')
    end;

    -- Skip no-op rewrites defensively
    if coalesce(new_qual, '') = coalesce(r.qual, '')
       and coalesce(new_check, '') = coalesce(r.with_check, '') then
      continue;
    end if;

    stmt := format(
      'alter policy %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;

    execute stmt;
    updated_count := updated_count + 1;
  end loop;

  raise notice 'auth_rls_initplan fix: updated % policies', updated_count;
end
$mig$;

commit;
