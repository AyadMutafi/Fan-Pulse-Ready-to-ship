/**
 * Team of the Tournament Retro — 2026 FIFA World Cup closure content.
 *
 * After the tournament ends, this module produces the all-tournament Elite XI
 * (the heroes) and Crisis XI (the villains) — ranked across the ENTIRE World
 * Cup, not per stage. It's shareable closure content that gives users a reason
 * to open the app one more time.
 *
 * ANTI-HALLUCINATION CONTRACT (non-negotiable):
 *   1. The ONLY players eligible for either XI are those drawn from:
 *        (a) the group-stage Elite/Crisis pools in src/app/api/world-cup/seed/route.ts
 *            (ELITE_PLAYERS['group-stage'] + CRISIS_PLAYERS['group-stage'])
 *        (b) the R32 VERIFIED_POOL in src/lib/r32-buzz-ranker.ts
 *      Every one of those players was web-verified for WC 2026 squad
 *      participation (see VERIFIED_DATA.md). We NEVER invent a player.
 *   2. The matchInfo string on each pick cites ONLY the verified match fact
 *      already attached to that player in the source pool — we copy it verbatim
 *      and pick the player's BEST fact (for Elite) or WORST fact (for Crisis)
 *      when a player appears in both stages.
 *   3. tournamentScore is an APP-INTERNAL composite (group pulse × 0.4 + R32
 *      buzz × 0.4 + trend bonus × 0.2). It is NOT a real-world statistic and is
 *      never labelled as "verified". It exists only to rank players relative to
 *      each other.
 *   4. If a position group has fewer than the needed players, we fill from the
 *      next-best available verified player rather than inventing. If the entire
 *      verified pool is exhausted, that slot shows "N/A" (a null placeholder) —
 *      we NEVER fabricate a name to fill a slot.
 */

import { VERIFIED_POOL } from '@/lib/r32-buzz-ranker'
import type { Trend } from '@/types'

// ── Source pool: group-stage Elite + Crisis (mirrors the seed file) ───────────
// These arrays are COPIES of ELITE_PLAYERS['group-stage'] and
// CRISIS_PLAYERS['group-stage'] from src/app/api/world-cup/seed/route.ts. They
// are reproduced here (not imported) because the seed file is a server-only
// admin route that wipes the DB on POST — importing it would pull heavy Prisma
// + admin-auth side effects into a pure ranking module. The values are verified
// facts (see VERIFIED_DATA.md Part 4); keeping them in sync is a manual
// responsibility documented in the worklog.

interface GroupStageEntry {
  name: string
  nationCode: string
  position: 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'CF'
  pulseScore: number
  trend: Trend
  matchInfo: string
  /** 'elite' = hero performance, 'crisis' = villain performance */
  tier: 'elite' | 'crisis'
}

const GROUP_STAGE_ELITE: GroupStageEntry[] = [
  { name: 'Guillermo Ochoa', nationCode: 'MEX', position: 'GK', pulseScore: 88, trend: 'rising', matchInfo: 'MEX 2-0 RSA (clean sheet)', tier: 'elite' },
  { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 84, trend: 'rising', matchInfo: 'MAR 1-1 BRA', tier: 'elite' },
  { name: 'Harry Souttar', nationCode: 'AUS', position: 'CB', pulseScore: 83, trend: 'rising', matchInfo: 'AUS 2-0 TUR (clean sheet)', tier: 'elite' },
  { name: 'César Montes', nationCode: 'MEX', position: 'CB', pulseScore: 82, trend: 'rising', matchInfo: 'MEX 2-0 RSA (clean sheet)', tier: 'elite' },
  { name: 'Andrew Robertson', nationCode: 'SCO', position: 'LB', pulseScore: 83, trend: 'rising', matchInfo: 'SCO 1-0 HAI (clean sheet)', tier: 'elite' },
  { name: 'Jamal Musiala', nationCode: 'GER', position: 'CM', pulseScore: 93, trend: 'rising', matchInfo: "GER 7-1 CUW (Musiala 47')", tier: 'elite' },
  { name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', pulseScore: 90, trend: 'rising', matchInfo: "ENG 4-2 CRO (Bellingham 47')", tier: 'elite' },
  { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 89, trend: 'rising', matchInfo: 'GER 7-1 CUW', tier: 'elite' },
  { name: 'Lionel Messi', nationCode: 'ARG', position: 'RW', pulseScore: 95, trend: 'rising', matchInfo: "ARG 3-0 ALG (Messi 17', 60', 76' — hat-trick)", tier: 'elite' },
  { name: 'Vinícius Júnior', nationCode: 'BRA', position: 'LW', pulseScore: 88, trend: 'rising', matchInfo: "BRA 1-1 MAR (Vinícius 32')", tier: 'elite' },
  { name: 'Alexander Isak', nationCode: 'SWE', position: 'ST', pulseScore: 91, trend: 'rising', matchInfo: "SWE 5-1 TUN (Isak 30')", tier: 'elite' },
]

