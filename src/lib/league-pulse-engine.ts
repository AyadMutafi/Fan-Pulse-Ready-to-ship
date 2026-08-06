/**
 * League Pulse Engine
 *
 * Adapts the WC-focused pulse-engine.ts for EPL league use. Computes a 0-100
 * Pulse Score for each LeaguePlayer from three components:
 *
 *   - fanSentiment   (40%)  — FanVote crowd sentiment (0-100, 50 = neutral)
 *   - fplForm        (35%)  — FPL form (0-10 → 0-100)
 *   - fplPoints      (25%)  — FPL total points (0-200 → 0-100)
 *
 *   pulseScore = Σ(weight_k × normalized_component_k)
 *
 * ANTI-HALLUCINATION: computed ONLY from real FanVote aggregations + real FPL
 * data. When FanVote data is absent (pre-season), sentiment defaults to 50
 * (neutral). When FPL data is absent, form + points default to 0 — the score
 * will be low, which is correct (we can't rate a player we have no data for).
 *
 * No Math.random(). Deterministic given the same input data.
 */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

export interface LeaguePulseInput {
  fanSentiment: number // 0-100
  fplForm: number // 0-10
  fplPoints: number // 0+
  fplPointsPerGame?: number // 0-10
}

export interface LeaguePulseResult {
  pulseScore: number // 0-100
  sentiment: number // 0-100
  trend: 'rising' | 'stable' | 'falling'
}

const WEIGHTS = {
  fanSentiment: 0.40,
  fplForm: 0.35,
  fplPoints: 0.25,
}

/**
 * Compute the league pulse score for a player.
 *
 * @returns { pulseScore: 0-100, sentiment: 0-100, trend }
 */
export function computeLeaguePulseScore(input: LeaguePulseInput): LeaguePulseResult {
  const sentimentNorm = clamp(input.fanSentiment)
  const formNorm = clamp((input.fplForm / 10) * 100)
  const pointsNorm = clamp((input.fplPoints / 200) * 100)

  const score =
    WEIGHTS.fanSentiment * sentimentNorm +
    WEIGHTS.fplForm * formNorm +
    WEIGHTS.fplPoints * pointsNorm

  // Trend: rising if form > 6, falling if form < 3, stable otherwise
  let trend: 'rising' | 'stable' | 'falling' = 'stable'
  if (input.fplForm >= 6) trend = 'rising'
  else if (input.fplForm > 0 && input.fplForm < 3) trend = 'falling'

  return {
    pulseScore: round1(clamp(score)),
    sentiment: round1(sentimentNorm),
    trend,
  }
}

/**
 * Convert a pulse score (0-100) to a fan-sentiment emoji.
 * Same 5-level scale used throughout the app (🤩😊😐😟😡).
 */
export function leaguePulseToEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}

/**
 * Batch-compute pulse scores for a list of players.
 * Each player must have: fanSentiment, fplForm, fplPoints.
 */
export function computeLeaguePulseBatch(
  players: LeaguePulseInput[],
): LeaguePulseResult[] {
  return players.map((p) => computeLeaguePulseScore(p))
}
