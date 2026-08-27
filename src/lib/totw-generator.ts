/**
 * TOTW Generator
 *
 * Generates a Team of the Week (or Flops of the Week) XI from completed
 * LeagueMatch + LeaguePlayer data.
 *
 * Selection logic:
 *   1. Find all completed LeagueMatches for the given matchweek.
 *   2. For each LeaguePlayer, compute a matchweek score:
 *      pulseScore (60%) + sentiment (30%) + match result bonus (10%)
 *   3. Pick the top-scoring player for each position in a 4-3-3 formation:
 *      GK × 1, RB × 1 (or DEF), CB × 2, LB × 1 (or DEF), CM × 2, CAM × 1, RW × 1, ST × 1, LW × 1
 *   4. For "flops", pick the LOWEST-scoring players instead.
 *
 * ANTI-HALLUCINATION: the generator ONLY selects players that exist in the DB
 * (synced from FPL). When no completed matches exist for the matchweek (pre-
 * season, or matchweek not yet played), it returns null — the caller MUST
 * render an honest empty state. We NEVER fabricate a TOTW XI.
 *
 * The matchInfo field is built from real match data: "2 goals vs CHE",
 * "Clean sheet vs LIV", "Assist in 3-1 win vs ARS". When no match-specific
 * data is available, it falls back to a generic "Matchweek N performance".
 */

import type { PrismaClient, FPLPlayer } from '@prisma/client'

export interface TOTWSelection {
  playerName: string
  teamCode: string
  position: string // "GK" | "RB" | "CB" | "LB" | "CM" | "CAM" | "RW" | "ST" | "LW"
  pulseScore: number
  sentiment: number
  matchInfo: string
  photoUrl: string | null
  order: number
  /** Fan sentiment trend — derived from match result: W=rising, L=falling, D=stable */
  trend: 'rising' | 'stable' | 'falling'
}

export interface TOTWResult {
  formation: string
  players: TOTWSelection[]
  matchweek: number
  type: 'totw' | 'flops'
  /** True if at least one completed match exists for this matchweek. */
  hasMatchData: boolean
}

// 4-3-3 formation positions in display order (back to front)
const FORMATION_433: Array<{ pos: string; order: number }> = [
  { pos: 'GK', order: 0 },
  { pos: 'RB', order: 1 },
  { pos: 'CB', order: 2 },
  { pos: 'CB', order: 3 },
  { pos: 'LB', order: 4 },
  { pos: 'CM', order: 5 },
  { pos: 'CAM', order: 6 },
  { pos: 'CM', order: 7 },
  { pos: 'RW', order: 8 },
  { pos: 'ST', order: 9 },
  { pos: 'LW', order: 10 },
]

// Map FPL positions to formation slots
// FPL DEF → RB/CB/LB, FPL MID → CM/CAM/RW/LW, FPL FWD → ST/LW/RW
const POSITION_MAP: Record<string, string[]> = {
  GK: ['GK'],
  DEF: ['RB', 'CB', 'LB'],
  MID: ['CM', 'CAM', 'RW', 'LW'],
  FWD: ['ST', 'RW', 'LW'],
}

/**
 * Generate a Team of the Week (or Flops of the Week) for a given matchweek.
 *
 * @param db          PrismaClient instance
 * @param matchweek   Matchweek number (1, 2, 3, ...)
 * @param type        "totw" (top performers) or "flops" (worst performers)
 * @param league      League slug (default "EPL")
 * @param season      Season string (default "2026-27")
 * @returns TOTWResult, or { hasMatchData: false, players: [] } if no matches
 */
