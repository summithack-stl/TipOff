# Shared crew status (Supabase)

What this is for: a crew in the field marks a block cleaned, and the supervisor at a desk and the
next crew see it. Today nothing is shared between users.

## Why Supabase and not Vercel KV/Postgres

The requirement that decided it: **roles enforced by row-level security, not only in the UI.** The
app ships an anon key to every phone, so "crew can write, viewer cannot" has to hold in the database
even if someone takes that key out of the bundle and calls the API directly.

- **Supabase** is Postgres with RLS, plus email magic-link auth and realtime over the same
  connection. The policies in `migrations/0001_crew_status.sql` are the authorization model; auth
  and live updates come with it.
- **Vercel KV** is a key-value store with no row-level anything and no auth. Every rule would live
  in app code, and the write path would need its own session system.
- **Vercel Postgres** has RLS, but no auth and no realtime, so we would still be building magic
  links and either polling or wiring up a socket.

Supabase was also already chosen during the hackathon. See `app/.env.example` for what it needs.

## Layout

| File | What it is |
| --- | --- |
| `migrations/0001_crew_status.sql` | teams, join codes, profiles/roles, append-only `hotspot_status`, assignments, and every RLS policy |
| `tests/00_auth_shim.sql` | **test only.** Stands up the `auth` schema and the `anon`/`authenticated` roles a plain Postgres lacks, so the migration can be run unchanged |
| `tests/01_rls_test.sql` | 30 assertions about what each role can and cannot do |
| `tests/run.sh` | applies both to a throwaway database and runs the tests |

## The model

- **Status is append-only.** Marking a block cleaned inserts a row; nothing is ever updated or
  deleted. That is what lets a supervisor see what happened on a block, and means a crew member
  cannot quietly rewrite it. `hotspot_current` is a view over the newest row per team and hotspot.
- **Roles are `viewer`, `crew`, `supervisor`.** Signing in makes you a `viewer` with no team: it
  grants nothing on its own. A join code makes you `crew`. Only a supervisor makes a supervisor.
- **Reading works logged out.** `hotspot_status` is readable by `anon`, so judges and the public see
  the map and plans exactly as today. Names are not: `profiles` is team-only, so a logged-out
  visitor sees "cleaned on Tuesday" and never who did it.
- **Join codes are separate from teams**, so every member can read their team's name while only a
  supervisor can read the code that lets someone else in.
- `hotspot_id` is a text column with a format check, not a foreign key: hotspots are rebuilt nightly
  from the City's 311 file into JSON and do not live in this database.

## Applying it

Paste `migrations/0001_crew_status.sql` into the Supabase SQL editor, or `supabase db push` with the
CLI. It is written to run on a fresh project; the `auth` schema and the `anon`/`authenticated` roles
are already there.
