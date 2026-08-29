#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Fan Pulse — Docker entrypoint
# Initializes the SQLite DB + Z.ai config + VADER service + Next.js app
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Create Z.ai SDK config file from env vars ───────────────────────────────
# The z-ai-web-dev-sdk reads config from a .z-ai-config JSON file, NOT from
# env vars. It checks 3 paths in order:
#   1. process.cwd()/.z-ai-config  (=/app/.z-ai-config in the container)
#   2. os.homedir()/.z-ai-config    (= /home/nextjs/.z-ai-config)
#   3. /etc/.z-ai-config
#
# Problem: The nextjs user may not have write access to /app/ (owned by root
# in some Docker layer configurations). So we write to MULTIPLE locations:
#   - /tmp/.z-ai-config (always writable, but ephemeral)
#   - /home/nextjs/.z-ai-config (the nextjs home dir — always writable by nextjs)
#   - /app/.z-ai-config (try, but don't fail if we can't)
# And we set HOME=/home/nextjs so the SDK's os.homedir() finds it.

if [ -n "$ZAI_API_KEY" ]; then
  echo "[entrypoint] Creating Z.ai config from env vars..."

  # Build the JSON config string
  CONFIG="{\"baseUrl\":\"${ZAI_BASE_URL:-https://internal-api.z.ai/v1}\",\"apiKey\":\"$ZAI_API_KEY\""
  if [ -n "$ZAI_TOKEN" ]; then
    CONFIG="$CONFIG,\"token\":\"$ZAI_TOKEN\""
  fi
  if [ -n "$ZAI_CHAT_ID" ]; then
    CONFIG="$CONFIG,\"chatId\":\"$ZAI_CHAT_ID\""
  fi
  if [ -n "$ZAI_USER_ID" ]; then
    CONFIG="$CONFIG,\"userId\":\"$ZAI_USER_ID\""
  fi
  CONFIG="$CONFIG}"

  # Write to /home/nextjs/ (the SDK checks os.homedir() which = $HOME)
  mkdir -p /home/nextjs
  echo "$CONFIG" > /home/nextjs/.z-ai-config
  chmod 644 /home/nextjs/.z-ai-config
  echo "[entrypoint] ✓ Z.ai config written to /home/nextjs/.z-ai-config"

  # Also write to /tmp/ as a backup (always writable)
  echo "$CONFIG" > /tmp/.z-ai-config
  chmod 644 /tmp/.z-ai-config
  echo "[entrypoint] ✓ Z.ai config written to /tmp/.z-ai-config"

  # Try /app/ too (may fail if read-only, that's OK)
  echo "$CONFIG" > /app/.z-ai-config 2>/dev/null && echo "[entrypoint] ✓ Z.ai config written to /app/.z-ai-config" || echo "[entrypoint] Could not write to /app/.z-ai-config (OK — using /home/nextjs/ and /tmp/ instead)"

  # Set HOME so the SDK's os.homedir() resolves to /home/nextjs
  export HOME=/home/nextjs
  echo "[entrypoint] HOME set to /home/nextjs for Z.ai SDK"
else
  echo "[entrypoint] ⚠ ZAI_API_KEY not set — Z.ai SDK features will be unavailable"
fi

# /data is ephemeral on Render free tier — every cold start wipes it.
# We restore the baked empty-schema DB so the app has tables ready without
# needing to run `prisma db push` at runtime.
#
# The DATABASE_URL env var (set by Render dashboard or Dockerfile) tells us
# WHERE the SQLite file should live. We parse it and copy the baked schema
# to that path. This is robust against dashboard env var overrides — the
# entrypoint always initializes the correct file.
#
# Once the schema exists, instrumentation.ts (Next.js register hook) checks
# if the tables are empty and auto-seeds all verified World Cup + EPL data.

DB_URL="${DATABASE_URL:-file:/data/fanpulse.db}"

# Extract path from "file:<path>" format
DB_PATH="${DB_URL#file:}"

if [ -z "$DB_PATH" ]; then
  echo "[entrypoint] Could not parse DB path from DATABASE_URL=$DB_URL"
  echo "[entrypoint] Falling back to /data/fanpulse.db"
  DB_PATH="/data/fanpulse.db"
fi

echo "[entrypoint] DATABASE_URL=$DB_URL"
echo "[entrypoint] DB path: $DB_PATH"

# Ensure the parent directory exists
DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
  echo "[entrypoint] Creating DB directory: $DB_DIR"
  mkdir -p "$DB_DIR"
fi

# If the DB file doesn't exist OR is smaller than 8KB (empty SQLite file with
# no tables — SQLite header is 100 bytes, a schema-only DB is typically 12KB+),
# copy the baked schema. This handles:
#   1. First boot (file doesn't exist)
#   2. Render dashboard created an empty file (size = 0 or 4096 bytes)
INIT_NEEDED=0
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] DB file not found — initializing from baked schema..."
  INIT_NEEDED=1
else
  DB_SIZE=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null || echo 0)
  echo "[entrypoint] Existing DB file size: ${DB_SIZE} bytes"
  if [ "$DB_SIZE" -lt 8192 ]; then
    echo "[entrypoint] DB file is suspiciously small (< 8KB — likely empty schema) — re-initializing..."
    INIT_NEEDED=1
  else
    echo "[entrypoint] ✓ DB file exists with data — skipping init."
  fi
fi

if [ "$INIT_NEEDED" = "1" ]; then
  echo "[entrypoint] Copying baked schema from /data-init/fanpulse.db → $DB_PATH"
  cp /data-init/fanpulse.db "$DB_PATH"
  echo "[entrypoint] ✓ Schema DB copied. instrumentation.ts will auto-seed data on startup."
fi

# ── Start VADER sentiment pre-filter service (background) ───────────────────
# Runs on port 3031. Pre-filters social media posts before LLM scoring.
# If it fails, the app still works — LLM gets all posts (graceful degradation).
if [ -f /app/mini-services/vader-sentiment/index.ts ]; then
  echo "[entrypoint] Starting VADER sentiment service on port 3031..."
  # Try bun first, fall back to npx if bun is not available
  if command -v bun &> /dev/null; then
    cd /app/mini-services/vader-sentiment && bun run index.ts &
  else
    echo "[entrypoint] Bun not found, trying npx..."
    cd /app/mini-services/vader-sentiment && npx tsx index.ts &
  fi
  VADER_PID=$!
  echo "[entrypoint] ✓ VADER service started (PID: $VADER_PID)"
  cd /app
  # Give VADER 2 seconds to start
  sleep 2
else
  echo "[entrypoint] VADER service not found — skipping (app will use LLM directly)"
fi

# Hand off to CMD (the Next.js standalone server)
exec "$@"
