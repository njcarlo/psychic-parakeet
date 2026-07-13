#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ADMIN_DATABASE_URL="${ADMIN_DATABASE_URL:-}"
DATABASE_URL="${DATABASE_URL:-postgres://cleanops:cleanops@localhost:5432/cleanops}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"
PORT="${PORT:-3001}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173,http://localhost:5174}"

USE_SUDO_POSTGRES=false
if [[ -z "$ADMIN_DATABASE_URL" ]] && command -v sudo >/dev/null && sudo -n -u postgres psql -d postgres -Atqc 'SELECT 1' >/dev/null 2>&1; then
  USE_SUDO_POSTGRES=true
fi

admin_psql() {
  if [[ "$USE_SUDO_POSTGRES" == "true" ]]; then
    sudo -n -u postgres psql -d postgres "$@"
  else
    psql "${ADMIN_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}" "$@"
  fi
}

echo "Creating cleanops role/database if needed..."
admin_psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cleanops') THEN
    CREATE ROLE cleanops LOGIN PASSWORD 'cleanops';
  ELSE
    ALTER ROLE cleanops WITH LOGIN PASSWORD 'cleanops';
  END IF;
END
$$;

SELECT 'CREATE DATABASE cleanops OWNER cleanops'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'cleanops') \gexec
SQL

schema_status="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT CASE WHEN to_regclass('public.businesses') IS NULL THEN 'missing' ELSE 'present' END")"
if [[ "$schema_status" == "missing" ]]; then
  echo "Applying migration 001_initial_schema.sql..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/migrations/001_initial_schema.sql"
else
  echo "Migration 001 already appears applied; skipping schema bootstrap."
fi

echo "Applying migration 002_recurrence_idempotency.sql..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/migrations/002_recurrence_idempotency.sql"

echo "Applying demo seed..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/seed.sql"

cat > "$ROOT_DIR/packages/api/.env" <<EOF
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=$JWT_SECRET
PORT=$PORT
CORS_ORIGIN=$CORS_ORIGIN
NODE_ENV=development
MVP_MODE=true
REDIS_OPTIONAL=true
EOF

echo
echo "CleanOps MVP setup complete."
echo
echo "Demo logins:"
echo "  Office:  admin@harbourshine.nz / password123"
echo "  Cleaner: mia@harbourshine.nz / password123"
