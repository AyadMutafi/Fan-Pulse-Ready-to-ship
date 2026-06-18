/**
 * Pulse Score Engine — the REAL weighted formula.
 *
 * Computes each WCSelectionPlayer's Pulse Score from four components:
 *   - matchPerformance  (40%)  — derived from the player's national team's WC results
 *   - fanSentiment      (25%)  — LLM-scored social posts (SentimentSummary) blended with FanVote crowd average
 *   - aiNarrative       (20%)  — trend + fan-sentiment direction
 *   - momentumTrend     (15%)  — trend adjusted by recent goal difference
 *
 *   overall = Σ(weight_k × component_k)
 *
 * No Math.random(). Deterministic given the same input data.
 * Results are persisted to PulseBreakdown (1:1 with player) and the player's
 * pulseScore column is updated, so every downstream surface (Elite/Crisis,
 * Sentiments, UI) reads the same computed value.
 *
 * Data sources:
 *   - Match table            → match performance + momentum
 *   - SentimentSummary table → scraped/LLM-scored fan sentiment (from /api/social-sentiment)
 *   - FanVote table          → crowd-submitted fan votes (from /api/fan-vote)
 *   - WCSelectionPlayer      → trend + fallback sentiment
 */

import type { PrismaClient } from '@prisma/client'
import { PULSE_WEIGHTS } from '@/types'

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

export interface PulseComponents {
  matchPerformance: number
  fanSentiment: number
  aiNarrative: number
  momentumTrend: number
  overall: number
  matchPerformanceNote: string
  fanSentimentNote: string
  aiNarrativeNote: string
  momentumTrendNote: string
}

interface TeamMatchSlice {
  points: number
  goalDiff: number
  played: number
}

interface SentimentAgg {
  score: number // weighted sum
  weight: number // total post count
}

interface VoteAgg {
  total: number
  count: number
}

/** Aggregate a national team's completed WC matches into a points/goal-diff slice. */
function aggregateTeamMatches(
  matches: Array<{
    homeTeamCode: string
    awayTeamCode: string
    homeScore: number
    awayScore: number
  }>,
  teamCode: string,
): TeamMatchSlice {
  let points = 0
  let goalDiff = 0
  let played = 0

  for (const m of matches) {
    if (m.homeTeamCode !== teamCode && m.awayTeamCode !== teamCode) continue
    const isHome = m.homeTeamCode === teamCode
    const teamGoals = isHome ? m.homeScore : m.awayScore
    const oppGoals = isHome ? m.awayScore : m.homeScore
    if (teamGoals > oppGoals) points += 3
    else if (teamGoals === oppGoals) points += 1
    goalDiff += teamGoals - oppGoals
    played += 1
  }

  return { points, goalDiff, played }
}

/**
 * Pure computation of the 4 Pulse components from aggregated source data.
 * Shared by both the batch and single-player paths. No side effects, no randomness.
 */