export async function generateTOTW(
  db: PrismaClient,
  matchweek: number,
  type: 'totw' | 'flops',
  league = 'EPL',
  season = '2026-27',
): Promise<TOTWResult> {
  // 1. Find completed matches for this matchweek
  const matches = await db.leagueMatch.findMany({
    where: {
      league,
      season,
      matchweek,
      status: 'completed',
    },
  })

  if (matches.length === 0) {
    return {
      formation: '4-3-3',
      players: [],
      matchweek,
      type,
      hasMatchData: false,
    }
  }

  // 2. Get all LeaguePlayers for this league/season
  // NOTE: We do NOT orderBy pulseScore here — when fan votes are 0, all
  // players have pulseScore=0, so desc/asc return the same order (DB
  // insertion order = Arsenal first). Instead, we fetch all players,
  // compute derived scores from FPL data + match results, and sort
  // in-memory by derived score. This ensures TOTW picks big winners
  // and FLOPS picks big losers.
  const rawPlayers = await db.leaguePlayer.findMany({
    where: { league, season },
  })

  if (rawPlayers.length === 0) {
    return {
      formation: '4-3-3',
      players: [],
      matchweek,
      type,
      hasMatchData: false,
    }
  }

  // 2b. Fetch FPLPlayer data for derived sentiment/pulseScore computation.
  const fplIds = rawPlayers.map((p) => p.fplId).filter((id): id is number => id !== null)
  const fplPlayers = await db.fPLPlayer.findMany({
    where: { fplId: { in: fplIds } },
  }).catch(() => [])
  const fplPlayerMap = new Map(fplPlayers.map((fp) => [fp.fplId, fp]))

  // 3. Build match-result context for each team
  const teamMatchResults = new Map<
    string,
    { goalsFor: number; goalsAgainst: number; opponent: string; result: 'W' | 'D' | 'L' }
  >()
  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue
    const homeResult = m.homeScore > m.awayScore ? 'W' : m.homeScore < m.awayScore ? 'L' : 'D'
    const awayResult = homeResult === 'W' ? 'L' : homeResult === 'L' ? 'W' : 'D'
    teamMatchResults.set(m.homeTeamCode, {
      goalsFor: m.homeScore,
      goalsAgainst: m.awayScore,
      opponent: m.awayTeamCode,
      result: homeResult,
    })
    teamMatchResults.set(m.awayTeamCode, {
      goalsFor: m.awayScore,
      goalsAgainst: m.homeScore,
      opponent: m.homeTeamCode,
      result: awayResult,
    })
  }

  // 3b. Compute derived pulseScore for ALL players and sort in-memory.
  // This is the critical fix: when LeaguePlayer.pulseScore = 0 for everyone
  // (no fan votes), the DB orderBy returns the same order for both 'desc'
  // (TOTW) and 'asc' (FLOPS) — so both pick the same Arsenal players.
  // By computing derived scores from FPL form/goals/assists + match result,
  // we ensure TOTW picks big WINNERS and FLOPS picks big LOSERS.
  const playersWithDerived = rawPlayers.map((p) => {
    const matchResult = teamMatchResults.get(p.teamCode)
    const fplData = p.fplId ? fplPlayerMap.get(p.fplId) : undefined

    const hasRealSentiment = p.sentiment !== 50
    const hasRealPulse = p.pulseScore > 0

    const derivedSentiment = hasRealSentiment
      ? p.sentiment
      : computeDerivedSentiment(fplData, matchResult?.result, p.position)

    const derivedPulseScore = hasRealPulse
      ? p.pulseScore
      : computeDerivedPulseScore(fplData, matchResult, p.position)

    return {
      ...p,
      _derivedPulseScore: derivedPulseScore,
      _derivedSentiment: derivedSentiment,
      _matchResult: matchResult,
      _fplData: fplData,
    }
  })

  // Sort by derived pulseScore: TOTW = highest first, FLOPS = lowest first
  playersWithDerived.sort((a, b) =>
    type === 'totw'
      ? b._derivedPulseScore - a._derivedPulseScore
      : a._derivedPulseScore - b._derivedPulseScore,
  )

  // 4. Assign each player to their best formation slot
  // For each formation slot, pick the top-scoring eligible player
  const usedPlayerIds = new Set<string>()
  const teamPickCount = new Map<string, number>() // max 3 per team for diversity
  const MAX_PER_TEAM = 3
  const selections: TOTWSelection[] = []

  for (const slot of FORMATION_433) {
    // Find players eligible for this slot (not used, right position, team not full)
    const eligible = playersWithDerived.filter((p) => {
      if (usedPlayerIds.has(p.id)) return false
      const possibleSlots = POSITION_MAP[p.position] ?? []
      if (!possibleSlots.includes(slot.pos)) return false
      // Team diversity: max MAX_PER_TEAM players from the same team
      const teamCount = teamPickCount.get(p.teamCode) ?? 0
      if (teamCount >= MAX_PER_TEAM) return false
      return true
    })

    if (eligible.length === 0) {
      // Fallback: ignore team diversity if we can't fill the slot
      const eligibleNoDiversity = playersWithDerived.filter((p) => {
        if (usedPlayerIds.has(p.id)) return false
        const possibleSlots = POSITION_MAP[p.position] ?? []
        return possibleSlots.includes(slot.pos)
      })
      if (eligibleNoDiversity.length === 0) continue
      const pick = eligibleNoDiversity[0]
      usedPlayerIds.add(pick.id)
      teamPickCount.set(pick.teamCode, (teamPickCount.get(pick.teamCode) ?? 0) + 1)

      const matchInfo = buildMatchInfo(pick._fplData ?? pick, pick._matchResult, matchweek)
      const trend: 'rising' | 'stable' | 'falling' =
        pick._matchResult?.result === 'W' ? 'rising' :
        pick._matchResult?.result === 'L' ? 'falling' : 'stable'
      selections.push({
        playerName: pick.name,
        teamCode: pick.teamCode,
        position: slot.pos,
        pulseScore: pick._derivedPulseScore,
        sentiment: pick._derivedSentiment,
        matchInfo,
        photoUrl: pick.photoUrl,
        order: slot.order,
        trend,
      })
      continue
    }

    // Pick the top player for this slot (already sorted by derived pulseScore)
    const pick = eligible[0]
    usedPlayerIds.add(pick.id)
    teamPickCount.set(pick.teamCode, (teamPickCount.get(pick.teamCode) ?? 0) + 1)

    const matchInfo = buildMatchInfo(pick._fplData ?? pick, pick._matchResult, matchweek)
    const trend: 'rising' | 'stable' | 'falling' =
      pick._matchResult?.result === 'W' ? 'rising' :
      pick._matchResult?.result === 'L' ? 'falling' : 'stable'

    selections.push({
      playerName: pick.name,
      teamCode: pick.teamCode,
      position: slot.pos,
      pulseScore: pick._derivedPulseScore,
      sentiment: pick._derivedSentiment,
      matchInfo,
      photoUrl: pick.photoUrl,
      order: slot.order,
      trend,
    })
  }

  return {
    formation: '4-3-3',
    players: selections,
    matchweek,
    type,
    hasMatchData: true,
  }
}

