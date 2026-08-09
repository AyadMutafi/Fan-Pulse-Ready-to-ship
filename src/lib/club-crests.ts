/**
 * Club Crest Library — authentic brand colors for every club in the app.
 *
 * Renders professional SVG crests (no external CDN, no broken images, no rate
 * limits). Each crest is a colored shield/roundel with the club's monogram.
 *
 * COVERAGE: all ~80 clubs across EPL, La Liga, Serie A, Bundesliga, Ligue 1,
 * Portuguese/Dutch leagues, and Saudi Pro League that appear in transfers,
 * TOTW, FPL, and EPL fixtures.
 *
 * DISAMBIGUATION: codes FCB (Barcelona vs Bayern), BRE (Brentford vs Werder
 * Bremen), and ALH (Al-Hilal vs Al-Ettifaq) collide. The resolver uses the
 * club NAME to pick the right variant when provided.
 *
 * ANTI-HALLUCINATION: colors are the well-known official brand colors of each
 * club (home-kit primary + accent). No invented data.
 */

export interface ClubCrest {
  /** Primary fill color (home kit dominant color). */
  primary: string
  /** Secondary/accent color (ring/border). */
  secondary: string
  /** 2-3 letter monogram shown on the crest. */
  monogram: string
}

/**
 * Default crest per club code. For colliding codes (FCB, BRE, ALH) the first-
 * listed club is the default; overrides below handle the other variant.
 */
