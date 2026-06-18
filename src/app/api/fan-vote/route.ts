import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/fan-vote?session=<sessionId>
// Returns aggregated fan votes for ALL teams, plus this session's own votes.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get('session') || searchParams.get('sessionId') || ''

    // Aggregate ALL fan votes per team
    const allVotes = await db.fanVote.findMany({
      select: { teamCode: true, score: true },
    })

    const teamAgg: Record<string, { total: number; count: number }> = {}
    for (const v of allVotes) {
      if (!teamAgg[v.teamCode]) teamAgg[v.teamCode] = { total: 0, count: 0 }
      teamAgg[v.teamCode].total += v.score
      teamAgg[v.teamCode].count += 1
    }

    const votes = Object.entries(teamAgg).map(([teamCode, agg]) => ({
      teamCode,
      score: agg.count > 0 ? Math.round(agg.total / agg.count) : 0,
      count: agg.count,
    }))

    // Session-specific votes
    let myVotes: Array<{ teamCode: string; score: number }> = []
    if (session) {
      const mine = await db.fanVote.findMany({
        where: { sessionId: session },
        select: { teamCode: true, score: true },
      })
      myVotes = mine.map(v => ({ teamCode: v.teamCode, score: v.score }))
    }

    return NextResponse.json({ votes, myVotes })
  } catch (err) {
    console.error('[fan-vote GET] error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch fan votes' },
      { status: 500 }
    )
  }
}

// POST /api/fan-vote
// Body: { teamCode: string, score: number, sessionId: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { teamCode, score, sessionId } = body as {
      teamCode?: unknown
      score?: unknown
      sessionId?: unknown
    }

    // Validate teamCode: non-empty 3-letter string
    if (
      typeof teamCode !== 'string' ||
      teamCode.length !== 3 ||
      !/^[A-Za-z]{3}$/.test(teamCode)
    ) {
      return NextResponse.json(
        { error: 'teamCode must be a 3-letter string' },
        { status: 400 }
      )
    }

    // Validate score: 0-100 integer
    if (
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100
    ) {
      return NextResponse.json(
        { error: 'score must be an integer between 0 and 100' },
        { status: 400 }
      )
    }

    // Validate sessionId: non-empty string
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'sessionId must be a non-empty string' },
        { status: 400 }
      )
    }

    const normalizedCode = teamCode.toUpperCase()

    // Upsert vote by [teamCode, sessionId] unique constraint
    const vote = await db.fanVote.upsert({
      where: {
        teamCode_sessionId: {
          teamCode: normalizedCode,
          sessionId,
        },
      },
      update: { score },
      create: {
        teamCode: normalizedCode,
        score,
        sessionId,
      },
    })

    return NextResponse.json({
      success: true,
      vote: {
        teamCode: vote.teamCode,
        score: vote.score,
        sessionId: vote.sessionId,
      },
    })
  } catch (err) {
    console.error('[fan-vote POST] error:', err)
    return NextResponse.json(
      { error: 'Failed to submit fan vote' },
      { status: 500 }
    )
  }
}
