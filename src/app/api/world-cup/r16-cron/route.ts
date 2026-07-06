import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import {
  rankR16Teams,
  seedR16Teams,
  loadPreviousScoresR16,
  getNextR16Batch,
  R16_POOL_SIZE,
  R16_BATCH_SIZE,
} from '@/lib/r16-buzz-ranker'

/**
 * R16 rotating-batch cron refresh.
 *
 * Each call refreshes the next ~3 players from the VERIFIED_POOL via real
 * z-ai-web-dev-sdk web_search, then re-ranks + upserts the Elite/Crisis XI.
 * After all 45 players are refreshed, the cursor wraps. This way a full pool
 * refresh completes over ~15 cron calls (60s apart) instead of one 70-second
 * blocking call — enabling near-continuous "ticker" updates.
 *
 * ANTI-HALLUCINATION: real web_search only. On 429/error the caller keeps the
 * baseline/last-known score; nothing is fabricated. buzzSource flips to 'live'
 * only when at least one player in the batch got a real live score.
 *
 * Auth: admin password (x-admin-password header / ?admin= query) OR a shared
 * X-Cron-Secret header (for external cron schedulers).
 */

let batchCursor = 0

const CRON_SECRET = process.env.CRON_SECRET || ''

function isCronAuthorized(request: NextRequest): boolean {
  if (isAdminAuthorized(request)) return true
  if (CRON_SECRET) {
    const h = request.headers.get('x-cron-secret')
    if (h && h === CRON_SECRET) return true
  }
  return false
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return unauthorizedResponse()
  }

  try {
    const r16Stage = await db.wCStage.findFirst({
      where: { name: 'Round of 16' },
    })
    if (!r16Stage) {
      return NextResponse.json(
        { error: 'R16 stage not found — run /api/world-cup/seed or /api/world-cup/r16-launch first' },
        { status: 404 }
      )
    }

    const { names: batch, nextCursor } = getNextR16Batch(batchCursor)
    const previousScores = await loadPreviousScoresR16(db, r16Stage.id)

    const t0 = Date.now()
    const result = await rankR16Teams(true, batch, previousScores)
    await seedR16Teams(db, result, r16Stage.id)
    const elapsedMs = Date.now() - t0

    batchCursor = nextCursor

    return NextResponse.json({
      ok: true,
      buzzSource: result.buzzSource,
      refreshedPlayers: result.refreshedPlayers,
      batchRequested: batch,
      batchSucceeded: result.refreshedPlayers.length,
      cursor: nextCursor,
      poolSize: R16_POOL_SIZE,
      batchSize: R16_BATCH_SIZE,
      elapsedMs,
      generatedAt: result.generatedAt,
    })
  } catch (error) {
    console.error('[r16-cron] failed:', error)
    return NextResponse.json(
      { error: 'R16 cron refresh failed', details: String(error) },
      { status: 500 }
    )
  }
}

/** POST is an alias for GET so external schedulers can use either verb. */
export const POST = GET
