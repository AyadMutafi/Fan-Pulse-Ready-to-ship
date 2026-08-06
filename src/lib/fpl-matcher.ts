/**
 * FPL Matcher
 *
 * Matches FPL players (from bootstrap-static `elements`) to LeaguePlayer DB
 * rows. The matching is done by name + team — FPL's `web_name` is often a
 * shortened surname (e.g. "Saka", "Salah"), while `first_name + second_name`
 * is the full name (e.g. "Bukayo Saka", "Mohamed Salah").
 *
 * The /api/fpl/sync endpoint uses this module to:
 *   1. Upsert FPLPlayer rows (keyed by fplId)
 *   2. Upsert LeaguePlayer rows (keyed by name + teamCode + season)
 *   3. Link them via LeaguePlayer.fplId = FPLPlayer.fplId
 *
 * ANTI-HALLUCINATION: we only match players that exist in the REAL FPL API
 * response. We never invent players. If a name can't be normalized, we skip it
 * rather than guessing.
 */

import type { FPLBootstrapElement } from '@/lib/fpl-api'
import { fplPositionToCode } from '@/lib/fpl-api'

/**
 * Normalize a player name for matching.
 * Lowercase, trim, remove diacritics, collapse spaces.
 *
 *   "Bukayo Saka"       → "bukayo saka"
 *   "Mohamed Salah"     → "mohamed salah"
 *   "Rúben Diogo Silva" → "ruben diogo silva"
 *   "  Haaland  "       → "haaland"
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, ' ')
}

/**
 * Build the full player name from FPL first_name + second_name.
 *   first_name="Bukayo", second_name="Saka" → "Bukayo Saka"
 */
export function buildFullName(
  firstName: string,
  secondName: string,
): string {
  const fn = firstName.trim()
  const sn = secondName.trim()
  if (!fn) return sn
  if (!sn) return fn
  return `${fn} ${sn}`
}

/**
 * The normalized shape we use for upserting LeaguePlayer + FPLPlayer rows.
 * Produced from an FPL bootstrap-static element + a team-code map.
 */
export interface MatchedPlayer {
  fplId: number
  fullName: string
  webName: string
  teamCode: string
  teamFplId: number
  position: string // "GK" | "DEF" | "MID" | "FWD"
  price: number // now_cost / 10
  ownershipPct: number
  form: number
  totalPoints: number
  pointsPerGame: number
  minutes: number
  goals: number
  assists: number
  cleanSheets: number
}

/**
 * Convert an FPL bootstrap element to a MatchedPlayer.
 * Returns null if the team ID can't be resolved (shouldn't happen — all 20 FPL
 * teams should be in the teamMap).
 *
 * @param element  FPL bootstrap-static element
 * @param teamMap  Map<FPL team ID, { code, name }> from resolveTeamCodes()
 */
export function matchPlayer(
  element: FPLBootstrapElement,
  teamMap: Map<number, { code: string; name: string }>,
): MatchedPlayer | null {
  const team = teamMap.get(element.team)
  if (!team) return null

  const fullName = buildFullName(element.first_name, element.second_name)
  if (!fullName) return null

  return {
    fplId: element.id,
    fullName,
    webName: element.web_name || fullName,
    teamCode: team.code,
    teamFplId: element.team,
    position: fplPositionToCode(element.element_type),
    price: element.now_cost / 10,
    ownershipPct: parseFloat(element.selected_by_percent) || 0,
    form: parseFloat(element.form) || 0,
    totalPoints: element.total_points || 0,
    pointsPerGame: parseFloat(element.points_per_game) || 0,
    minutes: element.minutes || 0,
    goals: element.goals_scored || 0,
    assists: element.assists || 0,
    cleanSheets: element.clean_sheets || 0,
  }
}

/**
 * Batch-match FPL elements to MatchedPlayer[].
 * Skips any element whose team ID can't be resolved.
 */
export function matchAllPlayers(
  elements: FPLBootstrapElement[],
  teamMap: Map<number, { code: string; name: string }>,
): MatchedPlayer[] {
  const out: MatchedPlayer[] = []
  for (const el of elements) {
    const matched = matchPlayer(el, teamMap)
    if (matched) out.push(matched)
  }
  return out
}
