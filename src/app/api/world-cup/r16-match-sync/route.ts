import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

/**
 * R16 match-status sync.
 *
 * Detects newly-completed R16 matches via real z-ai-web-dev-sdk web_search +
 * page_reader, and transitions the corresponding Match rows from
 * upcoming → completed with the real homeScore/awayScore.
 *
 * ANTI-HALLUCINATION CONTRACT (non-negotiable):
 *   - Only update a match if a score is EXPLICITLY found in the web source.
 *   - Never guess. If a match isn't found, leave it 'upcoming'.
 *   - Skip matches whose scheduled kickoff is still in the future (no score can exist yet).
 *   - Reject any captured score > 15 (no real soccer knockout score exceeds this).
 *   - Reject any captured "score" in 1900-2099 range (year-string collision).
 *   - Require the score to appear within 300 chars of BOTH "2026" and "Round of 16"
 *     so historical fixtures don't bleed through.
 *   - Log every transition (and every rejection) for auditability.
 *
 * Sources consulted: Wikipedia 2026_FIFA_World_Cup_knockout_stage page,
 * ESPN schedule, Aljazeera R16 schedule, Olympics.com bracket.
 *
 * Auth: admin password OR X-Cron-Secret (same as r16-cron).
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

const CODE_TO_NAME: Record<string, string> = {
  CAN: 'canada', MAR: 'morocco', PAR: 'paraguay', FRA: 'france',
  BRA: 'brazil', NOR: 'norway', ENG: 'england', MEX: 'mexico',
  POR: 'portugal', ESP: 'spain', USA: 'united states', BEL: 'belgium',
  ARG: 'argentina', EGY: 'egypt', SUI: 'switzerland', COL: 'colombia',
}

// Maximum plausible soccer knockout scoreline. Anything higher is rejected
// (e.g., "BRA 2026 NOR" would otherwise capture 2026 as a score).
const MAX_PLAUSIBLE_SCORE = 15

// Year-range rejection: a captured number in 1900-2099 is almost certainly a
// year string that bled into the regex, not a real goal tally.
function looksLikeYear(n: number): boolean {
  return n >= 1900 && n <= 2099
}

// Require the matched scoreline to be within `radius` chars of a 2026 date
// marker AND a "Round of 16" / "knockout" context marker. This prevents
// historical fixtures (e.g., POR 0-3 ESP from 2018) from being captured.
function hasDateAndStageContext(
  combinedText: string,
  matchIndex: number,
  radius = 300
): boolean {
  const start = Math.max(0, matchIndex - radius)
  const end = Math.min(combinedText.length, matchIndex + radius)
  const window = combinedText.slice(start, end).toLowerCase()
  const has2026 = /\b2026\b/.test(window)
  const hasStage =
    /round of 16|r16|knockout/.test(window)
  return has2026 && hasStage
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return unauthorizedResponse()
  }

  try {
    const upcoming = await db.match.findMany({
      where: { group: 'R16', status: 'upcoming' },
    })

    if (upcoming.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No upcoming R16 matches to sync.',
        checked: 0,
        updated: 0,
      })
    }

    // ANTI-HALLUCINATION: skip matches that haven't kicked off yet.
    // We add a 3-hour buffer to avoid edge cases around kickoff time, and
    // also require the match's scheduled date to be on or before today.
    const now = new Date()
    const eligible = upcoming.filter((m) => {
      if (!m.matchDate) return false
      const kickoff = new Date(m.matchDate)
      const threeHoursMs = 3 * 60 * 60 * 1000
      return kickoff.getTime() + threeHoursMs <= now.getTime()
    })

    if (eligible.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No R16 matches have kicked off yet — nothing to sync.',
        checked: upcoming.length,
        skippedFuture: upcoming.length,
        updated: 0,
      })
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    let combinedText = ''
    const today = new Date().toISOString().slice(0, 10)
    try {
      const searchResults = await zai.functions.invoke('web_search', {
        query: `"2026 FIFA World Cup" "Round of 16" results ${today} site:en.wikipedia.org OR site:espn.com OR site:aljazeera.com`,
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
      console.warn('[r16-match-sync] web_search failed:', err)
    }

    const transitions: string[] = []
    const rejections: string[] = []

    for (const match of eligible) {
      const homeName = CODE_TO_NAME[match.homeTeamCode] ?? match.homeTeamCode
      const awayName = CODE_TO_NAME[match.awayTeamCode] ?? match.awayTeamCode

      // Build candidate patterns. We use a tighter character window (25 chars)
      // and require word boundaries so that "BRA 2026 NOR" (date string with
      // no separator) does NOT match the code pattern.
      const patterns = [
        {
          // "Spain 2-1 Austria" (full names, 0-25 char gap)
          regex: new RegExp(
            `\\b${homeName}\\b[\\s\\S]{0,25}?(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\b[\\s\\S]{0,25}?\\b${awayName}\\b`,
            'i'
          ),
          homeFirst: true,
        },
        {
          // "Austria 1-2 Spain" (full names reversed)
          regex: new RegExp(
            `\\b${awayName}\\b[\\s\\S]{0,25}?(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\b[\\s\\S]{0,25}?\\b${homeName}\\b`,
            'i'
          ),
          homeFirst: false,
        },
        {
          // "ESP 2-1 AUT" (FIFA codes) — MUST have whitespace boundaries to
          // avoid colliding with date strings like "BRA 2026 NOR".
          regex: new RegExp(
            `\\b${match.homeTeamCode}\\b\\s+(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+\\b${match.awayTeamCode}\\b`,
            'i'
          ),
          homeFirst: true,
        },
      ]

      let foundHome: number | null = null
      let foundAway: number | null = null
      let rejectionReason = 'no scoreline pattern matched'

      for (const { regex, homeFirst } of patterns) {
        const matchResult = regex.exec(combinedText)
        if (!matchResult) continue

        const first = parseInt(matchResult[1])
        const second = parseInt(matchResult[2])

        // ANTI-HALLUCINATION GUARD 1: reject year-string collisions.
        if (looksLikeYear(first) || looksLikeYear(second)) {
          rejectionReason = `captured numbers look like years (${first}-${second})`
          continue
        }

        // ANTI-HALLUCINATION GUARD 2: reject implausible scores.
        if (first > MAX_PLAUSIBLE_SCORE || second > MAX_PLAUSIBLE_SCORE) {
          rejectionReason = `captured scores exceed ${MAX_PLAUSIBLE_SCORE} (${first}-${second})`
          continue
        }

        // ANTI-HALLUCINATION GUARD 3: require 2026 + Round-of-16 context
        // within 300 chars of the matched scoreline.
        if (!hasDateAndStageContext(combinedText, matchResult.index ?? 0)) {
          rejectionReason = `no "2026 + Round of 16" context near scoreline (${first}-${second})`
          continue
        }

        if (homeFirst) {
          foundHome = first
          foundAway = second
        } else {
          foundHome = second
          foundAway = first
        }
        break
      }

      if (foundHome !== null && foundAway !== null) {
        await db.match.update({
          where: { id: match.id },
          data: {
            homeScore: foundHome,
            awayScore: foundAway,
            status: 'completed',
          },
        })
        const msg = `[r16-match-sync] ${match.homeTeamCode} ${foundHome}-${foundAway} ${match.awayTeamCode} → completed (verified via web source)`
        console.log(msg)
        transitions.push(msg)
      } else {
        const msg = `[r16-match-sync] ${match.homeTeamCode} vs ${match.awayTeamCode}: rejected — ${rejectionReason} — leaving 'upcoming'`
        console.log(msg)
        rejections.push(msg)
      }
    }

    return NextResponse.json({
      ok: true,
      checked: upcoming.length,
      eligible: eligible.length,
      skippedFuture: upcoming.length - eligible.length,
      updated: transitions.length,
      rejected: rejections.length,
      transitions,
      rejections,
    })
  } catch (error) {
    console.error('[r16-match-sync] failed:', error)
    return NextResponse.json(
      { error: 'R16 match sync failed', details: String(error) },
      { status: 500 }
    )
  }
}

export const POST = GET