function computeComponents(args: {
  trend: string
  baselineSentiment: number
  slice: TeamMatchSlice
  sent: SentimentAgg | undefined
  votes: VoteAgg | undefined
}): PulseComponents {
  const { trend, baselineSentiment, slice, sent, votes } = args

  // ── matchPerformance (40%) ──
  const winRate = slice.played > 0 ? slice.points / (slice.played * 3) : 0.5
  const avgGD = slice.played > 0 ? slice.goalDiff / slice.played : 0
  const gdBonus = clamp(((avgGD + 3) / 6) * 30, 0, 30)
  const matchPerformance = clamp(winRate * 70 + gdBonus)

  // ── fanSentiment (25%) ──
  const scrapedScore = sent && sent.weight > 0 ? sent.score / sent.weight : null
  const voteScore = votes && votes.count > 0 ? votes.total / votes.count : null

  let fanSentiment: number
  let fanSentimentNote: string
  if (scrapedScore !== null && voteScore !== null) {
    fanSentiment = scrapedScore * 0.7 + voteScore * 0.3
    fanSentimentNote = `${Math.round(scrapedScore)}% scraped × 0.7 + ${Math.round(voteScore)}% fan vote × 0.3 (${sent!.weight} posts, ${votes!.count} votes)`
  } else if (scrapedScore !== null) {
    fanSentiment = scrapedScore
    fanSentimentNote = `${Math.round(scrapedScore)}% from ${sent!.weight} scraped posts (no fan votes yet)`
  } else if (voteScore !== null) {
    fanSentiment = voteScore
    fanSentimentNote = `${Math.round(voteScore)}% from ${votes!.count} fan votes (no scraped posts yet)`
  } else {
    fanSentiment = baselineSentiment
    fanSentimentNote = `${Math.round(baselineSentiment)}% baseline — run sentiment refresh for live data`
  }

  // ── aiNarrative (20%) ──
  const trendScore = trend === 'rising' ? 75 : trend === 'falling' ? 25 : 50
  const fanDir = fanSentiment >= 65 ? 70 : fanSentiment <= 40 ? 30 : 50
  const aiNarrative = clamp((trendScore + fanDir) / 2)
  const fanStrength =
    fanSentiment >= 65 ? 'strong' : fanSentiment <= 40 ? 'weak' : 'neutral'
  let aiNarrativeNote: string
  if (trend === 'rising') {
    aiNarrativeNote = `Positive trajectory (rising) reinforced by ${fanStrength} fan signal`
  } else if (trend === 'falling') {
    aiNarrativeNote = `Declining indicators (falling) with ${fanStrength} fan support`
  } else {
    aiNarrativeNote = `Stable pattern (stable) with ${fanStrength} fan mood`
  }

  // ── momentumTrend (15%) ──
  const trendBase = trend === 'rising' ? 80 : trend === 'falling' ? 20 : 50
  const gdAdj = clamp(avgGD * 8, -15, 15)
  const momentumTrend = clamp(trendBase + gdAdj)
  const momentumTrendNote =
    avgGD > 0.5
      ? `Upward momentum — avg +${avgGD.toFixed(1)} GD over ${slice.played} matches`
      : avgGD < -0.5
        ? `Downward momentum — avg ${avgGD.toFixed(1)} GD over ${slice.played} matches`
        : `Consistent momentum — avg ${avgGD.toFixed(1)} GD over ${slice.played} matches`

  // ── overall = the REAL weighted formula ──
  const overall =
    PULSE_WEIGHTS.matchPerformance * matchPerformance +
    PULSE_WEIGHTS.fanSentiment * fanSentiment +
    PULSE_WEIGHTS.aiNarrative * aiNarrative +
    PULSE_WEIGHTS.momentumTrend * momentumTrend

  return {
    matchPerformance: round1(matchPerformance),
    fanSentiment: round1(fanSentiment),
    aiNarrative: round1(aiNarrative),
    momentumTrend: round1(momentumTrend),
    overall: Math.round(overall),
    matchPerformanceNote: `${slice.played} matches · ${slice.points} pts · GD ${slice.goalDiff >= 0 ? '+' : ''}${slice.goalDiff}`,
    fanSentimentNote,
    aiNarrativeNote,
    momentumTrendNote,
  }
}

/** Persist computed components for a player (update score + upsert breakdown). */
async function persistComponents(
  database: PrismaClient,
  playerId: string,
  c: PulseComponents,
): Promise<void> {
  await database.wCSelectionPlayer.update({
    where: { id: playerId },
    data: { pulseScore: c.overall, sentiment: c.fanSentiment },
  })
  await database.pulseBreakdown.upsert({
    where: { playerId },
    create: {
      playerId,
      matchPerformance: c.matchPerformance,
      fanSentiment: c.fanSentiment,
      aiNarrative: c.aiNarrative,
      momentumTrend: c.momentumTrend,
      matchPerformanceNote: c.matchPerformanceNote,
      fanSentimentNote: c.fanSentimentNote,
      aiNarrativeNote: c.aiNarrativeNote,
      momentumTrendNote: c.momentumTrendNote,
    },
    update: {
      matchPerformance: c.matchPerformance,
      fanSentiment: c.fanSentiment,
      aiNarrative: c.aiNarrative,
      momentumTrend: c.momentumTrend,
      matchPerformanceNote: c.matchPerformanceNote,
      fanSentimentNote: c.fanSentimentNote,
      aiNarrativeNote: c.aiNarrativeNote,
      momentumTrendNote: c.momentumTrendNote,
    },
  })
}

export interface ComputeResult {
  playersComputed: number
  breakdownsWritten: number
  errors: string[]
}

