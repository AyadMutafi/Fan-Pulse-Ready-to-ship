#!/bin/sh
set -e
DB_PATH="/app/db/custom.db"
echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"
echo "[entrypoint] Checking for SQLite DB at ${DB_PATH}..."
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] No DB file found — creating fresh SQLite DB with schema..."
  npx --yes prisma db push --skip-generate --accept-data-loss
  echo "[entrypoint] DB created. Auto-seed will run on server startup."
  touch /app/db/.fresh-db
else
  echo "[entrypoint] DB exists — skipping schema push."
fi
echo "[entrypoint] Starting Next.js server..."
exec "$@"