const GROUP_STAGE_CRISIS: GroupStageEntry[] = [
  { name: 'Eloy Room', nationCode: 'CUW', position: 'GK', pulseScore: 16, trend: 'falling', matchInfo: 'CUW 1-7 GER (7 conceded)', tier: 'crisis' },
  { name: 'Leandro Bacuna', nationCode: 'CUW', position: 'RB', pulseScore: 18, trend: 'falling', matchInfo: 'CUW 1-7 GER', tier: 'crisis' },
  { name: 'Dylan Bronn', nationCode: 'TUN', position: 'CB', pulseScore: 20, trend: 'falling', matchInfo: 'TUN 1-5 SWE', tier: 'crisis' },
  { name: 'Gustavo Gómez', nationCode: 'PAR', position: 'CB', pulseScore: 24, trend: 'falling', matchInfo: 'PAR 1-4 USA', tier: 'crisis' },
  { name: 'Junior Alonso', nationCode: 'PAR', position: 'LB', pulseScore: 26, trend: 'falling', matchInfo: 'PAR 1-4 USA', tier: 'crisis' },
  { name: 'Hannibal Mejbri', nationCode: 'TUN', position: 'CM', pulseScore: 28, trend: 'falling', matchInfo: 'TUN 1-5 SWE', tier: 'crisis' },
  { name: 'Ao Tanaka', nationCode: 'JPN', position: 'CM', pulseScore: 32, trend: 'falling', matchInfo: 'JPN 2-2 NED (2-goal lead squandered)', tier: 'crisis' },
  { name: 'Miguel Almirón', nationCode: 'PAR', position: 'CAM', pulseScore: 30, trend: 'falling', matchInfo: 'PAR 1-4 USA', tier: 'crisis' },
  { name: 'Luiz Henrique', nationCode: 'BRA', position: 'LW', pulseScore: 28, trend: 'falling', matchInfo: 'BRA 1-1 MAR (held to draw)', tier: 'crisis' },
  { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 30, trend: 'falling', matchInfo: 'ESP 0-0 CPV (held scoreless)', tier: 'crisis' },
  { name: 'Wout Weghorst', nationCode: 'NED', position: 'ST', pulseScore: 26, trend: 'falling', matchInfo: 'NED 2-2 JPN (2-goal lead squandered)', tier: 'crisis' },
]

// ── Merged player record ─────────────────────────────────────────────────────

type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD'
function posGroup(p: { position: string }): PosGroup {
  if (p.position === 'GK') return 'GK'
  if (['CB', 'LB', 'RB'].includes(p.position)) return 'DEF'
  if (['CM', 'CAM', 'CDM'].includes(p.position)) return 'MID'
  return 'FWD' // LW, RW, ST, CF
}

/**
 * A player merged across all stages where they appeared.
 *
 * `eliteScore` aggregates their hero performances (group-stage Elite pulse +
 * R32 advanced-team buzz). `crisisScore` aggregates their villain performances
 * (group-stage Crisis pulse + R32 eliminated-team buzz). A player can appear in
 * BOTH lists (e.g. Weghorst was a Crisis pick in the group stage AND his team
 * was eliminated in R32) — the two scores are tracked independently so the same
 * verified player can anchor either XI.
 */
interface MergedPlayer {
  name: string
  nationCode: string
  position: GroupStageEntry['position']
  /** Hero-path composite score, or null if the player never appeared as a hero. */
  eliteScore: number | null
  /** Villain-path composite score, or null if the player never appeared as a villain. */
  crisisScore: number | null
  /** Best hero fact (for Elite XI matchInfo). */
  eliteMatchInfo: string | null
  /** Worst villain fact (for Crisis XI matchInfo). */
  crisisMatchInfo: string | null
  /** Most recent trend across stages. */
  trend: Trend
}

// Trend bonus: rising = 80, stable = 50, falling = 20.
function trendBonus(trend: Trend): number {
  if (trend === 'rising') return 80
  if (trend === 'stable') return 50
  return 20
}

