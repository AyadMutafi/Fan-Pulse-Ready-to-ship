/**
 * GET /api/transfer-tweets — latest real transfer tweets from Tier 1 journalists.
 *
 * Public, read-only, rate-limited (20 req/min/IP). Cached in-memory for 10 min.
 *
 * Query params:
 *   limit  — max tweets to return (1-12, default 8)
 *
 * Anti-hallucination:
 *   - Every returned tweet has a real https://x.com/<handle>/status/<digits> URL
 *     and an author handle in TIER1_HANDLES.
 *   - If both the live X search and the DB fallback return 0 tweets, the route
 *     returns { tweets: [], lastUpdated: null, error: 'Transfer tweets temporarily unavailable' }
 *     — an honest empty state. It NEVER fabricates tweets.
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { fetchLatestTransferTweets } from '@/lib/latest-transfer-tweets'

export const dynamic = 'force-dynamic'

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests / minute / IP
  const ip = getClientIp(request)
  const rl = rateLimit(`transfer-tweets:${ip}`, 20, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  // Parse limit (1-12, default 8)
  const url = new URL(request.url)
  const rawLimit = parseInt(url.searchParams.get('limit') || '8', 10)
  const limit = Math.min(12, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 8))

  try {
    const tweets = await fetchLatestTransferTweets(limit)

    if (tweets.length === 0) {
      // Honest empty state — never fabricate
      const res = NextResponse.json({
        tweets: [],
        lastUpdated: null,
        error: 'Transfer tweets temporarily unavailable',
      })
      setCorsHeaders(res, request)
      return res
    }

    const res = NextResponse.json({
      tweets,
      lastUpdated: new Date().toISOString(),
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const res = NextResponse.json(
      { tweets: [], lastUpdated: null, error: `Failed to fetch transfer tweets: ${msg}` },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
