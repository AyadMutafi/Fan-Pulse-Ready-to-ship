# ─────────────────────────────────────────────────────────────
# Fan Pulse — Fly.io Dockerfile
# Multi-stage build: deps → build → lean runner
# Keeps SQLite on a persistent Fly volume (no DB migration needed)
# ─────────────────────────────────────────────────────────────
#
# ROOT CAUSE OF PRIOR DEPLOY FAILURES (fixed):
#   .dockerignore excluded `docker-entrypoint.sh`, but this Dockerfile
#   does `COPY docker-entrypoint.sh` in the runner stage. Docker could
#   not find the file in the build context → build aborted every time.
#   Removing it from .dockerignore is the actual fix.
#
# Bun version: Pinned to 1.3 (matches local dev). Bun 1.1 cannot read
# the project's `bun.lock` text-format lockfile.
#
# The prisma CLI is copied from the deps stage so `bunx prisma db push`
# in docker-entrypoint.sh resolves locally (no npm download at runtime).
#
# The container runs as root (no USER nextjs) because Fly volumes mount
# as root-owned — a non-root user cannot create the SQLite DB file.
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install deps + generate Prisma client ──
FROM oven/bun:1.3-debian AS deps
WORKDIR /app

# Copy lockfile + package.json first for better layer caching.
# `bun.lock` is the Bun 1.2+ text-format lockfile (the only one in this repo).
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install deps and generate Prisma client (needed at build time).
# --frozen-lockfile guarantees the exact versions pinned in bun.lock.
RUN bun install --frozen-lockfile
RUN bunx prisma generate

# ── Stage 2: Build the Next.js standalone output ──
FROM oven/bun:1.3-debian AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build standalone Next.js (output: .next/standalone)
# The build script copies .next/static and public into standalone/
RUN bun run build

# ── Stage 3: Lean production runner ──
FROM oven/bun:1.3-debian AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# SQLite DB lives on a persistent Fly volume mounted at /app/db
ENV DATABASE_URL=file:/app/db/custom.db

# The nextjs user is created for file ownership, but the container runs
# as root (see comment below the db mkdir) so it can write to the Fly volume.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone Next.js server (self-contained)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema + the full Prisma client + CLI.
# The CLI (node_modules/prisma) is needed by docker-entrypoint.sh to run
# `bunx prisma db push` on first boot. Without it, bunx tries to download
# prisma from npm at runtime — which fails on a fresh Fly volume.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Create the node_modules/.bin/prisma symlink so `bunx prisma` resolves to
# the locally-installed CLI instead of downloading from npm.
RUN mkdir -p node_modules/.bin && \
    ln -sf ../prisma/build/index.js node_modules/.bin/prisma

# Entrypoint script: ensures the SQLite DB exists before starting the server.
# This COPY works now that .dockerignore no longer excludes the file.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create the db directory (the Fly volume mounts over this on first boot).
# The volume is root-owned by default, so we intentionally run the container
# as root (no USER nextjs) — this lets the entrypoint write the SQLite DB
# file to the mounted volume without permission errors. The Next.js server
# also runs as root, which is acceptable for a Fly.io single-app VM.
RUN mkdir -p /app/db

EXPOSE 3000

# Health check — uses bun (already in the image) instead of curl (not installed
# on oven/bun:1.3-debian). The health endpoint now also verifies DB reachability.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "server.js"]
