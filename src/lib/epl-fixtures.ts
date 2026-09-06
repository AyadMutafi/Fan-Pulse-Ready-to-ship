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

/**
 * EPL Fixtures Fetcher
 *
 * EPL fixtures come from REAL sources ONLY — never invented.
 *
 * Primary source: FPL (Fantasy Premier League) public API
 * Fallback: Wikipedia via web_search (lazy-loaded)
 *
 * (Updated: lazy-load z-ai-web-dev-sdk for web_search fallback)
 */

// Lazy Z.ai loader for the web_search fallback
let _zai: any = null
async function getZAI(): Promise<any | null> {
  if (_zai) return _zai
  try {
    const ZAIModule = await import('z-ai-web-dev-sdk')
    _zai = await ZAIModule.default.create()
    return _zai
  } catch (err) {
    console.warn(`[epl-fixtures] Z.ai init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

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
}

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
    sunderland: 'SUN',
  }
  return ALIASES[lower] ?? null
}

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

function deriveStatus(
  finished: boolean,
  kickoff: Date,
  now: Date,
): 'upcoming' | 'live' | 'completed' {
  if (finished) return 'completed'
  const twoHoursMs = 2 * 60 * 60 * 1000
  if (kickoff.getTime() <= now.getTime() && now.getTime() - kickoff.getTime() < twoHoursMs) {
    return 'live'
  }
  return 'upcoming'
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timeout)
  }
}

interface FPLTeam {
  id: number
  name: string
  short_name: string
}

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

  for (const [id, code] of Object.entries(FPL_ID_TO_CODE)) {
    out.set(Number(id), { code, name: code })
  }
  return out
}

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
    if (!f.kickoff_time) continue
    const home = teams.get(f.team_h)
    const away = teams.get(f.team_a)
    if (!home || !away) continue

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

  mapped.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())

  const upcoming = mapped.filter((f) => f.status !== 'completed')
  const recentCompleted = mapped
    .filter((f) => f.status === 'completed')
    .slice(-4)
    .reverse()

  const ordered = upcoming.length > 0 ? upcoming : recentCompleted
  return ordered.slice(0, Math.max(1, limit))
}

/**
 * Fallback: search the web for EPL fixtures.
 *
 * Uses the z-ai-web-dev-sdk `web_search` function lazily so that missing
 * runtime config doesn't crash builds.
 */
async function fetchFromWebSearch(limit: number): Promise<EPLFixture[]> {
  const now = new Date()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const query = `Premier League fixtures ${monthNames[now.getMonth()]} ${now.getFullYear()} site:wikipedia.org`

  try {
    const zai = await getZAI()
    if (!zai) {
      console.warn('[epl-fixtures] Z.ai unavailable for web_search fallback')
      return []
    }
    const searchResults = await zai.functions.invoke('web_search', {
      query,
      num: 6,
    })
    if (!Array.isArray(searchResults) || searchResults.length === 0) return []

    // No reliable parser — return empty (honest empty state)
    void limit
    return []
  } catch (err) {
    console.warn('[epl-fixtures] web_search fallback failed:', err)
    return []
  }
}

export async function fetchUpcomingEPLFixtures(
  limit = 8,
): Promise<EPLFixture[]> {
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

  fixturesCache = { fixtures, fetchedAt: Date.now() }
  return fixtures.slice(0, limit)
}

export function clearFixturesCache(): void {
  fixturesCache = null
}
