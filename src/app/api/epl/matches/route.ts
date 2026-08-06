/**
 * GET /api/epl/matches
 *
 * Returns EPL matches for a matchweek (or the current/next matchweek if
 * not specified).
 *
 *   ?matchweek=1   → specific matchweek
 *   ?status=live   → filter by status (upcoming/live/completed)
 *   ?limit=20      → max matches (default 20, max 50)
 *
 * Rate-limit: 20 req/min/IP.
 *
 * ANTI-HALLUCINATION: returns ONLY matches synced from the real FPL API.
 * When no matches exist (pre-season), returns an empty array + honest state.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { getCurrentMatchweek } from '@/lib/totw-generator'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`epl-matches:${ip}`, 20, 60_000)
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
  const rawMatchweek = Number(searchParams.get('matchweek') ?? '0')
  const status = searchParams.get('status')
  const rawLimit = Number(searchParams.get('limit') ?? '20')
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.floor(rawLimit))) : 20

  try {
    let matchweek = rawMatchweek
    if (!matchweek || matchweek < 1) {
      matchweek = await getCurrentMatchweek(getDb())
    }

    const where: {
      league: string
      season: string
      matchweek?: number
      status?: string
    } = {
      league: 'EPL',
      season: '2026-27',
    }
    if (matchweek > 0) where.matchweek = matchweek
    if (status && ['upcoming', 'live', 'completed'].includes(status)) {
      where.status = status
    }

    const matches = await getDb().leagueMatch.findMany({
      where,
      orderBy: { kickoffAt: 'asc' },
      take: limit,
    })

    return NextResponse.json(
      {
        matches,
        matchweek,
        available: matches.length > 0,
        count: matches.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (err) {
    console.error('[api/epl/matches] Error:', err)
    return NextResponse.json(
      { matches: [], available: false, count: 0, error: 'Matches temporarily unavailable' },
      { status: 200 },
    )
  }
}
