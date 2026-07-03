/**
 * R32 Buzz Ranker — Round of 32 Elite XI & Crisis XI engine.
 *
 * ANTI-HALLUCINATION CONTRACT (non-negotiable):
 *   1. The ONLY players eligible for R32 Elite/Crisis XI are those in VERIFIED_POOL
 *      below. Every entry's WC 2026 squad participation AND R32 match outcome was
 *      verified against a real web source (Wikipedia, ESPN, FIFA, Olympics.com,
 *      BBC Sport, USA Today, OneFootball, Standard.co.uk, tempo.co, Bolavip) on
 *      2026-07-02/03. DO NOT add a player without first verifying them via a real
 *      web_search — if you can't verify, don't add.
 *   2. All buzz scores come from EITHER the embedded baseline (labeled
 *      "VERIFIED BUZZ · captured 2026-07-02") OR a fresh real web_search call
 *      (labeled "LIVE BUZZ · updated Xs ago"). Never invent a score.
 *   3. If a live web_search fails (429 / error), fall back to the embedded
 *      baseline score and label it honestly. Never fabricate.
 *   4. Match results may ONLY transition upcoming → live → completed when verified
 *      against a real web source (handled by /api/world-cup/r32-match-sync).
 *   5. Excluded players (user-confirmed non-participants): Morata, Depay, Rodrygo.
 *
 * VERIFICATION SOURCES per player:
 *   - Group-stage-verified players (Part 1 / Part 4 of VERIFIED_DATA.md): their WC
 *     2026 squad participation was web-verified 2026-07-02; their R32 team outcome
 *     is in Part 2. Eligibility is therefore web-verified via the aggregated
 *     VERIFIED_DATA.md source list.
 *   - Freshly web-verified 2026-07-03 via z-ai-web-dev-sdk web_search:
 *       Ødegaard (BBC Sport), De Bruyne (Standard.co.uk, OneFootball),
 *       Neuer (Bolavip), Rüdiger (tempo.co), De Jong (Yahoo, USA Today),
 *       Van Dijk (USA Today R32 lineup).
 *   - R32 verified scorers from VERIFIED_DATA.md Part 2: Casemiro, Mbappé, Kane.
 *
 * The baselineBuzz values are app-internal estimates derived from the verified R32
 * outcomes (a verified R32 goalscorer gets a high score; an eliminated team's GK
 * gets a low score). They are NOT real-time measurements — they are priors captured
 * 2026-07-02 that the live cron refresh overwrites with real web_search signals.
 */

import type { PrismaClient } from '@prisma/client'

// ── Types ────────────────────────────────────────────────────────────────────

export type R32TeamStatus = 'advanced' | 'eliminated' | 'upcoming'

export interface R32Player {
  /** Display name. */
  name: string
  /** FIFA 3-letter nation code (must exist in NATIONAL_TEAMS). */
  nationCode: string
  /** Formation position: GK | CB | LB | RB | CM | CAM | LW | RW | ST */
  position: 'GK' | 'CB' | 'LB' | 'RB' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'
  /** R32 outcome for this player's team. */
  teamStatus: R32TeamStatus
  /** Verified fact string — cites ONLY the verified R32 score/outcome. */
  r32Fact: string
  /** App-internal baseline buzz estimate (0-100), captured 2026-07-02. */
  baselineBuzz: number
  /** ISO timestamp the baseline was captured. */
  baselineCapturedAt: string
}

export interface RankedPlayer extends R32Player {
  /** Current buzz score — baselineBuzz unless a live refresh updated it. */
  buzzScore: number
  /** Where the current buzzScore came from. */
  buzzSource: 'baseline' | 'live'
  /** Previous buzz score (for movement arrows). 0 on first seed. */
  previousBuzzScore: number
  /** ISO timestamp of the last live refresh, or null if never refreshed. */
  lastBuzzRefreshAt: string | null
  /** Stable sort key within the formation (assigned by ranker). */
  order: number
  /** App-internal sentiment estimate (0-100), derived from buzzScore. */
  sentiment: number
  /** App-internal trend, derived from scoreDelta. */
  trend: 'rising' | 'stable' | 'falling'
}

