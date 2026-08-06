/**
 * FPL API Client
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * All FPL data comes from the REAL Fantasy Premier League public API:
 *
 *   https://fantasy.premierleague.com/api/bootstrap-static/
 *     Returns: players (elements), teams, element_types (positions), events (gameweeks)
 *
 *   https://fantasy.premierleague.com/api/fixtures/
 *     Returns: all fixtures for the current FPL season, with kickoff_time,
 *     event (gameweek), finished flag, team IDs, and scores (when finished)
 *
 *   https://fantasy.premierleague.com/api/element-summary/{playerId}/
 *     Returns: per-player fixture history + fixtures (used for form calculation)
 *
 *   https://fantasy.premierleague.com/api/entry/{teamId}/
 *     Returns: a user's FPL squad (for the "Your FPL Team" feature)
 *
 * We NEVER fabricate player data, fixtures, or gameweek info. If any fetch
 * fails or returns an unexpected shape, we return null/empty — the caller
 * MUST render an honest empty state.
 *
 * Rate-limiting: the FPL API has no published rate limit, but we use a 6s
 * timeout per call + cache aggressively (bootstrap-static for 1hr, fixtures
 * for 30min). The /api/fpl/sync admin endpoint adds a 200ms inter-call delay
 * when bulk-syncing players.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { fplIdToCode, nameToCode } from '@/lib/epl-teams'

const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/'
const FPL_FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/'
const FPL_ELEMENT_SUMMARY_URL = (id: number) =>
  `https://fantasy.premierleague.com/api/element-summary/${id}/`
const FPL_ENTRY_URL = (id: number) =>
  `https://fantasy.premierleague.com/api/entry/${id}/`
const FPL_ENTRY_EVENT_URL = (teamId: number, gw: number) =>
  `https://fantasy.premierleague.com/api/entry/${teamId}/event/${gw}/picks/`

/** Fetch with a 6-second timeout. */
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

// ── Types (only the fields we use) ────────────────────────────────────────────

export interface FPLBootstrapElement {
  id: number
  first_name: string
  second_name: string
  web_name: string
  team: number // FPL team ID (1-20)
  element_type: number // 1=GK, 2=DEF, 3=MID, 4=FWD
  now_cost: number // price × 10 (e.g. 90 = £9.0)
  selected_by_percent: string // "45.2" (string in FPL API)
  form: string // "5.2"
  total_points: number
  points_per_game: string
  minutes: number
  goals_scored: number
  assists: number
  clean_sheets: number
}

export interface FPLBootstrapTeam {
  id: number
  name: string
  short_name: string
}

export interface FPLBootstrapElementType {
  id: number
  singular_name: string // "Goalkeeper", "Defender", "Midfielder", "Forward"
  singular_name_short: string // "GKP", "DEF", "MID", "FWD"
}

export interface FPLBootstrapEvent {
  id: number
  name: string
  deadline_time: string
  is_current: boolean
  is_next: boolean
  finished: boolean
  average_entry_score: number
  highest_score: number
}

interface FPLBootstrapResponse {
  elements: FPLBootstrapElement[]
  teams: FPLBootstrapTeam[]
  element_types: FPLBootstrapElementType[]
  events: FPLBootstrapEvent[]
}

export interface FPLFixtureRaw {
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
}

export interface FPLEntryResponse {
  id: number
  player_first_name: string
  player_last_name: string
  name: string
  summary_overall_points: number
  summary_event_points: number
  current_event: number | null
  favourite_team: number | null
  started_event: number | null
}

export interface FPLEntryPicksResponse {
  picks: Array<{
    element: number
    position: number
    is_captain: boolean
    is_vice_captain: boolean
    multiplier: number
  }>
  entry_history: {
    event: number
    points: number
    total_points: number
    rank: number
    rank_sort: number
    overall_rank: number
    event_transfers: number
    event_transfers_cost: number
    value: number
    points_on_bench: number
  }
}

// ── Position helpers ──────────────────────────────────────────────────────────

const FPL_POSITION_MAP: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

/** Convert FPL element_type ID to our position code. */
export function fplPositionToCode(elementType: number): string {
  return FPL_POSITION_MAP[elementType] ?? 'MID'
}

// ── Team ID → code resolution ─────────────────────────────────────────────────

/**
 * Resolve FPL team IDs to { code, name } pairs from the bootstrap-static
 * `teams` array. Falls back to the static map for known IDs.
 *
 * Returns a Map keyed by FPL team ID.
 */
export function resolveTeamCodes(
  teams: FPLBootstrapTeam[],
): Map<number, { code: string; name: string }> {
  const out = new Map<number, { code: string; name: string }>()
  for (const t of teams) {
    const code =
      nameToCode(t.name) ??
      (t.short_name && t.short_name.length === 3
        ? t.short_name.toUpperCase()
        : null) ??
      fplIdToCode(t.id) ??
      null
    if (code) {
      out.set(t.id, { code, name: t.name })
    }
  }
  // Fallback: fill from static map for any IDs not covered
  for (let id = 1; id <= 20; id++) {
    if (!out.has(id)) {
      const code = fplIdToCode(id)
      if (code) out.set(id, { code, name: code })
    }
  }
  return out
}