/**
 * Recompute every WCSelectionPlayer's pulse score + breakdown from real data.
 * Idempotent; safe to call repeatedly.
 */
export async function computeAllPulseScores(
  database: PrismaClient,
): Promise<ComputeResult> {
  const errors: string[] = []
  let playersComputed = 0
  let breakdownsWritten = 0

  const players = await database.wCSelectionPlayer.findMany()
  if (players.length === 0) {
    return { playersComputed: 0, breakdownsWritten: 0, errors }
  }

  const teamCodes = [...new Set(players.map((p) => p.nationCode))]

  const [allMatches, sentimentSummaries, fanVotes] = await Promise.all([
    database.match.findMany({
      where: { status: 'completed', league: 'WC' },
      select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true },
    }),
    database.sentimentSummary.findMany({
      where: { teamCode: { in: teamCodes }, platform: 'all', period: '24h' },
      select: { teamCode: true, avgSentiment: true, postCount: true },
    }),
    database.fanVote.findMany({
      where: { teamCode: { in: teamCodes } },
      select: { teamCode: true, score: true },
    }),
  ])

  const matchByTeam = new Map<string, TeamMatchSlice>()
  const sentimentByTeam = new Map<string, SentimentAgg>()
  const voteByTeam = new Map<string, VoteAgg>()

  for (const code of teamCodes) matchByTeam.set(code, aggregateTeamMatches(allMatches, code))

  for (const s of sentimentSummaries) {
    const prev = sentimentByTeam.get(s.teamCode)
    if (prev) {
      prev.score += s.avgSentiment * s.postCount
      prev.weight += s.postCount
    } else {
      sentimentByTeam.set(s.teamCode, { score: s.avgSentiment * s.postCount, weight: s.postCount })
    }
  }

  for (const v of fanVotes) {
    const prev = voteByTeam.get(v.teamCode)
    if (prev) {
      prev.total += v.score
      prev.count += 1
    } else {
      voteByTeam.set(v.teamCode, { total: v.score, count: 1 })
    }
  }

  for (const player of players) {
    try {
      const c = computeComponents({
        trend: player.trend,
        baselineSentiment: player.sentiment,
        slice: matchByTeam.get(player.nationCode) ?? { points: 0, goalDiff: 0, played: 0 },
        sent: sentimentByTeam.get(player.nationCode),
        votes: voteByTeam.get(player.nationCode),
      })
      await persistComponents(database, player.id, c)
      playersComputed += 1
      breakdownsWritten += 1
    } catch (err) {
      errors.push(`Player ${player.playerName} (${player.nationCode}): ${String(err)}`)
    }
  }

  return { playersComputed, breakdownsWritten, errors }
}

/**
 * Compute (and persist) the pulse breakdown for a single player on demand.
 * Used by GET /api/pulse-score so the endpoint always returns a real, fresh
 * computation even before a full batch recompute has run.
 */
export async function computePlayerPulseScore(
  database: PrismaClient,
  playerId: string,
): Promise<PulseComponents | null> {
  const player = await database.wCSelectionPlayer.findUnique({
    where: { id: playerId },
    select: { id: true, nationCode: true, trend: true, sentiment: true },
  })
  if (!player) return null

  const [matches, sentRows, voteRows] = await Promise.all([
    database.match.findMany({
      where: { status: 'completed', league: 'WC' },
      select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true },
    }),
    database.sentimentSummary.findMany({
      where: { teamCode: player.nationCode, platform: 'all', period: '24h' },
      select: { avgSentiment: true, postCount: true },
    }),
    database.fanVote.findMany({
      where: { teamCode: player.nationCode },
      select: { score: true },
    }),
  ])

  const sent: SentimentAgg = { score: 0, weight: 0 }
  for (const s of sentRows) {
    sent.score += s.avgSentiment * s.postCount
    sent.weight += s.postCount
  }
  const votes: VoteAgg = { total: 0, count: 0 }
  for (const v of voteRows) {
    votes.total += v.score
    votes.count += 1
  }

  const c = computeComponents({
    trend: player.trend,
    baselineSentiment: player.sentiment,
    slice: aggregateTeamMatches(matches, player.nationCode),
    sent: sent.weight > 0 ? sent : undefined,
    votes: votes.count > 0 ? votes : undefined,
  })

  await persistComponents(database, player.id, c)
  return c
}
