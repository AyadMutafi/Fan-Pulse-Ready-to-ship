import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request as any)
  const rl = rateLimit(`endpoint:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  }
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const league = searchParams.get('league')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }
    if (league && league !== 'all') {
      where.league = league
    }

    const matches = await db.match.findMany({
      where,
      orderBy: [
        { matchDate: 'desc' },
      ],
    })

    // Transform DB records to API response with proper team info
    const result = matches.map(m => ({
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
      league: m.league,
      group: m.group,
      minute: m.minute,
      matchDate: m.matchDate?.toISOString() ?? null,
    }))

    return NextResponse.json({ matches: result })
  } catch (error) {
    console.error('Failed to fetch matches:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}
