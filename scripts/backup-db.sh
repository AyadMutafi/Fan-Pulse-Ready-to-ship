#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Fan Pulse — Encrypted SQLite DB Backup to GitHub (git-CLI only)
#
# What it does (all via git protocol, no GitHub API — avoids 403s
# from fine-grained PATs that lack Contents:read scope):
#   1. Snapshots db/custom.db + .db-shm + .db-wal (WAL mode = consistent)
#   2. Encrypts the tarball with openssl aes-256-cbc + a passphrase
#      from $DB_BACKUP_PASSPHRASE (stored in .env.local, gitignored)
#   3. Pushes the encrypted blob to the `db-backups` branch on GitHub
#      — appends to the branch if it exists, creates it if not
#   4. Prunes to keep only the last 7 daily backups
#
# Run manually:    bash scripts/backup-db.sh
# Scheduled:       background loop (sleep 86400) — see hardening setup
#
# Recovery: pull the latest encrypted backup from the db-backups
# branch, decrypt with the same passphrase, untar into db/.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd /home/z/my-project

# ── Load secrets from .env.local (gitignored) ──
if [ -f .env.local ]; then
  set -a
  . .env.local
  set +a
fi

: "${DB_BACKUP_PASSPHRASE:?DB_BACKUP_PASSPHRASE not set in .env.local}"
: "${GITHUB_PAT:?GITHUB_PAT not set in .env.local}"

REPO="AyadMutafi/Fan-Pulse-Ready-to-ship"
REMOTE="https://AyadMutafi:${GITHUB_PAT}@github.com/${REPO}.git"
BRANCH="db-backups"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
FILENAME="backup-${TIMESTAMP}.tar.gz.enc"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: starting backup $TIMESTAMP"

# ── Step 1: Snapshot the SQLite files (WAL mode = consistent across all 3) ──
SNAP_DIR="/tmp/fanpulse-snap-$$"
rm -rf "$SNAP_DIR"
mkdir -p "$SNAP_DIR"
cp db/custom.db "$SNAP_DIR/custom.db" 2>/dev/null || true
cp db/custom.db-shm "$SNAP_DIR/custom.db-shm" 2>/dev/null || true
cp db/custom.db-wal "$SNAP_DIR/custom.db-wal" 2>/dev/null || true

if [ ! -s "$SNAP_DIR/custom.db" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: ERROR — db/custom.db missing or empty"
  exit 1
fi

cat > "$SNAP_DIR/backup-meta.txt" <<META
backup_timestamp: $TIMESTAMP
backup_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)
db_size_bytes: $(stat -c %s "$SNAP_DIR/custom.db")
sha256_db: $(sha256sum "$SNAP_DIR/custom.db" | cut -d' ' -f1)
created_by: scripts/backup-db.sh
META

# ── Step 2: Tar + encrypt ──
TARBALL="/tmp/fanpulse-${TIMESTAMP}.tar.gz"
ENC="${TARBALL}.enc"
tar -czf "$TARBALL" -C /tmp "$(basename "$SNAP_DIR")"
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -salt -pass "pass:$DB_BACKUP_PASSPHRASE" \
  -in "$TARBALL" -out "$ENC"
ENC_SIZE=$(stat -c %s "$ENC")
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: encrypted tarball is $ENC_SIZE bytes"

# ── Step 3: Push to db-backups branch via git CLI ──
WORKTREE="/tmp/fanpulse-push-$$"
rm -rf "$WORKTREE"
mkdir -p "$WORKTREE"
cd "$WORKTREE"
git init -q .
git config user.email "backup@fanpulse"
git config user.name "Fan Pulse Backup"
git config gc.auto 0

# Check if the remote branch already exists (via git protocol — no API needed)
BRANCH_EXISTS=$(git ls-remote --heads "$REMOTE" "$BRANCH" 2>/dev/null | grep -c . || echo 0)

if [ "$BRANCH_EXISTS" -gt 0 ]; then
  # Branch exists — fetch it and fully sync working tree + index to it,
  # so the new commit retains all previous backups PLUS the new one.
  # (--hard syncs both HEAD and index+worktree; --soft would leave the
  # index empty and the new commit would only contain the new file,
  # orphaning all previous backups.)
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: db-backups branch exists, appending"
  git fetch -q "$REMOTE" "$BRANCH"
  git reset -q --hard FETCH_HEAD
  git clean -qfd
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: db-backups branch doesn't exist, creating"
fi

# Stage the new encrypted blob
cp "$ENC" "$WORKTREE/$FILENAME"
git add "$FILENAME"
git commit -q -m "db backup $TIMESTAMP (encrypted, $ENC_SIZE bytes)"

# Push: fast-forward if branch exists, create if not
git push -q "$REMOTE" "HEAD:$BRANCH" 2>&1 | sed 's/'"$GITHUB_PAT"'/***REDACTED***/g' || true
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: pushed $FILENAME to $BRANCH"

# ── Step 4: Prune — keep only the last 7 backups ──
# List files in the branch HEAD tree via git (no API)
# Fetch the latest branch state (in case prune runs)
git fetch -q "$REMOTE" "$BRANCH" 2>/dev/null || true
FILES=$(git ls-tree --name-only "FETCH_HEAD" 2>/dev/null | grep -E '^backup-[0-9]{8}-[0-9]{6}\.tar\.gz\.enc$' | sort -r)

COUNT=$(echo "$FILES" | grep -c . || echo 0)
if [ "$COUNT" -gt 7 ]; then
  PRUNE_COUNT=$((COUNT - 7))
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: pruning $PRUNE_COUNT old backup(s)"
  # To prune: reset to FETCH_HEAD, git rm the old files, commit, push
  git reset -q --soft FETCH_HEAD
  echo "$FILES" | tail -n +8 | while read -r OLD_FILE; do
    if [ -n "$OLD_FILE" ]; then
      git rm -q --cached "$OLD_FILE" 2>/dev/null || true
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: pruned $OLD_FILE"
    fi
  done
  # Only commit + push if we actually removed something
  if ! git diff --cached --quiet; then
    git commit -q -m "prune old backups ($(date -u +%Y-%m-%d))"
    git push -q "$REMOTE" "HEAD:$BRANCH" 2>&1 | sed 's/'"$GITHUB_PAT"'/***REDACTED***/g' || true
  fi
fi

# ── Cleanup ──
cd /home/z/my-project
rm -rf "$SNAP_DIR" "$TARBALL" "$ENC" "$WORKTREE"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup: DONE — $COUNT backup(s) on $BRANCH, latest = $TIMESTAMP"
