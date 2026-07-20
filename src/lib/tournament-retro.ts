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

// ── Knockout heroes (QF / SF / 3rd / Final) — VERIFIED via Tier-1 sources ────
// These are players who produced decisive hero (or villain) performances in
// the knockout rounds. Each entry's WC 2026 squad participation AND knockout
// match outcome was verified against Tier-1 sources (Sofascore, ESPN, FIFA.com,
// BBC, Guardian, NYT Athletic, DAZN, Yahoo Sports, NBC Sports) on 2026-07-20.
//
// ANTI-HALLUCINATION: every player here was in their nation's WC 2026 squad.
// Players who retired before the tournament (Di María, Griezmann, Carvajal)
// or were left out by their coach (Walker, Shaw, Foden) are NOT in this list.
// See /home/z/my-project/research/synthesis-report.md for the full discrepancy
// table and verification trail.

interface KnockoutHeroEntry {
  name: string
  nationCode: string
  position: GroupStageEntry['position']
  /** App-internal composite pulse (0-100) reflecting knockout-stage heroism. */
  pulseScore: number
  trend: Trend
  /** Verified knockout-stage match fact (copied from the research reports). */
  matchInfo: string
  /** 'elite' = hero performance, 'crisis' = villain performance */
  tier: 'elite' | 'crisis'
}

