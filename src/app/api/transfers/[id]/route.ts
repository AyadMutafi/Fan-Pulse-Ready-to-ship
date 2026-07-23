/**
 * GET /api/transfers/[id] — full saga detail: all Tier 1 sources, all fan
 * posts, and the 7-day sentiment timeline.
 *
 * Public, read-only, rate-limited (20 req/min/IP).
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:detail:${ip}`, 20, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  try {
    const saga = await db.transferSaga.findUnique({
      where: { id },
      include: {
        sources: { orderBy: { reportedAt: 'desc' } },
        posts: { orderBy: { postedAt: 'desc' }, take: 50 },
        timeline: { orderBy: { date: 'asc' } },
      },
    })

    if (!saga) {
      const res = NextResponse.json(
        { error: 'Saga not found' },
        { status: 404 },
      )
      setCorsHeaders(res, request)
      return res
    }

    // Anti-hallucination: batch-sanitize source + post URLs. The seed script
    // generates all journalist source URLs with a shared "2059000000" snowflake
    // prefix and all fan post URLs with sagaIdHash IDs that decode to 2066
    // (future). The batch check detects prefix clustering; per-URL validation
    // catches future-dated/invalid snowflakes. Fabricated URLs become null and
    // the frontend renders them as non-clickable cards.
    const safeSourceUrls = sanitizeXPostUrlBatch(
      saga.sources.map((s) => s.url),
    )
    const safePostUrls = sanitizeXPostUrlBatch(
      saga.posts.map((p) => p.url),
    )

    const res = NextResponse.json({
      saga: {
        id: saga.id,
        playerName: saga.playerName,
        playerNationCode: saga.playerNationCode,
        fromClubCode: saga.fromClubCode,
        fromClubName: saga.fromClubName,
        toClubCode: saga.toClubCode,
        toClubName: saga.toClubName,
        status: saga.status,
        feeReported: saga.feeReported,
        tier1Count: saga.tier1Count,
        fanReadLikelihood: saga.fanReadLikelihood,
        buzzVolume: saga.buzzVolume,
        buzzTrend: saga.buzzTrend,
        excitedPct: saga.excitedPct,
        skepticalPct: saga.skepticalPct,
        dreadingPct: saga.dreadingPct,
        avgSentiment: saga.avgSentiment,
        firstReportedAt: saga.firstReportedAt,
        lastUpdatedAt: saga.lastUpdatedAt,
        resolvedAt: saga.resolvedAt,
        // Anti-hallucination: null-out resolutionUrl if it's a fabricated X URL
        resolutionUrl: sanitizeXPostUrl(saga.resolutionUrl),
      },
      sources: saga.sources.map((s, i) => ({
        id: s.id,
        journalistName: s.journalistName,
        journalistHandle: s.journalistHandle,
        outlet: s.outlet,
        url: safeSourceUrls[i],
        headline: s.headline,
        reportedAt: s.reportedAt,
      })),
      posts: saga.posts.map((p, i) => ({
        id: p.id,
        platform: p.platform,
        author: p.author,
        content: p.content,
        url: safePostUrls[i],
        sentimentScore: p.sentimentScore,
        sentimentLabel: p.sentimentLabel,
        postedAt: p.postedAt,
      })),
      timeline: saga.timeline.map((t) => ({
        date: t.date,
        excitedPct: t.excitedPct,
        skepticalPct: t.skepticalPct,
        dreadingPct: t.dreadingPct,
        avgSentiment: t.avgSentiment,
        postCount: t.postCount,
      })),
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/[id]] GET error:', err)
    const res = NextResponse.json(
      { error: 'Failed to load saga detail' },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
