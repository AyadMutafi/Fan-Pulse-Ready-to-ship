import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/curated-links?matchId=xxx&limit=20
 *
 * Public endpoint that returns founder-curated links for a specific match.
 * Used by the Fan Talk pipeline (src/lib/live-fan-talk.ts) as the primary
 * source when > 3 curated links exist for a match.
 *
 * Rate limit: 20 req/min/IP (same as /api/fan-talk).
 *
 * Response:
 *   {
 *     links: Array<{
 *       id, url, platform, author, content, sentimentScore,
 *       sentimentLabel, hashtags: string[], postedAt, matchLabel, curatedAt
 *     }>,
 *     total: number
 *   }
 *
 * ANTI-HALLUCINATION: every link returned was curated by the founder from
 * a real URL (validated against the domain allowlist in /api/curate). The
 * content field holds the real page_reader extraction — never fabricated.
 */

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(`curated-links:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')
    const platform = searchParams.get('platform')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(limitParam) || DEFAULT_LIMIT),
    )

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId query parameter is required' },
        { status: 400 },
      )
    }

    const links = await db.curatedLink.findMany({
      where: {
        matchId,
        isActive: true,
        ...(platform ? { platform } : {}),
      },
      orderBy: { postedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        url: true,
        platform: true,
        author: true,
        content: true,
        sentimentScore: true,
        sentimentLabel: true,
        hashtags: true,
        postedAt: true,
        matchLabel: true,
        curatedAt: true,
      },
    })

    // Parse hashtags JSON → string[] for client convenience
    const formatted = links.map((l) => {
      let hashtags: string[] = []
      try {
        const parsed = JSON.parse(l.hashtags)
        if (Array.isArray(parsed)) {
          hashtags = parsed.filter((h) => typeof h === 'string')
        }
      } catch {
        // leave empty
      }
      return {
        ...l,
        hashtags,
        sentimentScore: Math.round(l.sentimentScore),
        postedAt: l.postedAt.toISOString(),
        curatedAt: l.curatedAt.toISOString(),
      }
    })

    return NextResponse.json({
      links: formatted,
      total: formatted.length,
    })
  } catch (error) {
    console.error('[curated-links] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch curated links' },
      { status: 500 },
    )
  }
}
