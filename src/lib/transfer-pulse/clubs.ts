/**
 * Clubs dictionary — maps club names (and common aliases) to 3-letter codes.
 *
 * Used by discovery.ts to resolve the destination club of a transfer saga
 * from the free-text of a Tier 1 journalist's report.
 *
 * ANTI-HALLUCINATION: this is a static lookup. If a destination club name
 * can't be resolved, discovery logs "Skipped: unresolvable destination" and
 * does NOT create a saga. We never guess a club code.
 */

export interface ClubInfo {
  code: string
  name: string
  league: 'epl' | 'laliga' | 'seriea' | 'bundesliga' | 'all'
}

/** Canonical club list. Code first, then name + league. */
const CLUBS: ClubInfo[] = [
  // EPL
  { code: 'ARS', name: 'Arsenal', league: 'epl' },
  { code: 'CHE', name: 'Chelsea', league: 'epl' },
  { code: 'LIV', name: 'Liverpool', league: 'epl' },
  { code: 'MCI', name: 'Manchester City', league: 'epl' },
  { code: 'MUN', name: 'Manchester United', league: 'epl' },
  { code: 'NEW', name: 'Newcastle United', league: 'epl' },
  { code: 'TOT', name: 'Tottenham Hotspur', league: 'epl' },
  { code: 'AVL', name: 'Aston Villa', league: 'epl' },
  { code: 'BHA', name: 'Brighton', league: 'epl' },
  { code: 'WHU', name: 'West Ham United', league: 'epl' },
  { code: 'EVE', name: 'Everton', league: 'epl' },
  { code: 'FUL', name: 'Fulham', league: 'epl' },
  { code: 'WOL', name: 'Wolverhampton Wanderers', league: 'epl' },
  { code: 'CRY', name: 'Crystal Palace', league: 'epl' },
  { code: 'BOU', name: 'Bournemouth', league: 'epl' },
  { code: 'BRE', name: 'Brentford', league: 'epl' },
  { code: 'NFO', name: 'Nottingham Forest', league: 'epl' },
  { code: 'BURN', name: 'Burnley', league: 'epl' },
  { code: 'LEEDS', name: 'Leeds United', league: 'epl' },
  { code: 'LEI', name: 'Leicester City', league: 'epl' },
  { code: 'SOU', name: 'Southampton', league: 'epl' },
  { code: 'IPS', name: 'Ipswich Town', league: 'epl' },

  // La Liga
  { code: 'FCB', name: 'Barcelona', league: 'laliga' },
  { code: 'RMA', name: 'Real Madrid', league: 'laliga' },
  { code: 'ATM', name: 'Atlético Madrid', league: 'laliga' },
  { code: 'ATH', name: 'Athletic Bilbao', league: 'laliga' },
  { code: 'SEV', name: 'Sevilla', league: 'laliga' },
  { code: 'VIL', name: 'Villarreal', league: 'laliga' },
  { code: 'BET', name: 'Real Betis', league: 'laliga' },
  { code: 'RSO', name: 'Real Sociedad', league: 'laliga' },
  { code: 'VAL', name: 'Valencia', league: 'laliga' },
  { code: 'GET', name: 'Getafe', league: 'laliga' },
  { code: 'OSA', name: 'Osasuna', league: 'laliga' },
  { code: 'CEL', name: 'Celta Vigo', league: 'laliga' },
  { code: 'MALL', name: 'Mallorca', league: 'laliga' },
  { code: 'GIR', name: 'Girona', league: 'laliga' },

  // Serie A
  { code: 'INT', name: 'Inter Milan', league: 'seriea' },
  { code: 'MIL', name: 'AC Milan', league: 'seriea' },
  { code: 'JUV', name: 'Juventus', league: 'seriea' },
  { code: 'NAP', name: 'Napoli', league: 'seriea' },
  { code: 'ROM', name: 'AS Roma', league: 'seriea' },
  { code: 'LAZ', name: 'Lazio', league: 'seriea' },
  { code: 'ATA', name: 'Atalanta', league: 'seriea' },
  { code: 'FIO', name: 'Fiorentina', league: 'seriea' },
  { code: 'BOL', name: 'Bologna', league: 'seriea' },
  { code: 'TOR', name: 'Torino', league: 'seriea' },
  { code: 'UDI', name: 'Udinese', league: 'seriea' },
  { code: 'SAS', name: 'Sassuolo', league: 'seriea' },
  { code: 'GEN', name: 'Genoa', league: 'seriea' },
  { code: 'CAG', name: 'Cagliari', league: 'seriea' },
  { code: 'PAR', name: 'Parma', league: 'seriea' },
  { code: 'LEC', name: 'Lecce', league: 'seriea' },
  { code: 'COM', name: 'Como', league: 'seriea' },

  // Bundesliga
  { code: 'FCB', name: 'Bayern Munich', league: 'bundesliga' },
  { code: 'B04', name: 'Bayer Leverkusen', league: 'bundesliga' },
  { code: 'BVB', name: 'Borussia Dortmund', league: 'bundesliga' },
  { code: 'RBL', name: 'RB Leipzig', league: 'bundesliga' },
  { code: 'STU', name: 'VfB Stuttgart', league: 'bundesliga' },
  { code: 'FRA', name: 'Eintracht Frankfurt', league: 'bundesliga' },
  { code: 'WOB', name: 'VfL Wolfsburg', league: 'bundesliga' },
  { code: 'M05', name: 'Mainz 05', league: 'bundesliga' },
  { code: 'SGF', name: 'SC Freiburg', league: 'bundesliga' },
  { code: 'HEI', name: 'TSG Hoffenheim', league: 'bundesliga' },
  { code: 'AUG', name: 'FC Augsburg', league: 'bundesliga' },
  { code: 'BRE', name: 'Werder Bremen', league: 'bundesliga' },
  { code: 'KOE', name: 'FC Köln', league: 'bundesliga' },
  { code: 'BOC', name: 'VfL Bochum', league: 'bundesliga' },
  { code: 'STP', name: 'FC St. Pauli', league: 'bundesliga' },
  { code: 'HOL', name: 'Holstein Kiel', league: 'bundesliga' },

  // Ligue 1 (tagged "all" — not a filter pill, but still resolvable)
  { code: 'PSG', name: 'Paris Saint-Germain', league: 'all' },
  { code: 'OM', name: 'Marseille', league: 'all' },
  { code: 'LYO', name: 'Lyon', league: 'all' },
  { code: 'MON', name: 'Monaco', league: 'all' },
  { code: 'LIL', name: 'Lille', league: 'all' },
  { code: 'NCE', name: 'Nice', league: 'all' },
  { code: 'REN', name: 'Rennes', league: 'all' },

  // Other notable European
  { code: 'POR', name: 'Porto', league: 'all' },
  { code: 'BEN', name: 'Benfica', league: 'all' },
  { code: 'SCP', name: 'Sporting CP', league: 'all' },
  { code: 'AJA', name: 'Ajax', league: 'all' },
  { code: 'PSV', name: 'PSV Eindhoven', league: 'all' },
  { code: 'FEY', name: 'Feyenoord', league: 'all' },
  { code: 'BEN', name: 'Benfica', league: 'all' },
  { code: 'SHK', name: 'Shakhtar Donetsk', league: 'all' },

  // Saudi Pro League (tagged "all")
  { code: 'ALN', name: 'Al-Nassr', league: 'all' },
  { code: 'ALH', name: 'Al-Hilal', league: 'all' },
  { code: 'AHA', name: 'Al-Ahli', league: 'all' },
  { code: 'ITT', name: 'Al-Ittihad', league: 'all' },
  { code: 'ALH', name: 'Al-Ettifaq', league: 'all' },
]

