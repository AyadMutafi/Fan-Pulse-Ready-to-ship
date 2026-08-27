import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes — the background scan runs after we respond

/**
 * POST /api/cron/scan-epl-sentiment
 *
 * Scans X.com for fan posts about EPL players and updates their sentiment
 * scores in the database. This is what powers the TOTW rank emojis — the
 * sentiment comes from REAL fan reactions on X.com, scored by AI.
 *
 * FIRE-AND-FORGET DESIGN:
 *   cron-job.org free tier has a 30-second timeout. The full scan of 20
 *   players takes 1-2 minutes (each player needs an xAI search + AI sentiment
 *   scoring). So this endpoint returns IMMEDIATELY (< 1 second) with
 *   "scan started" and runs the actual scan in the background.
 *
 *   The scan continues running on the server even after the HTTP response
 *   is sent. The next cron run will pick up where this one left off (it
 *   scans the top N players by pulseScore who haven't been scanned recently).
 *
 * AUTH: caller must send either:
 *   - x-admin-password header matching process.env.ADMIN_PASSWORD
 *   - X-Cron-Secret header matching process.env.CRON_SECRET
 *
 * Body (optional):
 *   { limit: number }  — max players to scan per run (default: 5, max: 10)
 *                       Small batch = faster background run = no timeout
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

  // Check if xAI is configured
  if (!process.env.XAI_API_KEY) {
    return NextResponse.json(
      { error: 'XAI_API_KEY not configured — cannot scan X.com' },
      { status: 503 },
    )
  }

  // Parse body (but don't block on it)
  let limit = 5 // Small batch: 5 players per run = ~30-60 seconds in background
  try {
    const body = await request.json().catch(() => ({}))
    limit = Math.min(10, Math.max(1, body.limit ?? 5))
  } catch {
    // Default limit = 5
  }

  // Get the latest completed matchweek (quick query, < 100ms)
  let matchweek = 1
  try {
    const latest = await db.leagueMatch.findFirst({
      where: { league: 'EPL', season: '2026-27', status: 'completed' },
      orderBy: { matchweek: 'desc' },
      select: { matchweek: true },
    })
    matchweek = latest?.matchweek ?? 1
  } catch {
    // Default to matchweek 1
  }

  // ── FIRE AND FORGET ────────────────────────────────────────────────────
  // Start the scan in the background. We do NOT await it — the response
  // is sent immediately so cron-job.org doesn't timeout.
  // The scan continues running on the server after the response is sent.
  ;(async () => {
    try {
      console.log(`[api/cron/scan-epl-sentiment] Background scan starting: matchweek ${matchweek}, limit ${limit}`)

      const { scanEPLPlayerSentiments } = await import('@/lib/epl-sentiment-scanner')
      const result = await scanEPLPlayerSentiments(db, matchweek, limit)

      console.log(
        `[api/cron/scan-epl-sentiment] Background scan done: ${result.scanned} scanned, ${result.updated} updated, ${result.errors} errors`,
      )

      // Log individual results for debugging
      for (const r of result.results) {
        if (r.error) {
          console.warn(`[scan-epl-sentiment] ${r.playerName} (${r.teamCode}): ${r.error}`)
        } else {
          console.log(`[scan-epl-sentiment] ${r.playerName} (${r.teamCode}): ${r.postCount} posts, sentiment=${r.sentimentScore}`)
        }
      }
    } catch (err) {
      console.error('[api/cron/scan-epl-sentiment] Background scan failed:', err)
    }
  })()

  // Return IMMEDIATELY — don't wait for the scan to finish
  return NextResponse.json({
    success: true,
    message: 'Scan started in background — check server logs for results',
    matchweek,
    batchSize: limit,
    note: 'The scan runs asynchronously. Each cron run scans a small batch of players. Run every 30 min to keep sentiment fresh.',
  })
}

/**
 * GET /api/cron/scan-epl-sentiment
 * Same as POST but allows cron services that can't send POST bodies.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
