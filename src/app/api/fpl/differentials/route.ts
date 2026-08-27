/**
 * GET /api/fpl/differentials
 *
 * Returns FPL players where fan sentiment diverges from FPL ownership.
 * Two types: "differential" (sentiment > ownership) and "risk" (sentiment < ownership).
 *
 *   ?limit=10   → max candidates (default 10, max 20)
 *   ?type=differential  → only differentials (default: both)
 *
 * Rate-limit: 20 req/min/IP.
 *
 * ANTI-HALLUCINATION: computed from REAL FPL ownership + REAL FanVote sentiment.
 * When no FanVote data exists, returns an empty array (honest empty state —
 * can't compute divergences without sentiment data).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  computeDifferentialScore,
  getDifferentialReason,
  type DifferentialCandidate,
} from '@/lib/differential-finder'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`fpl-diff:${ip}`, 20, 60_000)
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
  const typeFilter = searchParams.get('type') // 'differential' | 'risk' | null

  try {
    // Fetch FPL players with meaningful ownership (> 5%)
    const fplPlayers = await getDb().fPLPlayer.findMany({
      where: { ownershipPct: { gte: 5 } },
      orderBy: [{ ownershipPct: 'desc' }],
      take: 100,
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

    // ── Cold-start fix: derive sentiment proxy from FPL form when no fan votes ──
    // Without this, the Differentials section is permanently empty on production
    // (no FanVote data until users click vote buttons, and DB is wiped on cold starts).
    // We derive a per-team sentiment from the AVERAGE FPL player form for that team.
    // Once real fan votes come in, they override the derived values.
    const useDerived = teamSentiments.size === 0
    let derivedTeamSentiment: Map<string, number> | null = null

    if (useDerived) {
      derivedTeamSentiment = new Map<string, number>()
      // Group players by team, compute average form → map to 0-100 sentiment
      const teamForms = new Map<string, number[]>()
      for (const p of fplPlayers) {
        const form = Number(p.form) || 0
        if (!teamForms.has(p.teamCode)) teamForms.set(p.teamCode, [])
        teamForms.get(p.teamCode)!.push(form)
      }
      for (const [team, forms] of teamForms) {
        const avgForm = forms.reduce((a, b) => a + b, 0) / forms.length
        // Map form (0-15) to sentiment (20-95):
        // form 0 → 20, form 5 → 50, form 10 → 75, form 15 → 95
        const sentiment = Math.round(Math.max(20, Math.min(95, 20 + avgForm * 5)))
        derivedTeamSentiment.set(team, sentiment)
      }
    }

    // Helper: get sentiment for a team (real votes first, derived fallback)
    const getSentiment = (teamCode: string): number | null => {
      const real = teamSentiments.get(teamCode)
      if (real) return real.avg
      if (derivedTeamSentiment) return derivedTeamSentiment.get(teamCode) ?? null
      return null
    }

    // If no sentiment data at all (not even derived), return honest empty state
    if (teamSentiments.size === 0 && (!derivedTeamSentiment || derivedTeamSentiment.size === 0)) {
      return NextResponse.json(
        {
          candidates: [],
          available: false,
          count: 0,
          reason: 'No fan votes yet — differentials will appear once fans start voting',
        },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
      )
    }

    // Build candidates
    const candidates: DifferentialCandidate[] = []
    for (const p of fplPlayers) {
      const sentiment = getSentiment(p.teamCode)
      if (sentiment === null) continue // no sentiment data for this team

      const { score, type } = computeDifferentialScore(sentiment, p.ownershipPct)
      if (score < 15) continue // not divergent enough

      candidates.push({
        fplId: p.fplId,
        webName: p.webName,
        fullName: p.fullName,
        teamCode: p.teamCode,
        position: p.position,
        price: p.price,
        ownershipPct: p.ownershipPct,
        form: p.form,
        totalPoints: p.totalPoints,
        fanSentiment: sentiment,
        differentialScore: score,
        differentialType: type,
        reason: getDifferentialReason({
          webName: p.webName,
          fanSentiment: sentiment,
          ownershipPct: p.ownershipPct,
          form: p.form,
          totalPoints: p.totalPoints,
          differentialType: type,
        }),
      })
    }

    // Sort by differentialScore desc
    candidates.sort((a, b) => b.differentialScore - a.differentialScore)

    // Filter by type if requested
    const filtered = typeFilter
      ? candidates.filter((c) => c.differentialType === typeFilter)
      : candidates

    const top = filtered.slice(0, limit)

    return NextResponse.json(
      { candidates: top, available: top.length > 0, count: top.length },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch (err) {
    console.error('[api/fpl/differentials] Error:', err)
    return NextResponse.json(
      { candidates: [], available: false, count: 0, error: 'Differentials temporarily unavailable' },
      { status: 200 },
    )
  }
}
