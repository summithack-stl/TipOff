-- Row-level security tests for 0001_crew_status.sql.
--
-- The point of the item is that roles are enforced by the database, not the UI, so these run as
-- the anon and authenticated roles exactly as PostgREST would, and assert what each one cannot do.
-- See supabase/tests/README.md to run them.

\set ON_ERROR_STOP on
\set QUIET on

create or replace function test_assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok then raise notice 'ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

-- Runs a statement that must be refused outright. Passing it means RLS let something through.
create or replace function test_denied(sql text, what text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: % was allowed', what;
exception
  when insufficient_privilege or check_violation then raise notice 'ok   % refused', what;
end $$;

-- For a function that refuses with its own message rather than a privilege error.
create or replace function test_raises(sql text, what text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: % was allowed', what;
exception
  when raise_exception then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice 'ok   % refused (%)', what, sqlerrm;
end $$;

-- An UPDATE or DELETE whose USING clause does not match is not an error: the rows are simply not
-- visible, so it changes nothing. That is still a denial, and this is how to assert it.
create or replace function test_changes_nothing(sql text, what text) returns void
language plpgsql as $$
declare touched integer;
begin
  execute sql;
  get diagnostics touched = row_count;
  if touched = 0 then
    raise notice 'ok   % changes nothing', what;
  else
    raise exception 'FAILED: % changed % row(s)', what, touched;
  end if;
exception
  when insufficient_privilege or check_violation then raise notice 'ok   % refused', what;
end $$;

-- Two teams, so "my team" is a real boundary rather than the only team there is.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'supervisor@stl.gov'),
  ('22222222-2222-2222-2222-222222222222', 'crew@stl.gov'),
  ('33333333-3333-3333-3333-333333333333', 'judge@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'other-team-crew@stl.gov'),
  -- On the team, but still only a viewer: the one who proves the role check does the work
  -- rather than the team check happening to catch them.
  ('55555555-5555-5555-5555-555555555555', 'desk-viewer@stl.gov');

insert into public.teams (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Refuse North'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Refuse South');

insert into public.team_join_codes (team_id, code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'NORTH-2026'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'SOUTH-2026');

-- The trigger made every profile a viewer with no team; set up the fixture from there.
update public.profiles set team_id = 'aaaaaaaa-0000-0000-0000-000000000001', role = 'supervisor'
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set team_id = 'aaaaaaaa-0000-0000-0000-000000000001', role = 'crew'
 where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set team_id = 'aaaaaaaa-0000-0000-0000-000000000002', role = 'crew'
 where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set team_id = 'aaaaaaaa-0000-0000-0000-000000000001', role = 'viewer'
 where id = '55555555-5555-5555-5555-555555555555';

select test_assert(
  (select count(*) from public.profiles where role = 'viewer' and team_id is null) = 1,
  'signing in creates a viewer with no team');

-- ---------------------------------------------------------------- anonymous (nobody signed in)
set role anon;
select set_config('request.jwt.claim.sub', '', false);

-- 0002: the raw table (notes, who) is team-only; the public reads hotspot_public instead.
select test_denied($$select 1 from public.hotspot_status$$, 'anon reading raw status, with its notes');
select test_assert((select count(*) from public.hotspot_public) = 0, 'anon reads public status (none yet)');
select test_denied(
  $$insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
    values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001', 'cleaned',
            '22222222-2222-2222-2222-222222222222')$$,
  'anon writing status');
-- anon has no grant on profiles at all, so this is refused outright rather than returning no rows.
select test_denied($$select 1 from public.profiles$$, 'anon reading profiles, so no names leak');

-- ---------------------------------------------------------------- viewer (signed in, no role)
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);

select test_denied(
  $$insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
    values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001', 'cleaned',
            '33333333-3333-3333-3333-333333333333')$$,
  'a viewer writing status');
select test_assert((select count(*) from public.team_join_codes) = 0, 'a viewer sees no join codes');

-- A viewer who IS on the team. Nothing but the role stops this one, so it is the test that fails
-- if the role condition is ever dropped from the write policy.
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select test_denied(
  $$insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
    values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001', 'cleaned',
            '55555555-5555-5555-5555-555555555555')$$,
  'a viewer on the team writing status');

-- ---------------------------------------------------------------- crew
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

