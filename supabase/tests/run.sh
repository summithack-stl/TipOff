#!/usr/bin/env bash
# Applies the migration to a throwaway Postgres and runs the row-level security tests.
#
# These policies are the only thing standing between a stolen anon key and a crew's data, so they
# are tested rather than eyeballed. No Supabase project needed: 00_auth_shim.sql stands up the
# auth schema and the anon/authenticated roles that Supabase would provide.
#
#   ./supabase/tests/run.sh                        # uses a local postgres on $PGPORT (default 5432)
#   PGHOST=127.0.0.1 PGPORT=5433 PGUSER=me ./supabase/tests/run.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
DB="${TIPOFF_TEST_DB:-tipoff_rls_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB;" -c "create database $DB;"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/00_auth_shim.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/migrations/0001_crew_status.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/01_rls_test.sql 2>&1 |
  grep -E "NOTICE:  ok|ERROR|FAILED|ALL RLS" | sed 's/psql:[^ ]* //'
