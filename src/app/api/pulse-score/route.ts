import { NextRequest, NextResponse } from 'next/server'
import { db, getDb } from '@/lib/db'
import { computePlayerPulseScore } from '@/lib/pulse-engine'

/**
 * GET /api/pulse-score?playerId=<id>
 *
 * Returns the player's Pulse Score breakdown (the 4 weighted components +
 * human-readable notes). Uses the persisted PulseBreakdown if available;
 * otherwise computes it on demand via the real weighted engine
 * (40% match / 25% fan / 20% narrative / 15% momentum). No Math.random().
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
    }

    // Use getDb() so we always get a client with the latest generated models
    // (the dev-mode global singleton can be stale after a schema change).
    const database = getDb()

    const player = await database.wCSelectionPlayer.findUnique({
      where: { id: playerId },
      include: { pulseBreakdown: true, selection: true },
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    let breakdown = player.pulseBreakdown
    let overall = player.pulseScore

    // If no persisted breakdown yet, compute it on demand from real data.
    if (!breakdown) {
      const computed = await computePlayerPulseScore(database, playerId)
      if (computed) {
        breakdown = {
          playerId,
          matchPerformance: computed.matchPerformance,
          fanSentiment: computed.fanSentiment,
          aiNarrative: computed.aiNarrative,
          momentumTrend: computed.momentumTrend,
          matchPerformanceNote: computed.matchPerformanceNote,
          fanSentimentNote: computed.fanSentimentNote,
          aiNarrativeNote: computed.aiNarrativeNote,
          momentumTrendNote: computed.momentumTrendNote,
        } as NonNullable<typeof breakdown>
        overall = computed.overall
      }
    }

    const pulseScore = {
      overall,
      matchPerformance: breakdown?.matchPerformance ?? 50,
      fanSentiment: breakdown?.fanSentiment ?? 50,
      aiNarrative: breakdown?.aiNarrative ?? 50,
      momentumTrend: breakdown?.momentumTrend ?? 50,
      matchPerformanceNote:
        breakdown?.matchPerformanceNote ?? 'Not yet computed — run a recompute.',
      fanSentimentNote:
        breakdown?.fanSentimentNote ?? 'Not yet computed — run a recompute.',
      aiNarrativeNote:
        breakdown?.aiNarrativeNote ?? 'Not yet computed — run a recompute.',
      momentumTrendNote:
        breakdown?.momentumTrendNote ?? 'Not yet computed — run a recompute.',
    }

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.playerName,
        nationCode: player.nationCode,
        position: player.position,
        pulseScore: overall,
        sentiment: player.sentiment,
        trend: player.trend,
        isLive: player.isLive,
        matchInfo: player.matchInfo,
        order: player.order,
      },
      pulseScore,
      weights: { matchPerformance: 0.4, fanSentiment: 0.25, aiNarrative: 0.2, momentumTrend: 0.15 },
    })
  } catch (error) {
    console.error('Failed to fetch pulse score:', error)
    return NextResponse.json({ error: 'Failed to fetch pulse score' }, { status: 500 })
  }
}
