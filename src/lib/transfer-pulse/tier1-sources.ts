/**
 * Tier 1 Journalist Source List — Transfer Pulse
 *
 * ANTI-HALLUCINATION GATE: A transfer rumor only enters Transfer Pulse if at
 * least one journalist from this list has reported it. This list is deliberately
 * conservative — better to miss a rumor than surface a fabricated one.
 *
 * Verification: All handles were verified against the journalists' actual X
 * profiles in July 2026. Handles change — re-verify before adding new sources.
 *
 * Reliability scores (0-1) are based on community consensus (Reddit r/soccer
 * reliability threads) and editorial oversight (The Athletic > independent).
 * They are directional, not scientific. Adjust as you observe real accuracy.
 *
 * Maintenance rules:
 * - Add sources deliberately, one at a time, only after verifying handle + track record
 * - Remove sources who lose credibility immediately
 * - Log every add/remove in /home/z/my-project/worklog.md with date + reason
 * - Never lower the bar to fill the tracker
 *
 * HANDLE FORMAT NOTE:
 *   Tier1Source.handle stores the handle WITH the leading '@' (e.g. '@FabrizioRomano')
 *   for human readability and display. The runtime matching layer (TIER1_HANDLES,
 *   isTier1Journalist, getTier1Source) normalizes the '@' away so that handles
 *   extracted from real X post URLs — which never include the '@'
 *   (x.com/FabrizioRomano/status/... → 'FabrizioRomano') — still match.
 *   The DB column TransferSource.journalistHandle also stores the handle WITHOUT
 *   the '@', because the UI prepends '@' at render time
 *   (see TransferSagaDetail.tsx: `@{s.journalistHandle}`).
 */

export interface Tier1Source {
  /** Journalist display name, e.g. "Fabrizio Romano" */
  name: string
  /** Exact X handle WITH leading '@' — VERIFIED July 2026 */
  handle: string
  /** Outlet / publication, e.g. "The Athletic" */
  outlet: string
  /** Reliability 0-1, based on community/journalist consensus */
  reliability: number
  /** Which league/market/club the journalist is strongest in */
  specialty: string
}

export const TIER1_SOURCES: Tier1Source[] = [

  // ── PAN-EUROPEAN / GENERAL (cover all leagues) ──────────────────────────────
  { name: 'Fabrizio Romano', handle: '@FabrizioRomano', outlet: 'Independent', reliability: 0.98, specialty: 'Pan-European' },
  { name: 'David Ornstein', handle: '@David_Ornstein', outlet: 'The Athletic', reliability: 0.97, specialty: 'Pan-European / Premier League' },
  { name: 'Gianluca Di Marzio', handle: '@DiMarzio', outlet: 'Sky Sport Italia', reliability: 0.95, specialty: 'Pan-European / Serie A' },

  // ── PREMIER LEAGUE (England) ────────────────────────────────────────────────
  { name: 'Laurie Whitwell', handle: '@lauriewhitwell', outlet: 'The Athletic', reliability: 0.95, specialty: 'Manchester United' },
  { name: 'Rob Dawson', handle: '@RobDawsonESPN', outlet: 'ESPN', reliability: 0.93, specialty: 'Manchester City' },
  { name: 'Sam Lee', handle: '@SamLee', outlet: 'The Athletic', reliability: 0.93, specialty: 'Manchester City' },
  { name: 'James Olley', handle: '@JamesOlley', outlet: 'ESPN', reliability: 0.92, specialty: 'Chelsea' },
  { name: 'Adam Crafton', handle: '@AdamCrafton_', outlet: 'The Athletic', reliability: 0.94, specialty: 'Chelsea / Premier League' },
  { name: 'Jacob Steinberg', handle: '@JacobSteinberg', outlet: 'The Guardian', reliability: 0.90, specialty: 'Chelsea / Premier League' },
  { name: 'Nizaar Kinsella', handle: '@NizaarKinsella', outlet: 'Evening Standard', reliability: 0.89, specialty: 'Chelsea' },
  { name: 'Phil Hay', handle: '@PhilHay_', outlet: 'The Athletic', reliability: 0.92, specialty: 'Leeds United' },
  { name: 'David Amoyal', handle: '@DavidAmoyal', outlet: 'ESPN / Calcio Land Pod', reliability: 0.87, specialty: 'Serie A for English audience' },

  // ── LA LIGA (Spain) ─────────────────────────────────────────────────────────
  { name: 'Matteo Moretto', handle: '@MatteMoretto', outlet: 'Relevo', reliability: 0.95, specialty: 'La Liga general' },
  { name: 'Moisés Llorens', handle: '@moilens', outlet: 'ESPN', reliability: 0.90, specialty: 'Barcelona / La Liga' },
  { name: 'Mario Cortegana', handle: '@mariocortegana', outlet: 'The Athletic', reliability: 0.91, specialty: 'Real Madrid' },
  { name: 'Guillem Balague', handle: '@guillembalague', outlet: 'BBC Sport', reliability: 0.90, specialty: 'La Liga / Barcelona' },
  { name: 'Santi Aouna', handle: '@santiaouna', outlet: 'Foot Mercato', reliability: 0.85, specialty: 'La Liga / Ligue 1 crossover' },
  { name: 'Arancha Rodríguez', handle: '@aranchamobile', outlet: 'El Chiringuito', reliability: 0.78, specialty: 'Real Madrid (verify each claim)' },
  { name: 'José Álvarez Haya', handle: '@josealvarezhaya', outlet: 'El Chiringuito', reliability: 0.78, specialty: 'Real Madrid (verify each claim)' },

  // ── SERIE A (Italy) ─────────────────────────────────────────────────────────
  { name: 'Nicolo Schira', handle: '@NicoSchira', outlet: 'Il Mattino / Tuttosport', reliability: 0.88, specialty: 'Serie A / general' },
  { name: 'Alfredo Pedullà', handle: '@AlfredoPedulla', outlet: 'Sportitalia', reliability: 0.86, specialty: 'Serie A (strong on Juventus)' },
  { name: 'Marco Conterio', handle: '@marcoconterio', outlet: 'Tuttomercatoweb', reliability: 0.82, specialty: 'Serie A / Juventus' },

  // ── BUNDESLIGA (Germany) ────────────────────────────────────────────────────
  { name: 'Florian Plettenberg', handle: '@Plettigoal', outlet: 'Sky Sport DE', reliability: 0.95, specialty: 'Bundesliga / Bayern Munich' },
  { name: 'Christian Falk', handle: '@cfbayern', outlet: 'BILD', reliability: 0.87, specialty: 'Bayern Munich' },
  { name: 'Patrick Berger', handle: '@PBergerEdathu', outlet: 'Sport1', reliability: 0.90, specialty: 'Bundesliga general' },
  { name: 'Kerry Hau', handle: '@kerryhau', outlet: 'Sky Sport DE', reliability: 0.88, specialty: 'Bayern Munich / Bundesliga' },

  // ── LIGUE 1 (France) ────────────────────────────────────────────────────────
  { name: 'Fabrice Hawkins', handle: '@FabriceHawkins', outlet: 'RMC Sport', reliability: 0.93, specialty: 'PSG / Ligue 1' },
  { name: 'Jonathan Johnson', handle: '@Jon_LeGossip', outlet: 'CBS Sports', reliability: 0.88, specialty: 'PSG / Ligue 1 (English)' },
  { name: 'Loïc Tanzi', handle: '@loictanzi', outlet: "L'Équipe", reliability: 0.90, specialty: 'PSG / Ligue 1' },

  // ── SAUDI PRO LEAGUE & MIDDLE EAST (high volume of European outflows) ───────
  { name: 'Rudy Galetti', handle: '@RudyGaletti', outlet: 'Independent', reliability: 0.88, specialty: 'Saudi Pro League / Middle East' },
  { name: 'Ekrem KONUR', handle: '@Ekremkonur', outlet: 'Vatan / Independent', reliability: 0.85, specialty: 'Turkish / Middle East market' },
  { name: 'Achraf Ben Ayad', handle: '@aboraayad', outlet: 'Independent', reliability: 0.82, specialty: 'Middle East / African market' },

  // ── TURKISH SÜPER LIG ───────────────────────────────────────────────────────
  // Ekrem KONUR covers this (listed above in Middle East section)
  // Levent Tüzemen — handle unverified; research before adding

  // ── EMERGING MARKETS (add with verification) ────────────────────────────────
  // Belgian Pro League: research Tom Peeters (HLN) or Sascha Brijs (Sporza)
  // Eredivisie: research Michael Statham (@M_Statham_NL, Football-Oranje) — reliability ~0.80
  // Primeira Liga (Portugal): research Pedro Sepúlveda (SIC Notícias)
  // Scottish Premiership: research club-specific Athletic correspondents
]

