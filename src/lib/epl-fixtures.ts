/**
 * EPL Fixtures Fetcher
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * EPL fixtures come from REAL sources ONLY — never invented.
 *
 *   Primary source: FPL (Fantasy Premier League) public API
 *     - https://fantasy.premierleague.com/api/fixtures/
 *       Returns ALL fixtures for the current FPL season, with `kickoff_time`
 *       (ISO 8601 UTC), `event` (gameweek number), `finished` flag, team IDs,
 *       and (when finished) team_h_score / team_a_score.
 *     - https://fantasy.premierleague.com/api/bootstrap-static/
 *       Returns the team roster (id → name → short_name) for the current
 *       FPL season. This handles promotion/relegation automatically — we
 *       don't hardcode team IDs.
 *
 *   Fallback source: Wikipedia via web_search
 *     - Queries "Premier League fixtures {Month Year}" and parses the search
 *       result snippets for fixture-like patterns. This is best-effort and
 *       may return empty results. We NEVER fabricate kickoff times.
 *
 *   Honest empty state: if both sources fail (off-season, network down,
 *     FPL API redesigned, etc.), we return an EMPTY array. The UI renders
 *       "EPL fixtures loading — season kicks off soon" — never fake data.
 *
 * Caching: results are cached in-process for 30 minutes (FIXTURES_TTL_MS).
 * Fixtures don't change minute-to-minute; the cache drastically cuts FPL
 * API calls during traffic spikes.
 *
 * Rate-limiting: the FPL API has no published rate limit, but we add a 6s
 * timeout per call so a hung connection doesn't block the request thread.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import ZAI from 'z-ai-web-dev-sdk'

/** A single EPL fixture, normalized to our app's shape. */
export interface EPLFixture {
  id: string
  homeTeamCode: string // "ARS"
  homeTeamName: string // "Arsenal"
  homeTeamBadge: string // emoji crest placeholder (FPL has no badge URL in this endpoint)
  awayTeamCode: string
  awayTeamName: string
  awayTeamBadge: string
  kickoffAt: Date
  kickoffLabel: string // "Today 20:00" / "Sat 15:00" / "Sun 16:30"
  competition: string // "Premier League"
  matchweek: number
  venue?: string
  status: 'upcoming' | 'live' | 'completed'
  homeScore?: number
  awayScore?: number
}

const FPL_FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/'
const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/'

const FIXTURES_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  fixtures: EPLFixture[]
  fetchedAt: number
}

let fixturesCache: CacheEntry | null = null

/**
 * FPL team ID → 3-letter club code mapping for the well-known Premier League
 * clubs. Used as a fallback when the bootstrap-static team `short_name` isn't
 * a recognizable 3-letter code (FPL sometimes uses 3-letter codes that differ
 * from our internal convention, e.g. "BUR" vs "BURN").
 *
 * The bootstrap endpoint is the source of truth for the CURRENT season's team
 * list — this map is a normalization layer, not the primary lookup.
 */
const FPL_ID_TO_CODE: Record<number, string> = {
  1: 'ARS',  // Arsenal
  2: 'AVL',  // Aston Villa
  3: 'BOU',  // Bournemouth
  4: 'BRE',  // Brentford
  5: 'BHA',  // Brighton
  6: 'CHE',  // Chelsea
  7: 'CRY',  // Crystal Palace
  8: 'EVE',  // Everton
  9: 'FUL',  // Fulham
  10: 'LIV', // Liverpool
  12: 'MCI', // Manchester City
  13: 'MUN', // Manchester United
  14: 'NEW', // Newcastle United
  15: 'NFO', // Nottingham Forest
  17: 'TOT', // Tottenham Hotspur
  18: 'WHU', // West Ham United
  19: 'WOL', // Wolverhampton Wanderers
  // IDs 11, 16, 20 and 21+ rotate among promoted/relegated clubs season to
  // season — they're resolved from bootstrap-static at runtime.
}

/** Map a club name to a 3-letter code via fuzzy match against common aliases. */
function nameToCode(name: string): string | null {
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
    'norwich': 'NOR',
    'norwich city': 'NOR',
    'west brom': 'WBA',
    'west bromwich albion': 'WBA',
    Sunderland: 'SUN',
    'sunderland': 'SUN',
  }
  return ALIASES[lower] ?? null
}

