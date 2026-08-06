/**
 * GET /api/epl/fan-mood
 *
 * Returns the current fan mood for the top EPL clubs (by fan engagement).
 *
 *   Response: {
 *     moods: [{ teamCode, teamName, avgScore, voteCount, moodEmoji }],
 *     available: boolean,
 *     count: number,
 *   }
 *
 * Rate-limit: 20 requests per minute per IP.
 * Cache: 5 minutes server-side (votes change in real-time; 5-min staleness
 *        is acceptable for the mood carousel).
 *
 * ANTI-HALLUCINATION: when no EPL votes exist yet, returns an empty array
 * and `available: false`. The UI MUST render the honest "Be the first to
 * vote" empty state — never fabricate moods.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { fetchEPLClubMood } from '@/lib/epl-club-mood'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const revalidate = 300 // 5 minutes — Next.js ISR cache for the route

export async function GET(request: NextRequest) {
  // ── Rate limit: 20 req/min/IP ──
  const ip = getClientIp(request)
  const rl = rateLimit(`epl-fan-mood:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  try {
    const moods = await fetchEPLClubMood()
    return NextResponse.json(
      {
        moods,
        available: moods.length > 0,
        count: moods.length,
      },
      {
        headers: {
          // Short CDN cache — votes change in real-time, but 60s is safe.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    console.error('[api/epl/fan-mood] Failed to fetch mood:', err)
    return NextResponse.json(
      {
        moods: [],
        available: false,
        count: 0,
        error: 'Fan mood temporarily unavailable',
      },
      { status: 200 },
    )
  }
}
