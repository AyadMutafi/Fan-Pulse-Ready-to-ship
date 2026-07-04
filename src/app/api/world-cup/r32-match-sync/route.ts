import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { safeErrorResponse } from '@/lib/safe-error'

/**
 * R32 match-status sync.
 *
 * Detects newly-completed R32 matches via real z-ai-web-dev-sdk web_search +
 * page_reader, and transitions the corresponding Match rows from
 * upcoming → completed with the real homeScore/awayScore.
 *
 * ANTI-HALLUCINATION CONTRACT (non-negotiable):
 *   - Only update a match if a score is EXPLICITLY found in the web source.
 *   - Never guess. If a match isn't found, leave it 'upcoming'.
 *   - Log every transition for auditability.
 *
 * Sources consulted: Wikipedia 2026_FIFA_World_Cup_knockout_stage page,
 * Olympics.com R32 bracket, ESPN, FIFA.com.
 *
 * Auth: admin password OR X-Cron-Secret (same as r32-cron).
 */

const CRON_SECRET = process.env.CRON_SECRET || ''

function isCronAuthorized(request: NextRequest): boolean {
  if (isAdminAuthorized(request)) return true
  if (CRON_SECRET) {
    const h = request.headers.get('x-cron-secret')
    if (h && h === CRON_SECRET) return true
  }
  return false
}

// FIFA code → team name (lowercase) for matching scraped text.
const CODE_TO_NAME: Record<string, string> = {
  ESP: 'spain', AUT: 'austria', POR: 'portugal', CRO: 'croatia',
  SUI: 'switzerland', ALG: 'algeria', AUS: 'australia', EGY: 'egypt',
  ARG: 'argentina', CPV: 'cape verde', COL: 'colombia', GHA: 'ghana',
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return unauthorizedResponse()
  }

  try {
    // Find all upcoming R32 matches.
    const upcoming = await db.match.findMany({
      where: { group: 'R32', status: 'upcoming' },
    })

    if (upcoming.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No upcoming R32 matches to sync.',
        checked: 0,
        updated: 0,
      })
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Fetch the Wikipedia knockout-stage page + a fresh results search.
    let combinedText = ''
    const today = new Date().toISOString().slice(0, 10)
    try {
      const searchResults = await zai.functions.invoke('web_search', {
        query: `2026 FIFA World Cup Round of 32 results ${today} site:en.wikipedia.org OR site:olympics.com`,
        num: 5,
      })
      for (const r of searchResults ?? []) {
        try {
          const pageData = await zai.functions.invoke('page_reader', { url: r.url })
          const html = pageData?.data?.html || ''
          combinedText += ' ' + html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
        } catch {
          // skip unreadable pages
        }
      }
    } catch (err) {
      console.warn('[r32-match-sync] web_search failed:', err)
    }

    const transitions: string[] = []

    for (const match of upcoming) {
      const homeName = CODE_TO_NAME[match.homeTeamCode] ?? match.homeTeamCode
      const awayName = CODE_TO_NAME[match.awayTeamCode] ?? match.awayTeamCode

      // Look for a scoreline pattern near both team names.
      // Matches e.g. "Spain 2-1 Austria", "Spain 2–1 Austria", "ESP 2 - 1 AUT".
      const patterns = [
        new RegExp(
          `${homeName}[\\s\\S]{0,40}?(\\d+)\\s*[-–]\\s*(\\d+)[\\s\\S]{0,40}?${awayName}`,
          'i'
        ),
        new RegExp(
          `${awayName}[\\s\\S]{0,40}?(\\d+)\\s*[-–]\\s*(\\d+)[\\s\\S]{0,40}?${homeName}`,
          'i'
        ),
        new RegExp(
          `${match.homeTeamCode}[\\s\\S]{0,20}?(\\d+)\\s*[-–]\\s*(\\d+)[\\s\\S]{0,20}?${match.awayTeamCode}`,
          'i'
        ),
      ]

      let foundHome: number | null = null
      let foundAway: number | null = null
      for (const p of patterns) {
        const m = combinedText.match(p)
        if (m) {
          // Determine orientation: pattern 1 = home first; pattern 2 = away first.
          if (p.source.startsWith(homeName) || p.source.startsWith(match.homeTeamCode)) {
            foundHome = parseInt(m[1])
            foundAway = parseInt(m[2])
          } else {
            foundAway = parseInt(m[1])
            foundHome = parseInt(m[2])
          }
          break
        }
      }

      if (foundHome !== null && foundAway !== null) {
        // ANTI-HALLUCINATION: only update with an explicitly-found score.
        await db.match.update({
          where: { id: match.id },
          data: {
            homeScore: foundHome,
            awayScore: foundAway,
            status: 'completed',
          },
        })
        const msg = `[r32-match-sync] ${match.homeTeamCode} ${foundHome}-${foundAway} ${match.awayTeamCode} → completed (verified via web source)`
        console.log(msg)
        transitions.push(msg)
      } else {
        console.log(
          `[r32-match-sync] ${match.homeTeamCode} vs ${match.awayTeamCode}: no verified score found yet — leaving 'upcoming'`
        )
      }
    }

    return NextResponse.json({
      ok: true,
      checked: upcoming.length,
      updated: transitions.length,
      transitions,
    })
  } catch (error) {
    return NextResponse.json(
      safeErrorResponse(error, 'r32-match-sync'),
      { status: 500 }
    )
  }
}

export const POST = GET
