/**
 * Fan Pulse Design Tokens
 *
 * The distinctive design direction for Fan Pulse:
 *   - Pitch green (#00A862) — the color of football itself
 *   - Floodlight white (#FAFAF7) — the default background
 *   - Terrace dark (#1A1B1E) — text and dark mode background
 *   - Pulse red (#FF4D4F) — live data emphasis
 *   - Fog gray (#9CA3AF) — secondary info
 *
 * These tokens replace the old purple-on-dark theme (#6C2BD9).
 * The app keeps emojis as the PRIMARY visual language for fan sentiment
 * — these colors provide the STRUCTURE around the emojis, not replace them.
 *
 * Dark mode is a toggle, not the default. Default = floodlight white.
 */

export const TOKENS = {
  // Colors
  pitch: '#00A862',       // Primary accent — the color of a football pitch
  flood: '#FAFAF7',       // Default background — floodlight white
  terrace: '#1A1B1E',    // Text dark — like concrete terraces
  pulse: '#FF4D4F',      // Live data emphasis — the heartbeat
  muted: '#9CA3AF',      // Secondary text — fog gray
  fog: '#F3F4F6',        // Surface background — subtle gray

  // Semantic colors
  good: '#10B981',        // Positive sentiment (fans approve)
  mixed: '#F59E0B',        // Mixed sentiment (fans unsure)
  bad: '#EF4444',          // Negative sentiment (fans disapprove)

  // Status colors (credibility labels)
  confirmed: '#10B981',   // Confirmed transfer
  reported: '#F59E0B',    // Reported rumor
  debunked: '#EF4444',    // Debunked rumor

  // Dark mode colors
  darkBg: '#0F1115',      // Dark mode background (night match)
  darkSurface: '#1A1D23', // Dark mode card surface
  darkText: '#F3F4F6',    // Dark mode text
  darkMuted: '#6B7280',   // Dark mode secondary text

  // Type scale
  fontSize: {
    xs: '10px',
    sm: '11px',
    base: '13px',
    lg: '15px',
    xl: '18px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '48px',      // Scoreboard numbers
  },

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
  },

  // Border radius
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  // Sentiment emoji mapping (STAYS as primary visual)
  sentimentEmoji: {
    excellent: '🔥',   // 70-100% approval
    good: '👍',        // 50-69%
    mixed: '😐',       // 30-49%
    poor: '👎',        // 0-29%
  },

  // Fan mood emojis (for sentiment scores)
  moodEmoji: {
    ecstatic: '🤩',     // 90+
    happy: '😊',       // 70-89
    neutral: '😐',     // 50-69
    worried: '😟',     // 30-49
    angry: '😡',       // 0-29
  },

  // Credibility labels with emojis
  credibility: {
    confirmed: { emoji: '✅', label: 'Confirmed' },
    reported: { emoji: '📰', label: 'Reported' },
    debunked: { emoji: '❌', label: 'Debunked' },
  },
} as const

/**
 * Get the sentiment emoji for an approval percentage.
 * Used on transfer cards, shareable cards, and the TOTW list.
 */
export function getApprovalEmoji(approvalPct: number): string {
  if (approvalPct >= 70) return TOKENS.sentimentEmoji.excellent
  if (approvalPct >= 50) return TOKENS.sentimentEmoji.good
  if (approvalPct >= 30) return TOKENS.sentimentEmoji.mixed
  return TOKENS.sentimentEmoji.poor
}

/**
 * Get the sentiment label for an approval percentage.
 */
export function getApprovalLabel(approvalPct: number): string {
  if (approvalPct >= 70) return 'Excellent'
  if (approvalPct >= 50) return 'Good'
  if (approvalPct >= 30) return 'Mixed'
  return 'Poor'
}

/**
 * Get the mood emoji for a fan sentiment score (0-100).
 * Used on TOTW cards, player cards, and fan mood displays.
 */
export function getMoodEmoji(sentimentScore: number): string {
  if (sentimentScore >= 90) return TOKENS.moodEmoji.ecstatic
  if (sentimentScore >= 70) return TOKENS.moodEmoji.happy
  if (sentimentScore >= 50) return TOKENS.moodEmoji.neutral
  if (sentimentScore >= 30) return TOKENS.moodEmoji.worried
  return TOKENS.moodEmoji.angry
}

/**
 * Get the credibility info for a transfer status.
 */
export function getCredibility(status: string): { emoji: string; label: string; color: string } {
  if (status === 'completed') {
    return { ...TOKENS.credibility.confirmed, color: TOKENS.confirmed }
  }
  if (status === 'debunked') {
    return { ...TOKENS.credibility.debunked, color: TOKENS.debunked }
  }
  return { ...TOKENS.credibility.reported, color: TOKENS.reported }
}
