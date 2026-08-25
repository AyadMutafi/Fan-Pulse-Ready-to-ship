import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // FPL sync takes ~30s typically

/**
 * POST /api/cron/fpl-refresh
 *
 * Cron-triggered FPL data refresh. Hits the /api/fpl/sync endpoint internally
 * to pull the latest player form, ownership, fixtures, and gameweek results
 * from the real Fantasy Premier League API.
 *
 * AUTH: caller must send either:
 *   - x-admin-password header matching process.env.ADMIN_PASSWORD
 *   - X-Cron-Secret header matching process.env.CRON_SECRET
 *
 * WHAT IT DOES:
 *   1. Authenticates (admin password OR cron secret)
 *   2. Calls the existing /api/fpl/sync POST handler internally
 *   3. Returns the sync result (counts of players, fixtures, etc.)
 *
 * WHY THIS EXISTS:
 *   - instrumentation.ts runs FPL sync on cold start (every container boot),
 *     but on Render free tier, the container sleeps after 15 min idle.
 *   - For fresh EPL data on matchdays (Sat/Sun 12:30–17:00 UK), an external
 *     cron (cron-job.org, UptimeRobot, GitHub Actions) hits this endpoint
 *     every 30 minutes during the season.
 *   - Without this, users see stale data (yesterday's scores) until the
 *     container reboots.
 *
 * TRIGGER EXAMPLE (cron-job.org, every 30 min):
 *   curl -X POST https://your-app.onrender.com/api/cron/fpl-refresh \
 *        -H "X-Cron-Secret: $CRON_SECRET"
 *
 * TRIGGER EXAMPLE (GitHub Actions, hourly):
 *   name: fpl-refresh
 *   on:
 *     schedule:
 *       - cron: '0 * * * *'  # top of every hour UTC
 *   jobs:
 *     refresh:
 *       runs-on: ubuntu-latest
 *       steps:
 *         - run: |
 *             curl -X POST ${{ secrets.FANPULSE_URL }}/api/cron/fpl-refresh \
 *               -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
 *               --fail --max-time 90
 */
export async function POST(request: NextRequest) {
  const adminPwd = request.headers.get('x-admin-password')
  const cronSecret = request.headers.get('x-cron-secret')

  // ── Auth ──
  const expectedAdmin = process.env.ADMIN_PASSWORD || ''
  const expectedCron = process.env.CRON_SECRET || ''

  const adminOk =
    adminPwd && expectedAdmin && adminPwd === expectedAdmin
  const cronOk =
    cronSecret && expectedCron && cronSecret === expectedCron

  if (!adminOk && !cronOk) {
    return NextResponse.json(
      { error: 'Unauthorized — need valid x-admin-password or X-Cron-Secret header' },
      { status: 401 },
    )
  }

  try {
    // Call the existing FPL sync route handler directly (no HTTP roundtrip)
    const fplSyncModule = await import('@/app/api/fpl/sync/route')
    const syncRequest = new Request('http://localhost:3000/api/fpl/sync', {
      method: 'POST',
      headers: {
        'x-admin-password': process.env.ADMIN_PASSWORD || '123456789',
      },
    })
    const syncResponse = await fplSyncModule.POST(syncRequest as any)
    const syncResult = await syncResponse.json()

    if (syncResponse.status !== 200 || !syncResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'FPL sync failed',
          details: syncResult,
          timestamp: new Date().toISOString(),
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      synced: syncResult.synced,
      timestamp: syncResult.timestamp,
    })
  } catch (err) {
    console.error('[api/cron/fpl-refresh] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal error during FPL refresh',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}

/**
 * GET /api/cron/fpl-refresh
 * Same as POST but allows cron services that can't send POST bodies.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
