import { NextRequest, NextResponse } from 'next/server'
import { db, getDb } from '@/lib/db'
import { computeAllPulseScores } from '@/lib/pulse-engine'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

/**
 * POST /api/compute-pulse-scores
 *
 * Recompute every WCSelectionPlayer's pulse score and breakdown using real data
 * from the SentimentSummary (fan sentiment) and Match (match results) tables.
 *
 * AUTH REQUIRED: this route does 22+ sequential DB writes and is a DoS vector
 * if left open. Only the admin may call it.
 *
 * Called by:
 *  - The seed route, automatically, after seeding players (server-side call —
 *    pass through by setting the internal header)
 *  - Manual admin trigger via the World Cup tab admin panel (future)
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const result = await computeAllPulseScores(getDb())
    return NextResponse.json({
      success: true,
      ...result,
      computedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('POST /api/compute-pulse-scores error:', error)
    return NextResponse.json(
      { error: 'Failed to compute pulse scores', details: String(error) },
      { status: 500 },
    )
  }
}

/**
 * GET /api/compute-pulse-scores
 *
 * Lightweight status check — returns counts of players, breakdowns, sentiment
 * summaries, and matches so the UI can show whether a recompute would have
 * fresh data to work with.
 */
export async function GET(_request: NextRequest) {
  try {
    const [players, breakdowns, sentimentSummaries, matches] = await Promise.all([
      db.wCSelectionPlayer.count(),
      db.pulseBreakdown.count(),
      db.sentimentSummary.count({ where: { platform: 'all', period: '24h' } }),
      db.match.count({ where: { status: 'completed', league: 'WC' } }),
    ])

    return NextResponse.json({
      players,
      breakdowns,
      sentimentSummaries,
      completedMatches: matches,
      lastComputedAt: breakdowns > 0 ? new Date().toISOString() : null,
    })
  } catch (error) {
    console.error('GET /api/compute-pulse-scores error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch compute status' },
      { status: 500 },
    )
  }
}
