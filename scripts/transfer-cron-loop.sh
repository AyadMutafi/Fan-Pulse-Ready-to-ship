#!/bin/bash
# Transfer cron loop — calls /api/transfers/cron every 5 minutes to refresh
# the Transfer Pulse data (discovery + ingest rotating batch).
#
# Uses CRON_SECRET env var for authentication (set in .env).

INTERVAL_SECONDS=300  # 5 minutes
SECRET="${CRON_SECRET}"
if [ -z "$SECRET" ]; then
  # Source from .env if not in environment
  SECRET=$(grep "^CRON_SECRET=" /home/z/my-project/.env 2>/dev/null | cut -d'=' -f2-)
fi
if [ -z "$SECRET" ]; then
  echo "[transfer-cron] ERROR: CRON_SECRET not set — aborting" >&2
  exit 1
fi

SITE_URL="http://localhost:3000"
ENDPOINT="${SITE_URL}/api/transfers/cron"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Transfer cron loop started (every ${INTERVAL_SECONDS}s)"

while true; do
  RESPONSE=$(curl -sf -X POST "${ENDPOINT}" \
    -H "Authorization: Bearer ${SECRET}" \
    -H "Content-Type: application/json" \
    --max-time 240 \
    -w "\n%{http_code}" 2>&1 || echo "CURL_FAILED")

  HTTP_CODE=$(echo "${RESPONSE}" | tail -1)
  BODY=$(echo "${RESPONSE}" | head -n -1)

  if [ "${HTTP_CODE}" = "200" ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OK: ${BODY:0:300}"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] FAILED (HTTP ${HTTP_CODE}): ${BODY:0:200}"
  fi

  sleep "${INTERVAL_SECONDS}"
done
