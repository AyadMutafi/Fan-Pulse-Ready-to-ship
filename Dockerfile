# ─────────────────────────────────────────────────────────────
# Fan Pulse — Fly.io Dockerfile
# Multi-stage build: deps → build → lean runner
# Keeps SQLite on a persistent Fly volume (no DB migration needed)
# ─────────────────────────────────────────────────────────────
#
# Bun version: Pinned to 1.3 (matches local dev). Bun 1.1 cannot read
# the project's `bun.lock` (lockfileVersion: 1, the Bun 1.2+ text format)
# and would silently fall back to a non-frozen install — which is the
# root cause of the previous deploy failures.
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

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone Next.js server (self-contained)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema + migrations so the entrypoint can run `db push`
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint script: ensures the SQLite DB exists before starting the server
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create the db directory (the Fly volume will mount over this)
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

USER nextjs
EXPOSE 3000

# Health check — uses bun (already in the image) instead of curl (not installed
# on oven/bun:1.3-debian). The health endpoint now also verifies DB reachability.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "server.js"]
