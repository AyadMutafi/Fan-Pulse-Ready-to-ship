#!/bin/sh
# ─────────────────────────────────────────────────────────────
# Fan Pulse — Container entrypoint
# Ensures the SQLite DB exists + schema is applied before starting
# the Next.js server. Safe to run on every boot (idempotent).
# ─────────────────────────────────────────────────────────────
set -e

DB_PATH="/app/db/custom.db"

echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"
echo "[entrypoint] Checking for SQLite DB at ${DB_PATH}..."

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] No DB file found — creating fresh SQLite DB with schema..."
  # The volume exists but is empty (first deploy or after volume wipe).
  # prisma db push creates the file AND applies the schema in one step.
  bunx prisma db push --skip-generate --accept-data-loss
  echo "[entrypoint] DB created. Seeding initial match data via API after server boot..."
  touch /app/db/.fresh-db
else
  echo "[entrypoint] DB exists — ensuring schema is up to date..."
  # Idempotent: if schema already matches, this is a no-op.
  bunx prisma db push --skip-generate --accept-data-loss
fi

echo "[entrypoint] Starting Next.js server..."
exec "$@"
