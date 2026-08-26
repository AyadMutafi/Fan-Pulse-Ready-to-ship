import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { findEPLTeam } from '@/lib/epl-teams'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

/**
 * GET /api/recent-matches
 *
 * Returns a unified feed of recent completed matches from BOTH:
 *   - LeagueMatch (EPL) — the active season, shown FIRST
 *   - Match (World Cup) — archived, shown SECOND
 *
 * This solves the "time warp" problem where the home page showed only
 * WC matches even after EPL GW1 was complete. Now EPL matches appear
 * first because the season is active.
 *
 * Query params:
 *   ?limit=12   — max matches per league (default 12, max 50)
 *
 * Rate-limit: 20 req/min/IP.
 *
 * ANTI-HALLUCINATION: all data comes from real DB rows synced from the
 * FPL API (EPL) and verified WC data. No fabricated matches.
 */

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`recent-matches:${ip}`, 20, 60_000)
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
  const rawLimit = Number(searchParams.get('limit') ?? '12')
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.floor(rawLimit))) : 12

  try {
    // ── 1. Fetch EPL matches (LeagueMatch table) ───────────────────────────
    // Completed matches first (most recent kickoff), then upcoming (next 3).
    const eplCompleted = await db.leagueMatch.findMany({
      where: {
        league: 'EPL',
        season: '2026-27',
        status: 'completed',
      },
      orderBy: { kickoffAt: 'desc' },
      take: limit,
    }).catch(() => [])

    const eplUpcoming = await db.leagueMatch.findMany({
      where: {
        league: 'EPL',
        season: '2026-27',
        status: 'upcoming',
      },
      orderBy: { kickoffAt: 'asc' },
      take: 3,
    }).catch(() => [])

    // Resolve team codes → names for EPL matches
    const eplMatches = [...eplCompleted, ...eplUpcoming].map((m) => {
      const homeTeam = findEPLTeam(m.homeTeamCode)
      const awayTeam = findEPLTeam(m.awayTeamCode)
      return {
        id: m.id,
        homeTeam: {
          code: m.homeTeamCode,
          name: homeTeam?.name ?? m.homeTeamCode,
          flag: homeTeam?.badge ?? '⚽',
          sentiment: 50, // Default — updated by FanVote aggregation
        },
        awayTeam: {
          code: m.awayTeamCode,
          name: awayTeam?.name ?? m.awayTeamCode,
          flag: awayTeam?.badge ?? '⚽',
          sentiment: 50,
        },
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        score: m.homeScore !== null && m.awayScore !== null
          ? `${m.homeScore} - ${m.awayScore}`
          : 'vs',
        status: m.status,
        league: 'EPL',
        group: `Matchweek ${m.matchweek}`,
        minute: null,
        matchDate: m.kickoffAt.toISOString(),
      }
    })

    // ── 2. Fetch WC matches (Match table) ───────────────────────────────────
    const wcMatchesRaw = await db.match.findMany({
      where: { league: 'WC', status: 'completed' },
      orderBy: { matchDate: 'desc' },
      take: limit,
    }).catch(() => [])

    const wcMatches = wcMatchesRaw.map((m) => ({
      id: m.id,
      homeTeam: {
        code: m.homeTeamCode,
        name: m.homeTeamName,
        flag: m.homeTeamFlag,
        sentiment: m.homeSentiment,
      },
      awayTeam: {
        code: m.awayTeamCode,
        name: m.awayTeamName,
        flag: m.awayTeamFlag,
        sentiment: m.awaySentiment,
      },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      score: `${m.homeScore} - ${m.awayScore}`,
      status: m.status,
      league: 'WC',
      group: m.group,
      minute: m.minute,
      matchDate: m.matchDate?.toISOString() ?? null,
    }))

    // ── 3. Merge: EPL first (active season), WC second (archived) ───────────
    const allMatches = [...eplMatches, ...wcMatches]

    return NextResponse.json(
      {
        matches: allMatches,
        eplCount: eplMatches.length,
        wcCount: wcMatches.length,
        total: allMatches.length,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (error) {
    console.error('[api/recent-matches] Error:', error)
    return NextResponse.json(
      { matches: [], error: 'Failed to fetch matches' },
      { status: 200 }, // Return 200 with empty array so UI doesn't crash
    )
  }
}