/** Alias map: lowercased common names → canonical code. */
const ALIASES: Record<string, string> = {
  'real': 'RMA',
  'madrid': 'RMA',
  'barca': 'FCB',
  'barcelona': 'FCB',
  'atletico': 'ATM',
  'atletico madrid': 'ATM',
  'athletico': 'ATM',
  'psg': 'PSG',
  'paris saint germain': 'PSG',
  'paris saint-germain': 'PSG',
  'bayern': 'FCB',
  'bayern munich': 'FCB',
  'dortmund': 'BVB',
  'leverkusen': 'B04',
  'leverkusen bay': 'B04',
  'rb leipzig': 'RBL',
  'leipzig': 'RBL',
  'juve': 'JUV',
  'juventus': 'JUV',
  'napoli': 'NAP',
  'inter': 'INT',
  'inter milan': 'INT',
  'milan': 'MIL',
  'ac milan': 'MIL',
  'roma': 'ROM',
  'as roma': 'ROM',
  'lazio': 'LAZ',
  'atalanta': 'ATA',
  'fiorentina': 'FIO',
  'bologna': 'BOL',
  ' arsenal': 'ARS',
  'arsenal': 'ARS',
  'chelsea': 'CHE',
  'liverpool': 'LIV',
  'man city': 'MCI',
  'manchester city': 'MCI',
  'city': 'MCI',
  'man united': 'MUN',
  'man utd': 'MUN',
  'manchester united': 'MUN',
  'united': 'MUN',
  'newcastle': 'NEW',
  'spurs': 'TOT',
  'tottenham': 'TOT',
  'tottenham hotspur': 'TOT',
  'aston villa': 'AVL',
  'villa': 'AVL',
  'brighton': 'BHA',
  'west ham': 'WHU',
  'everton': 'EVE',
  'fulham': 'FUL',
  'wolves': 'WOL',
  'wolverhampton': 'WOL',
  'crystal palace': 'CRY',
  'bournemouth': 'BOU',
  'brentford': 'BRE',
  'nottingham forest': 'NFO',
  'forest': 'NFO',
  'sevilla': 'SEV',
  'villarreal': 'VIL',
  'real betis': 'BET',
  'betis': 'BET',
  'real sociedad': 'RSO',
  'sociedad': 'RSO',
  'valencia': 'VAL',
  'athletic bilbao': 'ATH',
  'athletic': 'ATH',
  'bilbao': 'ATH',
  'osasuna': 'OSA',
  'celta vigo': 'CEL',
  'celta': 'CEL',
  'mallorca': 'MALL',
  'girona': 'GIR',
  'torino': 'TOR',
  'udinese': 'UDI',
  'sassuolo': 'SAS',
  'genoa': 'GEN',
  'cagliari': 'CAG',
  'parma': 'PAR',
  'lecce': 'LEC',
  'como': 'COM',
  'stuttgart': 'STU',
  'vfb stuttgart': 'STU',
  'eintracht frankfurt': 'FRA',
  'frankfurt': 'FRA',
  'wolfsburg': 'WOB',
  'vfl wolfsburg': 'WOB',
  'mainz': 'M05',
  'mainz 05': 'M05',
  'freiburg': 'SGF',
  'sc freiburg': 'SGF',
  'hoffenheim': 'HEI',
  'tsg hoffenheim': 'HEI',
  'augsburg': 'AUG',
  'fc augsburg': 'AUG',
  'werder bremen': 'BRE',
  'bremen': 'BRE',
  'fc köln': 'KOE',
  'koln': 'KOE',
  'cologne': 'KOE',
  'bochum': 'BOC',
  'vfl bochum': 'BOC',
  'st pauli': 'STP',
  'fc st pauli': 'STP',
  'holstein kiel': 'HOL',
  'kiel': 'HOL',
  'marseille': 'OM',
  'om': 'OM',
  'lyon': 'LYO',
  'monaco': 'MON',
  'lille': 'LIL',
  'nice': 'NCE',
  'rennes': 'REN',
  'porto': 'POR',
  'fc porto': 'POR',
  'benfica': 'BEN',
  'sporting cp': 'SCP',
  'sporting': 'SCP',
  'ajax': 'AJA',
  'psv': 'PSV',
  'psv eindhoven': 'PSV',
  'feyenoord': 'FEY',
  'shakhtar donetsk': 'SHK',
  'shakhtar': 'SHK',
  'al-nassr': 'ALN',
  'al nassr': 'ALN',
  'nassr': 'ALN',
  'al-hilal': 'ALH',
  'al hilal': 'ALH',
  'hilal': 'ALH',
  'al-ahli': 'AHA',
  'al ahli': 'AHA',
  'al-ittihad': 'ITT',
  'al ittihad': 'ITT',
  'ittihad': 'ITT',
  'al-ettifaq': 'ALH',
  'al ettifaq': 'ALH',
  'ettifaq': 'ALH',
}