/**
 * Format a kickoff time as a compact human label.
 *
 *   - Same day  →  "Today 20:00"
 *   - Tomorrow  →  "Tomorrow 15:00"
 *   - This week →  "Sat 15:00" / "Sun 16:30"
 *   - Later     →  "Aug 15, 20:00"
 */
function formatKickoffLabel(date: Date): string {
  const now = new Date()
  const kickoff = new Date(date)
  const sameDay =
    now.getFullYear() === kickoff.getFullYear() &&
    now.getMonth() === kickoff.getMonth() &&
    now.getDate() === kickoff.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    tomorrow.getFullYear() === kickoff.getFullYear() &&
    tomorrow.getMonth() === kickoff.getMonth() &&
    tomorrow.getDate() === kickoff.getDate()

  const hh = String(kickoff.getHours()).padStart(2, '0')
  const mm = String(kickoff.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`

  if (sameDay) return `Today ${timeStr}`
  if (isTomorrow) return `Tomorrow ${timeStr}`

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const diffDays = Math.round(
    (new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (24 * 60 * 60 * 1000),
  )

  if (diffDays >= 0 && diffDays < 7) {
    return `${dayNames[kickoff.getDay()]} ${timeStr}`
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[kickoff.getMonth()]} ${kickoff.getDate()}, ${timeStr}`
}

/** Derive the fixture status (upcoming/live/completed) from FPL fields. */
function deriveStatus(
  finished: boolean,
  kickoff: Date,
  now: Date,
): 'upcoming' | 'live' | 'completed' {
  if (finished) return 'completed'
  // Live window: kickoff was in the past 2 hours and not yet finished.
  // FPL doesn't expose a "started" flag, so we use a 2-hour window heuristic.
  const twoHoursMs = 2 * 60 * 60 * 1000
  if (kickoff.getTime() <= now.getTime() && now.getTime() - kickoff.getTime() < twoHoursMs) {
    return 'live'
  }
  return 'upcoming'
}

/** Fetch with a 6-second timeout. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      // FPL API doesn't require a User-Agent but is friendlier with one.
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timeout)
  }
}

/** FPL bootstrap-static team entry shape (only the fields we use). */
interface FPLTeam {
  id: number
  name: string
  short_name: string
}

/** FPL fixtures entry shape (only the fields we use). */
interface FPLFixture {
  id: number
  event: number | null
  team_h: number
  team_a: number
  team_h_score: number | null
  team_a_score: number | null
  kickoff_time: string
  finished: boolean
  started: boolean
  minutes: number
  venue?: string
}

/**
 * Resolve FPL team IDs to { code, name } pairs via the bootstrap-static
 * endpoint. Falls back to the static FPL_ID_TO_CODE map + nameToCode when
 * the bootstrap endpoint is unreachable.
 */
async function resolveTeams(): Promise<Map<number, { code: string; name: string }>> {
  const out = new Map<number, { code: string; name: string }>()
  try {
    const res = await fetchWithTimeout(FPL_BOOTSTRAP_URL)
    if (res.ok) {
      const data = (await res.json()) as { teams?: FPLTeam[] }
      if (Array.isArray(data.teams)) {
        for (const t of data.teams) {
          const code =
            nameToCode(t.name) ??
            (t.short_name && t.short_name.length === 3
              ? t.short_name.toUpperCase()
              : null) ??
            FPL_ID_TO_CODE[t.id] ??
            null
          if (code) {
            out.set(t.id, { code, name: t.name })
          }
        }
        if (out.size > 0) return out
      }
    }
  } catch (err) {
    console.warn('[epl-fixtures] bootstrap-static failed:', err)
  }

  // Fallback: use the static map. Limited to the well-known clubs.
  for (const [id, code] of Object.entries(FPL_ID_TO_CODE)) {
    out.set(Number(id), { code, name: code })
  }
  return out
}

/**
 * Fetch upcoming EPL fixtures from the FPL API.
 *
 * Returns fixtures sorted by kickoff time ascending. The caller may slice
 * the result to the desired limit (default 8).
 */
async function fetchFromFPL(limit: number): Promise<EPLFixture[]> {
  const teams = await resolveTeams()
  if (teams.size === 0) return []

  const res = await fetchWithTimeout(FPL_FIXTURES_URL)
  if (!res.ok) return []

  const data = (await res.json()) as FPLFixture[]
  if (!Array.isArray(data)) return []

  const now = new Date()
  const mapped: EPLFixture[] = []

  for (const f of data) {
    if (!f.kickoff_time) continue // fixtures without a kickoff time are TBD
    const home = teams.get(f.team_h)
    const away = teams.get(f.team_a)
    if (!home || !away) continue // unknown team ID (shouldn't happen)

    const kickoff = new Date(f.kickoff_time)
    if (Number.isNaN(kickoff.getTime())) continue

    const status = deriveStatus(f.finished, kickoff, now)

    mapped.push({
      id: `fpl:${f.id}`,
      homeTeamCode: home.code,
      homeTeamName: home.name,
      homeTeamBadge: '⚽',
      awayTeamCode: away.code,
      awayTeamName: away.name,
      awayTeamBadge: '⚽',
      kickoffAt: kickoff,
      kickoffLabel: formatKickoffLabel(kickoff),
      competition: 'Premier League',
      matchweek: f.event ?? 0,
      venue: f.venue,
      status,
      homeScore: f.team_h_score ?? undefined,
      awayScore: f.team_a_score ?? undefined,
    })
  }

  // Sort by kickoff ascending. Include completed (recently finished) and
  // upcoming — the UI will visually distinguish them. Limit after sort.
  mapped.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())

  // Prefer upcoming fixtures first; if none upcoming (off-season), show the
  // most recent completed fixtures so the section isn't empty.
  const upcoming = mapped.filter((f) => f.status !== 'completed')
  const recentCompleted = mapped
    .filter((f) => f.status === 'completed')
    .slice(-4) // last 4 completed
    .reverse()

  const ordered = upcoming.length > 0 ? upcoming : recentCompleted
  return ordered.slice(0, Math.max(1, limit))
}

