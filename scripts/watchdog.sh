#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Fan Pulse — Dev Server Watchdog
#
# Runs forever in the background. Every 60s, pings the health
# endpoint. After 3 consecutive failures, kills any stale process
# on port 3000, restarts `bun run dev`, and logs the recovery.
#
# Run with:  nohup bash scripts/watchdog.sh >> watchdog.log 2>&1 &
# ─────────────────────────────────────────────────────────────
set -u
cd /home/z/my-project

HEALTH_URL="http://localhost:3000/api/health"
PORT=3000
FAIL_COUNT=0
MAX_FAILS=3

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: started, monitoring $HEALTH_URL every 60s"

while true; do
  # Health check: 5s timeout, only HTTP 200 counts as healthy
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")

  if [ "$STATUS" = "200" ]; then
    # Reset fail counter on success
    if [ "$FAIL_COUNT" -gt 0 ]; then
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: recovered (was $FAIL_COUNT fails)"
    fi
    FAIL_COUNT=0
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: health check failed ($STATUS) — fail $FAIL_COUNT/$MAX_FAILS"

    if [ "$FAIL_COUNT" -ge "$MAX_FAILS" ]; then
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: threshold reached, restarting dev server"

      # Kill anything on port 3000 (stale dev server)
      PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
      if [ -n "$PIDS" ]; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: killing PIDs on port $PORT: $PIDS"
        for PID in $PIDS; do
          kill -9 "$PID" 2>/dev/null || true
        done
        sleep 2
      fi

      # Kill any stale bun/next processes
      pkill -9 -f "bun run dev" 2>/dev/null || true
      pkill -9 -f "next-server" 2>/dev/null || true
      pkill -9 -f "next dev" 2>/dev/null || true
      sleep 2

      # Restart dev server in background, append to dev.log
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: starting bun run dev"
      nohup bun run dev >> dev.log 2>&1 &
      NEW_PID=$!
      echo "$NEW_PID" > dev.pid
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: dev server restarted, PID $NEW_PID, wrote dev.pid"

      # Wait for server to come up before resuming checks
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: waiting 30s for server to boot..."
      sleep 30

      # Verify recovery
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
      if [ "$STATUS" = "200" ]; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: restart SUCCESS, health check passing"
      else
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: restart still failing ($STATUS) — will retry next cycle"
      fi
      FAIL_COUNT=0
    fi
  fi

  sleep 60
done
