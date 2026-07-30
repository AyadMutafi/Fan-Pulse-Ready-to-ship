/**
 * Player Card Data Adapter — converts verified data sources into the unified
 * PlayerCardData shape used by the <PlayerCard> component.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * Every adapter function pulls ONLY from verified data arrays:
 *   - VERIFIED_ELITE_XI / VERIFIED_CRISIS_XI (src/lib/verified-team-of-tournament.ts)
 *   - VERIFIED_BALLON_DOR_CONTENDERS         (src/lib/ballon-dor.ts)
 *   - SentimentPlayer[]                       (from /api/sentiments — real DB players)
 *   - TransferSagaSummary[]                   (from /api/transfers — real sagas)
 *
 * NO score is invented. Where a source has `pulseScore` we use it verbatim.
 * Where a source has `ballonDorScore` we use it (labelled "Ballon d'Or").
 * Where a source has only `avgSentiment` (transfers) we use it (labelled
 * "Fan Sentiment") and never call it a Pulse Score.
 *
 * The `isAwardWinner` / `isYoungBreakout` flags are derived from the verified
 * `isAwardWinner` / `awardName` fields and the VERIFIED_YOUNG_BREAKOUT_NAMES set.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VERIFIED_ELITE_XI, VERIFIED_CRISIS_XI, type VerifiedPick } from '@/lib/verified-team-of-tournament'
import { VERIFIED_BALLON_DOR_CONTENDERS, type BallonDorContender } from '@/lib/ballon-dor'
import { VERIFIED_YOUNG_BREAKOUT_NAMES, getCardTier, type CardTier } from '@/lib/player-card-tiers'
import type { Trend } from '@/types'
import type { SentimentPlayer } from '@/types'
import type { TransferSagaSummary } from '@/components/TransferPulseCard'

/** The 40/25/20/15 Pulse formula weights (for the card-back breakdown visual). */
export const PULSE_FORMULA = [
  { key: 'matchPerformance', label: 'Match Performance', weight: 40, note: 'Team results, win rate, goal difference' },
  { key: 'fanSentiment', label: 'Fan Sentiment', weight: 25, note: 'Real fan posts + crowd votes' },
  { key: 'aiNarrative', label: 'AI Narrative', weight: 20, note: 'Trend direction × fan signal strength' },
  { key: 'momentumTrend', label: 'Momentum', weight: 15, note: 'Trend adjusted by recent goal difference' },
] as const

/** Unified card data shape consumed by <PlayerCard>. */
export interface PlayerCardData {
  /** Stable unique id (used for localStorage card-collection tracking). */
  id: string
  /** Real player name (verbatim from verified data). */
  name: string
  /** ISO nation code, e.g. "FRA". */
  nationCode: string
  /** Field position code, e.g. "LW". */
  position: string
  /** The hero number — real verified score (0-100). */
  pulseScore: number
  /** Label for the hero number (default "Pulse Score"). */
  scoreLabel: string
  /** Real verified trend. */
  trend: Trend
  /** Club name (when known from verified data). */
  clubName?: string
  /** Short club code (when known). */
  clubCode?: string
  /** True if the player won an official FIFA tournament award. */
  isAwardWinner: boolean
  /** Award name, when isAwardWinner is true. */
  awardName?: string
  /** True if the player is a verified young breakout (VERIFIED_YOUNG_BREAKOUT_NAMES). */
  isYoungBreakout: boolean
  /** Computed card tier (from getCardTier). */
  tier: CardTier
  /** Verified match fact / source citation (shown on card back). */
  verifiedNote: string
  /** Where the data came from (e.g. "Team of Tournament"). */
  source: string
  /** Verified fan-sentiment value (0-100) when available — shown on card back. */
  fanSentiment?: number
}

/** Build a PlayerCardData from a VERIFIED_ELITE_XI / VERIFIED_CRISIS_XI pick. */
function fromVerifiedPick(pick: VerifiedPick, source: string): PlayerCardData {
  const isYoungBreakout = VERIFIED_YOUNG_BREAKOUT_NAMES.has(pick.name)
  return {
    id: `verified:${source}:${pick.name}`,
    name: pick.name,
    nationCode: pick.nationCode,
    position: pick.position,
    pulseScore: pick.pulseScore,
    scoreLabel: 'Pulse Score',
    trend: pick.trend,
    isAwardWinner: pick.isAwardWinner,
    awardName: pick.awardName,
    isYoungBreakout,
    tier: getCardTier(pick.pulseScore, pick.trend, pick.isAwardWinner, isYoungBreakout),
    verifiedNote: pick.matchInfo,
    source,
    fanSentiment: pick.sentiment,
  }
}

