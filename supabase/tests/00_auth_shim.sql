-- TEST ONLY. Supabase provides the auth schema, the anon/authenticated roles and the realtime
-- publication; a plain Postgres does not. This stands them up so the real migration can be applied
-- unchanged and its policies exercised. It is never applied to a Supabase project.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Same shape as Supabase's: the signed-in user's id comes from a request-scoped setting.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

grant usage on schema auth to anon, authenticated;
grant select on auth.users to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
