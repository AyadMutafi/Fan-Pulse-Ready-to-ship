/**
 * Transfer Pulse — Auto-refresh on stale read.
 *
 * Problem: `/api/transfers/cron` is auth-gated and no external scheduler
 * calls it, so the DB never refreshes automatically. Sagas go stale.
 *
 * Solution: when the public GET /api/transfers handler sees the newest active
 * saga's `lastUpdatedAt` is older than `STALE_MS`, it kicks off a NON-BLOCKING
 * background refresh (discovery for a small rotating batch + ingest for the
 * few most-stale active sagas) and returns the current data immediately.
 *
 * Properties:
 *   • FIRE-AND-FORGET — the GET response is NOT delayed by the refresh.
 *     The refresh happens for the NEXT request to see.
 *   • SINGLE-FLIGHT — a module-level boolean guards against overlapping
 *     refreshes. If a refresh is already running, the GET handler just
 *     returns current data without scheduling another.
 *   • NEVER THROWS — every step is wrapped in try/catch so a refresh
 *     failure can never break the GET response.
 *   • ROTATING OFFSET — successive refreshes advance the discovery offset
 *     so the full watchlist gets cycled through over time.
 *
 * This is NOT a replacement for the cron — it's a backstop that keeps the
 * data fresh in low-traffic single-instance deploys where no external
 * scheduler is configured.
 */

import { db } from '@/lib/db'
import { discoverTransferSagas } from './discovery'
import { ingestSagaPosts } from './ingest'
import { TRACKED_PLAYERS } from './tracked-players'

/** A saga is considered stale if its lastUpdatedAt is older than this. */
export const STALE_MS = 30 * 60 * 1000 // 30 minutes

/** How many players to discover per background refresh. */
const DISCOVERY_BATCH = 4

/** How many sagas to ingest per background refresh. */
const INGEST_BATCH = 3

// ── Module-level single-flight state ────────────────────────────────────────
let refreshInProgress = false
let discoveryOffset = 0
let lastRefreshStartedAt: Date | null = null
let lastRefreshFinishedAt: Date | null = null
let lastRefreshError: string | null = null

/**
 * Returns true if the newest active saga's lastUpdatedAt is older than
 * STALE_MS. If there are no active sagas at all, returns true (so an empty
 * DB still triggers a refresh attempt).
 */
export async function isTransferDataStale(): Promise<boolean> {
  try {
    const newest = await db.transferSaga.findFirst({
      where: { status: 'active' },
      orderBy: { lastUpdatedAt: 'desc' },
      select: { lastUpdatedAt: true },
    })
    if (!newest) return true // empty DB → refresh
    const ageMs = Date.now() - newest.lastUpdatedAt.getTime()
    return ageMs > STALE_MS
  } catch {
    // If the staleness check itself fails, do NOT trigger a refresh — we
    // don't want a broken DB query to spawn a cascade of failed refreshes.
    return false
  }
}

/**
 * Kick off a NON-BLOCKING background refresh. Returns immediately (the
 * refresh promise is intentionally NOT awaited). Safe to call from a request
 * handler — it will never throw.
 *
 * If a refresh is already running, this is a no-op.
 */
export function maybeStartBackgroundRefresh(): void {
  if (refreshInProgress) return
  // Fire-and-forget. The `void` keyword signals we're intentionally not
  // awaiting; the catch inside swallows all errors.
  void runBackgroundRefresh()
}

/**
 * Internal: actually run the refresh. Wrapped in try/catch so any failure
 * is logged + recorded for diagnostics, but never propagated.
 */
async function runBackgroundRefresh(): Promise<void> {
  refreshInProgress = true
  lastRefreshStartedAt = new Date()
  const startedAt = Date.now()
  const log: string[] = []

  try {
    // ── Phase 1: discovery for a small rotating batch ───────────────────
    const offset = discoveryOffset % TRACKED_PLAYERS.length
    try {
      const disc = await discoverTransferSagas({
        maxPlayers: DISCOVERY_BATCH,
        offset,
      })
      log.push(
        `discovery: scanned=${disc.playersScanned} created=${disc.sagasCreated} ` +
          `updated=${disc.sagasUpdated} sources=${disc.sourcesAdded} ` +
          `errors=${disc.errors.length} (${(disc.durationMs / 1000).toFixed(1)}s)`,
      )
      if (disc.errors.length > 0) {
        log.push(`discovery errors: ${disc.errors.join('; ').slice(0, 240)}`)
      }
    } catch (err) {
      log.push(`discovery failed: ${String(err).slice(0, 160)}`)
    }
    // Advance the rotating offset so the next refresh covers a different slice.
    discoveryOffset =
      (discoveryOffset + DISCOVERY_BATCH) % TRACKED_PLAYERS.length

    // ── Phase 2: ingest for the most-stale active sagas ─────────────────
    try {
      const staleCutoff = new Date(Date.now() - STALE_MS)
      const staleSagas = await db.transferSaga.findMany({
        where: { status: 'active', lastUpdatedAt: { lt: staleCutoff } },
        orderBy: { lastUpdatedAt: 'asc' },
        take: INGEST_BATCH,
      })
      let ingested = 0
      for (const saga of staleSagas) {
        try {
          const r = await ingestSagaPosts(saga.id, 15)
          if (!r.error) ingested++
          log.push(
            `ingest ${saga.playerName}: +${r.postsAdded} posts (${r.provider})`,
          )
        } catch (err) {
          log.push(
            `ingest ${saga.playerName} failed: ${String(err).slice(0, 100)}`,
          )
        }
      }
      log.push(`ingest: ${ingested}/${staleSagas.length} sagas refreshed`)
    } catch (err) {
      log.push(`ingest query failed: ${String(err).slice(0, 160)}`)
    }

    lastRefreshError = null
  } catch (err) {
    // Outer catch — should rarely fire because the inner catches cover the
    // individual phases, but we keep this as a safety net.
    lastRefreshError = String(err).slice(0, 240)
  } finally {
    refreshInProgress = false
    lastRefreshFinishedAt = new Date()
    const durMs = Date.now() - startedAt
    console.log(
      `[transfer-pulse/auto-refresh] background refresh finished in ${durMs}ms — ` +
        log.join(' | '),
    )
  }
}

/**
 * Diagnostic snapshot for the admin UI / health endpoint.
 */
export function getAutoRefreshStatus(): {
  refreshInProgress: boolean
  lastRefreshStartedAt: Date | null
  lastRefreshFinishedAt: Date | null
  lastRefreshError: string | null
  discoveryOffset: number
  staleMs: number
} {
  return {
    refreshInProgress,
    lastRefreshStartedAt,
    lastRefreshFinishedAt,
    lastRefreshError,
    discoveryOffset,
    staleMs: STALE_MS,
  }
}
