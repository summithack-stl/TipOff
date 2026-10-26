-- Shared crew status: what a crew did on a block, so the next person sees it.
--
-- Everything here is places, times and job status. No resident is named, no report text is stored,
-- and nothing identifies who dumped: TipOff holds the City's 311 aggregates and a crew's own notes.
--
-- Roles: viewer (default, read-only; judges and the public), crew (can update status),
-- supervisor (can invite people and assign blocks). Enforced by row-level security below, not by
-- the UI, so a stolen anon key still cannot write.

create type public.crew_role as enum ('viewer', 'crew', 'supervisor');
create type public.hotspot_state as enum ('open', 'cleaned', 'camera_placed', 'needs_followup');

-- A crew. One per department or shift; a supervisor invites people into it with a join code.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- The join code lives apart from the team so that policy can be stricter: every member may read
-- their team's name, but only a supervisor may read the code that lets someone else in.
create table public.team_join_codes (
  team_id uuid primary key references public.teams (id) on delete cascade,
  code text not null unique check (length(code) between 6 and 32),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per signed-in person. Created by the trigger below on first sign-in, always as a viewer:
-- signing in grants nothing until a supervisor or a join code says otherwise.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  role public.crew_role not null default 'viewer',
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Append-only: every update is a new row, so a supervisor can see what happened on a block and
-- when, and nobody can quietly rewrite history. The current status is the newest row (see the view).
create table public.hotspot_status (
  id bigint generated always as identity primary key,
  -- Matches the hotspot ids the app already uses, e.g. "dumping-27654_-50128". Not a foreign key:
  -- hotspots are rebuilt nightly from the City's 311 file and live in JSON, not in this database.
  hotspot_id text not null check (hotspot_id ~ '^(dumping|pothole|graffiti)-[0-9]+_-?[0-9]+$'),
  team_id uuid not null references public.teams (id) on delete cascade,
  status public.hotspot_state not null,
  note text check (note is null or length(note) <= 500),
  photo_url text check (photo_url is null or length(photo_url) <= 500),
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now()
);

create index hotspot_status_lookup on public.hotspot_status (team_id, hotspot_id, updated_at desc);

-- A supervisor hands today's blocks to a crew member; "My blocks" filters to these.
create table public.assignments (
  id bigint generated always as identity primary key,
  hotspot_id text not null check (hotspot_id ~ '^(dumping|pothole|graffiti)-[0-9]+_-?[0-9]+$'),
  team_id uuid not null references public.teams (id) on delete cascade,
  assigned_to uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid not null references auth.users (id),
  day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (team_id, hotspot_id, day)
);

create index assignments_for_person on public.assignments (team_id, day, assigned_to);

-- Where a block stands right now: the newest row per team and hotspot.
create view public.hotspot_current
with (security_invoker = true) as
select distinct on (team_id, hotspot_id) id, hotspot_id, team_id, status, note, photo_url, updated_by, updated_at
from public.hotspot_status
order by team_id, hotspot_id, updated_at desc, id desc;

-- Helpers. security definer so a policy on profiles does not recurse into profiles' own policy;
-- search_path is pinned so they cannot be redirected by a caller's own schema.
create function public.my_team() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select team_id from public.profiles where id = auth.uid()
$$;

create function public.my_role() returns public.crew_role
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer'::public.crew_role)
$$;

-- A signed-in person starts as a viewer with no team. Nothing is granted by signing in.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Redeeming a join code has to read a code the caller may not read, so it runs as definer and
-- returns only the team it joined. A wrong or expired code is a plain error, and tells the caller
-- nothing about which codes exist.
create function public.join_team(code text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare target uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  select team_id into target from public.team_join_codes
   where team_join_codes.code = join_team.code
     and (expires_at is null or expires_at > now());
  if target is null then
    raise exception 'that join code is not valid';
  end if;
  -- Joining makes you crew. It never promotes: a supervisor is only ever made by a supervisor.
  update public.profiles
     set team_id = target,
         role = case when role = 'supervisor' then role else 'crew'::public.crew_role end
   where id = auth.uid();
  return target;
end;
$$;

alter table public.teams enable row level security;
alter table public.team_join_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.hotspot_status enable row level security;
alter table public.assignments enable row level security;

-- teams: members read their own team's name. Nobody writes one through the API.
create policy teams_read_own on public.teams
  for select to authenticated using (id = public.my_team());

-- join codes: supervisors of that team only. This is the invite secret.
create policy join_codes_supervisor on public.team_join_codes
  for all to authenticated
  using (team_id = public.my_team() and public.my_role() = 'supervisor')
  with check (team_id = public.my_team() and public.my_role() = 'supervisor');

-- profiles: your own row, and your teammates'. Not the whole city's.
create policy profiles_read_team on public.profiles
  for select to authenticated
  using (id = auth.uid() or (team_id is not null and team_id = public.my_team()));

-- You may rename yourself. The with check pins role and team to what they already are, so nobody
-- promotes themselves to supervisor or moves themselves into another team.
create policy profiles_rename_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role() and team_id is not distinct from public.my_team());

-- A supervisor sets roles inside their own team, and cannot reach outside it.
create policy profiles_supervisor_manages_team on public.profiles
  for update to authenticated
  using (public.my_role() = 'supervisor' and team_id is not distinct from public.my_team())
  with check (public.my_role() = 'supervisor' and team_id is not distinct from public.my_team());

-- Status is civic information: anyone may read it, signed in or not, so judges and the public see
-- the map and plans exactly as before. Who did it stays behind profiles, which is team-only, so a
-- logged-out visitor sees "cleaned on Tuesday", never a name.
create policy status_read_public on public.hotspot_status
  for select to anon, authenticated using (true);

-- Only crew and supervisors write, only for their own team, and only as themselves.
create policy status_write_crew on public.hotspot_status
  for insert to authenticated
  with check (
    team_id = public.my_team()
    and updated_by = auth.uid()
    and public.my_role() in ('crew', 'supervisor')
  );

-- No update and no delete policy, on purpose: the table is append-only. Correcting a block means
-- adding a row, which is what a supervisor needs to see.

-- Assignments are internal to a team.
create policy assignments_read_team on public.assignments
  for select to authenticated using (team_id = public.my_team());

create policy assignments_supervisor_writes on public.assignments
  for all to authenticated
  using (team_id = public.my_team() and public.my_role() = 'supervisor')
  with check (
    team_id = public.my_team()
    and assigned_by = auth.uid()
    and public.my_role() = 'supervisor'
  );

-- Supabase hands the browser the anon key; these are the only grants it gets.
grant usage on schema public to anon, authenticated;
grant select on public.hotspot_status, public.hotspot_current to anon, authenticated;
grant select on public.teams, public.profiles, public.assignments to authenticated;
grant select, insert, update, delete on public.team_join_codes to authenticated;
grant insert on public.hotspot_status to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant update on public.profiles to authenticated;
grant execute on function public.join_team(text) to authenticated;

-- Realtime: the app subscribes to status changes so a second phone updates without a refresh.
alter publication supabase_realtime add table public.hotspot_status;
