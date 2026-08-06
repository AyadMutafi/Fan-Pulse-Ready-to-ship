/**
 * EPL Clubs — pure static dictionary (no DB imports).
 *
 * Shared between client and server code so the vote modal can resolve a
 * club code → human name without a network round-trip.
 *
 * Only 3-letter codes are included — the FanVote API validates that teamCode
 * is exactly 3 letters (`/^[A-Za-z]{3}$/`). Clubs with longer codes (BURN,
 * LEEDS) are omitted from the Fan Mood carousel; they still appear in the
 * fixtures list but can't be voted on through the current API contract.
 *
 * Sorted by typical fan-engagement size (top 6 first) so the carousel
 * surfaces the most-engaged clubs at the front when no votes exist yet.
 */

export interface EPLClubInfo {
  code: string
  name: string
  /** Default emoji crest placeholder. Real crests would come from FPL API. */
  badge: string
}

export const EPL_CLUBS: EPLClubInfo[] = [
  { code: 'ARS', name: 'Arsenal', badge: '🔴' },
  { code: 'CHE', name: 'Chelsea', badge: '🔵' },
  { code: 'LIV', name: 'Liverpool', badge: '🔴' },
  { code: 'MCI', name: 'Manchester City', badge: '🔵' },
  { code: 'MUN', name: 'Manchester United', badge: '🔴' },
  { code: 'TOT', name: 'Tottenham Hotspur', badge: '⚪' },
  { code: 'NEW', name: 'Newcastle United', badge: '⚫' },
  { code: 'AVL', name: 'Aston Villa', badge: '🟣' },
  { code: 'BHA', name: 'Brighton', badge: '🔵' },
  { code: 'WHU', name: 'West Ham United', badge: '🟤' },
  { code: 'EVE', name: 'Everton', badge: '🔵' },
  { code: 'FUL', name: 'Fulham', badge: '⚪' },
]

/** Lookup a club by its 3-letter code. Returns undefined for unknown codes. */
export function findEPLClub(code: string): EPLClubInfo | undefined {
  return EPL_CLUBS.find((c) => c.code === code.toUpperCase())
}
