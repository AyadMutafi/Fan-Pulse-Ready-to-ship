import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes — scanning 20 players takes ~1-2 min

/**
 * POST /api/cron/scan-epl-sentiment
 *
 * Scans X.com for fan posts about EPL players and updates their sentiment
 * scores in the database. This is what powers the TOTW rank emojis — the
 * sentiment comes from REAL fan reactions on X.com, scored by AI.
 *
 * AUTH: caller must send either:
 *   - x-admin-password header matching process.env.ADMIN_PASSWORD
 *   - X-Cron-Secret header matching process.env.CRON_SECRET
 *
 * Body (optional):
 *   { matchweek: number }  — which matchweek to scan for (default: latest completed)
 *   { limit: number }      — max players to scan (default: 20)
 *
 * WHAT IT DOES:
 *   1. Gets the latest completed matchweek from LeagueMatch
 *   2. Gets the top N LeaguePlayers by pulseScore
 *   3. For each player, searches X.com via xAI for fan posts
 *   4. Scores the sentiment of those posts via AI (Grok → Cerebras → Groq → Z.ai)
 *   5. Updates LeaguePlayer.sentiment with the REAL fan sentiment score
 *   6. The TOTW generator then uses this sentiment for ranking + rank emojis
 *
 * TRIGGER:
 *   curl -X POST https://your-app.onrender.com/api/cron/scan-epl-sentiment \
 *        -H "X-Cron-Secret: $CRON_SECRET" \
 *        -H "Content-Type: application/json" \
 *        -d '{"matchweek": 1, "limit": 20}'
 */
export async function POST(request: NextRequest) {
  const adminPwd = request.headers.get('x-admin-password')
  const cronSecret = request.headers.get('x-cron-secret')

  // ── Auth ──
  const expectedAdmin = process.env.ADMIN_PASSWORD || ''
  const expectedCron = process.env.CRON_SECRET || ''

  const adminOk = adminPwd && expectedAdmin && adminPwd === expectedAdmin
  const cronOk = cronSecret && expectedCron && cronSecret === expectedCron

  if (!adminOk && !cronOk) {
    return NextResponse.json(
      { error: 'Unauthorized — need valid x-admin-password or X-Cron-Secret header' },
      { status: 401 },
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(50, Math.max(1, body.limit ?? 20))

    // Get the latest completed matchweek if not specified
    let matchweek = body.matchweek
    if (!matchweek) {
      const latest = await db.leagueMatch.findFirst({
        where: { league: 'EPL', season: '2026-27', status: 'completed' },
        orderBy: { matchweek: 'desc' },
        select: { matchweek: true },
      })
      matchweek = latest?.matchweek ?? 1
    }

    // Check if xAI is configured
    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'XAI_API_KEY not configured — cannot scan X.com for fan sentiment',
          matchweek,
        },
        { status: 503 },
      )
    }

    // Import the scanner (dynamic import to avoid loading on every request)
    const { scanEPLPlayerSentiments } = await import('@/lib/epl-sentiment-scanner')

    console.log(`[api/cron/scan-epl-sentiment] Starting scan for matchweek ${matchweek}, limit ${limit}`)

    const result = await scanEPLPlayerSentiments(db, matchweek, limit)

    console.log(
      `[api/cron/scan-epl-sentiment] Done: ${result.scanned} scanned, ${result.updated} updated, ${result.errors} errors`,
    )

    return NextResponse.json({
      success: true,
      matchweek,
      scanned: result.scanned,
      updated: result.updated,
      errors: result.errors,
      results: result.results.map((r) => ({
        player: r.playerName,
        team: r.teamCode,
        posts: r.postCount,
        sentiment: r.sentimentScore,
        topQuote: r.topQuote,
        error: r.error,
      })),
    })
  } catch (err) {
    console.error('[api/cron/scan-epl-sentiment] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Sentiment scan failed',
        details: String(err).slice(0, 200),
      },
      { status: 500 },
    )
  }
}

/**
 * GET /api/cron/scan-epl-sentiment
 * Same as POST but allows cron services that can't send POST bodies.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
