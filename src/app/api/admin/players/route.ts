import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/admin-auth'

/**
 * GET /api/admin/players — list all WCSelectionPlayers with evidence summary.
 * Returns per-player: postCount, avgSentiment, hasAIRating, lastRatingUpdatedAt.
 * Used by the admin "Rate Players" tab to show who has evidence + who needs rating.
 */
export async function GET(request: NextRequest) {
  const adminId = getAdminFromRequest(request)
  if (!adminId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const players = await db.wCSelectionPlayer.findMany({
      select: {
        id: true,
        playerName: true,
        nationCode: true,
        position: true,
        pulseScore: true,
        sentiment: true,
        trend: true,
        matchInfo: true,
        isLive: true,
      },
      orderBy: [{ pulseScore: 'desc' }, { playerName: 'asc' }],
    })

    // Deduplicate by playerName (a player may appear in multiple stages).
    // Keep the first (highest pulseScore) record per name.
    const seen = new Set<string>()
    const unique = players.filter((p) => {
      if (seen.has(p.playerName)) return false
      seen.add(p.playerName)
      return true
    })

    const ids = unique.map((p) => p.id)

    const [postAggs, ratings] = await Promise.all([
      db.curatedPost.groupBy({
        by: ['playerId'],
        where: { playerId: { in: ids } },
        _count: { _all: true },
        _avg: { sentimentScore: true, matchRating: true },
        _max: { createdAt: true },
      }),
      db.playerAIRating.findMany({
        where: { playerId: { in: ids } },
        select: {
          playerId: true,
          overall: true,
          socialScore: true,
          matchScore: true,
          narrativeScore: true,
          momentumScore: true,
          confidence: true,
          evidenceCount: true,
          reasoning: true,
          updatedAt: true,
        },
      }),
    ])

    const postMap = new Map(postAggs.map((a) => [a.playerId, a]))
    const ratingMap = new Map(ratings.map((r) => [r.playerId, r]))

    const result = unique.map((p) => {
      const agg = postMap.get(p.id)
      const rating = ratingMap.get(p.id)
      return {
        id: p.id,
        name: p.playerName,
        nationCode: p.nationCode,
        position: p.position,
        pulseScore: p.pulseScore,
        sentiment: p.sentiment,
        trend: p.trend,
        matchInfo: p.matchInfo,
        isLive: p.isLive,
        postCount: agg?._count._all ?? 0,
        avgSentiment: agg?._avg.sentimentScore ?? null,
        avgMatchRating: agg?._avg.matchRating ?? null,
        lastPostAt: agg?._max.createdAt ?? null,
        hasAIRating: !!rating,
        aiRating: rating
          ? {
              overall: rating.overall,
              socialScore: rating.socialScore,
              matchScore: rating.matchScore,
              narrativeScore: rating.narrativeScore,
              momentumScore: rating.momentumScore,
              confidence: rating.confidence,
              evidenceCount: rating.evidenceCount,
              reasoning: rating.reasoning,
              updatedAt: rating.updatedAt,
            }
          : null,
      }
    })

    return NextResponse.json({ ok: true, players: result, count: result.length })
  } catch (err) {
    console.error('admin players GET error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