/**
 * Merge the group-stage pools and the R32 VERIFIED_POOL into one list of
 * MergedPlayer records, keyed by player name.
 *
 * Scoring (per the spec):
 *   tournamentScore = (groupPulse × 0.4) + (r32Buzz × 0.4) + (trendBonus × 0.2)
 *
 * A player who only appeared in one stage gets a neutral 50 for the missing
 * stage's component, so their composite is still comparable. The `tier` of each
 * appearance (elite vs crisis) routes the score into `eliteScore` or
 * `crisisScore` — a player can have both.
 */
function mergeAllPlayers(): Map<string, MergedPlayer> {
  const map = new Map<string, MergedPlayer>()

  const ensure = (name: string, nationCode: string, position: GroupStageEntry['position'], trend: Trend): MergedPlayer => {
    let p = map.get(name)
    if (!p) {
      p = {
        name, nationCode, position,
        eliteScore: null, crisisScore: null,
        eliteMatchInfo: null, crisisMatchInfo: null,
        trend,
      }
      map.set(name, p)
    }
    return p
  }

  // ── Group-stage Elite appearances → eliteScore ──
  for (const g of GROUP_STAGE_ELITE) {
    const p = ensure(g.name, g.nationCode, g.position, g.trend)
    // R32 buzz defaults to 50 (neutral) unless this player also has an R32 record.
    const r32Buzz = 50
    const score = Math.round(g.pulseScore * 0.4 + r32Buzz * 0.4 + trendBonus(g.trend) * 0.2)
    p.eliteScore = score
    p.eliteMatchInfo = g.matchInfo
    p.trend = g.trend
  }

  // ── Group-stage Crisis appearances → crisisScore ──
  for (const g of GROUP_STAGE_CRISIS) {
    const p = ensure(g.name, g.nationCode, g.position, g.trend)
    const r32Buzz = 50
    const score = Math.round(g.pulseScore * 0.4 + r32Buzz * 0.4 + trendBonus(g.trend) * 0.2)
    p.crisisScore = score
    p.crisisMatchInfo = g.matchInfo
    p.trend = g.trend
  }

  // ── R32 VERIFIED_POOL appearances ──
  // Advanced-team players feed eliteScore; eliminated-team players feed crisisScore.
  // Group-stage pulse defaults to 50 (neutral) unless this player also has a
  // group-stage record (handled by reading the existing merged entry).
  for (const r of VERIFIED_POOL) {
    const position = r.position as GroupStageEntry['position']
    // Derive an R32 trend: advancing teams trend up, eliminated teams trend down.
    const r32Trend: Trend = r.teamStatus === 'advanced' ? 'rising' : 'falling'
    const p = ensure(r.name, r.nationCode, position, r32Trend)

    if (r.teamStatus === 'advanced') {
      // Group pulse: use the existing elite group-stage pulse if present, else 50.
      const groupEntry = GROUP_STAGE_ELITE.find(g => g.name === r.name)
      const groupPulse = groupEntry ? groupEntry.pulseScore : 50
      const score = Math.round(groupPulse * 0.4 + r.baselineBuzz * 0.4 + trendBonus(r32Trend) * 0.2)
      // If the player already has an eliteScore from the group stage, prefer the
      // HIGHER of the two (their best tournament moment). Update matchInfo to
      // the R32 fact if it's more decisive (R32 facts cite the knockout result).
      if (p.eliteScore === null || score > p.eliteScore) {
        p.eliteScore = score
      }
      if (!p.eliteMatchInfo) p.eliteMatchInfo = r.r32Fact
      else if (r.r32Fact && !p.eliteMatchInfo.includes('R32')) p.eliteMatchInfo = r.r32Fact
    } else if (r.teamStatus === 'eliminated') {
      const groupEntry = GROUP_STAGE_CRISIS.find(g => g.name === r.name)
      const groupPulse = groupEntry ? groupEntry.pulseScore : 50
      const score = Math.round(groupPulse * 0.4 + r.baselineBuzz * 0.4 + trendBonus(r32Trend) * 0.2)
      // For crisis, prefer the LOWER score (their worst tournament moment).
      if (p.crisisScore === null || score < p.crisisScore) {
        p.crisisScore = score
      }
      if (!p.crisisMatchInfo) p.crisisMatchInfo = r.r32Fact
      else if (r.r32Fact && r.r32Fact.includes('ELIMINATED')) p.crisisMatchInfo = r.r32Fact
    }
    // 'upcoming' R32 teamStatus is ignored — those players have no result yet.
  }

  return map
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface RetroPick {
  /** Stable id derived from name + position group. */
  id: string
  name: string
  nationCode: string
  position: string
  /** App-internal composite 0-100. NOT a verified statistic. */
  tournamentScore: number
  /** Verified match fact (copied verbatim from the source pool). */
  matchInfo: string | null
  trend: Trend
}

export interface RetroSide {
  formation: string
  players: RetroPick[]
}

export interface TournamentRetroResult {
  elite: RetroSide
  crisis: RetroSide
  generatedAt: string
}

// ── Formation slot config (4-3-3) ────────────────────────────────────────────
const FORMATION = '4-3-3'
const SLOTS: { group: PosGroup; count: number }[] = [
  { group: 'GK', count: 1 },
  { group: 'DEF', count: 4 },
  { group: 'MID', count: 3 },
  { group: 'FWD', count: 3 },
]
const XI_SIZE = SLOTS.reduce((n, s) => n + s.count, 0) // 11

/**
 * Pick an XI (4-3-3) from a candidate pool.
 *
 * @param candidates  players with a non-null score for this side
 * @param descending  true for Elite (highest score first), false for Crisis (lowest first)
 *
 * ANTI-HALLUCINATION: if a position group is short, we fill from the next-best
 * available verified player. If the entire pool is exhausted, the slot is
 * returned as a null placeholder (name: 'N/A') — we never fabricate.
 */
function pickXI(
  candidates: MergedPlayer[],
  scoreOf: (p: MergedPlayer) => number | null,
  descending: boolean,
): RetroPick[] {
  // Filter to players that actually have a score for this side, then sort.
  const eligible = candidates
    .filter(p => scoreOf(p) !== null)
    .sort((a, b) => {
      const sa = scoreOf(a)!
      const sb = scoreOf(b)!
      return descending ? sb - sa : sa - sb
    })

  const used = new Set<string>()
  const picks: (MergedPlayer | null)[] = []

  // Pass 1: fill each position-group slot from players of that group.
  for (const slot of SLOTS) {
    let filled = 0
    for (const p of eligible) {
      if (filled >= slot.count) break
      if (used.has(p.name)) continue
      if (posGroup(p) === slot.group) {
        picks.push(p)
        used.add(p.name)
        filled++
      }
    }
    // Pad with nulls if this group was under-filled.
    while (filled < slot.count) {
      picks.push(null)
      filled++
    }
  }

  // Pass 2: replace any null placeholders with the next-best unused verified
  // player (regardless of position group) so the XI fills 11 real names.
  for (let i = 0; i < picks.length; i++) {
    if (picks[i] !== null) continue
    const next = eligible.find(p => !used.has(p.name))
    if (next) {
      picks[i] = next
      used.add(next.name)
    }
    // If no unused player remains, the slot stays null → 'N/A'.
  }

  // Map to RetroPick, assigning an order within the formation.
  return picks.map((p, i) => {
    const slotIndex = i
    const group = SLOTS.reduce<{ group: PosGroup; count: number } | null>((acc, s) => {
      if (acc) return acc
      return s
    }, null)
    void group // (slot metadata derived from index instead)
    if (!p) {
      return {
        id: `na-${slotIndex}`,
        name: 'N/A',
        nationCode: '',
        position: '',
        tournamentScore: 0,
        matchInfo: null,
        trend: 'stable' as Trend,
      }
    }
    const score = scoreOf(p)!
    const matchInfo = descending ? p.eliteMatchInfo : p.crisisMatchInfo
    return {
      id: `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slotIndex}`,
      name: p.name,
      nationCode: p.nationCode,
      position: p.position,
      tournamentScore: score,
      matchInfo,
      trend: p.trend,
    }
  })
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Compute the Team of the Tournament Retro (Elite XI + Crisis XI).
 *
 * Pure function — no DB, no SDK. The result is deterministic for a given
 * VERIFIED_POOL + group-stage pool, so the API route caches it for 1 hour.
 */
export function computeTournamentRetro(): TournamentRetroResult {
  const merged = mergeAllPlayers()
  const all = Array.from(merged.values())

  const elite = pickXI(all, p => p.eliteScore, true)
  const crisis = pickXI(all, p => p.crisisScore, false)

  return {
    elite: { formation: FORMATION, players: elite },
    crisis: { formation: FORMATION, players: crisis },
    generatedAt: new Date().toISOString(),
  }
}

// ── Anti-hallucination self-check (exported for tests / dev scripts) ─────────

/**
 * Returns the set of every player name that is eligible to appear in the retro.
 * Used by the API route's self-check to guarantee no fabricated name slipped in.
 */
export function getAllVerifiedNames(): Set<string> {
  const names = new Set<string>()
  for (const g of GROUP_STAGE_ELITE) names.add(g.name)
  for (const g of GROUP_STAGE_CRISIS) names.add(g.name)
  for (const r of VERIFIED_POOL) names.add(r.name)
  return names
}
