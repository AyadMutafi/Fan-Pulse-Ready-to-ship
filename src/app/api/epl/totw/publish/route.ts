/**
 * POST /api/epl/totw/publish (admin-protected)
 *
 * Generates and publishes a Team of the Week (or Flops of the Week) for a
 * given matchweek. Persists it to the TeamOfTheWeek + TOTWPlayer tables so
 * subsequent GET /api/epl/totw requests return the published version.
 *
 *   Body: { matchweek: number, type: "totw" | "flops" }
 *
 * Rate-limit: 1 req/min/IP (admin-only).
 *
 * ANTI-HALLUCINATION: the TOTW is generated from real LeaguePlayer + LeagueMatch
 * data using generateTOTW(). When no completed matches exist, the publish fails
 * with a clear error — we NEVER publish a fabricated XI.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { generateTOTW, getLatestMatchweek } from '@/lib/totw-generator'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`epl-totw-publish:${ip}`, 1, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Publish rate limit — please wait a minute' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const type = (body.type ?? 'totw') as 'totw' | 'flops'
    let matchweek = Number(body.matchweek ?? 0)
    if (!matchweek || matchweek < 1) {
      matchweek = await getLatestMatchweek(getDb())
    }

    if (matchweek === 0) {
      return NextResponse.json(
        {
          error: 'No completed matches found — cannot publish TOTW before EPL matchweek 1',
        },
        { status: 400 },
      )
    }

    // Generate the TOTW
    const generated = await generateTOTW(getDb(), matchweek, type)
    if (!generated.hasMatchData || generated.players.length === 0) {
      return NextResponse.json(
        {
          error: `No match data for matchweek ${matchweek} — cannot generate TOTW`,
        },
        { status: 400 },
      )
    }

    // Upsert the TOTW record + players
    const existing = await getDb().teamOfTheWeek.findFirst({
      where: {
        league: 'EPL',
        season: '2026-27',
        matchweek,
        type,
      },
    })

    if (existing) {
      // Delete old players + TOTW, recreate
      await getDb().tOTWPlayer.deleteMany({ where: { totwId: existing.id } })
      await getDb().teamOfTheWeek.delete({ where: { id: existing.id } })
    }

    const totw = await getDb().teamOfTheWeek.create({
      data: {
        league: 'EPL',
        season: '2026-27',
        matchweek,
        type,
        formation: generated.formation,
        publishedAt: new Date(),
        players: {
          create: generated.players.map((p) => ({
            playerName: p.playerName,
            teamCode: p.teamCode,
            position: p.position,
            pulseScore: p.pulseScore,
            sentiment: p.sentiment,
            matchInfo: p.matchInfo,
            photoUrl: p.photoUrl,
            order: p.order,
          })),
        },
      },
      include: { players: true },
    })

    return NextResponse.json({
      success: true,
      totwId: totw.id,
      matchweek,
      type,
      playerCount: totw.players.length,
      publishedAt: totw.publishedAt,
    })
  } catch (err) {
    console.error('[api/epl/totw/publish] Error:', err)
    return NextResponse.json(
      { error: 'Publish failed — check server logs' },
      { status: 500 },
    )
  }
}
