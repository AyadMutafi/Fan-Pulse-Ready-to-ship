#!/bin/bash
# Simple background cron loop — runs the feed monitor refresh every 5 minutes.
# This is a dev-environment solution. In production, use Fly.io cron or similar.

INTERVAL_SECONDS=300  # 5 minutes
ADMIN_PW="${ADMIN_PASSWORD}"
if [ -z "$ADMIN_PW" ]; then
  echo "[cron-loop] ERROR: ADMIN_PASSWORD env var is not set — aborting" >&2
  exit 1
fi
SITE_URL="${SITE_URL:-http://localhost:3000}"
ENDPOINT="${SITE_URL}/api/admin/feed-monitor"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cron loop started (every ${INTERVAL_SECONDS}s)"

while true; do
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Running refresh..."
  RESPONSE=$(curl -sf -X PATCH "${ENDPOINT}" \
    -H "x-admin-password: ${ADMIN_PW}" \
    -H "Content-Type: application/json" \
    --max-time 300 \
    -w "\n%{http_code}" 2>&1 || echo "CURL_FAILED")
  
  HTTP_CODE=$(echo "${RESPONSE}" | tail -1)
  BODY=$(echo "${RESPONSE}" | head -n -1)
  
  if [ "${HTTP_CODE}" = "200" ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OK: ${BODY:0:200}"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] FAILED (HTTP ${HTTP_CODE})"
  fi
  
  sleep "${INTERVAL_SECONDS}"
done
