/**
 * Appearance Tracker — the "Actually Played" eligibility formula.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Earlier versions of the Elite/Crisis XI engine verified only two things per
 * player: (a) they were named in their nation's WC 2026 26-man squad, and
 * (b) their team's match outcome (advanced / eliminated). They did NOT verify
 * that the player *actually appeared on the pitch* in the cited match.
 *
 * This produced false positives — e.g. Guillermo Ochoa was named to Mexico's
 * WC 2026 squad (6th World Cup, record) and was listed as the R32 clean-sheet
 * GK, but the actual R32 starter vs Ecuador was Raúl Rangel (confirmed by
 * USA Today, El Paso Times, ESPN, ekantipur lineup pages). Ochoa was on the
 * bench. The same pattern affected the group-stage opener (MEX 2-0 RSA — also
 * Rangel, not Ochoa).
 *
 * This module closes that gap with a deterministic, source-cited formula that
 * gates eligibility AND weights the buzz score by how the player appeared.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE FORMULA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  STEP 1 — ELIGIBILITY GATE (binary):
 *    eligible = (status ∈ {starter, sub_played}) AND (minutesPlayed > 0)
 *
 *    A player who was 'sub_unused', 'not_in_squad', 'injured', 'retired', or
 *    'not_in_wc_squad' is EXCLUDED from the pool entirely. No exceptions.
 *
 *  STEP 2 — APPEARANCE WEIGHT (0.0–1.0, applied to baseline buzz):
 *    starter:        0.70 + 0.30 × min(minutesPlayed / 90, 1)   →  0.70–1.00
 *    sub_played:     0.40 + 0.40 × min(minutesPlayed / 90, 1)   →  0.40–0.80
 *    (ineligible):   0.00   (excluded by Step 1)
 *
 *    Rationale: a starter who plays the full 90+ET earns full buzz weight; a
 *    starter subbed off early retains 70% floor (they started, so they earned
 *    their appearance). A sub who plays 45 min earns 60%; a 5-min cameo earns
 *    ~42%. This prevents a last-minute sub from outranking a full-match
 *    performer on the same baseline.
 *
 *  STEP 3 — EVIDENCE CONFIDENCE (0.70–1.0, multiplied into the weighted buzz):
 *    tier1_lineup_page:        1.00  (Sofascore / ESPN / FIFA / Sky Sports
 *                                    official lineup page — gold standard)
 *    tier1_match_report:       0.95  (BBC / Guardian / NYT Athletic match
 *                                    report naming the player as starter/sub)
 *    tier2_aggregator:         0.85  (Yahoo / Rotowire / Sporting News —
 *                                    reliable but secondary)
 *    team_outcome_derived:     0.70  (we inferred appearance from the team
 *                                    result, NOT a direct lineup source —
 *                                    weakest tier, used as a fallback for
 *                                    legacy pool entries pending re-verification)
 *
 *  STEP 4 — FINAL BUZZ:
 *    adjustedBuzz = round(baselineBuzz × appearanceWeight × evidenceConfidence)
 *    clamped to [5, 99]
 *
 *    Players with weaker evidence are still eligible (Step 1 passes) but their
 *    buzz is discounted by the evidence-confidence multiplier, so a
 *    team_outcome_derived player ranks below a tier1_lineup_page player with
 *    the same baseline. This rewards direct verification without throwing away
 *    legacy data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Every AppearanceRecord MUST cite a real sourceUrl (or the literal string
 *     'team-outcome-derived' for the weakest tier). Never invent a URL.
 *  2. evidenceTier = 'tier1_lineup_page' is reserved for records where a real
 *     lineup page was consulted. Downgrade to 'team_outcome_derived' if unsure.
 *  3. minutesPlayed = 0 is the honest value for a player who didn't appear,
 *     even if they were on the bench. Never round 0 up to 1 to "keep" a player.
 *  4. The formula is deterministic: same inputs → same output. No randomness,
 *     no time-of-day variance, no "vibes."
 */

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * How a player related to a specific match.
 * - 'starter':         Named in the starting XI.
 * - 'sub_played':      Came off the bench and played >0 minutes.
 * - 'sub_unused':      On the bench, did NOT enter the pitch. INELIGIBLE.
 * - 'not_in_squad':    Not in the matchday squad. INELIGIBLE.
 * - 'injured':         Injured/unavailable for this match. INELIGIBLE.
 * - 'retired':         Retired from international football before this match. INELIGIBLE.
 * - 'not_in_wc_squad': Not named in the WC 2026 26-man squad. INELIGIBLE.
 */
