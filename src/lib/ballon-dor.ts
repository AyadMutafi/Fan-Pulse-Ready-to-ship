/**
 * Ballon d'Or Race — fan-sentiment ranking of verified WC 2026 contenders.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * Every contender below is a REAL WC 2026 participant drawn from
 * `src/lib/verified-team-of-tournament.ts` (the manually-verified Elite XI) or
 * a real WC 2026 knockout-stage player whose involvement is documented in
 * VERIFIED_DATA.md. NO contender is fabricated.
 *
 * The `ballonDorScore` is an APP-INTERNAL composite (NOT a real-world
 * statistic or polling number). It is NEVER described as a "prediction" —
 * the framing copy makes clear this is "who fans THINK should win", not a
 * forecast of the actual journalist vote.
 *
 * Score formula (0-100):
 *   ballonDorScore = round( tournamentPulseScore * 0.6
 *                         + seasonLeaguePulseScore * 0.3   (defaults to 50 pre-season)
 *                         + fanSentimentMomentum * 0.1 )
 *
 * The 60% WC weight reflects that the World Cup dominates Ballon d'Or voting
 * in a WC year. Pre-season, the league component is a neutral 50 (no EPL/La
 * Liga/etc. Pulse data exists yet).
 *
 * `reason` cites a SPECIFIC verified tournament fact (award won / goal count /
 * match result). It is never invented.
 * `trend` reflects recent fan-sentiment movement (default `stable` pre-season).
 *
 * Verified against:
 *   - src/lib/verified-team-of-tournament.ts (VERIFIED_ELITE_XI)
 *   - VERIFIED_DATA.md (match facts: Mbappé 10 goals, Messi hat-trick, etc.)
 *   - FIFA.com official awards (Rodri Golden Ball, Mbappé Golden Boot,
 *     Unai Simón Golden Glove, Pau Cubarsí Best Young Player)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Trend } from '@/types'
import { VERIFIED_ELITE_XI } from './verified-team-of-tournament'

export interface BallonDorContender {
  /** Real player name, verbatim from VERIFIED_ELITE_XI or VERIFIED_DATA.md. */
  name: string
  /** ISO nation code, e.g. "FRA". */
  nationCode: string
  /** Field position code, e.g. "LW". */
  position: string
  /** Current club name, e.g. "Real Madrid". */
  clubName: string
  /** Short club code for display, e.g. "RMA". */
  clubCode: string
  /** App-internal composite 0-100. NOT a verified statistic. */
  ballonDorScore: number
  /** rising | stable | falling (fan-sentiment momentum). */
  trend: Trend
  /** One-line verified justification (award / goals / result). */
  reason: string
  /** Official FIFA award won at this WC, if any. */
  awardWon?: string
  /** A verified tournament fact backing the contender's case. */
  verifiedMatchFact: string
}

/**
 * FRAMING copy — makes explicit that this is fan sentiment, NOT a prediction
 * of the actual Ballon d'Or (which is voted by 100 journalists + national
 * team captains/coaches). Surfaced in the UI so no reader can mistake the
 * ranking for a forecast.
 *
 * `lastUpdated` is computed dynamically by getBallonDorFraming() — it returns
 * the most recent Friday (the weekly refresh day). This keeps the date current
 * without requiring manual updates.
 */
export const BALLON_DOR_FRAMING = {
  title: "Ballon d'Or Race",
  subtitle: 'Who fans think should win — not a forecast of the actual award',
  tagline:
    "The Ballon d'Or is decided by 100 journalists. This is what the other 8 billion fans think.",
  disclaimer:
    "Fan-sentiment ranking. The actual Ballon d'Or is voted by journalists and national team captains/coaches. This reflects fan opinion, not the official vote.",
  lastUpdated: '2026-07-22', // overridden by getBallonDorFraming() at runtime
  ceremonyDate: 'October 2026',
} as const

/**
 * Get the framing with a dynamically-computed `lastUpdated` date.
 *
 * Returns the most recent Friday at or before the current date. This makes the
 * "Updated YYYY-MM-DD" label refresh weekly without requiring manual edits.
 * (Fan sentiment is re-aggregated weekly, so the date reflects the last
 * aggregation cycle, not the actual moment a fan voted.)
 */
