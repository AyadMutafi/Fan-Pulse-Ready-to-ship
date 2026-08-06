/**
 * GET /api/fpl/players
 *
 * Returns FPL players from the DB (synced by /api/fpl/sync). Supports
 * optional filters:
 *
 *   ?position=MID       → filter by position (GK/DEF/MID/FWD)
 *   ?minOwnership=30    → only players with ≥ 30% ownership
 *   ?team=ARS           → only players from Arsenal
 *   ?limit=50           → max players (default 50, max 200)
 *
 * Rate-limit: 20 req/min/IP.
 *
 * ANTI-HALLUCINATION: returns ONLY players synced from the real FPL API.
 * When the DB is empty (pre-sync), returns an empty array + `available: false`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`fpl-players:${ip}`, 20, 60_000)
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
  const position = searchParams.get('position')?.toUpperCase()
  const minOwnership = Number(searchParams.get('minOwnership') ?? '0')
  const team = searchParams.get('team')?.toUpperCase()
  const rawLimit = Number(searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.floor(rawLimit))) : 50

  try {
    const where: {
      position?: string
      teamCode?: string
      ownershipPct?: { gte: number }
    } = {}
    if (position && ['GK', 'DEF', 'MID', 'FWD'].includes(position)) {
      where.position = position
    }
    if (team && team.length === 3) {
      where.teamCode = team
    }
    if (Number.isFinite(minOwnership) && minOwnership > 0) {
      where.ownershipPct = { gte: minOwnership }
    }

    const players = await getDb().fPLPlayer.findMany({
      where,
      orderBy: { ownershipPct: 'desc' },
      take: limit,
    })

    return NextResponse.json(
      {
        players,
        available: players.length > 0,
        count: players.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (err) {
    console.error('[api/fpl/players] Error:', err)
    return NextResponse.json(
      { players: [], available: false, count: 0, error: 'Players temporarily unavailable' },
      { status: 200 },
    )
  }
}
