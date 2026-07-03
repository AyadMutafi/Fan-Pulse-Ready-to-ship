import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { NATIONAL_TEAMS } from '@/lib/national-teams'

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000
let lastFetchTime = 0
let cachedResults: any = null

/**
 * Anti-hallucination guard: the canonical set of 48 verified World Cup 2026 team codes.
 * Any scraped match whose home/away team code is NOT in this set MUST be skipped —
 * otherwise friendlies, qualifiers, or unrelated ESPN/FIFA articles would create
 * phantom WC matches in the database, polluting the verified data.
 * Source of truth: src/lib/national-teams.ts NATIONAL_TEAMS.
 */
const WC_2026_TEAM_CODES: ReadonlySet<string> = new Set(
  NATIONAL_TEAMS.map(t => t.code)
)

export async function GET() {
  try {
    // Check cache
    const now = Date.now()
    if (cachedResults && (now - lastFetchTime) < CACHE_DURATION) {
      return NextResponse.json({ source: 'cache', ...cachedResults })
    }

    const zai = await ZAI.create()

    // Step 1: Search for latest WC2026 results from ESPN
    const searchResults = await zai.functions.invoke('web_search', {
      query: 'FIFA World Cup 2026 group stage results scores site:espn.com',
      num: 5
    })

    // Step 2: Read the ESPN results page
    let matchData: Array<{
      homeTeam: string; awayTeam: string
      homeScore: number; awayScore: number
      group: string; matchDate: string; status: string
    }> = []

    for (const result of searchResults) {
      if (result.url.includes('espn.com')) {
        try {
          const pageData = await zai.functions.invoke('page_reader', {
            url: result.url
          })
          const html = pageData.data?.html || ''
          // Parse the ESPN page for match results
          // Look for patterns like "Group A: Mexico 2-0 South Africa"
          const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

          // Extract completed matches with scores
          const completedPattern = /Group\s+([A-L]):\s+([A-Za-z\s]+?)\s+(\d+)\s*[-–]\s*(\d+)\s+([A-Za-z\s]+)/g
          let match
          while ((match = completedPattern.exec(plainText)) !== null) {
            matchData.push({
              group: match[1],
              homeTeam: match[2].trim(),
              homeScore: parseInt(match[3]),
              awayScore: parseInt(match[4]),
              awayTeam: match[5].trim(),
              matchDate: '', // will be inferred from context
              status: 'completed'
            })
          }

          // Also extract upcoming matches (no score)
          const upcomingPattern = /Group\s+([A-L]):\s+([A-Za-z\s]+?)\s+vs\.?\s+([A-Za-z\s]+)/g
          while ((match = upcomingPattern.exec(plainText)) !== null) {
            // Check if this match already exists in our data
            const exists = matchData.some(m =>
              m.group === match[1] &&
              (m.homeTeam.includes(match[2].trim()) || m.awayTeam.includes(match[3].trim()))
            )
            if (!exists) {
              matchData.push({
                group: match[1],
                homeTeam: match[2].trim(),
                homeScore: 0,
                awayScore: 0,
                awayTeam: match[3].trim(),
                matchDate: '',
                status: 'upcoming'
              })
            }
          }

          if (matchData.length > 0) break // Found data, no need to check more URLs
        } catch (e) {
          console.error('Failed to read ESPN page:', e)
        }
      }
    }

    // Step 3: Also search FIFA.com for additional match data
    try {
      const fifaResults = await zai.functions.invoke('web_search', {
        query: 'FIFA World Cup 2026 results group stage scores site:fifa.com',
        num: 3
      })

      for (const result of fifaResults) {
        if (result.url.includes('fifa.com')) {
          try {
            const pageData = await zai.functions.invoke('page_reader', {
              url: result.url
            })
            const html = pageData.data?.html || ''
            const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

            // FIFA.com may use different formatting patterns
            // Try patterns like "Mexico 2-0 South Africa" with group context nearby
            const fifaScorePattern = /([A-Za-z\s]+?)\s+(\d+)\s*[-–]\s*(\d+)\s+([A-Za-z\s]+)/g
            let match
            while ((match = fifaScorePattern.exec(plainText)) !== null) {
              const homeName = match[1].trim()
              const awayName = match[4].trim()
              // Only add if not already captured and names look like countries
              const alreadyExists = matchData.some(m =>
                (m.homeTeam.includes(homeName) && m.awayTeam.includes(awayName)) ||
                (m.homeTeam.includes(awayName) && m.awayTeam.includes(homeName))
              )
              if (!alreadyExists && homeName.length > 2 && awayName.length > 2) {
                matchData.push({
                  group: '', // group may not be directly next to score on FIFA pages
                  homeTeam: homeName,
                  homeScore: parseInt(match[2]),
                  awayScore: parseInt(match[3]),
                  awayTeam: awayName,
                  matchDate: '',
                  status: 'completed'
                })
              }
            }
          } catch (e) {
            console.error('Failed to read FIFA page:', e)
          }
        }
      }
    } catch (e) {
      console.error('FIFA search failed:', e)
    }

    // Step 4: Also search SofaScore for supplemental data
    try {
      const sofaResults = await zai.functions.invoke('web_search', {
        query: 'FIFA World Cup 2026 results group stage scores site:sofascore.com',
        num: 3
      })
      // Could parse SofaScore pages similarly, but ESPN is primary source
      // Log for debugging
      console.log(`SofaScore search returned ${sofaResults?.length || 0} results`)
    } catch (e) {
      console.error('SofaScore search failed:', e)
    }

    // Step 5: Map team names to codes and update database
    // ONLY the 48 verified World Cup 2026 team codes are mapped here.
    // Non-WC teams (Denmark, Italy, Chile, Nigeria, Peru, Jamaica, Costa Rica,
    // Wales, Poland, Honduras, Iceland, Cameroon, ...) have been removed so that
    // the ESPN/FIFA scraper cannot create phantom WC matches from friendlies or
    // qualifiers. Cross-referenced against src/lib/national-teams.ts NATIONAL_TEAMS.
    const TEAM_NAME_TO_CODE: Record<string, string> = {
      // ── Group A ── Mexico, South Africa, Korea Republic, Czechia
      'mexico': 'MEX', 'south africa': 'RSA',
      'south korea': 'KOR', 'korea republic': 'KOR',
      'czechia': 'CZE', 'czech republic': 'CZE',
      // ── Group B ── Canada, Bosnia and Herzegovina, Qatar, Switzerland
      'canada': 'CAN',
      'bosnia': 'BIH', 'bosnia and herzegovina': 'BIH',
      'qatar': 'QAT', 'switzerland': 'SUI',
      // ── Group C ── Brazil, Haiti, Morocco, Scotland
      'brazil': 'BRA', 'haiti': 'HAI',
      'morocco': 'MAR', 'scotland': 'SCO',
      // ── Group D ── USA, Paraguay, Australia, Türkiye
      'united states': 'USA', 'paraguay': 'PAR', 'australia': 'AUS',
      'turkiye': 'TUR', 'turkey': 'TUR',
      // ── Group E ── Germany, Curaçao, Côte d'Ivoire, Ecuador
      'germany': 'GER', 'curacao': 'CUW', 'curaçao': 'CUW',
      'ecuador': 'ECU',
      'ivory coast': 'CIV', "côte d'ivoire": 'CIV', "cote d'ivoire": 'CIV',
      // ── Group F ── Netherlands, Japan, Sweden, Tunisia
      'netherlands': 'NED', 'japan': 'JPN', 'sweden': 'SWE', 'tunisia': 'TUN',
      // ── Group G ── Belgium, Egypt, Iran, New Zealand
      'belgium': 'BEL', 'egypt': 'EGY', 'iran': 'IRN', 'new zealand': 'NZL',
      // ── Group H ── Spain, Cape Verde, Saudi Arabia, Uruguay
      'spain': 'ESP', 'cape verde': 'CPV', 'cabo verde': 'CPV',
      'saudi arabia': 'KSA', 'uruguay': 'URU',
      // ── Group I ── France, Senegal, Iraq, Norway
      'france': 'FRA', 'senegal': 'SEN', 'iraq': 'IRQ', 'norway': 'NOR',
      // ── Group J ── Argentina, Algeria, Austria, Jordan
      'argentina': 'ARG', 'algeria': 'ALG', 'austria': 'AUT', 'jordan': 'JOR',
      // ── Group K ── Portugal, DR Congo, Uzbekistan, Colombia
      'portugal': 'POR',
      'dr congo': 'COD', 'congo dr': 'COD',
      'uzbekistan': 'UZB', 'colombia': 'COL',
      // ── Group L ── England, Croatia, Ghana, Panama
      'england': 'ENG', 'croatia': 'CRO', 'ghana': 'GHA', 'panama': 'PAN',
    }

    // Map team name to FIFA code
    function getTeamCode(name: string): string | null {
      const lower = name.toLowerCase().trim()
      for (const [key, code] of Object.entries(TEAM_NAME_TO_CODE)) {
        if (lower.includes(key)) return code
      }
      return null
    }

    // Team info for creating matches — exactly the 48 verified WC 2026 teams.
    // Non-WC entries (DEN, NGA, CMR, ITA, CHI, PER, JAM, CRC, WAL, POL, HON, ISL)
    // have been removed; the 12 WC 2026 teams that were previously missing
    // (QAT, HAI, CIV, TUN, EGY, IRN, IRQ, NOR, AUT, JOR, COD, PAN) have been added.
    // Cross-referenced against src/lib/national-teams.ts NATIONAL_TEAMS.
    const TEAM_INFO: Record<string, { name: string; flag: string }> = {
      // ── Group A ──
      MEX: { name: 'Mexico', flag: '🇲🇽' }, RSA: { name: 'South Africa', flag: '🇿🇦' },
      KOR: { name: 'South Korea', flag: '🇰🇷' }, CZE: { name: 'Czechia', flag: '🇨🇿' },
      // ── Group B ──
      CAN: { name: 'Canada', flag: '🇨🇦' }, BIH: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
      QAT: { name: 'Qatar', flag: '🇶🇦' }, SUI: { name: 'Switzerland', flag: '🇨🇭' },
      // ── Group C ──
      BRA: { name: 'Brazil', flag: '🇧🇷' }, HAI: { name: 'Haiti', flag: '🇭🇹' },
      MAR: { name: 'Morocco', flag: '🇲🇦' }, SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
      // ── Group D ──
      USA: { name: 'United States', flag: '🇺🇸' }, PAR: { name: 'Paraguay', flag: '🇵🇾' },
      AUS: { name: 'Australia', flag: '🇦🇺' }, TUR: { name: 'Turkiye', flag: '🇹🇷' },
      // ── Group E ──
      GER: { name: 'Germany', flag: '🇩🇪' }, CUW: { name: 'Curacao', flag: '🇨🇼' },
      CIV: { name: "Côte d'Ivoire", flag: '🇨🇮' }, ECU: { name: 'Ecuador', flag: '🇪🇨' },
      // ── Group F ──
      NED: { name: 'Netherlands', flag: '🇳🇱' }, JPN: { name: 'Japan', flag: '🇯🇵' },
      SWE: { name: 'Sweden', flag: '🇸🇪' }, TUN: { name: 'Tunisia', flag: '🇹🇳' },
      // ── Group G ──
      BEL: { name: 'Belgium', flag: '🇧🇪' }, EGY: { name: 'Egypt', flag: '🇪🇬' },
      IRN: { name: 'Iran', flag: '🇮🇷' }, NZL: { name: 'New Zealand', flag: '🇳🇿' },
      // ── Group H ──
      ESP: { name: 'Spain', flag: '🇪🇸' }, CPV: { name: 'Cape Verde', flag: '🇨🇻' },
      KSA: { name: 'Saudi Arabia', flag: '🇸🇦' }, URU: { name: 'Uruguay', flag: '🇺🇾' },
      // ── Group I ──
      FRA: { name: 'France', flag: '🇫🇷' }, SEN: { name: 'Senegal', flag: '🇸🇳' },
      IRQ: { name: 'Iraq', flag: '🇮🇶' }, NOR: { name: 'Norway', flag: '🇳🇴' },
      // ── Group J ──
      ARG: { name: 'Argentina', flag: '🇦🇷' }, ALG: { name: 'Algeria', flag: '🇩🇿' },
      AUT: { name: 'Austria', flag: '🇦🇹' }, JOR: { name: 'Jordan', flag: '🇯🇴' },
      // ── Group K ──
      POR: { name: 'Portugal', flag: '🇵🇹' }, COD: { name: 'DR Congo', flag: '🇨🇩' },
      UZB: { name: 'Uzbekistan', flag: '🇺🇿' }, COL: { name: 'Colombia', flag: '🇨🇴' },
      // ── Group L ──
      ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, CRO: { name: 'Croatia', flag: '🇭🇷' },
      GHA: { name: 'Ghana', flag: '🇬🇭' }, PAN: { name: 'Panama', flag: '🇵🇦' },
    }

    // Step 6: Update database with fetched match data
    let updated = 0
    let created = 0
    for (const match of matchData) {
      const homeCode = getTeamCode(match.homeTeam)
      const awayCode = getTeamCode(match.awayTeam)
      if (!homeCode || !awayCode) {
        console.warn(`Could not map teams: ${match.homeTeam} vs ${match.awayTeam}`)
        continue
      }

      // Anti-hallucination guard: both teams must be in the verified WC 2026
      // 48-team set (sourced from NATIONAL_TEAMS). This prevents phantom WC
      // matches from being created when the ESPN/FIFA regex scraper picks up
      // scorelines involving non-WC teams (e.g. friendlies, qualifiers, youth
      // tournaments). Skipped matches are logged for auditability.
      if (!WC_2026_TEAM_CODES.has(homeCode) || !WC_2026_TEAM_CODES.has(awayCode)) {
        console.warn(
          `Skipping non-WC2026 match: ${match.homeTeam} (${homeCode}) vs ${match.awayTeam} (${awayCode}) — one or both teams not in WC 2026 48-team set`
        )
        continue
      }

      const homeInfo = TEAM_INFO[homeCode]
      const awayInfo = TEAM_INFO[awayCode]
      if (!homeInfo || !awayInfo) continue

      // Try to find existing match by team codes
      const existing = await db.match.findFirst({
        where: {
          homeTeamCode: homeCode,
          awayTeamCode: awayCode,
          league: 'WC',
        }
      })

      if (existing) {
        // Update existing match
        await db.match.update({
          where: { id: existing.id },
          data: {
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            status: match.status,
            ...(match.group && { group: match.group }),
            ...(match.matchDate && { matchDate: new Date(match.matchDate) }),
          }
        })
        updated++
      } else {
        // Create new match
        await db.match.create({
          data: {
            homeTeamCode: homeCode,
            homeTeamName: homeInfo.name,
            homeTeamFlag: homeInfo.flag,
            awayTeamCode: awayCode,
            awayTeamName: awayInfo.name,
            awayTeamFlag: awayInfo.flag,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            status: match.status,
            league: 'WC',
            group: match.group,
            ...(match.matchDate && { matchDate: new Date(match.matchDate) }),
            homeSentiment: match.homeScore > match.awayScore ? 70 : match.homeScore === match.awayScore ? 50 : 30,
            awaySentiment: match.awayScore > match.homeScore ? 70 : match.homeScore === match.awayScore ? 50 : 30,
          }
        })
        created++
      }
    }

    const result = {
      source: 'live',
      fetchedAt: new Date().toISOString(),
      matchesProcessed: matchData.length,
      updated,
      created,
    }

    cachedResults = result
    lastFetchTime = now

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch live matches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch live matches', details: String(error) },
      { status: 500 }
    )
  }
}
