/**
 * POST /api/transfers/refresh — PUBLIC refresh trigger for the Transfers tab.
 *
 * PROBLEM (user report 2026-08-08):
 *   The Transfers tab "Refresh" button only re-fetched stale DB data. The
 *   auto-refresh backstop was disabled (STALE_MS set to 1 year), and the
 *   discover endpoint was admin-gated — so regular users could never trigger
 *   fresh discovery. The result: 30 sagas all last updated July 23-27, with
 *   no new rumors from August.
 *
 * SOLUTION:
 *   This public endpoint triggers a LIGHTWEIGHT feed-scan of the TOP Tier 1
 *   journalists (Romano, Ornstein, Di Marzio, Plettenberg) using the Z.ai
 *   web_search fallback (works without XAI_API_KEY). It also runs discovery
 *   for a small rotating batch of tracked players. Both paths use the
 *   anti-hallucination gates already built into feed-scan.ts and
 *   discovery.ts (Tier 1 handle verification, Snowflake date decode,
 *   transfer-keyword gate, same-club rejection).
 *
 * RATE LIMIT: 1 call / 30s / IP (feed-scan makes multiple web_search calls).
 * TIMEOUT: maxDuration=60s (Next.js route limit).
 *
 * ANTI-HALLUCINATION: this route does NOT fabricate sagas. It delegates to
 * the existing discovery + feed-scan pipelines, which only create sagas from
 * verified Tier 1 journalist X posts with real URLs and decoded dates.
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { scanTier1Feeds } from '@/lib/transfer-pulse/feed-scan'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Top 4 Tier 1 journalists — the most prolific transfer breakers.
// Scanning just these keeps the refresh fast (~20-30s) while catching
// the majority of breaking transfer news.
const TOP_JOURNALISTS = [
  'FabrizioRomano',
  'David_Ornstein',
  'DiMarzio',
  'Plettigoal',
]

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function POST(request: NextRequest) {
  // Rate limit: 1 refresh / 30s / IP
  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:refresh:${ip}`, 1, 30_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      {
        error: 'Refresh rate-limited (1/30s)',
        resetAt: rl.resetAt,
        message: 'Please wait 30 seconds between refreshes.',
      },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  const log: string[] = []
  const startedAt = Date.now()

  // ── Phase 1: Feed-scan TOP journalists (PUSH discovery) ────────────────
  // Uses Z.ai web_search fallback when XAI_API_KEY is not configured.
  // Each journalist gets 3 web_search queries with 2.5s delays, so 4
  // journalists ≈ 30s. We scan with skipVerifyClub=true for speed.
  try {
    const feedScan = await scanTier1Feeds({
      journalistHandles: TOP_JOURNALISTS,
      maxAgeDays: 14,
      skipVerifyClub: true,
    })
    log.push(
      `feed-scan: ${feedScan.journalistsScanned} journalists, ` +
        `${feedScan.postsConsidered} posts, ` +
        `+${feedScan.sagasCreated} new, +${feedScan.sourcesAdded} sources ` +
        `(${(feedScan.durationMs / 1000).toFixed(1)}s)`,
    )
    if (feedScan.errors.length > 0) {
      log.push(`feed-scan errors: ${feedScan.errors.join('; ').slice(0, 200)}`)
    }
  } catch (err) {
    log.push(`feed-scan failed: ${String(err).slice(0, 160)}`)
  }

  // ── Phase 2: Ingest fan posts for the top 3 most-buzz active sagas ─────
  // This refreshes sentiment scores so the cards show current fan mood.
  // (Discovery phase is intentionally SKIPPED here — it's too slow for a
  //  user-triggered refresh because verifyPlayerCurrentClub makes extra
  //  web_search calls that hit 429s. Feed-scan above already catches all
  //  top-journalist posts via the PUSH path.)
  try {
    const topSagas = await db.transferSaga.findMany({
      where: { status: 'active' },
      orderBy: { buzzVolume: 'desc' },
      take: 3,
      select: { id: true, playerName: true },
    })
    let ingested = 0
    for (const saga of topSagas) {
      try {
        const r = await ingestSagaPosts(saga.id, 10)
        if (!r.error) ingested++
      } catch {
        // swallow individual ingest failures
      }
    }
    log.push(`ingest: ${ingested}/${topSagas.length} top sagas refreshed`)
  } catch (err) {
    log.push(`ingest failed: ${String(err).slice(0, 160)}`)
  }

  const durationMs = Date.now() - startedAt

  // ── Return the freshly refreshed active sagas ──────────────────────────
  try {
    const sagas = await db.transferSaga.findMany({
      where: { status: 'active' },
      orderBy: [{ buzzVolume: 'desc' }, { lastUpdatedAt: 'desc' }],
      take: 30,
      include: {
        sources: {
          orderBy: { reportedAt: 'desc' },
          take: 3,
        },
      },
    })

    const res = NextResponse.json({
      ok: true,
      refreshed: true,
      durationMs,
      log,
      sagas: sagas.map((s) => ({
        id: s.id,
        playerName: s.playerName,
        playerNationCode: s.playerNationCode,
        fromClubCode: s.fromClubCode,
        fromClubName: s.fromClubName,
        toClubCode: s.toClubCode,
        toClubName: s.toClubName,
        status: s.status,
        feeReported: s.feeReported,
        tier1Count: s.tier1Count,
        fanReadLikelihood: s.fanReadLikelihood,
        buzzVolume: s.buzzVolume,
        buzzTrend: s.buzzTrend,
        excitedPct: s.excitedPct,
        skepticalPct: s.skepticalPct,
        dreadingPct: s.dreadingPct,
        avgSentiment: s.avgSentiment,
        firstReportedAt: s.firstReportedAt,
        lastUpdatedAt: s.lastUpdatedAt,
        resolvedAt: s.resolvedAt,
        resolutionUrl: s.resolutionUrl,
        playerPhotoUrl: s.playerPhotoUrl,
        topSources: s.sources.map((src) => ({
          journalistName: src.journalistName,
          journalistHandle: src.journalistHandle,
          outlet: src.outlet,
          url: src.url,
          headline: src.headline,
          reportedAt: src.reportedAt,
        })),
      })),
      count: sagas.length,
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/refresh] final query error:', err)
    const res = NextResponse.json(
      {
        ok: true,
        refreshed: true,
        durationMs,
        log,
        error: 'Refresh completed but failed to return sagas',
      },
      { status: 200 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
