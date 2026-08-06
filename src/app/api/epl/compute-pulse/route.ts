/**
 * POST /api/epl/compute-pulse (admin-protected)
 *
 * Recomputes the Pulse Score for all LeaguePlayer rows in the current season.
 * Reads FanVote aggregations + FPL form/points data, then writes the computed
 * pulseScore + sentiment + trend back to each LeaguePlayer.
 *
 *   Body: { season?: string (default "2026-27") }
 *
 * Rate-limit: 1 req/min/IP (admin-only, heavy operation).
 *
 * ANTI-HALLUCINATION: the pulse score is computed from REAL FanVote + FPL data
 * using computeLeaguePulseScore(). No invented values.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { computeLeaguePulseScore } from '@/lib/league-pulse-engine'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`epl-compute:${ip}`, 1, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Compute rate limit — please wait a minute' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const season = body.season ?? '2026-27'

    // 1. Fetch all LeaguePlayers for this season
    const players = await getDb().leaguePlayer.findMany({
      where: { league: 'EPL', season },
    })

    if (players.length === 0) {
      return NextResponse.json({
        success: true,
        computed: 0,
        message: 'No LeaguePlayer rows found — run /api/fpl/sync first',
      })
    }

    // 2. Fetch all FPLPlayer rows (for form + points)
    const fplPlayers = await getDb().fPLPlayer.findMany()
    const fplMap = new Map(fplPlayers.map((p) => [p.fplId, p]))

    // 3. Aggregate FanVote sentiment per team
    const teamSentiments = new Map<string, { avg: number; count: number }>()
    const votes = await getDb().fanVote.findMany({
      where: { teamCode: { in: [...new Set(players.map((p) => p.teamCode))] } },
      select: { teamCode: true, score: true },
    })
    for (const v of votes) {
      const existing = teamSentiments.get(v.teamCode) ?? { avg: 0, count: 0 }
      existing.avg = (existing.avg * existing.count + v.score) / (existing.count + 1)
      existing.count += 1
      teamSentiments.set(v.teamCode, existing)
    }

    // 4. Compute + update each player
    let computed = 0
    for (const player of players) {
      const fpl = player.fplId ? fplMap.get(player.fplId) : null
      const sentimentAgg = teamSentiments.get(player.teamCode)
      const fanSentiment = sentimentAgg ? sentimentAgg.avg : 50
      const fplForm = fpl?.form ?? 0
      const fplPoints = fpl?.totalPoints ?? 0

      const result = computeLeaguePulseScore({
        fanSentiment,
        fplForm,
        fplPoints,
      })

      await getDb().leaguePlayer.update({
        where: { id: player.id },
        data: {
          previousPulseScore: player.pulseScore,
          pulseScore: result.pulseScore,
          sentiment: result.sentiment,
          trend: result.trend,
        },
      })
      computed++
    }

    return NextResponse.json({
      success: true,
      computed,
      season,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[api/epl/compute-pulse] Error:', err)
    return NextResponse.json(
      { error: 'Compute failed — check server logs' },
      { status: 500 },
    )
  }
}