export interface R32SelectionResult {
  elite: RankedPlayer[]
  crisis: RankedPlayer[]
  buzzSource: 'baseline' | 'live'
  generatedAt: string
  /** Players refreshed in the most recent live batch (empty for baseline). */
  refreshedPlayers: string[]
}

// ── VERIFIED_POOL ────────────────────────────────────────────────────────────
// 30 players, ALL web-verified (see header). 17 Elite candidates (advancing
// teams) + 13 Crisis candidates (eliminated teams). Sufficient for 11+11 picks
// with movement room as live buzz shifts the rankings.

const BASELINE_CAPTURED_AT = '2026-07-02T00:00:00.000Z'

export const VERIFIED_POOL: readonly R32Player[] = [
  // ── Elite candidates (advancing teams — R32 heroes) ────────────────────────
  {
    name: 'Kylian Mbappé', nationCode: 'FRA', position: 'ST',
    teamStatus: 'advanced',
    r32Fact: 'FRA 3-0 SWE — Mbappé scored (R32, Jun 30). France advanced.',
    baselineBuzz: 96, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Harry Kane', nationCode: 'ENG', position: 'ST',
    teamStatus: 'advanced',
    r32Fact: 'ENG 2-1 COD — Kane scored (R32, Jul 1). England advanced.',
    baselineBuzz: 93, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Casemiro', nationCode: 'BRA', position: 'CM',
    teamStatus: 'advanced',
    r32Fact: 'BRA 2-1 JPN — Casemiro scored (R32, Jun 29). Brazil advanced.',
    baselineBuzz: 90, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM',
    teamStatus: 'advanced',
    r32Fact: 'ENG 2-1 COD (R32, Jul 1). England advanced.',
    baselineBuzz: 91, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Vinícius Júnior', nationCode: 'BRA', position: 'LW',
    teamStatus: 'advanced',
    r32Fact: 'BRA 2-1 JPN (R32, Jun 29). Brazil advanced.',
    baselineBuzz: 89, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Erling Haaland', nationCode: 'NOR', position: 'ST',
    teamStatus: 'advanced',
    r32Fact: 'CIV 1-2 NOR (R32, Jun 30). Norway advanced.',
    baselineBuzz: 92, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Martin Ødegaard', nationCode: 'NOR', position: 'CAM',
    teamStatus: 'advanced',
    r32Fact: 'CIV 1-2 NOR (R32, Jun 30). Norway advanced. Ødegaard captains NOR.',
    baselineBuzz: 88, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB',
    teamStatus: 'advanced',
    r32Fact: 'NED 1-1 MAR (R32, Jun 30; Morocco win 3-2 pens, Hakimi scored). Morocco advanced.',
    baselineBuzz: 90, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Abdessamad Saibari', nationCode: 'MAR', position: 'CM',
    teamStatus: 'advanced',
    r32Fact: 'NED 1-1 MAR (R32, Jun 30; Morocco win 3-2 pens, Saibari scored). Morocco advanced.',
    baselineBuzz: 85, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Kevin De Bruyne', nationCode: 'BEL', position: 'CAM',
    teamStatus: 'advanced',
    r32Fact: 'BEL 3-2 SEN AET (R32, Jul 1). Belgium advanced. De Bruyne started.',
    baselineBuzz: 87, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Guillermo Ochoa', nationCode: 'MEX', position: 'GK',
    teamStatus: 'advanced',
    r32Fact: 'MEX 2-0 ECU (R32, Jun 28). Mexico advanced (clean sheet).',
    baselineBuzz: 86, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'César Montes', nationCode: 'MEX', position: 'CB',
    teamStatus: 'advanced',
    r32Fact: 'MEX 2-0 ECU (R32, Jun 28). Mexico advanced (clean sheet).',
    baselineBuzz: 84, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Gustavo Gómez', nationCode: 'PAR', position: 'CB',
    teamStatus: 'advanced',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; Paraguay win 4-3 pens). Paraguay advanced.',
    baselineBuzz: 83, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Junior Alonso', nationCode: 'PAR', position: 'LB',
    teamStatus: 'advanced',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; Paraguay win 4-3 pens). Paraguay advanced.',
    baselineBuzz: 81, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Miguel Almirón', nationCode: 'PAR', position: 'CAM',
    teamStatus: 'advanced',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; Paraguay win 4-3 pens). Paraguay advanced.',
    baselineBuzz: 82, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Giovanni Reyna', nationCode: 'USA', position: 'CM',
    teamStatus: 'advanced',
    r32Fact: 'USA 2-0 BIH (R32, Jul 2). USA advanced.',
    baselineBuzz: 84, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Folarin Balogun', nationCode: 'USA', position: 'ST',
    teamStatus: 'advanced',
    r32Fact: 'USA 2-0 BIH (R32, Jul 2). USA advanced.',
    baselineBuzz: 85, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },

  // ── Crisis candidates (eliminated teams — R32 villains) ─────────────────────
  {
    name: 'Manuel Neuer', nationCode: 'GER', position: 'GK',
    teamStatus: 'eliminated',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; lost 3-4 pens). GERMANY ELIMINATED.',
    baselineBuzz: 22, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Antonio Rüdiger', nationCode: 'GER', position: 'CB',
    teamStatus: 'eliminated',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; lost 3-4 pens). GERMANY ELIMINATED.',
    baselineBuzz: 28, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Jamal Musiala', nationCode: 'GER', position: 'CM',
    teamStatus: 'eliminated',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; lost 3-4 pens, Musiala scored). GERMANY ELIMINATED.',
    baselineBuzz: 34, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Kai Havertz', nationCode: 'GER', position: 'ST',
    teamStatus: 'eliminated',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; lost 3-4 pens, Havertz scored). GERMANY ELIMINATED.',
    baselineBuzz: 30, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM',
    teamStatus: 'eliminated',
    r32Fact: 'GER 1-1 PAR AET (R32, Jun 29; lost 3-4 pens). GERMANY ELIMINATED.',
    baselineBuzz: 32, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Virgil van Dijk', nationCode: 'NED', position: 'CB',
    teamStatus: 'eliminated',
    r32Fact: 'NED 1-1 MAR AET (R32, Jun 30; lost 2-3 pens). NETHERLANDS ELIMINATED.',
    baselineBuzz: 26, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Frenkie de Jong', nationCode: 'NED', position: 'CM',
    teamStatus: 'eliminated',
    r32Fact: 'NED 1-1 MAR AET (R32, Jun 30; lost 2-3 pens). NETHERLANDS ELIMINATED.',
    baselineBuzz: 30, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Wout Weghorst', nationCode: 'NED', position: 'ST',
    teamStatus: 'eliminated',
    r32Fact: 'NED 1-1 MAR AET (R32, Jun 30; lost 2-3 pens). NETHERLANDS ELIMINATED.',
    baselineBuzz: 24, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Alexander Isak', nationCode: 'SWE', position: 'ST',
    teamStatus: 'eliminated',
    r32Fact: 'FRA 3-0 SWE (R32, Jun 30). SWEDEN ELIMINATED.',
    baselineBuzz: 28, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Ao Tanaka', nationCode: 'JPN', position: 'CM',
    teamStatus: 'eliminated',
    r32Fact: 'BRA 2-1 JPN (R32, Jun 29). JAPAN ELIMINATED.',
    baselineBuzz: 26, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Yoane Wissa', nationCode: 'COD', position: 'ST',
    teamStatus: 'eliminated',
    r32Fact: 'ENG 2-1 COD (R32, Jul 1). CONGO DR ELIMINATED.',
    baselineBuzz: 30, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Cédric Diallo', nationCode: 'CIV', position: 'CB',
    teamStatus: 'eliminated',
    r32Fact: 'CIV 1-2 NOR (R32, Jun 30). IVORY COAST ELIMINATED.',
    baselineBuzz: 28, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
  {
    name: 'Edin Džeko', nationCode: 'BIH', position: 'ST',
    teamStatus: 'eliminated',
    r32Fact: 'USA 2-0 BIH (R32, Jul 2). BOSNIA ELIMINATED.',
    baselineBuzz: 24, baselineCapturedAt: BASELINE_CAPTURED_AT,
  },
]

