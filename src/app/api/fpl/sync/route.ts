/**
 * POST /api/fpl/sync (admin-protected)
 *
 * Syncs FPL player + fixture data from the real FPL API into the DB.
 * Creates/updates FPLPlayer, LeaguePlayer, FPLFixture, FPLGameweek rows.
 *
 * Rate-limit: 1 req/min/IP (admin-only, heavy operation).
 *
 * ANTI-HALLUCINATION: ALL data comes from the REAL FPL API
 * (https://fantasy.premierleague.com/api/bootstrap-static/ + /fixtures/).
 * Never invents players, fixtures, or gameweeks. If the FPL API is down,
 * the sync fails gracefully and returns an error — the DB is left unchanged.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  fetchBootstrap,
  fetchFixtures,
  resolveTeamCodes,
  type FPLBootstrapElement,
  type FPLFixtureRaw,
} from '@/lib/fpl-api'
import { matchAllPlayers, normalizeName } from '@/lib/fpl-matcher'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Admin auth check
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  // Rate limit: 1 req/min/IP
  const ip = getClientIp(request)
  const rl = rateLimit(`fpl-sync:${ip}`, 1, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Sync rate limit — please wait a minute' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  try {
    // 1. Fetch bootstrap-static (players, teams, gameweeks)
    const bootstrap = await fetchBootstrap()
    if (!bootstrap) {
      return NextResponse.json(
        { error: 'FPL API unavailable — try again later' },
        { status: 502 },
      )
    }

    // 2. Resolve team IDs → codes
    const teamMap = resolveTeamCodes(bootstrap.teams)

    // 3. Sync FPLPlayer + LeaguePlayer rows
    const matchedPlayers = matchAllPlayers(bootstrap.elements, teamMap)
    let playersSynced = 0
    let playersLinked = 0

    for (const mp of matchedPlayers) {
      // Upsert FPLPlayer (keyed by fplId)
      await getDb().fPLPlayer.upsert({
        where: { fplId: mp.fplId },
        create: {
          fplId: mp.fplId,
          webName: mp.webName,
          fullName: mp.fullName,
          teamCode: mp.teamCode,
          teamFplId: mp.teamFplId,
          position: mp.position,
          price: mp.price,
          ownershipPct: mp.ownershipPct,
          form: mp.form,
          totalPoints: mp.totalPoints,
          pointsPerGame: mp.pointsPerGame,
          minutes: mp.minutes,
          goals: mp.goals,
          assists: mp.assists,
          cleanSheets: mp.cleanSheets,
        },
        update: {
          webName: mp.webName,
          fullName: mp.fullName,
          teamCode: mp.teamCode,
          teamFplId: mp.teamFplId,
          position: mp.position,
          price: mp.price,
          ownershipPct: mp.ownershipPct,
          form: mp.form,
          totalPoints: mp.totalPoints,
          pointsPerGame: mp.pointsPerGame,
          minutes: mp.minutes,
          goals: mp.goals,
          assists: mp.assists,
          cleanSheets: mp.cleanSheets,
          syncedAt: new Date(),
        },
      })
      playersSynced++

      // Upsert LeaguePlayer (keyed by name + teamCode + season)
      const season = '2026-27'
      const normalizedName = normalizeName(mp.fullName)
      const existing = await getDb().leaguePlayer.findFirst({
        where: {
          name: { equals: mp.fullName },
          teamCode: mp.teamCode,
          season,
        },
      })

      if (existing) {
        // Update fplId link if not set
        if (!existing.fplId) {
          await getDb().leaguePlayer.update({
            where: { id: existing.id },
            data: { fplId: mp.fplId, webName: mp.webName, position: mp.position },
          })
          playersLinked++
        }
      } else {
        // Create new LeaguePlayer
        await getDb().leaguePlayer.create({
          data: {
            name: mp.fullName,
            webName: mp.webName,
            teamCode: mp.teamCode,
            league: 'EPL',
            season,
            position: mp.position,
            fplId: mp.fplId,
          },
        })
        playersLinked++
      }
    }

    // 4. Sync FPLGameweek rows
    let gameweeksSynced = 0
    for (const ev of bootstrap.events) {
      await getDb().fPLGameweek.upsert({
        where: { fplId: ev.id },
        create: {
          fplId: ev.id,
          name: ev.name,
          deadlineTime: new Date(ev.deadline_time),
          isCurrent: ev.is_current,
          isNext: ev.is_next,
          finished: ev.finished,
          averageScore: ev.average_entry_score,
          highestScore: ev.highest_score,
        },
        update: {
          name: ev.name,
          deadlineTime: new Date(ev.deadline_time),
          isCurrent: ev.is_current,
          isNext: ev.is_next,
          finished: ev.finished,
          averageScore: ev.average_entry_score,
          highestScore: ev.highest_score,
          syncedAt: new Date(),
        },
      })
      gameweeksSynced++
    }

    // 5. Sync FPLFixture rows
    let fixturesSynced = 0
    let leagueMatchesCreated = 0
    const fixtures = await fetchFixtures()
    if (fixtures && Array.isArray(fixtures)) {
      for (const fx of fixtures) {
        if (!fx.kickoff_time) continue
        const homeTeam = teamMap.get(fx.team_h)
        const awayTeam = teamMap.get(fx.team_a)
        if (!homeTeam || !awayTeam) continue

        await getDb().fPLFixture.upsert({
          where: { fplId: fx.id },
          create: {
            fplId: fx.id,
            gameweek: fx.event ?? 0,
            homeTeamFplId: fx.team_h,
            awayTeamFplId: fx.team_a,
            homeTeamCode: homeTeam.code,
            awayTeamCode: awayTeam.code,
            kickoffTime: new Date(fx.kickoff_time),
            finished: fx.finished,
            started: fx.started,
            homeScore: fx.team_h_score,
            awayScore: fx.team_a_score,
            minutes: fx.minutes,
          },
          update: {
            gameweek: fx.event ?? 0,
            homeTeamCode: homeTeam.code,
            awayTeamCode: awayTeam.code,
            kickoffTime: new Date(fx.kickoff_time),
            finished: fx.finished,
            started: fx.started,
            homeScore: fx.team_h_score,
            awayScore: fx.team_a_score,
            minutes: fx.minutes,
            syncedAt: new Date(),
          },
        })
        fixturesSynced++

        // Also upsert LeagueMatch
        const matchweek = fx.event ?? 0
        if (matchweek > 0) {
          const status = fx.finished ? 'completed' : fx.started ? 'live' : 'upcoming'
          await getDb().leagueMatch.upsert({
            where: {
              league_season_matchweek_homeTeamCode_awayTeamCode: {
                league: 'EPL',
                season: '2026-27',
                matchweek,
                homeTeamCode: homeTeam.code,
                awayTeamCode: awayTeam.code,
              },
            },
            create: {
              league: 'EPL',
              season: '2026-27',
              matchweek,
              homeTeamCode: homeTeam.code,
              awayTeamCode: awayTeam.code,
              homeScore: fx.team_h_score,
              awayScore: fx.team_a_score,
              status,
              kickoffAt: new Date(fx.kickoff_time),
              fplFixtureId: fx.id,
            },
            update: {
              homeScore: fx.team_h_score,
              awayScore: fx.team_a_score,
              status,
              kickoffAt: new Date(fx.kickoff_time),
              fplFixtureId: fx.id,
            },
          })
          leagueMatchesCreated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced: {
        players: playersSynced,
        playersLinked,
        gameweeks: gameweeksSynced,
        fixtures: fixturesSynced,
        leagueMatches: leagueMatchesCreated,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[api/fpl/sync] Error:', err)
    return NextResponse.json(
      { error: 'Sync failed — check server logs' },
      { status: 500 },
    )
  }
}
