-- Crew status, second pass: what the public may see, who can be assigned, and who you are.

-- 1. Notes and names stay with the team.
--
-- 0001 let anyone read hotspot_status so the public sees "cleaned on Tuesday". But that row also
-- holds the crew's free-text note and who wrote it, and a note can name a resident or a
-- business. Row-level security cannot hide a column, and Supabase Realtime streams whole rows to
-- anyone allowed to select them. So the table becomes team-only, and the public reads a narrow
-- view: which block, what state, since when. Nothing a crew typed, nothing about who.

drop policy status_read_public on public.hotspot_status;
revoke select on public.hotspot_status, public.hotspot_current from anon;

create policy status_read_team on public.hotspot_status
  for select to authenticated using (team_id = public.my_team());

-- Newest state per block across all teams. A definer view (no security_invoker), so it can read
-- the table on the public's behalf; it exposes only these three columns.
create view public.hotspot_public as
select distinct on (hotspot_id) hotspot_id, status, updated_at
from public.hotspot_status
order by hotspot_id, updated_at desc, id desc;

grant select on public.hotspot_public to anon, authenticated;

-- 2. A block can only be handed to someone on the team.
--
-- 0001 checked the supervisor's team but not the assignee's, so any user id could be assigned.
create function public.is_teammate(person uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = person and team_id = public.my_team())
$$;

drop policy assignments_supervisor_writes on public.assignments;
create policy assignments_supervisor_writes on public.assignments
  for all to authenticated
  using (team_id = public.my_team() and public.my_role() = 'supervisor')
  with check (
    team_id = public.my_team()
    and assigned_by = auth.uid()
    and public.my_role() = 'supervisor'
    and public.is_teammate(assigned_to)
  );

-- 3. Who am I. The app reads this after sign-in, and the server asks it (with the caller's own
-- token) before letting a supervisor start a data refresh. Never anyone else's row.
create function public.my_profile()
returns table (id uuid, role public.crew_role, team_id uuid, team_name text, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.role, p.team_id, t.name, p.display_name
  from public.profiles p left join public.teams t on t.id = p.team_id
  where p.id = auth.uid()
$$;

revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
