/**
 * GET  /api/transfers/alerts — returns active sagas that breach the alert
 *         threshold (a "popping off" view for the hot-rumors widget).
 * POST /api/transfers/alerts — admin overrides the threshold config.
 *         Body: { minBuzz?, minLikelihood?, trendOnly? }
 *
 * The default threshold (no override): buzzVolume >= 8 AND
 * (buzzTrend = 'rising' OR fanReadLikelihood >= 70).
 *
 * Threshold config is held in module memory (single-instance deploy). It is a
 * derived view — no saga data is mutated. Pure read on top of the discovery +
 * ingest pipelines.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'

export const dynamic = 'force-dynamic'

interface AlertConfig {
  minBuzz: number
  minLikelihood: number
  trendOnly: boolean
}

const DEFAULT_CONFIG: AlertConfig = {
  minBuzz: 8,
  minLikelihood: 70,
  trendOnly: false,
}

// Module-level config override (admin-set, single-instance deploy).
let configOverride: AlertConfig | null = null

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:alerts:${ip}`, 20, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  const cfg = configOverride ?? DEFAULT_CONFIG

  try {
    // Fetch active sagas, then filter by threshold in JS (keeps the query
    // simple and lets us apply the OR logic cleanly).
    const candidates = await db.transferSaga.findMany({
      where: { status: 'active' },
      orderBy: [{ buzzVolume: 'desc' }, { lastUpdatedAt: 'desc' }],
      take: 50,
    })

    const triggered = candidates.filter((s) => {
      if (s.buzzVolume < cfg.minBuzz) return false
      if (cfg.trendOnly && s.buzzTrend !== 'rising') return false
      return s.buzzTrend === 'rising' || s.fanReadLikelihood >= cfg.minLikelihood
    })

    const res = NextResponse.json({
      config: cfg,
      alerts: triggered.map((s) => ({
        id: s.id,
        playerName: s.playerName,
        fromClubName: s.fromClubName,
        toClubName: s.toClubName,
        buzzVolume: s.buzzVolume,
        buzzTrend: s.buzzTrend,
        fanReadLikelihood: s.fanReadLikelihood,
        excitedPct: s.excitedPct,
        skepticalPct: s.skepticalPct,
        dreadingPct: s.dreadingPct,
        tier1Count: s.tier1Count,
        lastUpdatedAt: s.lastUpdatedAt,
      })),
      count: triggered.length,
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/alerts] GET error:', err)
    const res = NextResponse.json(
      { error: 'Failed to load alerts' },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    const res = unauthorizedResponse()
    setCorsHeaders(res, request)
    return res
  }

  let body: Partial<AlertConfig> = {}
  try {
    body = await request.json()
  } catch {
    const res = NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
    setCorsHeaders(res, request)
    return res
  }

  configOverride = {
    minBuzz: typeof body.minBuzz === 'number' ? body.minBuzz : DEFAULT_CONFIG.minBuzz,
    minLikelihood:
      typeof body.minLikelihood === 'number'
        ? body.minLikelihood
        : DEFAULT_CONFIG.minLikelihood,
    trendOnly: Boolean(body.trendOnly),
  }

  const res = NextResponse.json({ ok: true, config: configOverride })
  setCorsHeaders(res, request)
  return res
}
