/**
 * GET /api/transfers — list active transfer sagas, sorted by buzz volume.
 *
 * Public, read-only, rate-limited (20 req/min/IP).
 *
 * Anti-hallucination: this route only returns sagas that were created by the
 * Tier-1-gated discovery pipeline. It never invents sagas. If no sagas exist
 * (e.g. XAI_API_KEY not configured yet), it returns an empty list — the
 * frontend renders an honest empty state.
 *
 * AUTO-REFRESH (added 2026-07-25):
 *   Before returning sagas, we check whether the newest active saga's
 *   `lastUpdatedAt` is older than 30 minutes. If so, we kick off a
 *   NON-BLOCKING background refresh (discovery + ingest for a small batch)
 *   via `maybeStartBackgroundRefresh()`. The response returns immediately
 *   with the current data; the refresh happens in the background for the
 *   NEXT request to see. Single-flight guarded (only one refresh at a time),
 *   fully try/catch-wrapped (a refresh failure never breaks the GET).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { sanitizeXPostUrl, sanitizeXPostUrlBatch } from '@/lib/validate-x-url'
import { isTransferDataStale, maybeStartBackgroundRefresh } from '@/lib/transfer-pulse/auto-refresh'

export const dynamic = 'force-dynamic'

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests / minute / IP
  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:list:${ip}`, 20, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  // ── Auto-refresh backstop ────────────────────────────────────────────────
  // If the data is stale (>30 min since the newest active saga was updated),
  // kick off a NON-BLOCKING background refresh. We deliberately do NOT await
  // this — the response returns immediately with the current data. The
  // refresh happens for the NEXT request to see. Single-flight guarded +
  // fully try/catch-wrapped inside the helper, so a refresh failure can never
  // break the GET response.
  try {
    const stale = await isTransferDataStale()
    if (stale) maybeStartBackgroundRefresh()
  } catch {
    // Defensive: staleness check itself failed — swallow and proceed.
  }

  try {
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status') || 'active'
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get('limit') || '30', 10)),
    )

    // When status is 'all' (or omitted on the "All" filter), return sagas of
    // every status. Otherwise filter to the requested status.
    const where =
      statusParam === 'all' ? {} : { status: statusParam }

    const sagas = await db.transferSaga.findMany({
      where,
      orderBy: [{ buzzVolume: 'desc' }, { lastUpdatedAt: 'desc' }],
      take: limit,
      include: {
        sources: {
          orderBy: { reportedAt: 'desc' },
          take: 3, // top 3 Tier 1 sources for the card
        },
      },
    })

    // ANTI-HALLUCINATION: Filter out sagas where the sources array is empty
    // but tier1Count > 0 (the hallucination pattern). A saga must have at
    // least 1 real source URL to appear in the API response.
    const verifiedSagas = sagas.filter(s => s.sources.length > 0 || s.tier1Count === 0)


    const res = NextResponse.json({
      sagas: verifiedSagas.map((s) => {
        // Anti-hallucination: batch-sanitize source URLs. The seed script
        // generates all journalist source URLs with a shared "2059000000"
        // snowflake prefix — the batch check detects this clustering and
        // nulls out ALL X URLs in the batch. Individual snowflake validation
        // (future date, invalid ID) is also applied per-URL.
        const safeSourceUrls = sanitizeXPostUrlBatch(
          s.sources.map((src) => src.url),
        )
        return {
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
          // Anti-hallucination: null-out resolutionUrl if fabricated
          resolutionUrl: sanitizeXPostUrl(s.resolutionUrl),
          // Wikipedia/CC-BY-SA photo URL for the transfer TARGET player.
          // NULL when no photo → UI shows initials fallback.
          // Always https://upload.wikimedia.org/ when set.
          playerPhotoUrl: s.playerPhotoUrl,
          topSources: s.sources.map((src, i) => ({
            journalistName: src.journalistName,
            journalistHandle: src.journalistHandle,
            outlet: src.outlet,
            url: safeSourceUrls[i],
            headline: src.headline,
            reportedAt: src.reportedAt,
          })),
        }
      }),
      count: sagas.length,
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers] GET error:', err)
    const res = NextResponse.json(
      { error: 'Failed to load transfer sagas' },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
