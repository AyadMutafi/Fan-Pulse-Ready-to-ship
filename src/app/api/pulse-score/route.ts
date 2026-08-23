import { rateLimit, getClientIp } from '@/lib/rate-limit'
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
 *
 * Also returns fan sentiment metadata (post count + top quotes + freshness)
 * from the PlayerSentiment table when available — this is what powers the
 * "Based on N real fan posts" UI in the pulse breakdown modal.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request as any)
  const rl = rateLimit(`endpoint:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  }
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

    // Fetch per-player fan sentiment metadata (post count + top quotes + freshness)
    // This is what powers the "Based on N real fan posts" UI in the breakdown modal.
    const playerSentiment = await database.playerSentiment.findUnique({
      where: { playerId },
      select: {
        sentiment: true,
        postCount: true,
        positiveRatio: true,
        topQuotes: true,
        analyzedAt: true,
        monitorId: true,
      },
    })

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
      // Real fan sentiment metadata (null when no FeedMonitor data exists yet)
      fanSentimentMeta: playerSentiment
        ? {
            postCount: playerSentiment.postCount,
            positiveRatio: playerSentiment.positiveRatio,
            topQuotes: safeJsonParse(playerSentiment.topQuotes, []),
            analyzedAt: playerSentiment.analyzedAt.toISOString(),
            monitorId: playerSentiment.monitorId,
            freshnessLabel: getFreshnessLabel(playerSentiment.analyzedAt),
          }
        : null,
    })
  } catch (error) {
    console.error('Failed to fetch pulse score:', error)
    return NextResponse.json({ error: 'Failed to fetch pulse score' }, { status: 500 })
  }
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function getFreshnessLabel(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