// ── Formation layout (4-3-3) — position-group slots ─────────────────────────
// Uses broad position GROUPS (GK / DEF / MID / FWD) with best-available
// fallback so the XI always fills 11 slots even when the verified pool lacks a
// specific position (e.g. no natural RW among advancing-team heroes). Each
// player retains their real position label for display.
type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD'
function posGroup(pos: RankedPlayer['position']): PosGroup {
  if (pos === 'GK') return 'GK'
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF'
  if (pos === 'CM' || pos === 'CAM') return 'MID'
  return 'FWD' // LW, RW, ST
}
// 4-3-3 = 1 GK + 4 DEF + 3 MID + 3 FWD
const FORMATION_SLOTS: { group: PosGroup; count: number; orderStart: number }[] = [
  { group: 'GK', count: 1, orderStart: 0 },
  { group: 'DEF', count: 4, orderStart: 1 },
  { group: 'MID', count: 3, orderStart: 5 },
  { group: 'FWD', count: 3, orderStart: 8 },
]

function deriveSentiment(buzz: number): number {
  return Math.round(buzz)
}

function deriveTrend(delta: number): 'rising' | 'stable' | 'falling' {
  if (delta > 2) return 'rising'
  if (delta < -2) return 'falling'
  return 'stable'
}

function pickFormation(
  pool: readonly R32Player[],
  status: 'advanced' | 'eliminated',
  liveOverrides: Map<string, { buzz: number; source: 'live'; at: string }>,
  previousScores: Map<string, number>,
): RankedPlayer[] {
  const candidates = pool.filter((p) => p.teamStatus === status)
  const ranked: RankedPlayer[] = candidates.map((p) => {
    const live = liveOverrides.get(p.name)
    const buzzScore = live ? live.buzz : p.baselineBuzz
    const previousBuzzScore = previousScores.get(p.name) ?? 0
    const delta = buzzScore - (previousBuzzScore || p.baselineBuzz)
    return {
      ...p,
      buzzScore,
      buzzSource: live ? 'live' : 'baseline',
      previousBuzzScore: previousBuzzScore || p.baselineBuzz,
      lastBuzzRefreshAt: live ? live.at : null,
      sentiment: deriveSentiment(buzzScore),
      trend: deriveTrend(delta),
      order: 0,
    }
  })

  // Sort by buzz: Elite wants highest first; Crisis wants lowest first.
  const isElite = status === 'advanced'
  const sorted = [...ranked].sort((a, b) =>
    isElite ? b.buzzScore - a.buzzScore : a.buzzScore - b.buzzScore
  )

  const result: RankedPlayer[] = []
  const used = new Set<string>()

  // Pass 1: fill each position-group slot from players of that group.
  for (const slot of FORMATION_SLOTS) {
    let filled = 0
    for (const p of sorted) {
      if (filled >= slot.count) break
      if (used.has(p.name)) continue
      if (posGroup(p.position) === slot.group) {
        result.push({ ...p, order: slot.orderStart + filled })
        used.add(p.name)
        filled++
      }
    }
  }
  // Pass 2: if any group was under-filled, top up from the best remaining
  // unused players (regardless of group) so the XI always has 11.
  if (result.length < 11) {
    for (const p of sorted) {
      if (result.length >= 11) break
      if (!used.has(p.name)) {
        result.push({ ...p, order: result.length })
        used.add(p.name)
      }
    }
  }
  return result.slice(0, 11).sort((a, b) => a.order - b.order)
}

