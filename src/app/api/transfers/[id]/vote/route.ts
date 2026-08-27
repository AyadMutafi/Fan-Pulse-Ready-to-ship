import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/transfers/[id]/vote
 *
 * Fan vote on a transfer saga: "Is this a good signing?"
 *
 * Body: { vote: 'good' | 'mixed' | 'bad', sessionId: string }
 *
 * One vote per session per saga (enforced by @@unique).
 * If the session already voted, their vote is UPDATED (not duplicated).
 *
 * Returns the live aggregate:
 *   { goodPct, mixedPct, badPct, totalVotes, userVote }
 *
 * Anti-hallucination: vote counts are REAL. Never fabricated.
 */

const VALID_VOTES = ['good', 'mixed', 'bad'] as const
type VoteType = typeof VALID_VOTES[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sagaId } = await params

  // Rate limit: 10 votes per minute per IP (generous for genuine users)
  const ip = getClientIp(request)
  const rl = rateLimit(`transfer-vote:${ip}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down' },
      { status: 429 },
    )
  }

  try {
    const body = await request.json()
    const { vote, sessionId } = body

    // ── Validate ──
    if (!VALID_VOTES.includes(vote)) {
      return NextResponse.json(
        { error: `Invalid vote. Must be one of: ${VALID_VOTES.join(', ')}` },
        { status: 400 },
      )
    }

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 3) {
      return NextResponse.json(
        { error: 'sessionId is required (min 3 chars)' },
        { status: 400 },
      )
    }

    // Check the saga exists
    const saga = await db.transferSaga.findUnique({
      where: { id: sagaId },
      select: { id: true, status: true },
    })

    if (!saga) {
      return NextResponse.json({ error: 'Transfer saga not found' }, { status: 404 })
    }

    // ── Upsert the vote (one per session per saga) ──
    // If the session already voted, update their vote. If not, create new.
    await db.transferVote.upsert({
      where: {
        sagaId_sessionId: { sagaId, sessionId },
      },
      create: {
        sagaId,
        vote: vote as VoteType,
        sessionId,
      },
      update: {
        vote: vote as VoteType,
      },
    })

    // ── Aggregate all votes for this saga ──
    const votes = await db.transferVote.findMany({
      where: { sagaId },
      select: { vote: true, sessionId: true },
    })

    const good = votes.filter((v) => v.vote === 'good').length
    const mixed = votes.filter((v) => v.vote === 'mixed').length
    const bad = votes.filter((v) => v.vote === 'bad').length
    const total = votes.length

    const goodPct = total > 0 ? Math.round((good / total) * 100) : 0
    const mixedPct = total > 0 ? Math.round((mixed / total) * 100) : 0
    const badPct = total > 0 ? Math.round((bad / total) * 100) : 0

    // Fan Pulse score /10: weighted (good=10, mixed=5, bad=0)
    const pulseScore = total > 0
      ? Math.round(((good * 10 + mixed * 5 + bad * 0) / total) * 10) / 10
      : 0

    return NextResponse.json({
      success: true,
      userVote: vote,
      good: goodPct,
      mixed: mixedPct,
      bad: badPct,
      totalVotes: total,
      pulseScore,
      sentiment: goodPct >= 70 ? '🔥 Excellent' : goodPct >= 50 ? '👍 Good' : goodPct >= 30 ? '😐 Mixed' : '👎 Poor',
    })
  } catch (err) {
    console.error('[api/transfers/[id]/vote] Error:', err)
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 },
    )
  }
}
