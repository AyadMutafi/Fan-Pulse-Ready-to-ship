/**
 * GET /api/stories — today's Pulse Stories.
 *
 * Public, read-only, rate-limited (20 req/min/IP). Cached in-memory for 1 hour.
 *
 * Anti-hallucination:
 *   - Stories are generated exclusively from verified data via
 *     `generateDailyStories()` (see src/lib/story-generator.ts).
 *   - Every story carries a `source` citation (e.g. "Ballon d'Or Race",
 *     "FIFA.com official awards", "VERIFIED_DATA.md") and a `verifiedEvent`
 *     string with the specific backing fact.
 *   - No story content is invented — if a verified fact doesn't exist for a
 *     story type, that story is not generated.
 *
 * Deterministic daily rotation:
 *   The same calendar day (UTC) always yields the same story set. New stories
 *   appear each subsequent day. The 1-hour cache prevents re-deriving the set
 *   on every request within the same hour.
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import {
  generateDailyStories,
  storyDayKey,
  type PulseStory,
} from '@/lib/story-generator'

export const dynamic = 'force-dynamic'

// ── In-memory cache (1 hour TTL) ─────────────────────────────────────────────
// Stories are deterministic per-day, so caching is safe. The cache key is the
// UTC date string — if the server crosses midnight UTC, the next request
// re-derives the new day's stories.
interface CacheEntry {
  dayKey: string
  at: number
  stories: PulseStory[]
}
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
let cache: CacheEntry | null = null

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests / minute / IP
  const ip = getClientIp(request)
  const rl = rateLimit(`stories:${ip}`, 20, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  const now = Date.now()
  const todayKey = storyDayKey(new Date(now))

  // Serve from cache if fresh AND still the same UTC day.
  if (cache && now - cache.at < CACHE_TTL_MS && cache.dayKey === todayKey) {
    const res = NextResponse.json({
      stories: cache.stories,
      dayKey: cache.dayKey,
      cachedAt: cache.at,
      cached: true,
    })
    setCorsHeaders(res, request)
    return res
  }

  try {
    const stories = await generateDailyStories(new Date(now))
    cache = { dayKey: todayKey, at: now, stories }
    const res = NextResponse.json({
      stories,
      dayKey: todayKey,
      cachedAt: now,
      cached: false,
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const res = NextResponse.json(
      { error: 'Failed to generate stories', detail: msg },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