/** All Elite XI picks as card data. */
export function eliteXICards(): PlayerCardData[] {
  return VERIFIED_ELITE_XI.map((p) => fromVerifiedPick(p, 'Team of Tournament'))
}

/** All Crisis XI picks as card data. */
export function crisisXICards(): PlayerCardData[] {
  return VERIFIED_CRISIS_XI.map((p) => fromVerifiedPick(p, 'Crisis XI'))
}

/** All Ballon d'Or contenders as card data (uses ballonDorScore as the hero number). */
export function ballonDorCards(): PlayerCardData[] {
  return VERIFIED_BALLON_DOR_CONTENDERS.map((c: BallonDorContender) => {
    const isAwardWinner = !!c.awardWon
    const isYoungBreakout = VERIFIED_YOUNG_BREAKOUT_NAMES.has(c.name)
    return {
      id: `ballon-dor:${c.name}`,
      name: c.name,
      nationCode: c.nationCode,
      position: c.position,
      pulseScore: c.ballonDorScore,
      scoreLabel: "Ballon d'Or",
      trend: c.trend,
      clubName: c.clubName,
      clubCode: c.clubCode,
      isAwardWinner,
      awardName: c.awardWon,
      isYoungBreakout,
      tier: getCardTier(c.ballonDorScore, c.trend, isAwardWinner, isYoungBreakout),
      verifiedNote: c.verifiedMatchFact,
      source: "Ballon d'Or Race",
    }
  })
}

/** Build a PlayerCardData from a SentimentPlayer (live API data). */
export function fromSentimentPlayer(p: SentimentPlayer): PlayerCardData {
  const isYoungBreakout = VERIFIED_YOUNG_BREAKOUT_NAMES.has(p.name)
  return {
    id: `sentiment:${p.id}`,
    name: p.name,
    nationCode: p.nationCode,
    position: p.position ?? '—',
    pulseScore: p.pulseScore,
    scoreLabel: 'Pulse Score',
    trend: p.trend,
    isAwardWinner: false,
    isYoungBreakout,
    tier: getCardTier(p.pulseScore, p.trend, false, isYoungBreakout),
    verifiedNote: `Sentiment label: ${p.label.replace(/_/g, ' ')} · League: ${p.league}`,
    source: 'Match Sentiments',
    fanSentiment: p.sentiment,
  }
}

/**
 * Build a PlayerCardData from a TransferSagaSummary.
 *
 * Transfers do NOT carry a verified player Pulse Score — the saga has an
 * `avgSentiment` (0-100) reflecting fan mood about the rumor. We use that
 * real number as the hero, labelled "Fan Sentiment" (never "Pulse Score"),
 * and derive the tier from it. This is the anti-hallucination-safe choice:
 * we display the real saga sentiment, not a fabricated player score.
 */
export function fromTransferSaga(saga: TransferSagaSummary): PlayerCardData {
  const score = Math.round(saga.avgSentiment)
  const trend = (saga.buzzTrend === 'rising' || saga.buzzTrend === 'falling' ? saga.buzzTrend : 'stable') as Trend
  const isYoungBreakout = VERIFIED_YOUNG_BREAKOUT_NAMES.has(saga.playerName)
  const topSrc = saga.topSources[0]
  const note = topSrc
    ? `${topSrc.journalistName} (${topSrc.outlet}) — fan-read likelihood ${saga.fanReadLikelihood}%`
    : `Fan-read likelihood ${saga.fanReadLikelihood}% · buzz volume ${saga.buzzVolume}`
  return {
    id: `transfer:${saga.id}`,
    name: saga.playerName,
    nationCode: saga.playerNationCode,
    position: '—',
    pulseScore: score,
    scoreLabel: 'Fan Sentiment',
    trend,
    clubName: saga.toClubName || saga.fromClubName,
    clubCode: saga.toClubCode || saga.fromClubCode,
    isAwardWinner: false,
    isYoungBreakout,
    tier: getCardTier(score, trend, false, isYoungBreakout),
    verifiedNote: note,
    source: 'Transfer Pulse',
  }
}

/**
 * The COMPLETE collection of collectible cards (for the Card Collection view
 * and the "X / total" counter). De-duplicated by id. This is the canonical
 * list a user can "collect" by browsing the tabs.
 *
 * Sourced entirely from verified static data (Elite XI + Crisis XI + Ballon
 * d'Or). Sentiment + transfer cards are dynamic (they come from the live API)
 * and are added to the collection as the user views them.
 */
export function collectibleCardCatalog(): PlayerCardData[] {
  const all = [...eliteXICards(), ...crisisXICards(), ...ballonDorCards()]
  const seen = new Set<string>()
  const out: PlayerCardData[] = []
  for (const c of all) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}
