import { PrismaClient } from '@prisma/client'

/**
 * LAZY PrismaClient singleton — defers `new PrismaClient()` to first property
 * access (request time), NOT module-import time (build time).
 *
 * WHY: during `next build`, Next.js imports every route module to collect
 * page data. If `new PrismaClient()` runs at import time and `DATABASE_URL`
 * is unset (common in Docker build stages that create the DB AFTER build),
 * Prisma 6 throws `PrismaClientInitializationError: Environment variable
 * not found: DATABASE_URL` at CONSTRUCTION — propagating as
 * "Failed to collect page data for /api/..." and breaking the deploy.
 *
 * HOW: `db` is a Proxy whose `get` trap calls `getClient()` on first access.
 * At build time, the Proxy is created (no PrismaClient construction) →
 * module loads cleanly → page-data collection succeeds. At request time,
 * `db.feedMonitor.findMany()` triggers the trap → `getClient()` →
 * `new PrismaClient()` (DATABASE_URL IS set at runtime) → works.
 *
 * This is the standard Next.js + Prisma pattern for build-safe DB access.
 * All 15+ routes that `import { db } from '@/lib/db'` continue to work
 * unchanged — the Proxy is transparent.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _client: PrismaClient | null = null

/**
 * Returns the cached PrismaClient, creating it on first call. In non-prod,
 * caches on globalThis to survive Next.js dev hot-reloads (prevents the
 * "already 10 PrismaClients" warning).
 */
function getClient(): PrismaClient {
  if (_client) {
    // Verify the cached client still has the generated model accessors
    // (stale clients after a schema change return undefined for new models).
    if (typeof (_client as unknown as { socialPost?: unknown }).socialPost !== 'undefined') {
      return _client
    }
    console.log('[db] cached PrismaClient missing models — creating fresh client')
  }

  _client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.PRISMA_LOG === 'true' ? ['query'] : ['warn', 'error'],
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = _client
  }

  return _client
}

/**
 * Lazy Proxy over PrismaClient. Defers construction to first property
 * access so importing this module during `next build` never triggers
 * `new PrismaClient()` (which would throw if DATABASE_URL is unset in
 * the build stage).
 *
 * The Proxy binds methods to the underlying client so `this` context
 * is preserved (Prisma model delegates like `db.feedMonitor.findMany`
 * rely on the correct `this` binding).
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol, _receiver) {
    const client = getClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    // Bind functions so method calls preserve `this` (Prisma model
    // delegates require the correct receiver).
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
}) as PrismaClient

/**
 * Returns a PrismaClient that definitely has the latest generated models.
 *
 * In Next.js dev (Turbopack), the global singleton `db` above can be held
 * by an older module version after a schema change / regenerate, so
 * `db.socialPost` etc. may be `undefined` at runtime. This helper detects
 * that stale state and creates a fresh client on demand.
 *
 * SAFE AT BUILD TIME: like `db`, this function does NOT call
 * `new PrismaClient()` at module-import time — only when invoked at
 * request time.
 */
export function getDb(): PrismaClient {
  const client = getClient()
  if (typeof (client as unknown as { socialPost?: unknown }).socialPost !== 'undefined') {
    return client
  }
  console.log('[db] cached PrismaClient missing models — creating fresh client')
  const fresh = new PrismaClient({ log: ['warn', 'error'] })
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = fresh
  }
  _client = fresh
  return fresh
}
