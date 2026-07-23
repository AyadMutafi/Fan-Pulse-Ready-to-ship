/**
 * GET /api/transfers — list active transfer sagas, sorted by buzz volume.
 *
 * Public, read-only, rate-limited (20 req/min/IP).
 *
 * Anti-hallucination: this route only returns sagas that were created by the
 * Tier-1-gated discovery pipeline. It never invents sagas. If no sagas exist
 * (e.g. XAI_API_KEY not configured yet), it returns an empty list — the
 * frontend renders an honest empty state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { sanitizeXPostUrl, sanitizeXPostUrlBatch } from '@/lib/validate-x-url'

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

    const res = NextResponse.json({
      sagas: sagas.map((s) => {
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