const CRESTS: Record<string, ClubCrest> = {
  // ── EPL ──────────────────────────────────────────────────────────────
  ARS: { primary: '#EF0107', secondary: '#FFFFFF', monogram: 'ARS' },
  AVL: { primary: '#670E36', secondary: '#95BFE5', monogram: 'AVL' },
  BOU: { primary: '#DA291C', secondary: '#000000', monogram: 'BOU' },
  BRE: { primary: '#E30613', secondary: '#FFFFFF', monogram: 'BRE' }, // Brentford (default)
  BHA: { primary: '#0057B8', secondary: '#FFCD00', monogram: 'BHA' },
  CHE: { primary: '#034694', secondary: '#FFFFFF', monogram: 'CHE' },
  CRY: { primary: '#1B458F', secondary: '#C4122E', monogram: 'CRY' },
  EVE: { primary: '#003399', secondary: '#FFFFFF', monogram: 'EVE' },
  FUL: { primary: '#1A1A1A', secondary: '#CC0000', monogram: 'FUL' },
  LIV: { primary: '#C8102E', secondary: '#F6EB61', monogram: 'LIV' },
  MCI: { primary: '#6CABDD', secondary: '#1C2C5B', monogram: 'MCI' },
  MUN: { primary: '#DA291C', secondary: '#FBE122', monogram: 'MUN' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF', monogram: 'NEW' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF', monogram: 'NFO' },
  TOT: { primary: '#132257', secondary: '#FFFFFF', monogram: 'TOT' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7', monogram: 'WHU' },
  WOL: { primary: '#FDB913', secondary: '#231F20', monogram: 'WOL' },
  LEE: { primary: '#1D428A', secondary: '#FFFFFF', monogram: 'LEE' },
  LEEDS: { primary: '#1D428A', secondary: '#FFFFFF', monogram: 'LEE' },
  LEI: { primary: '#003090', secondary: '#FDBE11', monogram: 'LEI' },
  SOU: { primary: '#D71920', secondary: '#FFFFFF', monogram: 'SOU' },
  IPS: { primary: '#3D64A3', secondary: '#FFFFFF', monogram: 'IPS' },
  BURN: { primary: '#6C1D45', secondary: '#99D6EA', monogram: 'BUR' },
  SUN: { primary: '#EB172B', secondary: '#FFFFFF', monogram: 'SUN' },
  COV: { primary: '#6CADDF', secondary: '#1B458F', monogram: 'COV' },

  // ── La Liga ──────────────────────────────────────────────────────────
  FCB: { primary: '#A50044', secondary: '#004D98', monogram: 'FCB' }, // Barcelona (default)
  RMA: { primary: '#00529F', secondary: '#FEBE10', monogram: 'RMA' },
  ATM: { primary: '#CB3524', secondary: '#FFFFFF', monogram: 'ATM' },
  ATH: { primary: '#EE2523', secondary: '#FFFFFF', monogram: 'ATH' },
  SEV: { primary: '#D50027', secondary: '#FFFFFF', monogram: 'SEV' },
  VIL: { primary: '#005187', secondary: '#FFE667', monogram: 'VIL' },
  BET: { primary: '#00954C', secondary: '#FFFFFF', monogram: 'BET' },
  RSO: { primary: '#0067B1', secondary: '#FFFFFF', monogram: 'RSO' },
  VAL: { primary: '#F18E00', secondary: '#000000', monogram: 'VAL' },
  GET: { primary: '#005999', secondary: '#FFFFFF', monogram: 'GET' },
  OSA: { primary: '#D91A21', secondary: '#002E5F', monogram: 'OSA' },
  CEL: { primary: '#8AC3EE', secondary: '#005187', monogram: 'CEL' },
  MALL: { primary: '#E20613', secondary: '#FFD200', monogram: 'MAL' },
  GIR: { primary: '#CD2534', secondary: '#FFFFFF', monogram: 'GIR' },

  // ── Serie A ──────────────────────────────────────────────────────────
  INT: { primary: '#0068A8', secondary: '#000000', monogram: 'INT' },
  MIL: { primary: '#FB090B', secondary: '#000000', monogram: 'MIL' },
  JUV: { primary: '#1A1A1A', secondary: '#FFFFFF', monogram: 'JUV' },
  NAP: { primary: '#12A0D7', secondary: '#FFFFFF', monogram: 'NAP' },
  ROM: { primary: '#8E1F2F', secondary: '#F0BC42', monogram: 'ROM' },
  LAZ: { primary: '#87D8F7', secondary: '#005BA9', monogram: 'LAZ' },
  ATA: { primary: '#1E71B8', secondary: '#000000', monogram: 'ATA' },
  FIO: { primary: '#592C82', secondary: '#FFFFFF', monogram: 'FIO' },
  BOL: { primary: '#1B2A4B', secondary: '#A41E22', monogram: 'BOL' },
  TOR: { primary: '#881600', secondary: '#FFFFFF', monogram: 'TOR' },
  UDI: { primary: '#1A1A1A', secondary: '#FFFFFF', monogram: 'UDI' },
  SAS: { primary: '#00A752', secondary: '#000000', monogram: 'SAS' },
  GEN: { primary: '#C8102E', secondary: '#003478', monogram: 'GEN' },
  CAG: { primary: '#A50044', secondary: '#0033A0', monogram: 'CAG' },
  PAR: { primary: '#FCD000', secondary: '#005BA9', monogram: 'PAR' },
  LEC: { primary: '#EE2737', secondary: '#FFE800', monogram: 'LEC' },
  COM: { primary: '#003D7A', secondary: '#FFFFFF', monogram: 'COM' },

  // ── Bundesliga ───────────────────────────────────────────────────────
  // FCB (Bayern) override below — Barcelona is the default above.
  B04: { primary: '#E32221', secondary: '#000000', monogram: 'B04' },
  BVB: { primary: '#FDE100', secondary: '#000000', monogram: 'BVB' },
  RBL: { primary: '#DD0741', secondary: '#001F47', monogram: 'RBL' },
  STU: { primary: '#E32219', secondary: '#FFFFFF', monogram: 'STU' },
  FRA: { primary: '#1A1A1A', secondary: '#E1000F', monogram: 'SGE' },
  WOB: { primary: '#65B32E', secondary: '#FFFFFF', monogram: 'WOB' },
  M05: { primary: '#C3141E', secondary: '#FFFFFF', monogram: 'M05' },
  SGF: { primary: '#1A1A1A', secondary: '#FFFFFF', monogram: 'SCF' },
  HEI: { primary: '#1C63B7', secondary: '#FFFFFF', monogram: 'TSG' },
  AUG: { primary: '#BA3733', secondary: '#1C63B7', monogram: 'FCA' },
  // BRE (Werder Bremen) override below — Brentford is the default above.
  KOE: { primary: '#ED1C24', secondary: '#FFFFFF', monogram: 'KOE' },
  BOC: { primary: '#005CA9', secondary: '#FFFFFF', monogram: 'BOC' },
  STP: { primary: '#6B4423', secondary: '#FFFFFF', monogram: 'STP' },
  HOL: { primary: '#003C7C', secondary: '#E60012', monogram: 'HOL' },

  // ── Ligue 1 ──────────────────────────────────────────────────────────
  PSG: { primary: '#004170', secondary: '#DA291C', monogram: 'PSG' },
  OM: { primary: '#2FAEE0', secondary: '#FFFFFF', monogram: 'OM' },
  LYO: { primary: '#1B3C87', secondary: '#DA291C', monogram: 'OL' },
  MON: { primary: '#E51B22', secondary: '#FFFFFF', monogram: 'ASM' },
  LIL: { primary: '#E01E13', secondary: '#00337F', monogram: 'LOSC' },
  NCE: { primary: '#C8102E', secondary: '#000000', monogram: 'OGCN' },
  REN: { primary: '#E2001A', secondary: '#000000', monogram: 'SRFC' },

  // ── Portuguese / Dutch / Other ───────────────────────────────────────
  POR: { primary: '#002E6D', secondary: '#FFFFFF', monogram: 'FCP' },
  BEN: { primary: '#E40521', secondary: '#FFFFFF', monogram: 'SLB' },
  SCP: { primary: '#008057', secondary: '#FFFFFF', monogram: 'SCP' },
  AJA: { primary: '#D2122E', secondary: '#FFFFFF', monogram: 'AJA' },
  PSV: { primary: '#ED1C24', secondary: '#FFFFFF', monogram: 'PSV' },
  FEY: { primary: '#CC0033', secondary: '#FFFFFF', monogram: 'FEY' },
  SHK: { primary: '#FF6B00', secondary: '#000000', monogram: 'SHK' },

  // ── Saudi Pro League ─────────────────────────────────────────────────
  ALN: { primary: '#0D47A1', secondary: '#FDD835', monogram: 'NSR' },
  ALH: { primary: '#0047A0', secondary: '#FFFFFF', monogram: 'HIL' }, // Al-Hilal (default)
  AHA: { primary: '#00A86B', secondary: '#FFFFFF', monogram: 'AHL' },
  ITT: { primary: '#1A1A1A', secondary: '#FFD700', monogram: 'ITT' },
  // ALH (Al-Ettifaq) override below — Al-Hilal is the default above.
}

/**
 * Overrides for colliding codes, keyed by `${CODE}:${lowercasedNameSnippet}`.
 * The resolver checks these when a name is provided.
 */
const CREST_OVERRIDES: Record<string, ClubCrest> = {
  // FCB collision: Barcelona (default) vs Bayern Munich
  'FCB:bayern': { primary: '#DC052D', secondary: '#FFFFFF', monogram: 'FCB' },
  'FCB:bavarian': { primary: '#DC052D', secondary: '#FFFFFF', monogram: 'FCB' },
  // BRE collision: Brentford (default) vs Werder Bremen
  'BRE:werder': { primary: '#1D9053', secondary: '#FFFFFF', monogram: 'SVW' },
  'BRE:bremen': { primary: '#1D9053', secondary: '#FFFFFF', monogram: 'SVW' },
  // ALH collision: Al-Hilal (default) vs Al-Ettifaq
  'ALH:ettifaq': { primary: '#5C2D91', secondary: '#FFFFFF', monogram: 'ETF' },
  // WOL collision: Wolverhampton Wanderers (default) vs VfL Wolfsburg
  'WOL:wolfsburg': { primary: '#65B32E', secondary: '#FFFFFF', monogram: 'WOB' },
}

/**
 * Alias codes — maps alternative club codes (used in messy real-world transfer
 * data) to the canonical code in CRESTS. Example: the DB stores "BAY" for
 * Bayern Munich, "BAR" for Barcelona, "HIL" for Al-Hilal, "CFC" for Chelsea,
 * "MCFC" for Manchester City, etc.
 */
const CODE_ALIASES: Record<string, string> = {
  // Bayern Munich
  BAY: 'FCB',
  BMG: 'FCB',
  // Barcelona
  BAR: 'FCB',
  FCBAR: 'FCB',
  // Al-Hilal
  HIL: 'ALH',
  // Chelsea
  CFC: 'CHE',
  // Manchester City
  MCFC: 'MCI',
  // Manchester United
  MUFC: 'MUN',
  // Aston Villa
  AVFC: 'AVL',
  // Newcastle
  NUFC: 'NEW',
  // Leicester
  LCFC: 'LEI',
  // Leeds
  LU: 'LEE',
  LUFC: 'LEE',
  // Coventry
  CCFC: 'COV',
  // Wolves
  WWFC: 'WOL',
  // Eintracht Frankfurt
  EIN: 'FRA',
  SGE: 'FRA',
  // Köln
  FCK: 'KOE',
  // Union Berlin (not in base map — add inline below)
  UB: 'UNI',
  // Toulouse (not in base map)
  TOU: 'TFC',
  // Fenerbahce (not in base map)
  FEN: 'FEN',
  // LA Galaxy (not in base map)
  LAG: 'LAG',
  // Inter Miami (not in base map)
  IM: 'IMI',
  // Deportivo La Coruña (not in base map)
  DEP: 'DEP',
  // Rayo Vallecano (not in base map)
  RVA: 'RVA',
}

/**
 * Clubs not in the base CRESTS map but present in real transfer data.
 * Keyed by their own code so the resolver finds them directly.
 */
const EXTRA_CRESTS: Record<string, ClubCrest> = {
  // Union Berlin
  UNI: { primary: '#1A1A1A', secondary: '#D2122E', monogram: 'UNI' },
  // Toulouse FC
  TFC: { primary: '#5B2333', secondary: '#FFFFFF', monogram: 'TFC' },
  // Fenerbahce
  FEN: { primary: '#1A237E', secondary: '#FFEB3B', monogram: 'FEN' },
  // LA Galaxy
  LAG: { primary: '#002F65', secondary: '#FECF09', monogram: 'LAG' },
  // Inter Miami
  IMI: { primary: '#F7B5CD', secondary: '#231F20', monogram: 'IMI' },
  // Deportivo La Coruña
  DEP: { primary: '#0033A0', secondary: '#FFFFFF', monogram: 'DEP' },
  // Rayo Vallecano
  RVA: { primary: '#E53027', secondary: '#FFFFFF', monogram: 'RAY' },
}

/**
 * Name → canonical code map for fuzzy name-based resolution. Used when a code
 * isn't recognized — the resolver matches the club NAME against these keywords.
 */
const NAME_KEYWORDS: Array<{ keywords: string[]; code: string }> = [
  { keywords: ['arsenal'], code: 'ARS' },
  { keywords: ['chelsea'], code: 'CHE' },
  { keywords: ['liverpool'], code: 'LIV' },
  { keywords: ['man city', 'manchester city'], code: 'MCI' },
  { keywords: ['man united', 'manchester united', 'man utd'], code: 'MUN' },
  { keywords: ['tottenham', 'spurs'], code: 'TOT' },
  { keywords: ['newcastle'], code: 'NEW' },
  { keywords: ['aston villa'], code: 'AVL' },
  { keywords: ['brighton'], code: 'BHA' },
  { keywords: ['west ham'], code: 'WHU' },
  { keywords: ['everton'], code: 'EVE' },
  { keywords: ['fulham'], code: 'FUL' },
  { keywords: ['wolves', 'wolverhampton'], code: 'WOL' },
  { keywords: ['crystal palace'], code: 'CRY' },
  { keywords: ['bournemouth'], code: 'BOU' },
  { keywords: ['brentford'], code: 'BRE' },
  { keywords: ['nottingham forest', 'forest'], code: 'NFO' },
  { keywords: ['leeds'], code: 'LEE' },
  { keywords: ['leicester'], code: 'LEI' },
  { keywords: ['southampton'], code: 'SOU' },
  { keywords: ['ipswich'], code: 'IPS' },
  { keywords: ['burnley'], code: 'BURN' },
  { keywords: ['sunderland'], code: 'SUN' },
  { keywords: ['coventry'], code: 'COV' },
  // La Liga
  { keywords: ['barcelona', 'barca'], code: 'FCB' },
  { keywords: ['real madrid'], code: 'RMA' },
  { keywords: ['atletico', 'atlético'], code: 'ATM' },
  { keywords: ['athletic bilbao', 'athletic club'], code: 'ATH' },
  { keywords: ['sevilla'], code: 'SEV' },
  { keywords: ['villarreal'], code: 'VIL' },
  { keywords: ['betis'], code: 'BET' },
  { keywords: ['sociedad'], code: 'RSO' },
  { keywords: ['valencia'], code: 'VAL' },
  { keywords: ['getafe'], code: 'GET' },
  { keywords: ['osasuna'], code: 'OSA' },
  { keywords: ['celta'], code: 'CEL' },
  { keywords: ['mallorca'], code: 'MALL' },
  { keywords: ['girona'], code: 'GIR' },
  { keywords: ['rayo vallecano', 'rayo'], code: 'RVA' },
  { keywords: ['deportivo'], code: 'DEP' },
  // Serie A
  { keywords: ['inter milan', 'inter '], code: 'INT' },
  { keywords: ['ac milan', 'milan'], code: 'MIL' },
  { keywords: ['juventus', 'juve'], code: 'JUV' },
  { keywords: ['napoli'], code: 'NAP' },
  { keywords: ['roma'], code: 'ROM' },
  { keywords: ['lazio'], code: 'LAZ' },
  { keywords: ['atalanta'], code: 'ATA' },
  { keywords: ['fiorentina'], code: 'FIO' },
  { keywords: ['bologna'], code: 'BOL' },
  { keywords: ['torino'], code: 'TOR' },
  { keywords: ['udinese'], code: 'UDI' },
  { keywords: ['sassuolo'], code: 'SAS' },
  { keywords: ['genoa'], code: 'GEN' },
  { keywords: ['cagliari'], code: 'CAG' },
  { keywords: ['parma'], code: 'PAR' },
  { keywords: ['lecce'], code: 'LEC' },
  { keywords: ['como'], code: 'COM' },
  // Bundesliga
  { keywords: ['bayern'], code: 'FCB' },
  { keywords: ['leverkusen'], code: 'B04' },
  { keywords: ['dortmund'], code: 'BVB' },
  { keywords: ['leipzig'], code: 'RBL' },
  { keywords: ['stuttgart'], code: 'STU' },
  { keywords: ['frankfurt', 'eintracht'], code: 'FRA' },
  { keywords: ['wolfsburg'], code: 'WOB' },
  { keywords: ['mainz'], code: 'M05' },
  { keywords: ['freiburg'], code: 'SGF' },
  { keywords: ['hoffenheim'], code: 'HEI' },
  { keywords: ['augsburg'], code: 'AUG' },
  { keywords: ['werder', 'bremen'], code: 'BRE' },
  { keywords: ['köln', 'koln', 'cologne'], code: 'KOE' },
  { keywords: ['bochum'], code: 'BOC' },
  { keywords: ['st pauli'], code: 'STP' },
  { keywords: ['holstein kiel', 'kiel'], code: 'HOL' },
  { keywords: ['union berlin'], code: 'UNI' },
  // Ligue 1
  { keywords: ['paris saint', 'psg'], code: 'PSG' },
  { keywords: ['marseille', 'olympique marseille'], code: 'OM' },
  { keywords: ['lyon'], code: 'LYO' },
  { keywords: ['monaco'], code: 'MON' },
  { keywords: ['lille'], code: 'LIL' },
  { keywords: ['nice'], code: 'NCE' },
  { keywords: ['rennes'], code: 'REN' },
  // Other European
  { keywords: ['porto'], code: 'POR' },
  { keywords: ['benfica'], code: 'BEN' },
  { keywords: ['sporting'], code: 'SCP' },
  { keywords: ['ajax'], code: 'AJA' },
  { keywords: ['psv'], code: 'PSV' },
  { keywords: ['feyenoord'], code: 'FEY' },
  { keywords: ['shakhtar'], code: 'SHK' },
  { keywords: ['fenerbahce', 'fenerbahçe'], code: 'FEN' },
  { keywords: ['toulouse'], code: 'TFC' },
  // Saudi
  { keywords: ['al-nassr', 'al nassr', 'nassr'], code: 'ALN' },
  { keywords: ['al-hilal', 'al hilal', 'hilal'], code: 'ALH' },
  { keywords: ['al-ahli', 'al ahli'], code: 'AHA' },
  { keywords: ['al-ittihad', 'al ittihad', 'ittihad'], code: 'ITT' },
  { keywords: ['al-ettifaq', 'al ettifaq', 'ettifaq'], code: 'ALH' },
  // MLS / Other
  { keywords: ['la galaxy', 'galaxy'], code: 'LAG' },
  { keywords: ['inter miami'], code: 'IMI' },
]

/** Neutral fallback crest for unknown clubs. */
const FALLBACK_CREST: ClubCrest = {
  primary: '#6B7280',
  secondary: '#FFFFFF',
  monogram: '—',
}

/**
 * Try to resolve a club NAME to a crest via keyword matching. Returns null if
 * no keyword matches. Used as a fallback when the code isn't recognized.
 */
function resolveByName(name: string): ClubCrest | null {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of NAME_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        const canonical = entry.code
        // Check overrides for the resolved code + this name (Bayern/Bremen/etc.)
        for (const [key, crest] of Object.entries(CREST_OVERRIDES)) {
          const [c] = key.split(':')
          if (c === canonical && lower.includes(key.split(':')[1])) return crest
        }
        return CRESTS[canonical] ?? EXTRA_CRESTS[canonical] ?? null
      }
    }
  }
  return null
}

