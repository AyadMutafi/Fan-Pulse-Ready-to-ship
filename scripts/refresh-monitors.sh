#!/bin/bash
# Feed Monitor Cron Job — refreshes all active FeedMonitors every 5 minutes.
#
# Usage (crontab -e):
#   */5 * * * * /home/z/my-project/scripts/refresh-monitors.sh >> /var/log/fan-pulse-cron.log 2>&1
#
# Or on Fly.io, use fly-cron or a sidecar container.
#
# Required env vars:
#   ADMIN_PASSWORD — the admin password (set via fly secrets in production)
#   SITE_URL — the base URL of the app (defaults to http://localhost:3000)

set -euo pipefail

ADMIN_PW="${ADMIN_PASSWORD}"
if [ -z "$ADMIN_PW" ]; then
  echo "[refresh-monitors] ERROR: ADMIN_PASSWORD env var is not set — aborting" >&2
  exit 1
fi
SITE_URL="${SITE_URL:-http://localhost:3000}"
ENDPOINT="${SITE_URL}/api/admin/feed-monitor"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Running feed monitor cron..."

RESPONSE=$(curl -sf -X PATCH "${ENDPOINT}" \
  -H "x-admin-password: ${ADMIN_PW}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  -w "\n%{http_code}" || echo "CURL_FAILED")

HTTP_CODE=$(echo "${RESPONSE}" | tail -1)
BODY=$(echo "${RESPONSE}" | head -n -1)

if [ "${HTTP_CODE}" = "200" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cron OK: ${BODY}"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cron FAILED (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi
