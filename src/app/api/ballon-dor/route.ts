/**
 * GET /api/ballon-dor — verified Ballon d'Or fan-sentiment ranking.
 *
 * Public, read-only, rate-limited (20 req/min/IP). Cached in-memory for 1 hour.
 *
 * Anti-hallucination:
 *   - Returns ONLY contenders from VERIFIED_BALLON_DOR_CONTENDERS (which trace
 *     to VERIFIED_ELITE_XI + documented VERIFIED_DATA.md knockout players).
 *   - At boot, runs `auditContenderOrigins()` — if any name does NOT trace to
 *     a verified source, the route returns 500 with the offending names so the
 *     bug is caught immediately rather than shipping fabricated contenders.
 *   - The framing copy makes explicit this is fan sentiment, NOT a prediction.
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import {
  getBallonDorContenders,
  getBallonDorMovers,
  auditContenderOrigins,
  getBallonDorFraming,
  type BallonDorContender,
} from '@/lib/ballon-dor'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ── In-memory cache (1 hour TTL) ─────────────────────────────────────────────
// The contender list is static (verified data) — the only reason to ever
// re-derive it is a code deploy. Caching avoids re-running the sort + audit
// on every request. Single-instance deploy (Fly.io shared-cpu-1x) means an
// in-process cache is sufficient.
interface CacheEntry {
  at: number
  payload: {
    contenders: BallonDorContender[]
    movers: {
      biggestRiser: BallonDorContender | null
      biggestFaller: BallonDorContender | null
    }
    framing: ReturnType<typeof getBallonDorFraming>
  }
}
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
let cache: CacheEntry | null = null

/**
 * Build the payload. Reads from the DB (BallonDorContender table) first;
 * if the DB is empty, falls back to the hardcoded VERIFIED_BALLON_DOR_CONTENDERS
 * array and runs the anti-hallucination audit.
 */
async function buildPayload() {
  // ── Try DB first ────────────────────────────────────────────────────────
  try {
    const dbContenders = await db.ballonDorContender.findMany({
      where: { isActive: true },
      orderBy: { ballonDorScore: 'desc' },
    })

    if (dbContenders.length > 0) {
      // Map DB rows to the public API shape
      const contenders: BallonDorContender[] = dbContenders.map((c) => ({
        name: c.name,
        nationCode: c.nationCode,
        position: c.position,
        clubName: c.clubName,
        clubCode: c.clubCode,
        ballonDorScore: c.ballonDorScore,
        trend: c.trend as 'rising' | 'stable' | 'falling',
        reason: c.reason,
        awardWon: c.awardWon ?? undefined,
        verifiedMatchFact: c.verifiedMatchFact,
      }))

      // Compute movers from DB data
      const risers = contenders.filter((c) => c.trend === 'rising')
      const fallers = contenders.filter((c) => c.trend === 'falling')
      const biggestRiser = risers.length > 0
        ? risers.sort((a, b) => b.ballonDorScore - a.ballonDorScore)[0]
        : null
      const biggestFaller = fallers.length > 0
        ? fallers.sort((a, b) => b.ballonDorScore - a.ballonDorScore)[0]
        : null

      return {
        contenders,
        movers: { biggestRiser, biggestFaller },
        framing: getBallonDorFraming(),
      }
    }
  } catch (dbErr) {
    console.warn('[api/ballon-dor] DB read failed, falling back to hardcoded:', dbErr)
  }

  // ── Fallback: hardcoded data + audit ────────────────────────────────────
  const offenders = auditContenderOrigins()
  if (offenders.length > 0) {
    throw new Error(
      `auditContenderOrigins failed — unverified contenders: ${offenders.join(', ')}`,
    )
  }
  return {
    contenders: getBallonDorContenders(),
    movers: getBallonDorMovers(),
    framing: getBallonDorFraming(),
  }
}

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests / minute / IP
  const ip = getClientIp(request)
  const rl = rateLimit(`ballon-dor:${ip}`, 20, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  // Serve from cache if fresh
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    const res = NextResponse.json({
      ...cache.payload,
      cachedAt: cache.at,
      cached: true,
    })
    setCorsHeaders(res, request)
    return res
  }

  try {
    const payload = await buildPayload()
    cache = { at: now, payload }
    const res = NextResponse.json({ ...payload, cachedAt: now, cached: false })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    // Audit failure — return 500 so the bug surfaces. Never fall back to
    // fabricated data.
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const res = NextResponse.json(
      { error: 'Ballon d\'Or data integrity check failed', detail: msg },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