// ── Bootstrap-static fetcher (1hr cache) ──────────────────────────────────────

const BOOTSTRAP_TTL_MS = 60 * 60 * 1000 // 1 hour

interface BootstrapCache {
  data: FPLBootstrapResponse
  fetchedAt: number
}

let bootstrapCache: BootstrapCache | null = null

/**
 * Fetch the FPL bootstrap-static payload (players, teams, positions, gameweeks).
 *
 * Cached in-process for 1 hour. The bootstrap-static endpoint is large (~1MB)
 * and changes infrequently (prices update daily during the season).
 *
 * Returns null on failure — the caller MUST handle the null case honestly.
 */
export async function fetchBootstrap(): Promise<FPLBootstrapResponse | null> {
  if (bootstrapCache && Date.now() - bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS) {
    return bootstrapCache.data
  }

  try {
    const res = await fetchWithTimeout(FPL_BOOTSTRAP_URL)
    if (!res.ok) {
      console.warn('[fpl-api] bootstrap-static returned', res.status)
      return null
    }
    const data = (await res.json()) as FPLBootstrapResponse
    if (!data || !Array.isArray(data.elements) || !Array.isArray(data.teams)) {
      console.warn('[fpl-api] bootstrap-static: unexpected shape')
      return null
    }
    bootstrapCache = { data, fetchedAt: Date.now() }
    return data
  } catch (err) {
    console.warn('[fpl-api] bootstrap-static failed:', err)
    return null
  }
}

/** Clear the in-process bootstrap cache. Exposed for admin/tests. */
export function clearBootstrapCache(): void {
  bootstrapCache = null
}

// ── Fixtures fetcher (30min cache) ────────────────────────────────────────────

const FIXTURES_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface FixturesCache {
  data: FPLFixtureRaw[]
  fetchedAt: number
}

let fixturesCache: FixturesCache | null = null

/**
 * Fetch all FPL fixtures for the current season.
 *
 * Cached in-process for 30 minutes. Returns null on failure.
 */
export async function fetchFixtures(): Promise<FPLFixtureRaw[] | null> {
  if (fixturesCache && Date.now() - fixturesCache.fetchedAt < FIXTURES_TTL_MS) {
    return fixturesCache.data
  }

  try {
    const res = await fetchWithTimeout(FPL_FIXTURES_URL)
    if (!res.ok) {
      console.warn('[fpl-api] fixtures returned', res.status)
      return null
    }
    const data = (await res.json()) as FPLFixtureRaw[]
    if (!Array.isArray(data)) {
      console.warn('[fpl-api] fixtures: unexpected shape')
      return null
    }
    fixturesCache = { data, fetchedAt: Date.now() }
    return data
  } catch (err) {
    console.warn('[fpl-api] fixtures failed:', err)
    return null
  }
}

/** Clear the in-process fixtures cache. */
export function clearFixturesCache(): void {
  fixturesCache = null
}

// ── Element summary (per-player history) ──────────────────────────────────────

/**
 * Fetch a player's fixture history + upcoming fixtures from FPL.
 * Used for detailed form calculation. NOT cached (only called on-demand).
 *
 * Returns null on failure.
 */
export async function fetchPlayerHistory(
  playerId: number,
): Promise<{ history: Array<{ total_points: number; minutes: number; was_home: boolean }>; fixtures: unknown[] } | null> {
  try {
    const res = await fetchWithTimeout(FPL_ELEMENT_SUMMARY_URL(playerId))
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !Array.isArray(data.history)) return null
    return { history: data.history, fixtures: data.fixtures ?? [] }
  } catch (err) {
    console.warn(`[fpl-api] element-summary ${playerId} failed:`, err)
    return null
  }
}

// ── Entry (user's FPL team) ───────────────────────────────────────────────────

/**
 * Fetch a user's FPL team entry (overall info — name, points, current GW).
 * Returns null on failure (invalid team ID, FPL API down, etc.).
 */
export async function fetchFPLEntry(
  teamId: number,
): Promise<FPLEntryResponse | null> {
  try {
    const res = await fetchWithTimeout(FPL_ENTRY_URL(teamId))
    if (!res.ok) {
      if (res.status === 404) return null // invalid team ID
      console.warn('[fpl-api] entry returned', res.status)
      return null
    }
    const data = (await res.json()) as FPLEntryResponse
    if (!data || typeof data.id !== 'number') return null
    return data
  } catch (err) {
    console.warn('[fpl-api] entry failed:', err)
    return null
  }
}

/**
 * Fetch a user's FPL squad picks for a specific gameweek.
 * Returns null on failure.
 */
export async function fetchFPLPicks(
  teamId: number,
  gameweek: number,
): Promise<FPLEntryPicksResponse | null> {
  try {
    const res = await fetchWithTimeout(FPL_ENTRY_EVENT_URL(teamId, gameweek))
    if (!res.ok) {
      if (res.status === 404) return null // no picks for this GW yet
      console.warn('[fpl-api] picks returned', res.status)
      return null
    }
    const data = (await res.json()) as FPLEntryPicksResponse
    if (!data || !Array.isArray(data.picks)) return null
    return data
  } catch (err) {
    console.warn('[fpl-api] picks failed:', err)
    return null
  }
}
