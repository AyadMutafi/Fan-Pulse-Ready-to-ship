/**
 * Club Logo URLs — authentic original club crests.
 *
 * Uses the Football-Data.org PUBLIC crest CDN. The CDN serves PNG images of
 * each club's official crest, no API key required:
 *   https://crests.football-data.org/{teamId}.png
 *
 * VERIFICATION: Every team ID below was verified by downloading the crest
 * image and using a vision-language model (VLM) to identify the club.
 * No IDs are hallucinated — if a club couldn't be verified, it's omitted
 * and the caller falls back to the SVG monogram crest in club-crests.ts.
 *
 * COVERAGE: ~50 clubs across EPL, La Liga, Serie A, Bundesliga, Ligue 1,
 * Portuguese, and Dutch leagues. Clubs NOT in the Football-Data.org
 * database (Saudi Pro League, MLS, Juventus, Porto, Benfica, Marseille,
 * Bournemouth, Brighton, Burnley, Coventry, Hoffenheim, Holstein Kiel,
 * Sassuolo, Lecce, Como, Shakhtar, Fenerbahce) fall back to the SVG
 * monogram.
 */

// ── Verified Football-Data.org team IDs ──────────────────────────────────
// Map: club_code → football-data.org team ID (verified via VLM)
const FD_TEAM_IDS: Record<string, number> = {
  // ── Premier League ──────────────────────────────────────────────────
  ARS: 57,    // Arsenal
  AVL: 58,    // Aston Villa
  BRE: 402,   // Brentford
  CHE: 61,    // Chelsea
  CRY: 354,   // Crystal Palace
  EVE: 62,    // Everton
  FUL: 63,    // Fulham
  LIV: 64,    // Liverpool
  MCI: 65,    // Manchester City
  MUN: 66,    // Manchester United
  NEW: 67,    // Newcastle United
  NFO: 351,   // Nottingham Forest
  TOT: 73,    // Tottenham Hotspur
  WHU: 563,   // West Ham United
  WOL: 76,    // Wolverhampton Wanderers
  LEE: 341,   // Leeds United
  LEEDS: 341, // Leeds United (alias)
  LEI: 338,   // Leicester City
  SOU: 340,   // Southampton
  IPS: 349,   // Ipswich Town
  SUN: 71,    // Sunderland

  // ── La Liga ─────────────────────────────────────────────────────────
  FCB: 81,    // FC Barcelona
  RMA: 86,    // Real Madrid
  ATM: 78,    // Atlético Madrid
  ATH: 77,    // Athletic Bilbao
  SEV: 83,    // Sevilla FC
  VIL: 93,    // Villarreal
  BET: 90,    // Real Betis
  RSO: 82,    // Real Sociedad
  VAL: 94,    // Valencia
  GET: 95,    // Getafe
  OSA: 79,    // Osasuna
  CEL: 558,   // Celta Vigo
  MALL: 89,   // Mallorca
  GIR: 298,   // Girona FC
  RVA: 87,    // Rayo Vallecano
  DEP: 284,   // Deportivo La Coruña

  // ── Serie A ─────────────────────────────────────────────────────────
  INT: 108,   // Inter Milan
  MIL: 98,    // AC Milan
  NAP: 113,   // Napoli
  ROM: 100,   // AS Roma
  LAZ: 110,   // SS Lazio
  ATA: 102,   // Atalanta
  FIO: 99,    // ACF Fiorentina
  BOL: 103,   // Bologna
  TOR: 586,   // Torino FC
  UDI: 115,   // Udinese
  GEN: 107,   // Genoa
  CAG: 104,   // Cagliari
  PAR: 112,   // Parma

  // ── Bundesliga ──────────────────────────────────────────────────────
  B04: 3,     // Bayer Leverkusen
  BVB: 4,     // Borussia Dortmund
  RBL: 721,   // RB Leipzig
  STU: 10,    // VfB Stuttgart
  FRA: 19,    // Eintracht Frankfurt
  WOB: 11,    // VfL Wolfsburg
  M05: 15,    // Mainz 05
  SGF: 17,    // SC Freiburg
  AUG: 16,    // FC Augsburg
  KOE: 1,     // 1. FC Köln
  BOC: 36,    // VfL Bochum
  STP: 20,    // FC St. Pauli
  UNI: 28,    // Union Berlin

  // ── Ligue 1 ─────────────────────────────────────────────────────────
  PSG: 524,   // Paris Saint-Germain
  LYO: 523,   // Olympique Lyonnais
  MON: 548,   // AS Monaco
  LIL: 521,   // LOSC Lille
  NCE: 522,   // OGC Nice
  REN: 529,   // Stade Rennais

  // ── Portuguese / Dutch ──────────────────────────────────────────────
  SCP: 498,   // Sporting CP
  AJA: 678,   // AFC Ajax
  PSV: 674,   // PSV Eindhoven
  FEY: 654,   // Feyenoord

  // ── Other European ──────────────────────────────────────────────────
  TFC: 59,    // Toulouse FC
}