insert into public.hotspot_status (hotspot_id, team_id, status, note, updated_by)
values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001', 'cleaned', 'two mattresses gone',
        '22222222-2222-2222-2222-222222222222');
select test_assert((select count(*) from public.hotspot_status) = 1, 'crew marks a block cleaned');

select test_denied(
  $$insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
    values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000002', 'cleaned',
            '22222222-2222-2222-2222-222222222222')$$,
  'crew writing for another team');

select test_denied(
  $$insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
    values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001', 'cleaned',
            '11111111-1111-1111-1111-111111111111')$$,
  'crew writing in someone else''s name');

select test_denied(
  $$insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
    values ('not-a-hotspot', 'aaaaaaaa-0000-0000-0000-000000000001', 'cleaned',
            '22222222-2222-2222-2222-222222222222')$$,
  'a hotspot id that is not one');

-- Append-only: history cannot be rewritten, which is the whole point of a supervisor reading it.
select test_denied($$update public.hotspot_status set status = 'open'$$, 'updating a status row');
select test_denied($$delete from public.hotspot_status$$, 'deleting a status row');

select test_assert((select count(*) from public.team_join_codes) = 0, 'crew cannot read the join code');
select test_assert((select count(*) from public.profiles) = 3, 'crew sees only their own team');

select test_denied(
  $$update public.profiles set role = 'supervisor' where id = '22222222-2222-2222-2222-222222222222'$$,
  'crew promoting themselves');
select test_denied(
  $$update public.profiles set team_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     where id = '22222222-2222-2222-2222-222222222222'$$,
  'crew moving themselves to another team');

update public.profiles set display_name = 'A. Crew' where id = '22222222-2222-2222-2222-222222222222';
select test_assert(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'A. Crew',
  'crew can rename themselves');

select test_denied(
  $$insert into public.assignments (hotspot_id, team_id, assigned_to, assigned_by)
    values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222')$$,
  'crew assigning blocks');

-- ---------------------------------------------------------------- supervisor
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select test_assert((select count(*) from public.team_join_codes) = 1, 'supervisor reads their own join code only');

insert into public.assignments (hotspot_id, team_id, assigned_to, assigned_by)
values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
select test_assert((select count(*) from public.assignments) = 1, 'supervisor assigns a block');

update public.profiles set role = 'supervisor' where id = '22222222-2222-2222-2222-222222222222';
select test_assert(
  (select role from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'supervisor',
  'supervisor promotes a teammate');
update public.profiles set role = 'crew' where id = '22222222-2222-2222-2222-222222222222';

select test_changes_nothing(
  $$update public.profiles set role = 'viewer' where id = '44444444-4444-4444-4444-444444444444'$$,
  'supervisor reaching into another team');
select test_assert(
  (select count(*) from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 0,
  'supervisor cannot even see another team''s profile');

-- ---------------------------------------------------------------- the other team
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select test_assert((select count(*) from public.assignments) = 0, 'another team sees no assignments');
select test_assert((select count(*) from public.hotspot_status) = 0, 'another team cannot read the notes');
select test_assert((select count(*) from public.hotspot_public) = 1, 'but the public status shows the block');

-- ---------------------------------------------------------------- current status view
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into public.hotspot_status (hotspot_id, team_id, status, updated_by)
values ('dumping-27654_-50128', 'aaaaaaaa-0000-0000-0000-000000000001', 'needs_followup',
        '22222222-2222-2222-2222-222222222222');
select test_assert(
  (select status from public.hotspot_current where hotspot_id = 'dumping-27654_-50128') = 'needs_followup',
  'the current view shows the newest row');
select test_assert(
  (select count(*) from public.hotspot_status where hotspot_id = 'dumping-27654_-50128') = 2,
  'and the earlier row is still there as history');

-- ---------------------------------------------------------------- joining with a code
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select test_raises($$select public.join_team('NOT-A-CODE')$$, 'a wrong join code');
select test_assert(
  public.join_team('NORTH-2026') = 'aaaaaaaa-0000-0000-0000-000000000001',
  'a good join code joins the team');
select test_assert(public.my_role() = 'crew', 'joining makes you crew, not supervisor');

reset role;
select set_config('request.jwt.claim.sub', '', false);
\echo 'ALL RLS TESTS PASSED'