export type AppearanceStatus =
  | 'starter'
  | 'sub_played'
  | 'sub_unused'
  | 'not_in_squad'
  | 'injured'
  | 'retired'
  | 'not_in_wc_squad'

/**
 * Source-quality tier. Drives the evidence-confidence multiplier (Step 3).
 * Higher tier = stronger direct evidence of the player's appearance.
 */
export type EvidenceTier =
  | 'tier1_lineup_page'
  | 'tier1_match_report'
  | 'tier2_aggregator'
  | 'team_outcome_derived'

/**
 * A single player's appearance record for a single match.
 * Immutable after verification. The sourceUrl is the ground truth — if it's
 * 'team-outcome-derived', the record is a legacy inference pending upgrade.
 */
export interface AppearanceRecord {
  status: AppearanceStatus
  /** Minutes played. 0 if the player didn't enter the pitch. */
  minutesPlayed: number
  /** Real URL of the source, OR the literal 'team-outcome-derived' sentinel. */
  sourceUrl: string
  /** Human-readable source label, e.g. "USA Today lineup page". */
  sourceLabel: string
  evidenceTier: EvidenceTier
  /** ISO date the appearance was verified. */
  verifiedAt: string
}

// ── STEP 1: Eligibility gate ─────────────────────────────────────────────────

/**
 * Eligibility gate. A player is eligible for an Elite/Crisis XI for a match
 * ONLY if they actually appeared on the pitch (starter or sub_played) AND
 * played more than 0 minutes.
 *
 * Bench-only, not-in-squad, injured, retired, and not-in-WC-squad players are
 * all EXCLUDED. No exceptions — being named to the squad is necessary but not
 * sufficient; you have to have played.
 */
export function isEligibleForXI(a: AppearanceRecord): boolean {
  if (
    a.status === 'sub_unused' ||
    a.status === 'not_in_squad' ||
    a.status === 'injured' ||
    a.status === 'retired' ||
    a.status === 'not_in_wc_squad'
  ) {
    return false
  }
  if (a.status === 'starter' || a.status === 'sub_played') {
    return a.minutesPlayed > 0
  }
  return false
}

// ── STEP 2: Appearance weight (0.0–1.0) ──────────────────────────────────────

/**
 * Appearance weight multiplier (Step 2 of the formula).
 *
 * - Starter who plays the full match: 1.00
 * - Starter subbed off at 60': 0.70 + 0.30 × (60/90) = 0.90
 * - Sub who plays 45 min: 0.40 + 0.40 × (45/90) = 0.60
 * - Sub who plays 5 min: 0.40 + 0.40 × (5/90) = 0.42
 * - Ineligible: 0.00
 */
export function appearanceWeight(a: AppearanceRecord): number {
  if (!isEligibleForXI(a)) return 0
  const frac = Math.min(a.minutesPlayed / 90, 1)
  if (a.status === 'starter') {
    return 0.7 + 0.3 * frac
  }
  // sub_played
  return 0.4 + 0.4 * frac
}

// ── STEP 3: Evidence confidence (0.70–1.0) ───────────────────────────────────

/**
 * Evidence-confidence multiplier (Step 3 of the formula).
 * Driven solely by the source-quality tier.
 */
export function evidenceConfidence(tier: EvidenceTier): number {
  switch (tier) {
    case 'tier1_lineup_page':
      return 1.0
    case 'tier1_match_report':
      return 0.95
    case 'tier2_aggregator':
      return 0.85
    case 'team_outcome_derived':
      return 0.7
  }
}

