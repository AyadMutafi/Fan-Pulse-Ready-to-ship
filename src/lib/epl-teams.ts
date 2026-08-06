/**
 * EPL Teams — 20 clubs for the 2026-27 Premier League season.
 *
 * Maps FPL team IDs (1-20) to our 3-letter club codes. This is the canonical
 * mapping used by /api/fpl/sync to resolve FPL team IDs → club codes when
 * syncing player + fixture data.
 *
 * ANTI-HALLUCINATION: the FPL bootstrap-static API is the source of truth for
 * the CURRENT season's team list. This map is a normalization layer — it maps
 * the known FPL IDs to our codes. If FPL reuses an ID for a different club
 * (promotion/relegation), the sync endpoint resolves the discrepancy by
 * checking the team `name` from bootstrap-static first.
 *
 * The 2026-27 season sees promoted clubs: Leeds United, Sunderland, and
 * Coventry City ( Championship play-off winner). Their FPL IDs are assigned
 * by FPL at season start and resolved dynamically from bootstrap-static.
 */

export interface EPLTeamInfo {
  fplId: number
  code: string
  name: string
  shortName: string
  /** Emoji crest placeholder (real crests would come from FPL API). */
  badge: string
}

/**
 * The 20 EPL clubs for 2026-27. FPL IDs 1-19 are stable for the long-standing
 * Premier League clubs; IDs 11, 16, 20 are assigned to promoted clubs each
 * season and resolved dynamically from bootstrap-static.
 *
 * The codes here match the FPL_ID_TO_CODE map in epl-fixtures.ts and the
 * club dictionary in epl-clubs.ts.
 */
export const EPL_TEAMS: EPLTeamInfo[] = [
  { fplId: 1,  code: 'ARS', name: 'Arsenal',              shortName: 'ARS', badge: '🔴' },
  { fplId: 2,  code: 'AVL', name: 'Aston Villa',          shortName: 'AVL', badge: '🟣' },
  { fplId: 3,  code: 'BOU', name: 'Bournemouth',          shortName: 'BOU', badge: '🔴' },
  { fplId: 4,  code: 'BRE', name: 'Brentford',            shortName: 'BRE', badge: '🔴' },
  { fplId: 5,  code: 'BHA', name: 'Brighton',             shortName: 'BHA', badge: '🔵' },
  { fplId: 6,  code: 'CHE', name: 'Chelsea',              shortName: 'CHE', badge: '🔵' },
  { fplId: 7,  code: 'CRY', name: 'Crystal Palace',       shortName: 'CRY', badge: '🔵' },
  { fplId: 8,  code: 'EVE', name: 'Everton',              shortName: 'EVE', badge: '🔵' },
  { fplId: 9,  code: 'FUL', name: 'Fulham',               shortName: 'FUL', badge: '⚪' },
  { fplId: 10, code: 'LIV', name: 'Liverpool',            shortName: 'LIV', badge: '🔴' },
  // FPL ID 11 = promoted club (Leeds / Sunderland / Coventry) — resolved dynamically
  { fplId: 12, code: 'MCI', name: 'Manchester City',      shortName: 'MCI', badge: '🔵' },
  { fplId: 13, code: 'MUN', name: 'Manchester United',    shortName: 'MUN', badge: '🔴' },
  { fplId: 14, code: 'NEW', name: 'Newcastle United',     shortName: 'NEW', badge: '⚫' },
  { fplId: 15, code: 'NFO', name: 'Nottingham Forest',    shortName: 'NFO', badge: '🔴' },
  // FPL ID 16 = promoted club — resolved dynamically
  { fplId: 17, code: 'TOT', name: 'Tottenham Hotspur',    shortName: 'TOT', badge: '⚪' },
  { fplId: 18, code: 'WHU', name: 'West Ham United',      shortName: 'WHU', badge: '🟤' },
  { fplId: 19, code: 'WOL', name: 'Wolverhampton Wanderers', shortName: 'WOL', badge: '🟠' },
  // FPL ID 20 = promoted club — resolved dynamically
]

/**
 * Map FPL team ID → 3-letter club code.
 * For IDs not in the static map (11, 16, 20 — promoted clubs), the caller
 * must resolve from bootstrap-static `teams[].name` using `nameToCode()`.
 */
export function fplIdToCode(fplId: number): string | null {
  const team = EPL_TEAMS.find((t) => t.fplId === fplId)
  return team?.code ?? null
}

/**
 * Map a club name to a 3-letter code via fuzzy match against common aliases.
 * Used to resolve promoted clubs whose FPL IDs are assigned season-to-season.
 */
export function nameToCode(name: string): string | null {
  const lower = name.toLowerCase().trim()
  const ALIASES: Record<string, string> = {
    arsenal: 'ARS',
    'aston villa': 'AVL',
    bournemouth: 'BOU',
    brentford: 'BRE',
    brighton: 'BHA',
    'brighton and hove albion': 'BHA',
    chelsea: 'CHE',
    'crystal palace': 'CRY',
    everton: 'EVE',
    fulham: 'FUL',
    liverpool: 'LIV',
    'man city': 'MCI',
    'manchester city': 'MCI',
    'man united': 'MUN',
    'manchester united': 'MUN',
    'man utd': 'MUN',
    newcastle: 'NEW',
    'newcastle united': 'NEW',
    'nottingham forest': 'NFO',
    forest: 'NFO',
    tottenham: 'TOT',
    'tottenham hotspur': 'TOT',
    spurs: 'TOT',
    'west ham': 'WHU',
    'west ham united': 'WHU',
    wolves: 'WOL',
    'wolverhampton wanderers': 'WOL',
    wolverhampton: 'WOL',
    leicester: 'LEI',
    'leicester city': 'LEI',
    leeds: 'LEE',
    'leeds united': 'LEE',
    burnley: 'BUR',
    southampton: 'SOU',
    ipswich: 'IPS',
    'ipswich town': 'IPS',
    luton: 'LUT',
    'luton town': 'LUT',
    sheffield: 'SHU',
    'sheffield united': 'SHU',
    norwich: 'NOR',
    'norwich city': 'NOR',
    'west brom': 'WBA',
    'west bromwich albion': 'WBA',
    sunderland: 'SUN',
    coventry: 'COV',
    'coventry city': 'COV',
    hull: 'HUL',
    'hull city': 'HUL',
    'crystal palacefc': 'CRY',
  }
  return ALIASES[lower] ?? null
}

/** Lookup a team by its 3-letter code. */
export function findEPLTeam(code: string): EPLTeamInfo | undefined {
  return EPL_TEAMS.find((t) => t.code === code.toUpperCase())
}
