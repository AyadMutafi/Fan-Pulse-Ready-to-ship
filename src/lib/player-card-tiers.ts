/**
 * Emoji Player Card Tier System — FUT-style collectible cards.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * The EMOJI is the tier indicator — never a color background. Card backgrounds
 * are always glass with a faint tier-mood tint.
 *
 * Tier assignment uses ONLY real signals from verified data:
 *   - isAwardWinner      → from VERIFIED_ELITE_XI.isAwardWinner / BallonDorContender.awardWon
 *   - isYoungBreakout    → from VERIFIED_YOUNG_BREAKOUT_NAMES (players explicitly
 *                          described as teenage/young in the verified matchInfo)
 *   - pulseScore         → the real verified score (Elite XI pulseScore, Ballon d'Or
 *                          ballonDorScore, Sentiments API pulseScore, or Transfer
 *                          saga avgSentiment)
 *   - trend              → the real verified trend (rising/stable/falling)
 *
 * NO score is invented. NO player is fabricated. The tier emoji is derived
 * deterministically from the real verified signals above.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CardTier = 'elite' | 'rising' | 'steady' | 'crisis' | 'award' | 'breakout'

export interface CardTierInfo {
  /** The hero emoji — the primary tier indicator. */
  emoji: string
  /** Short label (small-caps brutalist). */
  label: string
  /** One-line description of what the tier means. */
  description: string
  /** Pulse-score range for the tier, or null for special tiers. */
  pulseRange: [number, number] | null
  /** Subtle background tint (rgba) applied over the glass surface. */
  tint: string
  /** Border-glow color (rgba) matching the emoji's mood. */
  glow: string
  /** Accent color for the tier label text. */
  accent: string
}

export const CARD_TIERS: Record<CardTier, CardTierInfo> = {
  elite: {
    emoji: '🔥',
    label: 'ELITE',
    description: 'On fire — top performer',
    pulseRange: [90, 100],
    tint: 'rgba(255, 107, 53, 0.08)',
    glow: 'rgba(255, 107, 53, 0.35)',
    accent: '#FF6B35',
  },
  rising: {
    emoji: '⚡',
    label: 'RISING',
    description: 'Momentum building',
    pulseRange: [80, 89],
    tint: 'rgba(168, 85, 247, 0.08)',
    glow: 'rgba(168, 85, 247, 0.30)',
    accent: '#A855F7',
  },
  steady: {
    emoji: '😐',
    label: 'STEADY',
    description: 'Neutral, nothing special',
    pulseRange: [50, 79],
    tint: 'rgba(148, 163, 184, 0.08)',
    glow: 'rgba(148, 163, 184, 0.20)',
    accent: '#94A3B8',
  },
  crisis: {
    emoji: '💀',
    label: 'CRISIS',
    description: 'Dead performance',
    pulseRange: [0, 49],
    tint: 'rgba(239, 68, 68, 0.08)',
    glow: 'rgba(239, 68, 68, 0.35)',
    accent: '#EF4444',
  },
  award: {
    emoji: '🏆',
    label: 'AWARD',
    description: 'Official award winner',
    pulseRange: null,
    tint: 'rgba(245, 158, 11, 0.10)',
    glow: 'rgba(245, 158, 11, 0.40)',
    accent: '#F59E0B',
  },
  breakout: {
    emoji: '🚀',
    label: 'BREAKOUT',
    description: 'Exceeding expectations',
    pulseRange: null,
    tint: 'rgba(16, 185, 129, 0.08)',
    glow: 'rgba(16, 185, 129, 0.30)',
    accent: '#10B981',
  },
}

/**
 * Players explicitly described as teenage / young in their VERIFIED matchInfo.
 * Sourced ONLY from src/lib/verified-team-of-tournament.ts — every entry's
 * matchInfo calls them "teenage" or they are documented Best Young Player
 * candidates. This is the anti-hallucination gate for the 🚀 breakout tier:
 * a player is only a "young breakout" if the verified data says so.
 *
 *   - 'Lamine Yamal'  → "teenage winger whose creativity unlocked defenses"
 *
 * Note: Pau Cubarsí won Best Young Player (isAwardWinner=true), so he hits
 * the 🏆 award tier first (getCardTier checks award before breakout). He is
 * intentionally NOT in this set — his verified signal is "award winner",
 * not "young breakout".
 */
export const VERIFIED_YOUNG_BREAKOUT_NAMES = new Set<string>([
  'Lamine Yamal',
])

/**
 * Determine a player's card tier from their real verified signals.
 *
 * Priority (highest first):
 *   1. award     — official FIFA award winner (Golden Ball / Boot / Glove / Best Young)
 *   2. breakout  — young player (verified) with pulseScore ≥ 80
 *   3. elite     — pulseScore ≥ 90
 *   4. rising    — pulseScore ≥ 80 AND trend === 'rising'
 *   5. crisis    — pulseScore < 50
 *   6. steady    — everything else (50–79)
 *
 * @param pulseScore       Real verified score (0-100).
 * @param trend            Real verified trend ('rising' | 'stable' | 'falling').
 * @param isAwardWinner    True if the player won an official FIFA tournament award.
 * @param isYoungBreakout  True if the player is a verified young talent (see VERIFIED_YOUNG_BREAKOUT_NAMES).
 */
export function getCardTier(
  pulseScore: number,
  trend: string,
  isAwardWinner: boolean,
  isYoungBreakout: boolean,
): CardTier {
  if (isAwardWinner) return 'award'
  if (isYoungBreakout && pulseScore >= 80) return 'breakout'
  if (pulseScore >= 90) return 'elite'
  if (pulseScore >= 80 && trend === 'rising') return 'rising'
  if (pulseScore < 50) return 'crisis'
  return 'steady'
}

/** Convenience: tier info for a given score+trend+flags combo. */
export function getCardTierInfo(
  pulseScore: number,
  trend: string,
  isAwardWinner: boolean,
  isYoungBreakout: boolean,
): CardTierInfo {
  return CARD_TIERS[getCardTier(pulseScore, trend, isAwardWinner, isYoungBreakout)]
}

/** All tier keys in display order (award first, crisis last). */
export const TIER_ORDER: CardTier[] = ['award', 'breakout', 'elite', 'rising', 'steady', 'crisis']