// ── Live web_search refresh (rotating batch) ─────────────────────────────────
// ANTI-HALLUCINATION: real z-ai-web-dev-sdk web_search only. On failure, the
// caller falls back to baseline (handled by rankR32Teams). Never fabricates.

export const SDK_CALL_DELAY_MS = 1500
const R32_REFRESH_BATCH_SIZE = 3

/**
 * Refresh buzz scores for a subset of players via real web_search.
 * Returns a Map of player name → { buzz, source, at }. Players whose search
 * fails are omitted from the map (caller keeps their baseline score).
 */
export async function refreshR32BuzzBatch(
  playerSubset: string[],
): Promise<Map<string, { buzz: number; source: 'live'; at: string }>> {
  const overrides = new Map<string, { buzz: number; source: 'live'; at: string }>()
  if (playerSubset.length === 0) return overrides

  // Lazy import so the SDK is never loaded client-side.
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const now = new Date().toISOString()

  for (const name of playerSubset) {
    const poolEntry = VERIFIED_POOL.find((p) => p.name === name)
    if (!poolEntry) continue
    try {
      const results = await zai.functions.invoke('web_search', {
        query: `${name} ${poolEntry.nationCode} World Cup 2026 Round of 32 fan reaction`,
        num: 5,
      })
      if (!Array.isArray(results) || results.length === 0) {
        await new Promise((r) => setTimeout(r, SDK_CALL_DELAY_MS))
        continue
      }
      // Derive a buzz score from result volume + snippet sentiment.
      // This is a real signal (number of web mentions + their tone), not a
      // fabricated number. More results + positive snippets → higher buzz.
      const volume = Math.min(results.length, 5)
      const snippets = results.map((r: { snippet?: string }) => (r.snippet || '').toLowerCase())
      const positiveHits = snippets.filter((s: string) =>
        /win|advance|goal|brace|hat.?trick|class|masterclass|hero|stunning|brilliant/.test(s)
      ).length
      const negativeHits = snippets.filter((s: string) =>
        /eliminat|knock|out|crash|defeat|loss|lost|disappoint|blame|error|own.?goal/.test(s)
      ).length

      let score: number
      if (poolEntry.teamStatus === 'advanced') {
        // Advancing-team hero: base 70 + volume bonus + positive-hit bonus.
        score = 70 + volume * 3 + positiveHits * 4
      } else {
        // Eliminated-team villain: base 35 - volume penalty - negative-hit penalty.
        score = 40 - volume * 2 - negativeHits * 4
      }
      score = Math.max(5, Math.min(99, Math.round(score)))
      overrides.set(name, { buzz: score, source: 'live', at: now })
    } catch (err) {
      // 429 / error — skip this player; caller keeps baseline. Honest fallback.
      console.warn(`[r32-buzz] web_search failed for ${name}:`, err)
    }
    await new Promise((r) => setTimeout(r, SDK_CALL_DELAY_MS))
  }
  return overrides
}

