import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import {
  rankR16Teams,
  seedR16Teams,
  R16_MATCHUPS,
} from '@/lib/r16-buzz-ranker'

/**
 * R16 launch — activates the Round of 16 as the LIVE stage.
 *
 * Steps:
 *   1. Verifies the 8 R16 matchups are present in the DB as 'upcoming' Match
 *      rows (seeded by /api/world-cup/seed). If missing, creates them from
 *      R16_MATCHUPS.
 *   2. Marks the R16 WCStage as 'live' with startedAt=2026-07-04.
 *   3. Calls rankR16Teams(false) (baseline, no SDK — instant) and
 *      seedR16Teams(locked=false) to populate the Elite/Crisis XI.
 *
 * Idempotent: safe to call multiple times. If R16 is already live + seeded,
 * returns the current state without re-seeding.
 *
 * Auth: admin only (this transitions stage status).
 */

const TEAM_INFO: Record<string, { name: string; flag: string }> = {
  MEX: { name: 'Mexico', flag: '🇲🇽' },
  CAN: { name: 'Canada', flag: '🇨🇦' },
  BRA: { name: 'Brazil', flag: '🇧🇷' },
  PAR: { name: 'Paraguay', flag: '🇵🇾' },
  MAR: { name: 'Morocco', flag: '🇲🇦' },
  NOR: { name: 'Norway', flag: '🇳🇴' },
  FRA: { name: 'France', flag: '🇫🇷' },
  ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  BEL: { name: 'Belgium', flag: '🇧🇪' },
  USA: { name: 'United States', flag: '🇺🇸' },
  ESP: { name: 'Spain', flag: '🇪🇸' },
  POR: { name: 'Portugal', flag: '🇵🇹' },
  SUI: { name: 'Switzerland', flag: '🇨🇭' },
  EGY: { name: 'Egypt', flag: '🇪🇬' },
  ARG: { name: 'Argentina', flag: '🇦🇷' },
  COL: { name: 'Colombia', flag: '🇨🇴' },
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  try {
    // ── 1. Find or create the R16 stage ──
    let r16Stage = await db.wCStage.findFirst({
      where: { name: 'Round of 16' },
    })
    if (!r16Stage) {
      return NextResponse.json(
        { error: 'R16 stage not found — run /api/world-cup/seed first' },
        { status: 404 }
      )
    }

    // ── 2. Ensure the 8 R16 matches exist (upcoming, group='R16') ──
    let matchesCreated = 0
    let matchesExisting = 0
    for (const m of R16_MATCHUPS) {
      const exists = await db.match.findFirst({
        where: {
          group: 'R16',
          homeTeamCode: m.homeCode,
          awayTeamCode: m.awayCode,
        },
      })
      if (exists) {
        matchesExisting++
        continue
      }
      const homeInfo = TEAM_INFO[m.homeCode]
      const awayInfo = TEAM_INFO[m.awayCode]
      if (!homeInfo || !awayInfo) continue
      await db.match.create({
        data: {
          homeTeamCode: m.homeCode,
          homeTeamName: homeInfo.name,
          homeTeamFlag: homeInfo.flag,
          awayTeamCode: m.awayCode,
          awayTeamName: awayInfo.name,
          awayTeamFlag: awayInfo.flag,
          homeScore: 0,
          awayScore: 0,
          status: 'upcoming',
          league: 'WC',
          group: 'R16',
          matchDate: new Date(m.matchDate),
          homeSentiment: 50,
          awaySentiment: 50,
        },
      })
      matchesCreated++
    }

    // ── 3. Transition the R16 stage to 'live' ──
    if (r16Stage.status !== 'live') {
      r16Stage = await db.wCStage.update({
        where: { id: r16Stage.id },
        data: {
          status: 'live',
          startedAt: new Date('2026-07-04T00:00:00.000Z'),
        },
      })
    }

    // ── 4. Seed R16 Elite XI + Crisis XI from the baseline ──
    const result = await rankR16Teams(false) // baseline, no SDK calls — instant
    await seedR16Teams(db, result, r16Stage.id, false) // locked=false (live)

    return NextResponse.json({
      ok: true,
      message: 'R16 is now LIVE — Elite/Crisis XI seeded from verified baseline',
      stage: {
        id: r16Stage.id,
        name: r16Stage.name,
        status: r16Stage.status,
        startedAt: r16Stage.startedAt,
      },
      matchesCreated,
      matchesExisting,
      matchups: R16_MATCHUPS,
      elite: result.elite.length,
      crisis: result.crisis.length,
      buzzSource: result.buzzSource,
      elitePlayers: result.elite.map((p) => ({ name: p.name, nationCode: p.nationCode, position: p.position, buzzScore: p.buzzScore })),
      crisisPlayers: result.crisis.map((p) => ({ name: p.name, nationCode: p.nationCode, position: p.position, buzzScore: p.buzzScore })),
      generatedAt: result.generatedAt,
    })
  } catch (error) {
    console.error('[r16-launch] failed:', error)
    return NextResponse.json(
      { error: 'R16 launch failed', details: String(error) },
      { status: 500 }
    )
  }
}

/** GET is an alias for POST (admin auth on both). */
export const GET = POST