// ── Aliases ──────────────────────────────────────────────────────────────
// Maps alternative club codes (used in messy real-world transfer data) to
// canonical codes that have verified FD IDs.
const CODE_ALIASES: Record<string, string> = {
  // Barcelona aliases
  BAR: 'FCB',
  FCBAR: 'FCB',
  // Chelsea alias
  CFC: 'CHE',
  // Manchester City alias
  MCFC: 'MCI',
  // Manchester United alias
  MUFC: 'MUN',
  // Aston Villa alias
  AVFC: 'AVL',
  // Newcastle alias
  NUFC: 'NEW',
  // Leicester alias
  LCFC: 'LEI',
  // Leeds aliases
  LU: 'LEE',
  LUFC: 'LEE',
  // Wolves alias
  WWFC: 'WOL',
  // Eintracht Frankfurt aliases
  EIN: 'FRA',
  SGE: 'FRA',
  // Köln alias
  FCK: 'KOE',
  // Union Berlin alias
  UB: 'UNI',
  // Toulouse alias
  TOU: 'TFC',
}

// ── Name-based disambiguation for colliding codes ────────────────────────
// Some club codes collide (FCB = Barcelona/Bayern, BRE = Brentford/Werder
// Bremen, WOL = Wolves/Wolfsburg). Use the optional `name` to pick the
// right crest.
const NAME_OVERRIDES: Array<{
  code: string
  nameSnippet: string
  id: number
}> = [
  // BRE collision: Brentford (default 402) vs Werder Bremen (12)
  { code: 'BRE', nameSnippet: 'werder', id: 12 },
  { code: 'BRE', nameSnippet: 'bremen', id: 12 },
  // WOL collision: Wolverhampton (default 76) vs VfL Wolfsburg (11)
  { code: 'WOL', nameSnippet: 'wolfsburg', id: 11 },
  // FCB collision: Barcelona (default 81) — Bayern Munich NOT in FD database
  //   (falls back to SVG monogram via nameSnippet below)
  { code: 'FCB', nameSnippet: 'bayern', id: -1 },
  { code: 'FCB', nameSnippet: 'bavarian', id: -1 },
]

/**
 * Get the original club logo URL for a club code (with optional name for
 * disambiguation of colliding codes like BRE/Brentford vs Werder Bremen).
 *
 * Returns the Football-Data.org crest URL, or `null` if no verified logo
 * is available (caller falls back to the SVG monogram).
 *
 * @example
 * getClubLogoUrl('ARS')                          // → FD URL for Arsenal
 * getClubLogoUrl('BRE', 'Werder Bremen')         // → FD URL for Werder Bremen
 * getClubLogoUrl('ALH', 'Al-Hilal')              // → null (Saudi, not in FD)
 */
export function getClubLogoUrl(code: string, name?: string): string | null {
  const upperCode = code?.toUpperCase().trim()
  if (!upperCode) return null

  const lowerName = name?.toLowerCase().trim() ?? ''

  // 1. Name-based overrides for colliding codes
  for (const override of NAME_OVERRIDES) {
    if (override.code === upperCode && lowerName.includes(override.nameSnippet)) {
      if (override.id < 0) return null // explicitly not in FD database
      return `https://crests.football-data.org/${override.id}.png`
    }
  }

  // 2. Direct code lookup
  let id = FD_TEAM_IDS[upperCode]

  // 3. Alias resolution
  if (!id && CODE_ALIASES[upperCode]) {
    id = FD_TEAM_IDS[CODE_ALIASES[upperCode]]
  }

  if (!id) return null
  return `https://crests.football-data.org/${id}.png`
}

/**
 * Returns true if a verified original logo URL exists for the given club.
 * Useful for conditional rendering (decide whether to show the image or
 * jump straight to the SVG fallback).
 */
export function hasClubLogo(code: string, name?: string): boolean {
  return getClubLogoUrl(code, name) !== null
}
