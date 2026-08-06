/**
 * GET /api/epl/totw
 *
 * Returns the Team of the Week (or Flops of the Week) for a matchweek.
 * If a published TOTW exists in the DB, returns it. Otherwise, generates it
 * on-the-fly from LeaguePlayer + LeagueMatch data.
 *
 *   ?matchweek=1   → specific matchweek (default: latest completed)
 *   ?type=totw     → "totw" (default) or "flops"
 *
 * Rate-limit: 20 req/min/IP.
 *
 * ANTI-HALLUCINATION: when no completed matches exist for the matchweek
 * (pre-season, or matchweek not yet played), returns { hasMatchData: false }
 * — the UI MUST render an honest empty state. We NEVER fabricate a TOTW XI.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { generateTOTW, getLatestMatchweek } from '@/lib/totw-generator'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`epl-totw:${ip}`, 20, 60_000)
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
  const type = (searchParams.get('type') ?? 'totw') as 'totw' | 'flops'

  try {
    let matchweek = rawMatchweek
    if (!matchweek || matchweek < 1) {
      matchweek = await getLatestMatchweek(getDb())
    }

    // If no completed matches exist, return honest empty state
    if (matchweek === 0) {
      return NextResponse.json(
        {
          totw: null,
          matchweek: 0,
          type,
          hasMatchData: false,
          message: 'EPL kicks off Aug 21 — Team of the Week will appear after Matchweek 1',
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        },
      )
    }

    // Check for a published TOTW in the DB
    const published = await getDb().teamOfTheWeek.findFirst({
      where: {
        league: 'EPL',
        season: '2026-27',
        matchweek,
        type,
      },
      include: { players: true },
    })

    if (published && published.players.length > 0) {
      return NextResponse.json(
        {
          totw: {
            id: published.id,
            formation: published.formation,
            matchweek: published.matchweek,
            type: published.type,
            publishedAt: published.publishedAt,
            players: published.players
              .sort((a, b) => a.order - b.order)
              .map((p) => ({
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
          matchweek,
          type,
          hasMatchData: true,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        },
      )
    }

    // No published TOTW — generate on-the-fly
    const generated = await generateTOTW(getDb(), matchweek, type)

    return NextResponse.json(
      {
        totw: generated.hasMatchData
          ? {
              formation: generated.formation,
              matchweek: generated.matchweek,
              type: generated.type,
              players: generated.players,
              publishedAt: null, // generated, not published
            }
          : null,
        matchweek,
        type,
        hasMatchData: generated.hasMatchData,
        message: generated.hasMatchData
          ? undefined
          : 'EPL kicks off Aug 21 — Team of the Week will appear after Matchweek 1',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (err) {
    console.error('[api/epl/totw] Error:', err)
    return NextResponse.json(
      {
        totw: null,
        matchweek: 0,
        type,
        hasMatchData: false,
        error: 'TOTW temporarily unavailable',
      },
      { status: 200 },
    )
  }
}
