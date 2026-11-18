#!/usr/bin/env bash
# Verify the schema + RLS policies on a throwaway local Postgres database.
# Needs a local PostgreSQL. Uses `sudo -u postgres psql` by default; override with PSQL.
set -euo pipefail
PSQL="${PSQL:-sudo -u postgres psql}"
DB="${DB:-manakh_rls_test}"
here="$(cd "$(dirname "$0")" && pwd)"
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null
$PSQL -q -d "$DB" -v ON_ERROR_STOP=1 \
  -f "$here/00_shim.sql" \
  -f "$here/../migrations/0001_init.sql" \
  -f "$here/../migrations/0002_bootstrap.sql" >/dev/null
$PSQL -q -d "$DB" -f "$here/10_rls_test.sql" | grep -E "PASSED|FAILED|ERROR" || true
$PSQL -q -c "drop database if exists $DB;" >/dev/null