/**
 * Resolve a club code (+ optional name for disambiguation) to a crest.
 *
 * Resolution order:
 *  1. If a name is provided, check CREST_OVERRIDES for colliding codes.
 *  2. Look up the code directly in CRESTS.
 *  3. Look up the code in EXTRA_CRESTS (clubs not in the base map).
 *  4. Resolve the code via CODE_ALIASES → CRESTS/EXTRA_CRESTS.
 *  5. If still unresolved and a name is provided, fuzzy-match by name.
 *  6. Fall back to the neutral gray crest.
 */
export function getClubCrest(code: string, name?: string): ClubCrest {
  const upperCode = code?.toUpperCase().trim()
  const lowerName = name?.toLowerCase().trim()

  // 1. If a name is provided, check overrides for colliding codes.
  if (lowerName && upperCode) {
    for (const key of Object.keys(CREST_OVERRIDES)) {
      const [c, nameSnippet] = key.split(':')
      if (c === upperCode && lowerName.includes(nameSnippet)) {
        return CREST_OVERRIDES[key]
      }
    }
  }

  // 2. Direct code lookup
  if (upperCode && CRESTS[upperCode]) return CRESTS[upperCode]

  // 3. Extra crests (clubs not in the base map)
  if (upperCode && EXTRA_CRESTS[upperCode]) return EXTRA_CRESTS[upperCode]

  // 4. Alias resolution
  if (upperCode && CODE_ALIASES[upperCode]) {
    const canonical = CODE_ALIASES[upperCode]
    if (CREST_OVERRIDES[`${canonical}:${lowerName}`]) {
      return CREST_OVERRIDES[`${canonical}:${lowerName}`]
    }
    // For aliased colliding codes (e.g. BAY→FCB), check name-based override
    if (lowerName) {
      for (const key of Object.keys(CREST_OVERRIDES)) {
        const [c, nameSnippet] = key.split(':')
        if (c === canonical && lowerName.includes(nameSnippet)) {
          return CREST_OVERRIDES[key]
        }
      }
    }
    if (CRESTS[canonical]) return CRESTS[canonical]
    if (EXTRA_CRESTS[canonical]) return EXTRA_CRESTS[canonical]
  }

  // 5. Name-based fuzzy resolution
  if (lowerName) {
    const byName = resolveByName(lowerName)
    if (byName) return byName
  }

  // 6. Fallback
  return FALLBACK_CREST
}

/**
 * Compute relative luminance of a hex color (0-1). Used to pick a readable
 * text color (dark text on light fills, white text on dark fills).
 */
export function hexLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** True when the fill is light enough that dark text reads better. */
export function shouldUseDarkText(primaryHex: string): boolean {
  return hexLuminance(primaryHex) > 0.6
}