/**
 * Build a 1-line match info string for a TOTW selection.
 * Uses real match result data when available.
 */
function buildMatchInfo(
  player: { goals?: number; assists?: number; cleanSheets?: number; position: string },
  matchResult:
    | { goalsFor: number; goalsAgainst: number; opponent: string; result: 'W' | 'D' | 'L' }
    | undefined,
  matchweek: number,
): string {
  if (!matchResult) {
    return `Matchweek ${matchweek} performance`
  }

  const { goalsFor, goalsAgainst, opponent, result } = matchResult
  const scoreStr = `${goalsFor}-${goalsAgainst} ${result} vs ${opponent}`

  // Add player-specific stats if available
  if (player.position === 'GK' && goalsAgainst === 0) {
    return `Clean sheet (${scoreStr})`
  }
  if ((player as { goals?: number }).goals && (player as { goals?: number }).goals! >= 2) {
    return `${(player as { goals?: number }).goals} goals (${scoreStr})`
  }
  if ((player as { goals?: number }).goals && (player as { goals?: number }).goals! >= 1) {
    return `Goal (${scoreStr})`
  }
  if ((player as { assists?: number }).assists && (player as { assists?: number }).assists! >= 1) {
    return `Assist (${scoreStr})`
  }
  return scoreStr
}

/**
 * Get the latest completed matchweek for a league/season.
 * Returns 0 if no matches have been completed yet (pre-season).
 */
export async function getLatestMatchweek(
  db: PrismaClient,
  league = 'EPL',
  season = '2026-27',
): Promise<number> {
  const latest = await db.leagueMatch.findFirst({
    where: { league, season, status: 'completed' },
    orderBy: { matchweek: 'desc' },
    select: { matchweek: true },
  })
  return latest?.matchweek ?? 0
}

/**
 * Get the current/next matchweek (the first upcoming matchweek, or the
 * latest completed if all have been played).
 * Returns 1 if no matches exist yet (pre-season → show MW1).
 */
export async function getCurrentMatchweek(
  db: PrismaClient,
  league = 'EPL',
  season = '2026-27',
): Promise<number> {
  const upcoming = await db.leagueMatch.findFirst({
    where: { league, season, status: 'upcoming' },
    orderBy: { matchweek: 'asc' },
    select: { matchweek: true },
  })
  if (upcoming) return upcoming.matchweek

  const latest = await db.leagueMatch.findFirst({
    where: { league, season },
    orderBy: { matchweek: 'desc' },
    select: { matchweek: true },
  })
  return latest?.matchweek ?? 1
}

