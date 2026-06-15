import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const matches = await db.match.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // live first
        { startedAt: 'desc' },
      ],
    })

    // Transform DB records to API response
    const result = matches.map(m => ({
      id: m.id,
      homeTeam: {
        code: m.homeCode,
        name: m.homeCode, // Will be enriched by national-teams on client
        flag: '', // Will be enriched by national-teams on client
        sentiment: m.homeSentiment,
      },
      awayTeam: {
        code: m.awayCode,
        name: m.awayCode,
        flag: '',
        sentiment: m.awaySentiment,
      },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      score: `${m.homeScore} - ${m.awayScore}`,
      status: m.status,
      league: m.league,
      minute: m.minute,
    }))

    return NextResponse.json({ matches: result })
  } catch (error) {
    console.error('Failed to fetch matches:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}