/**
 * O(1) lookup set of all Tier 1 handles, lowercased and WITHOUT the leading '@'.
 *
 * We strip the '@' because handles extracted from real X post URLs never carry
 * it (x.com/FabrizioRomano/status/... → 'FabrizioRomano'), and the DB stores
 * handles without '@' (the UI prepends '@' at render time). Keeping the set in
 * that same normalized form means URL/DB handles match directly with no extra
 * massaging at the call site.
 */
export const TIER1_HANDLES: ReadonlySet<string> = new Set(
  TIER1_SOURCES.map((s) => s.handle.replace(/^@/, '').toLowerCase()),
)

/**
 * Normalize a handle for comparison: trim, strip a leading '@', lowercase.
 * Accepts handles with or without the leading '@' (e.g. '@FabrizioRomano'
 * and 'FabrizioRomano' both normalize to 'fabrizioromano').
 */
function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

/**
 * Returns true if a journalist's X handle is in the Tier 1 list.
 * Used by the discovery pipeline to gate rumor creation.
 * Case-insensitive; accepts the handle with or without a leading '@'.
 */
export function isTier1Journalist(handle: string): boolean {
  if (!handle) return false
  return TIER1_HANDLES.has(normalizeHandle(handle))
}

/**
 * Returns the Tier1Source for a given handle, or null.
 * Case-insensitive; accepts the handle with or without a leading '@'.
 */
export function getTier1Source(handle: string): Tier1Source | null {
  if (!handle) return null
  const normalized = normalizeHandle(handle)
  return (
    TIER1_SOURCES.find(
      (s) => s.handle.replace(/^@/, '').toLowerCase() === normalized,
    ) ?? null
  )
}

// ── Backward-compatibility aliases ───────────────────────────────────────────
// Older code imported lookupTier1 / isTier1Handle. They are preserved here as
// thin wrappers so any unmigrated consumer keeps compiling. Prefer the new
// names (getTier1Source / isTier1Journalist) in new code.
//
// NOTE: lookupTier1 previously returned `Tier1Source | undefined`; getTier1Source
// returns `Tier1Source | null`. Existing call sites used truthiness checks
// (`if (!source) ...`), which work identically for null and undefined.

/** @deprecated Use getTier1Source. */
export const lookupTier1 = getTier1Source

/** @deprecated Use isTier1Journalist. */
export const isTier1Handle = isTier1Journalist