// ─── Derived Sentiment + PulseScore (FIX-02) ─────────────────────────────────
//
// When fan votes = 0, LeaguePlayer.sentiment defaults to 50 (neutral 😐) and
// pulseScore defaults to 0. This makes the TOTW look "dead" — all players show
// the same neutral mood and 0 PULSE. We derive both values from FPL player
// stats (form, goals, assists, clean sheets) + match result so the TOTW is
// visually meaningful even before fans start voting.
//
// Once real FanVote data comes in, /api/epl/compute-pulse overwrites
// LeaguePlayer.sentiment and pulseScore with real values — the derived
// fallback is only used when no real data exists.

/**
 * Compute a derived sentiment score (0-100) from FPL player stats.
 *
 * Formula:
 *   base = 50 (neutral)
 *   + form bonus: (form - 3) × 4, clamped to [-20, +40]
 *   + goals bonus: +8 per goal (max +24)
 *   + assists bonus: +5 per assist (max +15)
 *   + clean sheet bonus (DEF/GK only): +10
 *   + match result bonus: W=+10, D=+0, L=-10
 *   Final clamp: [15, 95]
 *
 * This produces a realistic distribution:
 *   - A GK with a clean sheet + win → ~75 (😊)
 *   - A ST with 2 goals + win → ~85 (🤩)
 *   - A MID with 0 goals in a loss → ~30 (😟)
 */
function computeDerivedSentiment(
  fplData: FPLPlayer | undefined,
  matchResult: 'W' | 'D' | 'L' | undefined,
  position: string,
): number {
  if (!fplData) return 50 // No FPL data → truly neutral

  let score = 50

  // Form bonus (FPL form is 0-10, typical range 2-8)
  const form = Number(fplData.form) || 0
  score += Math.max(-20, Math.min(40, (form - 3) * 4))

  // Goals bonus
  const goals = fplData.goals || 0
  score += Math.min(24, goals * 8)

  // Assists bonus
  const assists = fplData.assists || 0
  score += Math.min(15, assists * 5)

  // Clean sheet bonus (only for DEF/GK)
  if (position === 'GK' || position === 'RB' || position === 'CB' || position === 'LB') {
    const cleanSheets = fplData.cleanSheets || 0
    if (cleanSheets > 0) score += 10
  }

  // Match result bonus
  if (matchResult === 'W') score += 10
  else if (matchResult === 'L') score -= 10

  return Math.max(15, Math.min(95, Math.round(score)))
}

/**
 * Compute a derived pulse score (0-100) from FPL player stats + match result.
 *
 * Formula:
 *   base = 40
 *   + form × 3 (max +30)
 *   + totalPoints / 5 (max +20)
 *   + goals × 6 (max +18)
 *   + assists × 4 (max +12)
 *   + clean sheet (DEF/GK): +8
 *   + match result: W=+12, D=+4, L=-5
 *   + goal difference bonus: +3 per goal diff (max +9)
 *   Final clamp: [25, 98]
 *
 * This produces:
 *   - A star performer (form 10, 2 goals, win 3-0) → ~92
 *   - A solid performer (form 5, clean sheet, win 1-0) → ~75
 *   - A bench player (form 2, 0 goals, draw 0-0) → ~50
 */
function computeDerivedPulseScore(
  fplData: FPLPlayer | undefined,
  matchResult:
    | { goalsFor: number; goalsAgainst: number; opponent: string; result: 'W' | 'D' | 'L' }
    | undefined,
  position: string,
): number {
  if (!fplData) return 40

  let score = 40

  // Form contribution
  const form = Number(fplData.form) || 0
  score += Math.min(30, form * 3)

  // Total points contribution
  const totalPoints = fplData.totalPoints || 0
  score += Math.min(20, totalPoints / 5)

  // Goals + assists
  const goals = fplData.goals || 0
  score += Math.min(18, goals * 6)
  const assists = fplData.assists || 0
  score += Math.min(12, assists * 4)

  // Clean sheet for defenders
  if (position === 'GK' || position === 'RB' || position === 'CB' || position === 'LB') {
    if ((fplData.cleanSheets || 0) > 0) score += 8
  }

  // Match result + goal difference
  if (matchResult) {
    if (matchResult.result === 'W') {
      score += 12
      const gd = matchResult.goalsFor - matchResult.goalsAgainst
      score += Math.min(9, gd * 3)
    } else if (matchResult.result === 'D') {
      score += 4
    } else {
      score -= 5
    }
  }

  return Math.max(25, Math.min(98, Math.round(score)))
}