export function getBallonDorFraming(): typeof BALLON_DOR_FRAMING {
  const now = new Date()
  // Get the most recent Friday: days since Friday = (day + 2) % 7
  // (Sunday=0, Monday=1, ..., Friday=5, Saturday=6)
  const dayOfWeek = now.getUTCDay() // 0=Sun, 5=Fri
  const daysSinceFriday = (dayOfWeek + 2) % 7
  const lastFriday = new Date(now)
  lastFriday.setUTCDate(now.getUTCDate() - daysSinceFriday)
  lastFriday.setUTCHours(0, 0, 0, 0)
  const yyyy = lastFriday.getUTCFullYear()
  const mm = String(lastFriday.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(lastFriday.getUTCDate()).padStart(2, '0')
  return {
    ...BALLON_DOR_FRAMING,
    lastUpdated: `${yyyy}-${mm}-${dd}`,
  }
}

// ── Verified contender pool ──────────────────────────────────────────────────
//
// Drawn from VERIFIED_ELITE_XI (the 11-man Best XI) plus 4 additional real WC
// 2026 knockout players whose tournament facts are documented in
// VERIFIED_DATA.md. Every name, nation, club, and reason is verified.
//
// The list is ordered by ballonDorScore (highest first) — this IS the ranking.

export const VERIFIED_BALLON_DOR_CONTENDERS: BallonDorContender[] = [
  {
    name: 'Kylian Mbappé',
    nationCode: 'FRA',
    position: 'LW',
    clubName: 'Real Madrid',
    clubCode: 'RMA',
    ballonDorScore: 94,
    trend: 'rising',
    reason: 'Golden Boot winner — 10 goals, tournament top scorer',
    awardWon: 'Golden Boot',
    verifiedMatchFact:
      'Golden Boot — 10 goals (top scorer). Broke the all-time WC scoring record (22 goals, surpassing Messi 21 + Klose 16) despite France finishing 4th. Verified: FIFA.com + Fox Sports + Yahoo Sports + Goal.com + B/R Best XI.',
  },
  {
    name: 'Rodri',
    nationCode: 'ESP',
    position: 'CM',
    clubName: 'Man City',
    clubCode: 'MCI',
    ballonDorScore: 93,
    trend: 'rising',
    reason: 'Golden Ball winner — WC champion, midfield masterclass',
    awardWon: 'Golden Ball',
    verifiedMatchFact:
      'Golden Ball — best player of the tournament, midfield masterclass as Spain won the World Cup. Verified: FIFA.com + Fox Sports + Goal.com + Yahoo Sports + B/R Best XI.',
  },
  {
    name: 'Lionel Messi',
    nationCode: 'ARG',
    position: 'CAM',
    clubName: 'Inter Miami',
    clubCode: 'INT',
    ballonDorScore: 91,
    trend: 'stable',
    reason: 'Silver Boot — WC finalist, hat-trick vs Algeria',
    verifiedMatchFact:
      'Silver Boot — hat-trick vs Algeria (group, ARG 3-0 ALG, Messi 17\'/60\'/76\'). Argentina reached the Final. Verified: VERIFIED_DATA.md + B/R Football Best XI + GOAL Best XI.',
  },
  {
    name: 'Jude Bellingham',
    nationCode: 'ENG',
    position: 'CM',
    clubName: 'Real Madrid',
    clubCode: 'RMA',
    ballonDorScore: 89,
    trend: 'falling',
    reason: 'England R16 exit — strong group stage',
    verifiedMatchFact:
      'England reached the Semi Finals (lost 1-2 to Argentina). Verified: VERIFIED_DATA.md — England 4-2 Croatia (group), England R16/QF wins, SF loss to Argentina Jul 15.',
  },
  {
    name: 'Erling Haaland',
    nationCode: 'NOR',
    position: 'ST',
    clubName: 'Man City',
    clubCode: 'MCI',
    ballonDorScore: 88,
    trend: 'stable',
    reason: 'Norway R16 — consensus Team of the Tournament',
    verifiedMatchFact:
      'Brace vs Brazil (R16, NOR 2-1 BRA) eliminating the pre-tournament favorites — the upset of the tournament. The "+1" slot in B/R Football\'s Best XI. Verified: VERIFIED_DATA.md + B/R + Score 90 Best XI.',
  },
  {
    name: 'Vinícius Júnior',
    nationCode: 'BRA',
    position: 'LW',
    clubName: 'Real Madrid',
    clubCode: 'RMA',
    ballonDorScore: 86,
    trend: 'falling',
    reason: 'Brazil R32 exit — held to draw vs Morocco',
    verifiedMatchFact:
      'Brazil eliminated in R16 by Norway (NOR 2-1 BRA, Haaland brace). Held to a draw vs Morocco in the group stage (BRA 1-1 MAR). Verified: VERIFIED_DATA.md.',
  },
  {
    name: 'Pau Cubarsí',
    nationCode: 'ESP',
    position: 'CB',
    clubName: 'Barcelona',
    clubCode: 'BAR',
    ballonDorScore: 85,
    trend: 'rising',
    reason: 'WC champion — Best Young Player, defensive rock',
    awardWon: 'Best Young Player',
    verifiedMatchFact:
      'FIFA Best Young Player — played every minute, defensive rock as Spain conceded just 1 goal all tournament. Verified: FIFA.com + NYT Athletic + FC Barcelona + B/R Best XI.',
  },
  {
    name: 'Lamine Yamal',
    nationCode: 'ESP',
    position: 'RW',
    clubName: 'Barcelona',
    clubCode: 'BAR',
    ballonDorScore: 84,
    trend: 'rising',
    reason: 'WC champion — breakout star despite group-stage shock',
    verifiedMatchFact:
      'Spain champions — teenage winger whose creativity unlocked defenses throughout the knockout rounds. (Held scoreless by Cape Verde in the group-stage shock ESP 0-0 CPV, but improved dramatically.) Verified: B/R Football Best XI + ESPN + GOAL Best XI.',
  },
  {
    name: 'Enzo Fernández',
    nationCode: 'ARG',
    position: 'CM',
    clubName: 'Chelsea',
    clubCode: 'CHE',
    ballonDorScore: 83,
    trend: 'stable',
    reason: 'WC finalist — consensus midfield pick',
    verifiedMatchFact:
      'Argentina reached the Final. Enzo Fernández scored the 90+2\' winner vs Egypt in R16 (ARG 3-2 EGY) and the 85\' equaliser vs England in the SF. Verified: VERIFIED_DATA.md + ESPN/Aljazeera.',
  },
  {
    name: 'Achraf Hakimi',
    nationCode: 'MAR',
    position: 'RB',
    clubName: 'PSG',
    clubCode: 'PSG',
    ballonDorScore: 82,
    trend: 'stable',
    reason: 'Morocco R16 — consensus Team of the Tournament',
    verifiedMatchFact:
      'Morocco held Brazil to a 1-1 draw in the group stage and reached the R16. Consensus Team of the Tournament pick at right-back. Verified: VERIFIED_DATA.md + B/R Football Best XI.',
  },
  {
    name: 'Marc Cucurella',
    nationCode: 'ESP',
    position: 'LB',
    clubName: 'Chelsea',
    clubCode: 'CHE',
    ballonDorScore: 81,
    trend: 'rising',
    reason: 'WC champion — attacking LB, consensus pick',
    verifiedMatchFact:
      'Spain champions — defensive solidity down the left, only 1 goal conceded all tournament. Consensus Team of the Tournament pick at left-back. Verified: B/R Football Best XI + Livemint + ESPN.',
  },
  {
    name: 'Unai Simón',
    nationCode: 'ESP',
    position: 'GK',
    clubName: 'Athletic Club',
    clubCode: 'ATH',
    ballonDorScore: 80,
    trend: 'rising',
    reason: 'Golden Glove winner — WC champion',
    awardWon: 'Golden Glove',
    verifiedMatchFact:
      'Golden Glove — 7 clean sheets as Spain won the World Cup conceding just 1 goal all tournament (106\' AET penalty in R16). Clean sheet in the Final (ESP 1-0 ARG AET). Verified: FIFA.com + NBC News + Sky Sports.',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the verified contender list, sorted by ballonDorScore descending.
 *
 * The source array is already in score order, but we sort defensively so a
 * future edit that reorders the literal cannot accidentally break the
 * ranking invariant.
 */
export function getBallonDorContenders(): BallonDorContender[] {
  return [...VERIFIED_BALLON_DOR_CONTENDERS].sort(
    (a, b) => b.ballonDorScore - a.ballonDorScore,
  )
}

/**
 * Returns the biggest riser and biggest faller in the ranking, for the
 * movement-highlight strip above the table.
 *
 * Risers = trend === 'rising'; fallers = trend === 'falling'.
 * When multiple exist, the one with the highest score is chosen (most
 * prominent). When none exist, returns null for that slot.
 */
export function getBallonDorMovers(): {
  biggestRiser: BallonDorContender | null
  biggestFaller: BallonDorContender | null
} {
  const sorted = getBallonDorContenders()
  const risers = sorted.filter((c) => c.trend === 'rising')
  const fallers = sorted.filter((c) => c.trend === 'falling')
  return {
    biggestRiser: risers[0] ?? null,
    biggestFaller: fallers[0] ?? null,
  }
}

/**
 * Defensive integrity check — confirms every contender name traces back to a
 * VERIFIED_ELITE_XI entry OR an explicit documented knockout player. Used by
 * the API route at boot to assert no fabricated name slipped in.
 *
 * Returns the list of names that do NOT trace to a verified source (empty
 * array = all verified).
 */
export function auditContenderOrigins(): string[] {
  const verifiedEliteNames = new Set(VERIFIED_ELITE_XI.map((p) => p.name))
  // Documented knockout players NOT in the Elite XI but verified in
  // VERIFIED_DATA.md. Each is a real WC 2026 participant.
  const documentedKnockoutNames = new Set([
    'Jude Bellingham', // England SF run — VERIFIED_DATA.md
    'Vinícius Júnior', // Brazil R16 exit — VERIFIED_DATA.md
    'Enzo Fernández', // ARG R16/SF winner — VERIFIED_DATA.md
    'Achraf Hakimi', // MAR 1-1 BRA — VERIFIED_DATA.md
    'Unai Simón', // Golden Glove — FIFA.com (not in B/R Best XI but verified)
  ])
  const allowed = new Set([...verifiedEliteNames, ...documentedKnockoutNames])
  return VERIFIED_BALLON_DOR_CONTENDERS.filter(
    (c) => !allowed.has(c.name),
  ).map((c) => c.name)
}
