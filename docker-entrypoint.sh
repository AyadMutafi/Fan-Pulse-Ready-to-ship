#!/bin/sh
# ─────────────────────────────────────────────────────────────
# Fan Pulse — Container entrypoint
# Ensures the SQLite DB exists + schema is applied before starting
# the Next.js server.
# ─────────────────────────────────────────────────────────────
set -e

DB_PATH="/app/db/custom.db"

echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"
echo "[entrypoint] Checking for SQLite DB at ${DB_PATH}..."

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] No DB file found — creating fresh SQLite DB with schema..."
  # First deploy (or volume wipe). prisma db push creates the file AND applies
  # the schema in one step. --accept-data-loss is safe here because there is
  # no data to lose yet.
  bunx prisma db push --skip-generate --accept-data-loss
  echo "[entrypoint] DB created. Seeding initial match data via API after server boot..."
  touch /app/db/.fresh-db
else
  echo "[entrypoint] DB exists — skipping schema push (no --accept-data-loss on existing data)."
  # NOTE: We intentionally do NOT run `prisma db push` on every boot. The
  # previous version ran `db push --accept-data-loss` unconditionally, which
  # would silently drop columns (and their data) if the Prisma schema ever
  # drifted from the DB during a deploy. Schema changes must be handled via
  # proper migrations at deploy time, not silently on every container boot.
  #
  # If you need to apply a schema change, SSH in and run:
  #   bunx prisma db push --skip-generate
  # (without --accept-data-loss, so Prisma will prompt if data is at risk)
fi

echo "[entrypoint] Starting Next.js server..."
exec "$@"