// ── STEP 4: Combined adjusted buzz ───────────────────────────────────────────

/**
 * The full formula: baseline × appearanceWeight × evidenceConfidence, clamped.
 *
 * Returns 0 for ineligible players (so the ranker can filter them out cleanly),
 * and a value in [5, 99] for eligible players.
 */
export function computeAppearanceAdjustedBuzz(
  baselineBuzz: number,
  a: AppearanceRecord,
): number {
  if (!isEligibleForXI(a)) return 0
  const weight = appearanceWeight(a)
  const confidence = evidenceConfidence(a.evidenceTier)
  const raw = baselineBuzz * weight * confidence
  return Math.max(5, Math.min(99, Math.round(raw)))
}

// ── Helper factories (keep pool entries concise) ─────────────────────────────

/**
 * Build a verified starter appearance from a Tier-1 lineup page.
 * Use this when you have a direct lineup source (Sofascore/ESPN/FIFA/Sky).
 */
export function verifiedStarter(
  sourceUrl: string,
  sourceLabel: string,
  minutesPlayed = 90,
  verifiedAt = '2026-07-21',
): AppearanceRecord {
  return {
    status: 'starter',
    minutesPlayed,
    sourceUrl,
    sourceLabel,
    evidenceTier: 'tier1_lineup_page',
    verifiedAt,
  }
}

/**
 * Build a verified sub-played appearance from a Tier-1 source.
 * minutesPlayed is required — never round 0 up.
 */
export function verifiedSub(
  sourceUrl: string,
  sourceLabel: string,
  minutesPlayed: number,
  verifiedAt = '2026-07-21',
): AppearanceRecord {
  return {
    status: 'sub_played',
    minutesPlayed,
    sourceUrl,
    sourceLabel,
    evidenceTier: 'tier1_lineup_page',
    verifiedAt,
  }
}

/**
 * Build a legacy "team-outcome-derived" starter appearance.
 * Use this ONLY for existing pool entries whose appearance was inferred from
 * the team result (not directly verified against a lineup page). The weakest
 * evidence tier — these players are eligible but their buzz is discounted.
 */
export function inferredStarter(
  sourceNote: string,
  verifiedAt = '2026-07-02',
): AppearanceRecord {
  return {
    status: 'starter',
    minutesPlayed: 90,
    sourceUrl: 'team-outcome-derived',
    sourceLabel: sourceNote,
    evidenceTier: 'team_outcome_derived',
    verifiedAt,
  }
}

/**
 * Build an explicit INELIGIBLE record (bench-only, injured, retired, etc.).
 * The ranker's gate will exclude this player from the XI.
 */
export function ineligible(
  status: Exclude<AppearanceStatus, 'starter' | 'sub_played'>,
  sourceUrl: string,
  sourceLabel: string,
  verifiedAt = '2026-07-21',
): AppearanceRecord {
  return {
    status,
    minutesPlayed: 0,
    sourceUrl,
    sourceLabel,
    evidenceTier: 'team_outcome_derived',
    verifiedAt,
  }
}

// ── Diagnostic helpers (for UI / debugging) ──────────────────────────────────

/**
 * Human-readable label for the appearance, suitable for tooltips.
 * e.g. "Starter · 90 min · USA Today lineup page"
 */
export function appearanceLabel(a: AppearanceRecord): string {
  if (!isEligibleForXI(a)) {
    const reason =
      a.status === 'sub_unused' ? 'bench-only (did not enter)'
      : a.status === 'not_in_squad' ? 'not in matchday squad'
      : a.status === 'injured' ? 'injured'
      : a.status === 'retired' ? 'retired before match'
      : 'not in WC 2026 squad'
    return `INELIGIBLE · ${reason} · ${a.sourceLabel}`
  }
  const role = a.status === 'starter' ? 'Starter' : 'Sub'
  return `${role} · ${a.minutesPlayed} min · ${a.sourceLabel}`
}
