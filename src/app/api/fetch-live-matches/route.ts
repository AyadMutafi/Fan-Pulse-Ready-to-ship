import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000
let lastFetchTime = 0
let cachedResults: any = null

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
    const TEAM_NAME_TO_CODE: Record<string, string> = {
      'mexico': 'MEX', 'south africa': 'RSA', 'south korea': 'KOR', 'korea republic': 'KOR',
      'czechia': 'CZE', 'czech republic': 'CZE', 'canada': 'CAN',
      'bosnia': 'BIH', 'bosnia and herzegovina': 'BIH',
      'switzerland': 'SUI', 'denmark': 'DEN',
      'brazil': 'BRA', 'morocco': 'MAR', 'scotland': 'SCO',
      'cape verde': 'CPV', 'cabo verde': 'CPV',
      'united states': 'USA', 'paraguay': 'PAR', 'australia': 'AUS',
      'turkiye': 'TUR', 'turkey': 'TUR',
      'germany': 'GER', 'curacao': 'CUW', 'curaçao': 'CUW',
      'sweden': 'SWE', 'nigeria': 'NGA',
      'argentina': 'ARG', 'colombia': 'COL', 'uzbekistan': 'UZB', 'cameroon': 'CMR',
      'italy': 'ITA', 'chile': 'CHI', 'ecuador': 'ECU', 'algeria': 'ALG',
      'france': 'FRA', 'portugal': 'POR', 'peru': 'PER', 'jamaica': 'JAM',
      'netherlands': 'NED', 'senegal': 'SEN', 'costa rica': 'CRC', 'wales': 'WAL',
      'england': 'ENG', 'uruguay': 'URU', 'poland': 'POL', 'ghana': 'GHA',
      'spain': 'ESP', 'croatia': 'CRO', 'honduras': 'HON', 'iceland': 'ISL',
      'japan': 'JPN', 'belgium': 'BEL', 'new zealand': 'NZL', 'saudi arabia': 'KSA',
      // Additional common name variants
      'qatar': 'QAT', 'haiti': 'HAI', 'iran': 'IRI', 'egypt': 'EGY',
      'iraq': 'IRQ', 'norway': 'NOR', 'austria': 'AUT', 'jordan': 'JOR',
      'ivory coast': 'CIV', "côte d'ivoire": 'CIV', "cote d'ivoire": 'CIV',
      'dr congo': 'COD', 'congo dr': 'COD', 'panama': 'PAN',
    }

    // Map team name to FIFA code
    function getTeamCode(name: string): string | null {
      const lower = name.toLowerCase().trim()
      for (const [key, code] of Object.entries(TEAM_NAME_TO_CODE)) {
        if (lower.includes(key)) return code
      }
      return null
    }

    // Team info for creating matches — 48 WC 2026 teams
    const TEAM_INFO: Record<string, { name: string; flag: string }> = {
      MEX: { name: 'Mexico', flag: '🇲🇽' }, RSA: { name: 'South Africa', flag: '🇿🇦' },
      KOR: { name: 'South Korea', flag: '🇰🇷' }, CZE: { name: 'Czechia', flag: '🇨🇿' },
      CAN: { name: 'Canada', flag: '🇨🇦' }, BIH: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
      SUI: { name: 'Switzerland', flag: '🇨🇭' }, DEN: { name: 'Denmark', flag: '🇩🇰' },
      BRA: { name: 'Brazil', flag: '🇧🇷' }, MAR: { name: 'Morocco', flag: '🇲🇦' },
      SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }, CPV: { name: 'Cape Verde', flag: '🇨🇻' },
      USA: { name: 'United States', flag: '🇺🇸' }, PAR: { name: 'Paraguay', flag: '🇵🇾' },
      AUS: { name: 'Australia', flag: '🇦🇺' }, TUR: { name: 'Turkiye', flag: '🇹🇷' },
      GER: { name: 'Germany', flag: '🇩🇪' }, CUW: { name: 'Curacao', flag: '🇨🇼' },
      SWE: { name: 'Sweden', flag: '🇸🇪' }, NGA: { name: 'Nigeria', flag: '🇳🇬' },
      ARG: { name: 'Argentina', flag: '🇦🇷' }, COL: { name: 'Colombia', flag: '🇨🇴' },
      UZB: { name: 'Uzbekistan', flag: '🇺🇿' }, CMR: { name: 'Cameroon', flag: '🇨🇲' },
      ITA: { name: 'Italy', flag: '🇮🇹' }, CHI: { name: 'Chile', flag: '🇨🇱' },
      ECU: { name: 'Ecuador', flag: '🇪🇨' }, ALG: { name: 'Algeria', flag: '🇩🇿' },
      FRA: { name: 'France', flag: '🇫🇷' }, POR: { name: 'Portugal', flag: '🇵🇹' },
      PER: { name: 'Peru', flag: '🇵🇪' }, JAM: { name: 'Jamaica', flag: '🇯🇲' },
      NED: { name: 'Netherlands', flag: '🇳🇱' }, SEN: { name: 'Senegal', flag: '🇸🇳' },
      CRC: { name: 'Costa Rica', flag: '🇨🇷' }, WAL: { name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
      ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, URU: { name: 'Uruguay', flag: '🇺🇾' },
      POL: { name: 'Poland', flag: '🇵🇱' }, GHA: { name: 'Ghana', flag: '🇬🇭' },
      ESP: { name: 'Spain', flag: '🇪🇸' }, CRO: { name: 'Croatia', flag: '🇭🇷' },
      HON: { name: 'Honduras', flag: '🇭🇳' }, ISL: { name: 'Iceland', flag: '🇮🇸' },
      JPN: { name: 'Japan', flag: '🇯🇵' }, BEL: { name: 'Belgium', flag: '🇧🇪' },
      NZL: { name: 'New Zealand', flag: '🇳🇿' }, KSA: { name: 'Saudi Arabia', flag: '🇸🇦' },
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
