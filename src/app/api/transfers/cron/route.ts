/**
 * POST /api/transfers/cron — rotating-batch refresh: discovery for the next
 * slice of the watchlist + ingest for active sagas that haven't been refreshed
 * recently.
 *
 * Machine-to-machine endpoint. Authenticated via EITHER:
 *   - x-admin-password header (admin)
 *   - Authorization: Bearer <CRON_SECRET>  (the shared cron secret)
 * Fails closed if neither env var is set.
 *
 * Rate-limited to 1 call / 60s (the cron itself makes many xAI + LLM calls).
 *
 * The rotating offset is held in module memory — safe for a single-instance
 * deploy. Each call advances the offset by the batch size so successive ticks
 * cycle through the full 50-player watchlist.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { rateLimit } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'
import { TRACKED_PLAYERS } from '@/lib/transfer-pulse/tracked-players'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Module-level rotating offset (single-instance deploy only).
let discoveryOffset = 0
const DISCOVERY_BATCH = 4
const INGEST_BATCH = 3
const INGEST_STALE_MS = 30 * 60 * 1000 // 30 min

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

function isCronAuthorized(request: NextRequest): boolean {
  // Admin password works
  if (isAdminAuthorized(request)) return true
  // CRON_SECRET shared secret via Authorization: Bearer
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (token && token === secret) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    setCorsHeaders(res, request)
    return res
  }

  const rl = rateLimit('transfers:cron', 1, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Cron rate-limited (1/min)', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  const log: string[] = []
  const startedAt = Date.now()

  // 1. Discovery: next rotating batch of tracked players
  const offset = discoveryOffset % TRACKED_PLAYERS.length
  try {
    const disc = await discoverTransferSagas({
      maxPlayers: DISCOVERY_BATCH,
      offset,
    })
    log.push(
      `discovery: scanned=${disc.playersScanned} created=${disc.sagasCreated} updated=${disc.sagasUpdated} sources=${disc.sourcesAdded}`,
    )
    if (disc.errors.length) log.push(`discovery errors: ${disc.errors.join('; ').slice(0, 200)}`)
  } catch (err) {
    log.push(`discovery failed: ${String(err).slice(0, 120)}`)
  }
  discoveryOffset = (discoveryOffset + DISCOVERY_BATCH) % TRACKED_PLAYERS.length

  // 2. Ingest: refresh active sagas whose lastUpdatedAt is stale
  try {
    const staleCutoff = new Date(Date.now() - INGEST_STALE_MS)
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
        log.push(`ingest ${saga.playerName}: +${r.postsAdded} posts (${r.provider})`)
      } catch (err) {
        log.push(`ingest ${saga.playerName} failed: ${String(err).slice(0, 80)}`)
      }
    }
    log.push(`ingest: ${ingested}/${staleSagas.length} sagas refreshed`)
  } catch (err) {
    log.push(`ingest query failed: ${String(err).slice(0, 120)}`)
  }

  const res = NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    log,
    nextDiscoveryOffset: discoveryOffset,
  })
  setCorsHeaders(res, request)
  return res
}