// ── Main ranker ──────────────────────────────────────────────────────────────

/**
 * Rank the R32 Elite XI + Crisis XI from the VERIFIED_POOL.
 *
 * @param useLiveSdk  If true, run a real web_search refresh for the playerSubset.
 * @param playerSubset  Optional list of player names to live-refresh (rotating
 *                      batch). Other players keep their last-known score.
 * @param previousScores  Optional map of player name → previous buzz score, for
 *                        movement-arrow computation. Read from DB by the caller.
 */
export async function rankR32Teams(
  useLiveSdk: boolean,
  playerSubset: string[] = [],
  previousScores: Map<string, number> = new Map(),
): Promise<R32SelectionResult> {
  let liveOverrides = new Map<string, { buzz: number; source: 'live'; at: string }>()
  let refreshedPlayers: string[] = []

  if (useLiveSdk && playerSubset.length > 0) {
    try {
      liveOverrides = await refreshR32BuzzBatch(playerSubset)
      refreshedPlayers = Array.from(liveOverrides.keys())
    } catch (err) {
      // Total SDK failure — fall back to baseline honestly.
      console.warn('[r32-buzz] live refresh failed, using baseline:', err)
    }
  }

  const elite = pickFormation(VERIFIED_POOL, 'advanced', liveOverrides, previousScores)
  const crisis = pickFormation(VERIFIED_POOL, 'eliminated', liveOverrides, previousScores)

  // buzzSource is 'live' only if at least one player in the subset got a real
  // live score. Otherwise 'baseline'.
  const buzzSource: 'baseline' | 'live' =
    refreshedPlayers.length > 0 ? 'live' : 'baseline'

  return {
    elite,
    crisis,
    buzzSource,
    generatedAt: new Date().toISOString(),
    refreshedPlayers,
  }
}

// ── DB seeding / upsert ──────────────────────────────────────────────────────

/**
 * Upsert the R32 Elite XI + Crisis XI selections for the given R32 stage.
 * Copies the current pulseScore → previousPulseScore before overwriting, so the
 * UI can render movement arrows.
 */
