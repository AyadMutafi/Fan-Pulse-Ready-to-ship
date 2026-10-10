import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { NATIONAL_TEAMS } from '@/lib/national-teams'
import { safeErrorResponse } from '@/lib/safe-error'
import { getSdk } from '@/lib/ai/providers/zai'

// Lazy ZAI SDK loader (BUILD-SAFE) — kept for backward compat if needed
let _zai: any = null
async function getZAI() {
  if (_zai) return _zai
  _zai = await getSdk()
  return _zai
}

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000
let lastFetchTime = 0
let cachedResults: any = null

const WC_2026_TEAM_CODES: ReadonlySet<string> = new Set(
  NATIONAL_TEAMS.map(t => t.code)
)

export async function GET() {
  try {
    const now = Date.now()
    if (cachedResults && (now - lastFetchTime) < CACHE_DURATION) {
      return NextResponse.json({ source: 'cache', ...cachedResults })
    }

    const zai = await getZAI()
    if (!zai) {
      return NextResponse.json(
        { error: 'Z.ai SDK unavailable' },
        { status: 503 }
      )
    }

    // Step 1: Search for latest WC2026 results from ESPN
    const searchResults = await zai.functions.invoke('web_search', {
      query: 'FIFA World Cup 2026 group stage results scores site:espn.com',
      num: 5
    })

    let matchData: Array<{
      homeTeam: string; awayTeam: string
      homeScore: number; awayScore: number
      group: string; matchDate: string; status: string
    }> = []

    for (const result of searchResults) {
      if (result.url.includes('espn.com')) {
        try {
          const pageData = await zai.functions.invoke('page_reader', { url: result.url })
          const html = pageData.data?.html || ''
          const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

          const completedPattern = /Group\s+([A-L]):\s+([A-Za-z\s]+?)\s+(\d+)\s*[-–]\s*(\d+)\s+([A-Za-z\s]+)/g
          let match
          while ((match = completedPattern.exec(plainText)) !== null) {
            matchData.push({
              group: match[1],
              homeTeam: match[2].trim(),
              homeScore: parseInt(match[3]),
              awayScore: parseInt(match[4]),
              awayTeam: match[5].trim(),
              matchDate: '',
              status: 'completed'
            })
          }

          const upcomingPattern = /Group\s+([A-L]):\s+([A-Za-z\s]+?)\s+vs\.?\s+([A-Za-z\s]+)/g
          while ((match = upcomingPattern.exec(plainText)) !== null) {
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

          if (matchData.length > 0) break
        } catch (e) {
          console.error('Failed to read ESPN page:', e)
        }
      }
    }

    // Step 2: Search FIFA.com
    try {
      const fifaResults = await zai.functions.invoke('web_search', {
        query: 'FIFA World Cup 2026 results group stage scores site:fifa.com',
        num: 3
      })

      for (const result of fifaResults) {
        if (result.url.includes('fifa.com')) {
          try {
            const pageData = await zai.functions.invoke('page_reader', { url: result.url })
            const html = pageData.data?.html || ''
            const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

            const fifaScorePattern = /([A-Za-z\s]+?)\s+(\d+)\s*[-–]\s*(\d+)\s+([A-Za-z\s]+)/g
            let match
            while ((match = fifaScorePattern.exec(plainText)) !== null) {
              const homeName = match[1].trim()
              const awayName = match[4].trim()
              const alreadyExists = matchData.some(m =>
                (m.homeTeam.includes(homeName) && m.awayTeam.includes(awayName)) ||
                (m.homeTeam.includes(awayName) && m.awayTeam.includes(homeName))
              )
              if (!alreadyExists && homeName.length > 2 && awayName.length > 2) {
                matchData.push({
                  group: '',
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

    const TEAM_NAME_TO_CODE: Record<string, string> = {
      'mexico': 'MEX', 'south africa': 'RSA',
      'south korea': 'KOR', 'korea republic': 'KOR',
      'czechia': 'CZE', 'czech republic': 'CZE',
      'canada': 'CAN',
      'bosnia': 'BIH', 'bosnia and herzegovina': 'BIH',
      'qatar': 'QAT', 'switzerland': 'SUI',
      'brazil': 'BRA', 'haiti': 'HAI',
      'morocco': 'MAR', 'scotland': 'SCO',
      'united states': 'USA', 'paraguay': 'PAR', 'australia': 'AUS',
      'turkiye': 'TUR', 'turkey': 'TUR',
      'germany': 'GER', 'curacao': 'CUW', 'curaçao': 'CUW',
      'ecuador': 'ECU',
      'ivory coast': 'CIV', "côte d'ivoire": 'CIV', "cote d'ivoire": 'CIV',
      'netherlands': 'NED', 'japan': 'JPN', 'sweden': 'SWE', 'tunisia': 'TUN',
      'belgium': 'BEL', 'egypt': 'EGY', 'iran': 'IRN', 'new zealand': 'NZL',
      'spain': 'ESP', 'cape verde': 'CPV', 'cabo verde': 'CPV',
      'saudi arabia': 'KSA', 'uruguay': 'URU',
      'france': 'FRA', 'senegal': 'SEN', 'iraq': 'IRQ', 'norway': 'NOR',
      'argentina': 'ARG', 'algeria': 'ALG', 'austria': 'AUT', 'jordan': 'JOR',
      'portugal': 'POR',
      'dr congo': 'COD', 'congo dr': 'COD',
      'uzbekistan': 'UZB', 'colombia': 'COL',
      'england': 'ENG', 'croatia': 'CRO', 'ghana': 'GHA', 'panama': 'PAN',
    }

    function getTeamCode(name: string): string | null {
      const lower = name.toLowerCase().trim()
      for (const [key, code] of Object.entries(TEAM_NAME_TO_CODE)) {
        if (lower.includes(key)) return code
      }
      return null
    }

    const TEAM_INFO: Record<string, { name: string; flag: string }> = {
      MEX: { name: 'Mexico', flag: '🇲🇽' }, RSA: { name: 'South Africa', flag: '🇿🇦' },
      KOR: { name: 'South Korea', flag: '🇰🇷' }, CZE: { name: 'Czechia', flag: '🇨🇿' },
      CAN: { name: 'Canada', flag: '🇨🇦' }, BIH: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
      QAT: { name: 'Qatar', flag: '🇶🇦' }, SUI: { name: 'Switzerland', flag: '🇨🇭' },
      BRA: { name: 'Brazil', flag: '🇧🇷' }, HAI: { name: 'Haiti', flag: '🇭🇹' },
      MAR: { name: 'Morocco', flag: '🇲🇦' }, SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
      USA: { name: 'United States', flag: '🇺🇸' }, PAR: { name: 'Paraguay', flag: '🇵🇾' },
      AUS: { name: 'Australia', flag: '🇦🇺' }, TUR: { name: 'Turkiye', flag: '🇹🇷' },
      GER: { name: 'Germany', flag: '🇩🇪' }, CUW: { name: 'Curacao', flag: '🇨🇼' },
      CIV: { name: "Côte d'Ivoire", flag: '🇨🇮' }, ECU: { name: 'Ecuador', flag: '🇪🇨' },
      NED: { name: 'Netherlands', flag: '🇳🇱' }, JPN: { name: 'Japan', flag: '🇯🇵' },
      SWE: { name: 'Sweden', flag: '🇸🇪' }, TUN: { name: 'Tunisia', flag: '🇹🇳' },
      BEL: { name: 'Belgium', flag: '🇧🇪' }, EGY: { name: 'Egypt', flag: '🇪🇬' },
      IRN: { name: 'Iran', flag: '🇮🇷' }, NZL: { name: 'New Zealand', flag: '🇳🇿' },
      ESP: { name: 'Spain', flag: '🇪🇸' }, CPV: { name: 'Cape Verde', flag: '🇨🇻' },
      KSA: { name: 'Saudi Arabia', flag: '🇸🇦' }, URU: { name: 'Uruguay', flag: '🇺🇾' },
      FRA: { name: 'France', flag: '🇫🇷' }, SEN: { name: 'Senegal', flag: '🇸🇳' },
      IRQ: { name: 'Iraq', flag: '🇮🇶' }, NOR: { name: 'Norway', flag: '🇳🇴' },
      ARG: { name: 'Argentina', flag: '🇦🇷' }, ALG: { name: 'Algeria', flag: '🇩🇿' },
      AUT: { name: 'Austria', flag: '🇦🇹' }, JOR: { name: 'Jordan', flag: '🇯🇴' },
      POR: { name: 'Portugal', flag: '🇵🇹' }, COD: { name: 'DR Congo', flag: '🇨🇩' },
      UZB: { name: 'Uzbekistan', flag: '🇺🇿' }, COL: { name: 'Colombia', flag: '🇨🇴' },
      ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, CRO: { name: 'Croatia', flag: '🇭🇷' },
      GHA: { name: 'Ghana', flag: '🇬🇭' }, PAN: { name: 'Panama', flag: '🇵🇦' },
    }

    let updated = 0
    let created = 0
    for (const match of matchData) {
      const homeCode = getTeamCode(match.homeTeam)
      const awayCode = getTeamCode(match.awayTeam)
      if (!homeCode || !awayCode) continue

      if (!WC_2026_TEAM_CODES.has(homeCode) || !WC_2026_TEAM_CODES.has(awayCode)) {
        continue
      }

      const homeInfo = TEAM_INFO[homeCode]
      const awayInfo = TEAM_INFO[awayCode]
      if (!homeInfo || !awayInfo) continue

      const existing = await db.match.findFirst({
        where: { homeTeamCode: homeCode, awayTeamCode: awayCode, league: 'WC' }
      })

      if (existing) {
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
    return NextResponse.json(
      safeErrorResponse(error, 'fetch-live-matches'),
      { status: 500 }
    )
  }
}
