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

// ── SQLite concurrency pragmas ────────────────────────────────────────────────
//
// These make the Fan Pulse app safe for the Saturday EPL load: 7 concurrent
// matches, ~70 vote events/minute (≈1.2 writes/sec). SQLite handles that
// volume trivially, but ONLY with these pragmas — the default `delete` journal
// mode serializes readers behind writers and throws SQLITE_BUSY on contention.
//
//  • journal_mode=WAL        — Write-Ahead Logging. Readers never block
//                               writers and writers never block readers. The
//                               database stays readable while a vote is being
//                               committed. (PERSISTENT in the DB file header
//                               — survives reconnects, so setting it once is
//                               enough, but we set it every init for safety.)
//  • synchronous=NORMAL      — With WAL, this is the recommended durability /
//                               throughput trade-off. Safe against app crashes;
//                               only a simultaneous OS+power failure risks the
//                               last few ms of writes (acceptable for fan votes).
//  • busy_timeout=5000       — If a write lock is held, wait up to 5s for it to
//                               release instead of immediately throwing
//                               SQLITE_BUSY. This is the single most important
//                               pragma for concurrent writes — without it,
//                               parallel inserts randomly fail under load.
//  • cache_size=-65536       — 64MB page cache (default is ~2MB). More hot
//                               pages stay in RAM → fewer disk reads for the
//                               repeated `SELECT … FROM FanVote` aggregations
//                               the /api/fan-vote GET runs on every poll.
//  • foreign_keys=ON         — Prisma relies on FK constraints; SQLite disables
//                               them by default per-connection. Belt + braces.
//
// Prisma uses a SINGLE connection to SQLite (no pool — see the connection-
// pooling note in the worklog), so setting these once at module init applies
// to every subsequent query on that client. The `void` fire-and-forget is
// safe: Prisma queues queries internally until the pragmas resolve.
//
// NOTE: We use `$queryRawUnsafe` (not `$executeRawUnsafe`) because every
// SQLite PRAGMA returns a result row (the new value), and Prisma rejects
// result-returning queries with `$executeRawUnsafe` ("Execute returned
// results, which is not allowed in SQLite"). `$queryRawUnsafe` accepts both.
void applySqliteConcurrencyPragmas(db)

async function applySqliteConcurrencyPragmas(client: PrismaClient): Promise<void> {
  const pragmas = [
    'PRAGMA journal_mode=WAL',
    'PRAGMA synchronous=NORMAL',
    'PRAGMA busy_timeout=5000',
    'PRAGMA cache_size=-65536',
    'PRAGMA foreign_keys=ON',
  ]
  for (const sql of pragmas) {
    try {
      await client.$queryRawUnsafe(sql)
    } catch (err) {
      // Non-fatal: the app still works with default pragmas, just less
      // concurrently. Log so we notice in dev.
      console.error(`[db] PRAGMA failed: ${sql}`, err)
    }
  }
}

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
  const fresh = new PrismaClient({ log: ['warn', 'error'] })
  // Re-apply the same concurrency pragmas to the fresh client.
  void applySqliteConcurrencyPragmas(fresh)
  return fresh
}
