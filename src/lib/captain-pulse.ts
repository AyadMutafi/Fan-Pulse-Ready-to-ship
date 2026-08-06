/**
 * Captain Pulse Score
 *
 * Computes a weighted captain-potential score for FPL players, blending:
 *   - FPL form          (35%) — recent FPL points per game (0-10 scale → 0-100)
 *   - FPL ownership     (15%) — captain-worthy players are usually high-ownership
 *   - Fan sentiment     (30%) — Fan Pulse crowd sentiment (FanVote aggregation)
 *   - FPL total points  (20%) — season-long reliability
 *
 *   captainPulseScore = Σ(weight_k × normalized_component_k)
 *
 * The score is 0-100. A score ≥ 75 = "Strong Captain Pick", ≥ 60 = "Good Pick",
 * ≥ 45 = "Worth Considering", < 45 = "Risky Pick".
 *
 * ANTI-HALLUCINATION: the score is computed ONLY from real FPL data (form,
 * ownership, total_points) + real FanVote aggregations. No invented sentiment.
 * When FanVote data is absent (pre-season), the sentiment component defaults
 * to 50 (neutral) — the score still works, just with less fan-signal.
 */

export interface CaptainCandidate {
  fplId: number
  webName: string
  fullName: string
  teamCode: string
  position: string
  price: number
  ownershipPct: number
  form: number
  totalPoints: number
  pointsPerGame: number
  /** Fan sentiment 0-100 from FanVote aggregation. 50 = neutral (no votes). */
  fanSentiment: number
  /** Computed captain pulse score 0-100. */
  captainPulseScore: number
  /** Human-readable recommendation label. */
  recommendation: string
  /** Why this player is/isn't a good captain pick (1-line summary). */
  reason: string
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/** Weights — sum to 1.0 */
const WEIGHTS = {
  form: 0.35,
  ownership: 0.15,
  fanSentiment: 0.30,
  totalPoints: 0.20,
}

/**
 * Compute the captain pulse score for a single player.
 *
 * @param form          FPL form (0-10 scale)
 * @param ownershipPct  FPL selected_by_percent (0-100)
 * @param fanSentiment  FanVote-aggregated sentiment (0-100, 50 = neutral)
 * @param totalPoints   FPL season total points
 * @returns Score 0-100
 */
export function computeCaptainPulseScore(
  form: number,
  ownershipPct: number,
  fanSentiment: number,
  totalPoints: number,
): number {
  // Normalize form: 0-10 → 0-100 (cap at 10)
  const formNorm = clamp((form / 10) * 100)
  // Normalize ownership: 0-60% → 0-100 (cap at 60% — no one gets >60% ownership)
  const ownershipNorm = clamp((ownershipPct / 60) * 100)
  // Fan sentiment is already 0-100
  const sentimentNorm = clamp(fanSentiment)
  // Normalize total points: 0-200 → 0-100 (cap at 200 — elite captain threshold)
  const pointsNorm = clamp((totalPoints / 200) * 100)

  const score =
    WEIGHTS.form * formNorm +
    WEIGHTS.ownership * ownershipNorm +
    WEIGHTS.fanSentiment * sentimentNorm +
    WEIGHTS.totalPoints * pointsNorm

  return Math.round(clamp(score) * 10) / 10
}

/**
 * Get a human-readable recommendation label based on the captain pulse score.
 *
 *   ≥ 75 → "Strong Captain Pick"
 *   ≥ 60 → "Good Pick"
 *   ≥ 45 → "Worth Considering"
 *   < 45 → "Risky Pick"
 */
export function getRecommendation(score: number): string {
  if (score >= 75) return 'Strong Captain Pick'
  if (score >= 60) return 'Good Pick'
  if (score >= 45) return 'Worth Considering'
  return 'Risky Pick'
}

/**
 * Generate a 1-line reason for the recommendation.
 * Highlights the player's strongest component.
 */
export function getCaptainReason(candidate: {
  form: number
  ownershipPct: number
  fanSentiment: number
  totalPoints: number
}): string {
  const { form, ownershipPct, fanSentiment, totalPoints } = candidate

  // Identify the dominant strength
  if (form >= 7 && ownershipPct >= 30) {
    return `Red-hot form (${form.toFixed(1)}) + ${ownershipPct.toFixed(0)}% ownership`
  }
  if (form >= 7) {
    return `In-form (${form.toFixed(1)} pts/game recently)`
  }
  if (totalPoints >= 100) {
    return `Consistent (${totalPoints} pts this season)`
  }
  if (ownershipPct >= 40) {
    return `Template pick (${ownershipPct.toFixed(0)}% ownership)`
  }
  if (fanSentiment >= 70) {
    return `Fans love him (${fanSentiment.toFixed(0)}/100 fan sentiment)`
  }
  if (fanSentiment <= 30) {
    return `Fans are worried (${fanSentiment.toFixed(0)}/100 sentiment) — risky`
  }
  return `Balanced profile, moderate upside`
}

/**
 * Convert a mood score (0-100) to a fan-sentiment emoji.
 * Same 5-level scale used throughout the app (🤩😊😐😟😡).
 */
export function sentimentToEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}
