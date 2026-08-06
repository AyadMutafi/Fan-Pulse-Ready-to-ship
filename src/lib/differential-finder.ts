/**
 * Differential Finder
 *
 * Finds FPL players where fan sentiment DIVERGES from FPL ownership — these
 * are the "differential" picks that can win mini-leagues.
 *
 * Two types of divergence:
 *
 *   DIFFERENTIAL (sentiment HIGH, ownership LOW):
 *     Fans are excited about this player, but few FPL managers own them.
 *     → Potential captain differential or transfer target.
 *
 *   RISK (sentiment LOW, ownership HIGH):
 *     Fans are worried about this player, but many FPL managers own them.
 *     → Consider selling or avoiding as captain.
 *
 * The differentialScore is 0-100, where higher = more divergent (more
 * interesting differential). The type is "differential" or "risk".
 *
 * ANTI-HALLUCINATION: computed ONLY from real FPL ownership data + real
 * FanVote sentiment. When no FanVote data exists (pre-season), we can't
 * compute differentials — the API returns an empty array (honest empty state).
 */

export interface DifferentialCandidate {
  fplId: number
  webName: string
  fullName: string
  teamCode: string
  position: string
  price: number
  ownershipPct: number
  form: number
  totalPoints: number
  fanSentiment: number
  /** Divergence score 0-100 (higher = more divergent). */
  differentialScore: number
  /** "differential" (sentiment > ownership) or "risk" (sentiment < ownership). */
  differentialType: 'differential' | 'risk'
  /** 1-line explanation of the divergence. */
  reason: string
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/**
 * Compute the differential score for a player.
 *
 * The score is based on the ABSOLUTE GAP between fan sentiment (0-100) and
 * a normalized ownership (0-100). A larger gap = more divergent.
 *
 * We normalize ownership to 0-100 by capping at 60% (no FPL player gets >60%
 * ownership in practice). So ownership 30% → 50 normalized, ownership 60% → 100.
 *
 * @param fanSentiment  0-100 from FanVote aggregation
 * @param ownershipPct  0-100 from FPL selected_by_percent
 * @returns { score: 0-100, type: 'differential' | 'risk' }
 */
export function computeDifferentialScore(
  fanSentiment: number,
  ownershipPct: number,
): { score: number; type: 'differential' | 'risk' } {
  const sentimentNorm = clamp(fanSentiment)
  const ownershipNorm = clamp((ownershipPct / 60) * 100)

  const gap = sentimentNorm - ownershipNorm
  const absGap = Math.abs(gap)
  const type: 'differential' | 'risk' = gap > 0 ? 'differential' : 'risk'

  return {
    score: Math.round(absGap * 10) / 10,
    type,
  }
}

/**
 * Get a 1-line explanation for a differential/risk pick.
 */
export function getDifferentialReason(candidate: {
  webName: string
  fanSentiment: number
  ownershipPct: number
  form: number
  totalPoints: number
  differentialType: 'differential' | 'risk'
}): string {
  const { fanSentiment, ownershipPct, form, totalPoints, differentialType } = candidate

  if (differentialType === 'differential') {
    if (form >= 5 && totalPoints >= 30) {
      return `Fans excited (${fanSentiment.toFixed(0)}/100) but only ${ownershipPct.toFixed(0)}% own him — in-form differential`
    }
    if (fanSentiment >= 75) {
      return `Fan sentiment ${fanSentiment.toFixed(0)}/100 vs ${ownershipPct.toFixed(0)}% ownership — undervalued by FPL managers`
    }
    return `Fans bullish (${fanSentiment.toFixed(0)}/100), low ownership (${ownershipPct.toFixed(0)}%) — differential potential`
  }

  // Risk type
  if (fanSentiment <= 30) {
    return `Fans worried (${fanSentiment.toFixed(0)}/100) but ${ownershipPct.toFixed(0)}% still own him — sell risk`
  }
  return `Fan sentiment cooling (${fanSentiment.toFixed(0)}/100) vs high ownership (${ownershipPct.toFixed(0)}%) — template risk`
}

/**
 * Convert a mood score (0-100) to a fan-sentiment emoji.
 * Same 5-level scale used throughout the app (🤩😊😐😟😡).
 */
export function differentialSentimentToEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}