const KNOCKOUT_HEROES: KnockoutHeroEntry[] = [
  // ── Spain champions — Elite picks (QF/SF/Final) ──────────────────────────
  { name: 'Unai Simón', nationCode: 'ESP', position: 'GK', pulseScore: 99, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — Golden Glove, record 7 clean sheets, only 1 conceded all tournament, CHAMPIONS!)', tier: 'elite' },
  { name: 'Pedro Porro', nationCode: 'ESP', position: 'RB', pulseScore: 95, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — scored + clean sheet, into the Final) + ESP 1-0 ARG (FINAL — owned the right side, CHAMPIONS!)', tier: 'elite' },
  { name: 'Pau Cubarsí', nationCode: 'ESP', position: 'CB', pulseScore: 97, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — FIFA Best Young Player, defensive rock, CHAMPIONS!)', tier: 'elite' },
  { name: 'Aymeric Laporte', nationCode: 'ESP', position: 'CB', pulseScore: 96, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — only 1 goal conceded all tournament, CHAMPIONS!)', tier: 'elite' },
  { name: 'Marc Cucurella', nationCode: 'ESP', position: 'LB', pulseScore: 94, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — defensive solidity, CHAMPIONS!)', tier: 'elite' },
  { name: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 99, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — FIFA Golden Ball winner, midfield masterclass, CHAMPIONS!)', tier: 'elite' },
  { name: 'Fabián Ruiz', nationCode: 'ESP', position: 'CM', pulseScore: 94, trend: 'rising', matchInfo: 'ESP 2-1 BEL (QF — Fabián 30\' opener) + ESP 1-0 ARG (FINAL — controlled tempo, CHAMPIONS!)', tier: 'elite' },
  { name: 'Dani Olmo', nationCode: 'ESP', position: 'CAM', pulseScore: 93, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — playmaker, CHAMPIONS!)', tier: 'elite' },
  { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 98, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — terrorized France) + ESP 1-0 ARG (FINAL — terrorized Argentina, CHAMPIONS!)', tier: 'elite' },
  { name: 'Mikel Oyarzabal', nationCode: 'ESP', position: 'LW', pulseScore: 95, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — Oyarzabal opener, into the Final)', tier: 'elite' },
  { name: 'Ferran Torres', nationCode: 'ESP', position: 'ST', pulseScore: 99, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — Ferran Torres 106\' AET WINNER, super-sub, CHAMPIONS!)', tier: 'elite' },
  { name: 'Mikel Merino', nationCode: 'ESP', position: 'CM', pulseScore: 92, trend: 'rising', matchInfo: 'ESP 2-1 BEL (QF — Merino 88\' winner) + POR 0-1 ESP (R16 — injury-time winner)', tier: 'elite' },

  // ── Argentina runner-up — Elite picks (SF) + Crisis picks (Final) ────────
  { name: 'Emiliano Martínez', nationCode: 'ARG', position: 'GK', pulseScore: 95, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — 11-save MOTM, Sofascore 9.6, all-time WC Final save record, runner-up)', tier: 'elite' },
  { name: 'Lionel Messi', nationCode: 'ARG', position: 'CAM', pulseScore: 92, trend: 'rising', matchInfo: 'ARG 3-0 ALG (group — hat-trick 17\', 60\', 76\', equalled all-time WC scoring record)', tier: 'elite' },
  { name: 'Enzo Fernández', nationCode: 'ARG', position: 'CM', pulseScore: 88, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — Enzo 85\' equalizer, into the Final)', tier: 'elite' },
  { name: 'Lautaro Martínez', nationCode: 'ARG', position: 'ST', pulseScore: 93, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — Lautaro 90+2\' winner off bench, into the Final) + ARG 3-1 SUI (QF — Lautaro 120+1\' AET)', tier: 'elite' },
  { name: 'Alexis Mac Allister', nationCode: 'ARG', position: 'CM', pulseScore: 86, trend: 'rising', matchInfo: 'ARG 3-1 SUI (QF — Mac Allister 10\' opener)', tier: 'elite' },
  { name: 'Julián Álvarez', nationCode: 'ARG', position: 'ST', pulseScore: 87, trend: 'rising', matchInfo: 'ARG 3-1 SUI (QF — Álvarez 112\' AET screamer)', tier: 'elite' },

  // ── England 3rd place — Elite picks ──────────────────────────────────────
  { name: 'Bukayo Saka', nationCode: 'ENG', position: 'RW', pulseScore: 97, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — HAT-TRICK 37\', 45+1\', 87\' pen, 3rd-place medal)', tier: 'elite' },
  { name: 'Jude Bellingham', nationCode: 'ENG', position: 'CAM', pulseScore: 92, trend: 'rising', matchInfo: 'NOR 1-2 ENG (QF — Bellingham brace incl. 3\' ET winner) + ENG 6-4 FRA (3rd — 98\' sealer as sub, 3rd-place medal)', tier: 'elite' },
  { name: 'Anthony Gordon', nationCode: 'ENG', position: 'LW', pulseScore: 84, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — Gordon scored England\'s lone goal)', tier: 'elite' },

  // ── France 4th place — Elite (Mbappé record) + Crisis (Maignan 6 conceded) ──
  { name: 'Kylian Mbappé', nationCode: 'FRA', position: 'ST', pulseScore: 98, trend: 'rising', matchInfo: 'WC 2026 Golden Boot (10 goals) + broke all-time WC scoring record (22 goals, surpassing Messi 21 + Klose 16), despite France finishing 4th', tier: 'elite' },
  { name: 'Michael Olise', nationCode: 'FRA', position: 'CAM', pulseScore: 86, trend: 'rising', matchInfo: 'FRA 0-2 ESP (SF — France\'s creative hub) + ENG 6-4 FRA (3rd — scored but France lost)', tier: 'elite' },
  { name: 'Ousmane Dembélé', nationCode: 'FRA', position: 'LW', pulseScore: 84, trend: 'rising', matchInfo: 'FRA 2-0 MAR (QF — Dembélé 66\' clincher) + ENG 6-4 FRA (3rd — 90+6\' goal made it 5-4 but France still lost)', tier: 'elite' },

  // ── Morocco R16 hero ─────────────────────────────────────────────────────
  // (Achraf Hakimi already in group-stage Elite + R32 pool — no need to duplicate)

  // ── Norway R16 shock ─────────────────────────────────────────────────────
  { name: 'Erling Haaland', nationCode: 'NOR', position: 'ST', pulseScore: 93, trend: 'rising', matchInfo: 'NOR 2-1 BRA (R16 — Haaland brace, eliminated Brazil)', tier: 'elite' },
  { name: 'Martin Ødegaard', nationCode: 'NOR', position: 'CAM', pulseScore: 88, trend: 'rising', matchInfo: 'NOR 2-1 BRA (R16 — orchestrated the upset of the tournament)', tier: 'elite' },

  // ── Cape Verde Cinderella ────────────────────────────────────────────────
  { name: 'Vozinha', nationCode: 'CPV', position: 'GK', pulseScore: 88, trend: 'rising', matchInfo: 'B/R Football writers\' 2026 World Cup Best XI GK — Cape Verde\'s Cinderella run to R16', tier: 'elite' },

  // ── Crisis picks (knockout-stage villains) ───────────────────────────────
  { name: 'Enzo Fernández', nationCode: 'ARG', position: 'CM', pulseScore: 35, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — RED CARD 93\', left Argentina with 10 men, runner-up)', tier: 'crisis' },
  { name: 'Nico González', nationCode: 'ARG', position: 'LW', pulseScore: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — anonymous, subbed off, runner-up)', tier: 'crisis' },
  { name: 'Mike Maignan', nationCode: 'FRA', position: 'GK', pulseScore: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish) + FRA 0-2 ESP (SF — 2 conceded, eliminated)', tier: 'crisis' },
  { name: 'John Stones', nationCode: 'ENG', position: 'CB', pulseScore: 38, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — conceded 2 late goals, eliminated from Final)', tier: 'crisis' },
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

  // ── KNOCKOUT_HEROES appearances ──
  // These are verified QF/SF/3rd/Final hero/villain performances. The pulseScore
  // here is app-internal (0-100) and reflects the knockout-stage moment only — it
  // is combined with the existing group/R32 score (if any) using the same
  // best-moment routing: Elite keeps the HIGHER score, Crisis keeps the LOWER.
  for (const k of KNOCKOUT_HEROES) {
    const p = ensure(k.name, k.nationCode, k.position, k.trend)
    // Knockout buzz: high for heroes (esp. Final winners), low for villains.
    // Use the entry's pulseScore directly as the "buzz" component.
    const knockoutBuzz = k.pulseScore
    // Group-stage pulse: use the SAME-TIER group-stage pulse if present, else 50.
    // (Don't cross-contaminate — e.g. Lamine Yamal was a Crisis pick in the group
    // stage but an Elite hero in the knockouts; his eliteScore should NOT inherit
    // his group-stage crisis pulse of 30.)
    const groupEliteEntry = GROUP_STAGE_ELITE.find(g => g.name === k.name)
    const groupCrisisEntry = GROUP_STAGE_CRISIS.find(g => g.name === k.name)
    const r32Entry = VERIFIED_POOL.find(r => r.name === k.name)
    let groupPulse: number
    if (k.tier === 'elite') {
      groupPulse = groupEliteEntry?.pulseScore ?? (r32Entry && r32Entry.teamStatus === 'advanced' ? 50 : 50)
    } else {
      groupPulse = groupCrisisEntry?.pulseScore ?? (r32Entry && r32Entry.teamStatus === 'eliminated' ? 50 : 50)
    }
    const score = Math.round(groupPulse * 0.4 + knockoutBuzz * 0.4 + trendBonus(k.trend) * 0.2)

    if (k.tier === 'elite') {
      // Hero: keep the HIGHER score (their best tournament moment).
      if (p.eliteScore === null || score > p.eliteScore) {
        p.eliteScore = score
      }
      // Prefer the knockout matchInfo (more decisive) — but only overwrite if the
      // existing one doesn't already cite the Final/SF.
      if (!p.eliteMatchInfo) p.eliteMatchInfo = k.matchInfo
      else if (!p.eliteMatchInfo.includes('FINAL') && !p.eliteMatchInfo.includes('SF') && !p.eliteMatchInfo.includes('3rd')) {
        p.eliteMatchInfo = k.matchInfo
      }
      p.trend = k.trend
    } else {
      // Crisis: keep the LOWER score (their worst tournament moment).
      if (p.crisisScore === null || score < p.crisisScore) {
        p.crisisScore = score
      }
      if (!p.crisisMatchInfo) p.crisisMatchInfo = k.matchInfo
      else if (!p.crisisMatchInfo.includes('FINAL') && !p.crisisMatchInfo.includes('SF') && !p.crisisMatchInfo.includes('3rd')) {
        p.crisisMatchInfo = k.matchInfo
      }
      p.trend = k.trend
    }
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
  for (const k of KNOCKOUT_HEROES) names.add(k.name)
  return names
}
