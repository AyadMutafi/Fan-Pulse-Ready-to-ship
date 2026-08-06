/**
 * GET /api/epl/upcoming
 *
 * Returns upcoming EPL fixtures in priority order (next kickoff first).
 *
 *   Query:  ?limit=8   (max 12, default 8)
 *
 * Rate-limit: 20 requests per minute per IP. Fixtures are cached server-side
 * for 30 minutes (see src/lib/epl-fixtures.ts), so most calls return from
 * cache without hitting the FPL API.
 *
 * ANTI-HALLUCINATION: when no EPL fixtures are available (off-season, FPL
 * API down, webSearch fallback empty), the response returns an empty array
 * and `available: false`. The UI MUST render the honest empty state — never
 * fabricate kickoff times.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { fetchUpcomingEPLFixtures } from '@/lib/epl-fixtures'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const revalidate = 1800 // 30 minutes — Next.js ISR cache for the route

export async function GET(request: NextRequest) {
  // ── Rate limit: 20 req/min/IP ──
  const ip = getClientIp(request)
  const rl = rateLimit(`epl-upcoming:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(request.url)
  const rawLimit = Number(searchParams.get('limit') ?? '8')
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(12, Math.floor(rawLimit))) : 8

  try {
    const fixtures = await fetchUpcomingEPLFixtures(limit)
    return NextResponse.json(
      {
        fixtures,
        available: fixtures.length > 0,
        count: fixtures.length,
        cached: true,
      },
      {
        headers: {
          // CDN + browser cache for 5 minutes — keeps the route fast even
          // when the server-side in-memory cache is fresh.
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (err) {
    console.error('[api/epl/upcoming] Failed to fetch fixtures:', err)
    // Honest empty state — never fabricate fixtures on error.
    return NextResponse.json(
      {
        fixtures: [],
        available: false,
        count: 0,
        error: 'Fixtures temporarily unavailable',
      },
      { status: 200 }, // 200 so the UI renders the empty state, not an error
    )
  }
}