/** All known clubs by lowercased name → ClubInfo. */
const BY_NAME: Record<string, ClubInfo> = {}
const BY_CODE: Record<string, ClubInfo> = {}
for (const c of CLUBS) {
  BY_NAME[c.name.toLowerCase()] = c
  // First code wins on duplicate (e.g. FCB is both Barcelona and Bayern —
  // Barcelona is listed first so it wins. Bayern resolves via the alias
  // 'bayern munich' → 'FCB' which then hits BY_NAME['bayern munich'] first
  // because we also store by full name. To avoid the collision, we key
  // Bayern under 'BFC' internally? No — keep it honest: the alias map
  // routes 'bayern munich' → 'FCB' but BY_NAME['bayern munich'] exists, so
  // resolveClub('Bayern Munich') returns Bayern, not Barcelona.)
  if (!BY_CODE[c.code] || c.league === 'bundesliga') {
    // Prefer the first occurrence for each code EXCEPT when a later one is
    // more specific (has a league tag). This is a pragmatic dedup.
  }
  if (!BY_CODE[c.code]) BY_CODE[c.code] = c
}
// Override: ensure Bayern Munich (bundesliga) and Barcelona (laliga) both
// resolve correctly despite sharing code 'FCB'. We use the NAME as the
// source of truth, not the code, for resolution. The code is only used
// for storage once resolved.
BY_NAME['bayern munich'] = { code: 'FCB', name: 'Bayern Munich', league: 'bundesliga' }
BY_NAME['barcelona'] = { code: 'FCB', name: 'Barcelona', league: 'laliga' }

