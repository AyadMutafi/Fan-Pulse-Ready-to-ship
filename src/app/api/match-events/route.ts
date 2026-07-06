import { NextRequest, NextResponse } from 'next/server'
import { MATCH_EVENTS, getEventsByMatchId, getRecentEvents } from '@/lib/match-events-data'

// GET /api/match-events?matchId=arg-alg  → events for a specific match
// GET /api/match-events?recent=8         → most impactful events across all matches
// GET /api/match-events                  → all events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')
    const recent = searchParams.get('recent')

    if (matchId) {
      const events = getEventsByMatchId(matchId)
      return NextResponse.json({ matchId, events, count: events.length })
    }

    if (recent) {
      const limit = parseInt(recent, 10) || 8
      const events = getRecentEvents(limit)
      return NextResponse.json({ events, count: events.length })
    }

    // Return all events sorted by minute
    const events = [...MATCH_EVENTS].sort((a, b) => a.minute - b.minute)
    return NextResponse.json({ events, count: events.length })
  } catch (error) {
    console.error('Failed to fetch match events:', error)
    return NextResponse.json({ error: 'Failed to fetch match events' }, { status: 500 })
  }
}
