import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log queries in non-production when explicitly debugging.
    // Keeps dev stdout clean and avoids log-volume / data-leak surface in prod.
    log: process.env.PRISMA_LOG === 'true' ? ['query'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Returns a PrismaClient that definitely has the latest generated models.
 *
 * In Next.js dev (Turbopack), the global singleton `db` above can be held by an
 * older module version after a schema change / regenerate, so `db.socialPost`
 * etc. may be `undefined` at runtime. This helper detects that stale state and
 * creates a fresh client on demand.
 */
export function getDb(): PrismaClient {
  if (typeof (db as unknown as { socialPost?: unknown }).socialPost !== 'undefined') {
    return db
  }
  console.log('[db] cached PrismaClient missing models — creating fresh client')
  return new PrismaClient({ log: ['warn', 'error'] })
}