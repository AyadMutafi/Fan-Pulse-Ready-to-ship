# ─────────────────────────────────────────────────────────────────────────────
# Fan Pulse — Production Dockerfile for Render.com
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build (3 stages):
#   1. deps    → install all npm deps + OpenSSL (Prisma needs it)
#   2. builder → generate Prisma client, build Next.js standalone, bake the
#                empty SQLite schema into a seed .db file
#   3. runner  → slim runtime image (~150 MB) that listens on $PORT
#
# Base image: node:20-slim (Debian bookworm). Ships with OpenSSL 3.x — the
# exact binary target Prisma is configured for (see prisma/schema.prisma →
# binaryTargets = ["native", "debian-openssl-3.0.x"]). No extra apt packages
# beyond openssl + ca-certificates + curl are needed.
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app

# OpenSSL is required by the Prisma query engine at runtime.
# ca-certificates is required for outbound HTTPS to Groq / Grok / Z.ai.
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# package.json only — no lockfile committed, npm resolves fresh on each build.
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Reuse installed node_modules from the deps stage (cached layer)
COPY --from=deps /app/node_modules ./node_modules

# Now copy the rest of the source
COPY package.json ./
COPY prisma ./prisma
COPY . .

# 1. Generate Prisma client (writes libquery_engine-debian-openssl-3.0.x.so.node
#    into node_modules/.prisma/client and re-exports from @prisma/client).
RUN npx prisma generate

# 2. Build Next.js. next.config.ts sets output: "standalone", and the build
#    script (npm run build) copies .next/static + public INTO .next/standalone
#    so the standalone dir is fully self-contained.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Pre-create the SQLite schema in a fresh DB file. This DB has the schema
#    (tables, indexes) but ZERO data — the app's instrumentation.ts auto-seeds
#    the data on first startup. We bake this file into the runtime image so
#    the entrypoint script can `cp` it into /data on first boot, avoiding the
#    need to ship `prisma` CLI in the runtime stage.
ENV DATABASE_URL="file:/tmp/seed.db"
RUN npx prisma db push --skip-generate --accept-data-loss

# ─── Stage 3: runner (production runtime) ────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Render injects PORT at runtime; default to 10000 (Render's standard).
ENV PORT=10000
ENV HOSTNAME=0.0.0.0
# Default DATABASE_URL — Render dashboard may override this with
# file:/data/custom.db (matching .env.example). The entrypoint script reads
# this env var dynamically and initializes the correct file path.
ENV DATABASE_URL="file:/data/custom.db"

# OpenSSL (Prisma) + curl (Render healthchecks) + ca-certificates (outbound TLS)
# + python3 + pip (VADER sentiment pre-filter service)
# + unzip (required by Bun installer)
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates curl \
        python3 python3-pip python3-venv \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Install VADER sentiment library (Python) — system-wide so all users can access
RUN pip3 install --break-system-packages vaderSentiment 2>/dev/null || \
    pip3 install vaderSentiment

# Install Bun (for the VADER mini-service) — install to /usr/local/bin (system-wide)
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local/bin bash

# Verify VADER is working
RUN python3 -c "from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer; a = SentimentIntensityAnalyzer(); print('VADER OK:', a.polarity_scores('test'))"

# Verify Bun is working
RUN bun --version

# Non-root user — security best practice.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nextjs nextjs

# Set HOME env var so the Z.ai SDK's os.homedir() resolves correctly
ENV HOME=/home/nextjs

# /data holds the live SQLite DB. /data-init holds the baked seed schema.
RUN mkdir -p /data /data-init /home/nextjs && chown -R nextjs:nodejs /data /data-init /home/nextjs

# ── Copy the standalone Next.js app ─────────────────────────────────────────
# `npm run build` already merged .next/static + public INTO the standalone dir,
# so this single COPY gets a self-contained Next.js app at /app/server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# ── Copy Prisma schema (needed by instrumentation.ts auto-seed check) ───────
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# ── Copy the pre-built empty-schema DB for first-run init ───────────────────
COPY --from=builder --chown=nextjs:nodejs /tmp/seed.db /data-init/fanpulse.db

# ── Copy the VADER sentiment mini-service ───────────────────────────────────
COPY --chown=nextjs:nodejs mini-services/vader-sentiment ./mini-services/vader-sentiment

# ── Copy the entrypoint script ──────────────────────────────────────────────
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