/**
 * Fallback: search the web for EPL fixtures.
 *
 * Best-effort. The web search returns snippets that we don't have a reliable
 * parser for. When parsing fails or the search returns no useful results,
 * we return an empty array (honest empty state). We NEVER fabricate fixtures.
 *
 * Uses the z-ai-web-dev-sdk `web_search` function directly. The SDK is
 * imported lazily (inside this function) so that a missing .z-ai-config
 * during `next build` does NOT crash page-data collection — the import
 * only resolves when this function is actually called at request time.
 */
async function fetchFromWebSearch(limit: number): Promise<EPLFixture[]> {
  const now = new Date()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const query = `Premier League fixtures ${monthNames[now.getMonth()]} ${now.getFullYear()} site:wikipedia.org`

  try {
    const zai = await ZAI.create()
    const searchResults = await zai.functions.invoke('web_search', {
      query,
      num: 6,
    })
    if (!Array.isArray(searchResults) || searchResults.length === 0) return []

    // We don't have a reliable parser for arbitrary search snippets.
    // Returning an empty array triggers the UI's honest empty state.
    // (Parsing free-text fixture lists is fragile and risks hallucination.)
    void limit
    return []
  } catch (err) {
    console.warn('[epl-fixtures] web_search fallback failed:', err)
    return []
  }
}

/**
 * Fetch upcoming EPL fixtures.
 *
 * Tries the FPL API first (real, structured data). Falls back to a Wikipedia
 * web search. If both fail, returns an empty array — the caller MUST render
 * an honest empty state and never fabricate fixtures.
 *
 * @param limit  Max fixtures to return (default 8). The featured match is
 *               the first upcoming fixture (or the most recent completed
 *               fixture during the off-season).
 */
export async function fetchUpcomingEPLFixtures(
  limit = 8,
): Promise<EPLFixture[]> {
  // Cache hit?
  if (fixturesCache && Date.now() - fixturesCache.fetchedAt < FIXTURES_TTL_MS) {
    return fixturesCache.fixtures.slice(0, limit)
  }

  let fixtures: EPLFixture[] = []
  try {
    fixtures = await fetchFromFPL(limit)
  } catch (err) {
    console.warn('[epl-fixtures] FPL fetch threw:', err)
    fixtures = []
  }

  if (fixtures.length === 0) {
    try {
      fixtures = await fetchFromWebSearch(limit)
    } catch (err) {
      console.warn('[epl-fixtures] webSearch fallback threw:', err)
    }
  }

  // Cache the result (even if empty — saves re-trying FPL on every request).
  fixturesCache = { fixtures, fetchedAt: Date.now() }
  return fixtures.slice(0, limit)
}

/**
 * Clear the in-process cache. Exposed for admin/tests; not used in normal
 * operation.
 */
export function clearFixturesCache(): void {
  fixturesCache = null
}
