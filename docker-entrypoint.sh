#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Fan Pulse — Docker entrypoint
# Initializes the SQLite DB on first boot, then hands off to the main process.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# /data is ephemeral on Render free tier — every cold start wipes it.
# We restore the baked empty-schema DB so the app has tables ready without
# needing to run `prisma db push` at runtime (which would require shipping
# the prisma CLI in the runtime image — wasteful).
#
# Once the schema exists, instrumentation.ts (Next.js register hook) checks
# if the NationalTeam / Match tables are empty and auto-seeds all verified
# World Cup + EPL data via the seed endpoint.
if [ ! -f /data/fanpulse.db ]; then
  echo "[entrypoint] /data/fanpulse.db not found — initializing from baked schema..."
  cp /data-init/fanpulse.db /data/fanpulse.db
  echo "[entrypoint] ✓ Schema DB copied. Auto-seed will populate data on first request."
else
  echo "[entrypoint] /data/fanpulse.db exists — skipping init."
fi

# Hand off to CMD (the Next.js standalone server)
exec "$@"
