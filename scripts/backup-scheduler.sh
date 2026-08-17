#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Fan Pulse — Daily DB Backup Scheduler (background loop)
#
# cron isn't available in this sandbox, so we use a simple
# background loop. Runs the backup immediately on start (so a
# sandbox restart triggers a catch-up backup), then every 24h.
#
# Run with:  nohup bash scripts/backup-scheduler.sh >> backup-scheduler.log 2>&1 &
# ─────────────────────────────────────────────────────────────
set -u
cd /home/z/my-project

INTERVAL=86400  # 24 hours

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup-scheduler: started, interval=${INTERVAL}s"

while true; do
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup-scheduler: triggering daily backup"
  bash scripts/backup-db.sh 2>&1 | sed 's/\[backup:/\[backup-scheduler -> backup:/'
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup-scheduler: backup FAILED (exit $EXIT_CODE)"
  fi
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup-scheduler: sleeping ${INTERVAL}s until next backup"
  sleep $INTERVAL
done
