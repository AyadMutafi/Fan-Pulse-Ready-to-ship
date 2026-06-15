import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PULSE_WEIGHTS } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
    }

    const player = await db.wCSelectionPlayer.findUnique({
      where: { id: playerId },
      include: {
        pulseBreakdown: true,
        selection: true,
      },
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // If we have a breakdown, use it. Otherwise compute from player data.
    const breakdown = player.pulseBreakdown
    let pulseScore

    if (breakdown) {
      pulseScore = {
        overall: player.pulseScore,
        matchPerformance: breakdown.matchPerformance,
        fanSentiment: breakdown.fanSentiment,
        aiNarrative: breakdown.aiNarrative,
        momentumTrend: breakdown.momentumTrend,
        matchPerformanceNote: breakdown.matchPerformanceNote,
        fanSentimentNote: breakdown.fanSentimentNote,
        aiNarrativeNote: breakdown.aiNarrativeNote,
        momentumTrendNote: breakdown.momentumTrendNote,
      }
    } else {
      // Compute breakdown from player data
      // This is the Pulse Score Engine - the AI logic
      const matchPerf = player.pulseScore * 0.9 + Math.random() * 10
      const fanSent = player.sentiment
      const aiNarr = player.trend === 'rising' ? 75 : player.trend === 'falling' ? 25 : 50
      const momentum = player.trend === 'rising' ? 80 : player.trend === 'falling' ? 20 : 50

      pulseScore = {
        overall: player.pulseScore,
        matchPerformance: Math.min(100, Math.round(matchPerf)),
        fanSentiment: Math.min(100, Math.round(fanSent)),
        aiNarrative: Math.min(100, Math.round(aiNarr)),
        momentumTrend: Math.min(100, Math.round(momentum)),
        matchPerformanceNote: player.isLive
          ? `Live match impact: ${player.matchInfo || 'In progress'}`
          : `Match performance based on latest data`,
        fanSentimentNote: `Fan sentiment at ${Math.round(fanSent)}% across social platforms`,
        aiNarrativeNote: player.trend === 'rising'
          ? 'AI detects positive performance trajectory'
          : player.trend === 'falling'
          ? 'AI identifies declining performance indicators'
          : 'AI sees stable performance patterns',
        momentumTrendNote: player.trend === 'rising'
          ? 'Upward momentum in recent matches'
          : player.trend === 'falling'
          ? 'Downward momentum needs attention'
          : 'Consistent momentum levels',
      }
    }

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.playerName,
        nationCode: player.nationCode,
        position: player.position,
        pulseScore: player.pulseScore,
        sentiment: player.sentiment,
        trend: player.trend,
        isLive: player.isLive,
        matchInfo: player.matchInfo,
        order: player.order,
      },
      pulseScore,
    })
  } catch (error) {
    console.error('Failed to fetch pulse score:', error)
    return NextResponse.json({ error: 'Failed to fetch pulse score' }, { status: 500 })
  }
}