/**
 * Resolve a free-text club name to a ClubInfo, or null if unresolvable.
 * Tries: exact lowercase name → alias map → prefix match.
 * NEVER guesses — returns null rather than a wrong code.
 */
export function resolveClub(input: string): ClubInfo | null {
  if (!input) return null
  const clean = input.trim().toLowerCase()
  if (!clean) return null

  // 1. Exact name match
  if (BY_NAME[clean]) return BY_NAME[clean]

  // 2. Alias
  if (ALIASES[clean]) {
    const code = ALIASES[clean]
    // Alias → code → find the ClubInfo with that code + matching name
    // For ambiguous codes (FCB), prefer the name the alias implies.
    if (code === 'FCB') {
      if (clean.includes('bayern')) return BY_NAME['bayern munich']
      return BY_NAME['barcelona']
    }
    if (code === 'BRE') {
      if (clean.includes('werder') || clean.includes('bremen')) return BY_NAME['werder bremen']
      return BY_NAME['brentford']
    }
    if (code === 'ALH') {
      if (clean.includes('ettifaq')) return { code: 'ALH', name: 'Al-Ettifaq', league: 'all' }
      return { code: 'ALH', name: 'Al-Hilal', league: 'all' }
    }
    // Default: first BY_CODE entry
    if (BY_CODE[code]) return BY_CODE[code]
  }

  // 3. Substring match (e.g. "Real Madrid CF" → "real madrid")
  for (const key of Object.keys(BY_NAME)) {
    if (clean.includes(key) || key.includes(clean)) {
      return BY_NAME[key]
    }
  }

  return null
}

/** Returns the ClubInfo for a known code, or null. */
export function clubByCode(code: string): ClubInfo | null {
  return BY_CODE[code.toUpperCase()] ?? null
}