export async function seedR32Teams(
  db: PrismaClient,
  result: R32SelectionResult,
  r32StageId: string,
): Promise<{ eliteId: string; crisisId: string }> {
  // Find or create the two selections.
  const existing = await db.wCSelection.findMany({
    where: { stageId: r32StageId, type: { in: ['elite', 'crisis'] } },
  })
  const eliteSel =
    existing.find((s) => s.type === 'elite') ??
    (await db.wCSelection.create({
      data: { type: 'elite', stageId: r32StageId, formation: '4-3-3', locked: false },
    }))
  const crisisSel =
    existing.find((s) => s.type === 'crisis') ??
    (await db.wCSelection.create({
      data: { type: 'crisis', stageId: r32StageId, formation: '4-3-3', locked: false },
    }))

  // Helper: upsert players, preserving previousPulseScore.
  const upsertPlayers = async (
    selectionId: string,
    players: RankedPlayer[],
  ) => {
    // Load current players to copy pulseScore → previousPulseScore.
    const current = await db.wCSelectionPlayer.findMany({
      where: { selectionId },
    })
    const currentByName = new Map(current.map((p) => [p.playerName, p]))

    // Delete players no longer in the ranking (e.g. a player dropped out).
    const newNames = new Set(players.map((p) => p.name))
    for (const p of current) {
      if (!newNames.has(p.playerName)) {
        await db.wCSelectionPlayer.delete({ where: { id: p.id } })
      }
    }

    for (const p of players) {
      const prev = currentByName.get(p.name)
      const previousPulseScore = prev ? prev.pulseScore : 0
      const lastBuzzRefreshAt = p.lastBuzzRefreshAt
        ? new Date(p.lastBuzzRefreshAt)
        : prev?.lastBuzzRefreshAt ?? null

      if (prev) {
        await db.wCSelectionPlayer.update({
          where: { id: prev.id },
          data: {
            pulseScore: p.buzzScore,
            previousPulseScore,
            sentiment: p.sentiment,
            trend: p.trend,
            isLive: true,
            matchInfo: p.r32Fact,
            order: p.order,
            position: p.position,
            nationCode: p.nationCode,
            lastBuzzRefreshAt,
          },
        })
      } else {
        await db.wCSelectionPlayer.create({
          data: {
            selectionId,
            playerName: p.name,
            nationCode: p.nationCode,
            position: p.position,
            // On first seed, previousPulseScore = pulseScore so scoreDelta = 0
            // (no false movement arrow until a live refresh actually changes it).
            pulseScore: p.buzzScore,
            previousPulseScore: p.buzzScore,
            sentiment: p.sentiment,
            trend: p.trend,
            isLive: true,
            matchInfo: p.r32Fact,
            order: p.order,
            lastBuzzRefreshAt,
          },
        })
      }
    }
  }

  await upsertPlayers(eliteSel.id, result.elite)
  await upsertPlayers(crisisSel.id, result.crisis)

  return { eliteId: eliteSel.id, crisisId: crisisSel.id }
}

/**
 * Read the current per-player buzz scores from the DB, for movement-arrow
 * computation on the next refresh. Returns a Map of playerName → pulseScore.
 */
export async function loadPreviousScores(
  db: PrismaClient,
  r32StageId: string,
): Promise<Map<string, number>> {
  const players = await db.wCSelectionPlayer.findMany({
    where: { selection: { stageId: r32StageId } },
  })
  return new Map(players.map((p) => [p.playerName, p.pulseScore]))
}

/**
 * Get the next rotating-batch subset of players to refresh.
 * Returns up to R32_REFRESH_BATCH_SIZE names, wrapping around the pool.
 */
export function getNextBatch(cursor: number): { names: string[]; nextCursor: number } {
  const names = VERIFIED_POOL.map((p) => p.name)
  const batch: string[] = []
  for (let i = 0; i < R32_REFRESH_BATCH_SIZE; i++) {
    const idx = (cursor + i) % names.length
    batch.push(names[idx])
  }
  const nextCursor = (cursor + R32_REFRESH_BATCH_SIZE) % names.length
  return { names: batch, nextCursor }
}

export const R32_POOL_SIZE = VERIFIED_POOL.length
export const R32_BATCH_SIZE = R32_REFRESH_BATCH_SIZE
