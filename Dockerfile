# ─────────────────────────────────────────────────────────────
# Fan Pulse — Render.com Dockerfile (Node.js)
# Switched from Bun to Node.js to fix Prisma transitive dependency issues
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install deps + generate Prisma client ──
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

# ── Stage 2: Build the Next.js standalone output ──
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: Lean runner ──
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files for runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create db directory
RUN mkdir -p /app/db /data

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
