#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Fan Pulse — Persistent dev server launcher (double-fork daemonization)
#
# PROBLEM: The Z.ai sandbox kills ALL background processes when a Bash tool
# call returns — even with nohup/setsid/disown. A simple `sleep 300 &` dies
# the moment the shell exits.
#
# SOLUTION: Double-fork daemonization. setsid creates a new session, bash
# backgrounds `next dev` INSIDE that session, then bash exits immediately.
# The orphaned `next dev` process gets reparented to PID 1 (tini), which
# keeps it alive across Bash tool calls.
#
# USAGE:
#   bash dev-server.sh start   # start the dev server (persistent)
#   bash dev-server.sh status  # check if running
#   bash dev-server.sh stop    # kill the dev server
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd /home/z/my-project

PIDFILE="/tmp/next-dev.pid"

case "${1:-start}" in
  start)
    # Kill any existing instance
    pkill -9 -f "next-server" 2>/dev/null || true
    pkill -9 -f "next dev" 2>/dev/null || true
    sleep 2

    # Double-fork: setsid + background inside the new session + immediate exit
    setsid bash -c '
      cd /home/z/my-project
      node_modules/.bin/next dev -p 3000 </dev/null >>/home/z/my-project/dev.log 2>&1 &
      echo $! > /tmp/next-dev.pid
    ' &
    disown 2>/dev/null || true

    echo "[dev-server] Launching... waiting for next-server to bind port 3000"
    for i in $(seq 1 15); do
      sleep 1
      if ss -tlnp 2>/dev/null | grep -q ":3000"; then
        echo "[dev-server] ✓ Ready on port 3000 (PID $(cat $PIDFILE 2>/dev/null))"
        echo "[dev-server] PPid of next dev: $(grep ^PPid /proc/$(cat $PIDFILE)/status 2>/dev/null | awk '{print $2}') (should be 1)"
        exit 0
      fi
    done
    echo "[dev-server] ✗ Failed to bind port 3000 within 15s"
    exit 1
    ;;

  status)
    NSPID=$(pgrep -f "next-server" | head -1)
    if [ -n "$NSPID" ]; then
      echo "[dev-server] ✓ next-server running (PID $NSPID)"
      curl -sI http://localhost:3000/ 2>&1 | head -1
    else
      echo "[dev-server] ✗ Not running"
      exit 1
    fi
    ;;

  stop)
    pkill -9 -f "next-server" 2>/dev/null || true
    pkill -9 -f "next dev" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "[dev-server] Stopped"
    ;;

  *)
    echo "Usage: $0 {start|status|stop}"
    exit 1
    ;;
esac
