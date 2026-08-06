/**
 * GET /api/fpl/captain-pulse
 *
 * Returns the top 10 FPL captain candidates with their captainPulseScore
 * (weighted blend of form, ownership, fan sentiment, total points).
 *
 *   ?limit=10   → max candidates (default 10, max 20)
 *
 * Rate-limit: 20 req/min/IP.
 *
 * ANTI-HALLUCINATION: captainPulseScore is computed from REAL FPL data (form,
 * ownership, total_points) + REAL FanVote aggregations. When no FPL data
 * exists (pre-sync), returns an empty array. When no FanVote data exists,
 * sentiment defaults to 50 (neutral) — the score still works.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  computeCaptainPulseScore,
  getRecommendation,
  getCaptainReason,
  type CaptainCandidate,
} from '@/lib/captain-pulse'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`fpl-captain:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please slow down' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(request.url)
  const rawLimit = Number(searchParams.get('limit') ?? '10')
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(20, Math.floor(rawLimit))) : 10

  try {
    // Fetch FPL players sorted by form (top form = good captain candidates)
    const fplPlayers = await getDb().fPLPlayer.findMany({
      orderBy: [{ form: 'desc' }, { totalPoints: 'desc' }],
      take: limit * 5, // fetch more so we have room after sentiment join
    })

    if (fplPlayers.length === 0) {
      return NextResponse.json(
        { candidates: [], available: false, count: 0 },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
      )
    }

    // Aggregate fan sentiment per team from FanVote
    const teamSentiments = new Map<string, { avg: number; count: number }>()
    const votes = await getDb().fanVote.findMany({
      where: { teamCode: { in: [...new Set(fplPlayers.map((p) => p.teamCode))] } },
      select: { teamCode: true, score: true },
    })
    for (const v of votes) {
      const existing = teamSentiments.get(v.teamCode) ?? { avg: 0, count: 0 }
      existing.avg = (existing.avg * existing.count + v.score) / (existing.count + 1)
      existing.count += 1
      teamSentiments.set(v.teamCode, existing)
    }

    // Build candidates
    const candidates: CaptainCandidate[] = fplPlayers.map((p) => {
      const sentimentAgg = teamSentiments.get(p.teamCode)
      const fanSentiment = sentimentAgg ? sentimentAgg.avg : 50

      const captainPulseScore = computeCaptainPulseScore(
        p.form,
        p.ownershipPct,
        fanSentiment,
        p.totalPoints,
      )
      const recommendation = getRecommendation(captainPulseScore)
      const reason = getCaptainReason({
        form: p.form,
        ownershipPct: p.ownershipPct,
        fanSentiment,
        totalPoints: p.totalPoints,
      })

      return {
        fplId: p.fplId,
        webName: p.webName,
        fullName: p.fullName,
        teamCode: p.teamCode,
        position: p.position,
        price: p.price,
        ownershipPct: p.ownershipPct,
        form: p.form,
        totalPoints: p.totalPoints,
        pointsPerGame: p.pointsPerGame,
        fanSentiment,
        captainPulseScore,
        recommendation,
        reason,
      }
    })

    // Sort by captainPulseScore desc, take top N
    candidates.sort((a, b) => b.captainPulseScore - a.captainPulseScore)
    const top = candidates.slice(0, limit)

    return NextResponse.json(
      { candidates: top, available: top.length > 0, count: top.length },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch (err) {
    console.error('[api/fpl/captain-pulse] Error:', err)
    return NextResponse.json(
      { candidates: [], available: false, count: 0, error: 'Captain pulse temporarily unavailable' },
      { status: 200 },
    )
  }
}
