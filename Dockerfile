# ─────────────────────────────────────────────────────────────
# Fan Pulse — Render.com Dockerfile (Node.js + OpenSSL)
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install deps + generate Prisma client ──
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl

COPY package.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

# ── Stage 2: Build the Next.js standalone output ──
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: Lean runner ──
FROM node:20-slim AS runner
WORKDIR /app

# Install OpenSSL in the runner (required by Prisma at runtime)
RUN apt-get update -y && apt-get install -y openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the FULL node_modules (needed for prisma CLI at runtime)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create db directory
RUN mkdir -p /app/db /data

EXPOSE 10000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["sh", "-c", "node server.js"]
