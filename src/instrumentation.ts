/**
 * Next.js Instrumentation — Auto-seed + auto-sync on server startup.
 *
 * This runs ONCE when the Next.js server starts (before any request).
 *
 * TWO JOBS:
 *   1. World Cup seed — if NationalTeam/Match tables are empty, calls the
 *      /api/world-cup/seed endpoint to populate verified WC 2026 data
 *      (48 national teams, 40 WC matches, 44 players).
 *
 *   2. FPL sync — if FPLPlayer / LeagueMatch tables are empty (or are stale
 *      by >6 hours), calls the /api/fpl/sync endpoint to pull the LATEST
 *      data from the real Fantasy Premier League API:
 *        - 612+ FPL players (with form, ownership, points)
 *        - 20 EPL teams
 *        - 38 gameweeks
 *        - All fixtures (with scores for completed matches)
 *      This populates the TOTW, Captain Pulse, and Fantasy tabs.
 *
 * WHY THIS MATTERS:
 *   The FPL API at https://fantasy.premierleague.com/api/bootstrap-static/
 *   returns live data for the CURRENT FPL season (2026-27 as of Aug 2026).
 *   Without this sync, the DB has 0 LeagueMatch rows → TOTW shows "EPL kicks
 *   off Aug 21" forever, even after GW1 is finished in real life.
 *
 *   The sync runs in the background (non-blocking) on every cold start, and
 *   re-syncs if data is >6 hours old (EPL data changes daily during the
 *   season — fixtures are scored, player form updates, ownership shifts).
 */

const FPL_SYNC_MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6 hours

export async function register() {
  // Only run on the server (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { PrismaClient } = await import('@prisma/client')
      const db = new PrismaClient()

      console.log('[instrumentation] Running startup checks...')

      // ── JOB 1: World Cup seed (if empty) ───────────────────────────────
      const teamCount = await db.nationalTeam.count().catch(() => 0)
      const matchCount = await db.match.count().catch(() => 0)

      if (teamCount === 0 || matchCount === 0) {
        console.log('[instrumentation] WC DB empty — auto-seeding World Cup data...')

        const seedModule = await import('@/app/api/world-cup/seed/route')
        const mockRequest = new Request('http://localhost:3000/api/world-cup/seed?force=true', {
          method: 'POST',
          headers: {
            'x-admin-password': process.env.ADMIN_PASSWORD || '123456789',
          },
        })

        const response = await seedModule.POST(mockRequest as any)
        const result = await response.json()
        console.log('[instrumentation] WC auto-seed result:', JSON.stringify(result).slice(0, 200))
      } else {
        console.log(`[instrumentation] WC DB OK — ${teamCount} teams, ${matchCount} matches.`)
      }

      // ── JOB 2: FPL sync (if empty OR stale >6h) ───────────────────────
      const fplPlayerCount = await db.fPLPlayer.count().catch(() => 0)
      const leagueMatchCount = await db.leagueMatch.count().catch(() => 0)

      // Find the most recent LeagueMatch.syncedAt (we don't have a syncAt
      // column on LeagueMatch, but FPLFixture has syncedAt). Use that as
      // a proxy for "last FPL sync time".
      const latestFplFixture = await db.fPLFixture.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }).catch(() => null)

      const lastSyncAt = latestFplFixture?.syncedAt?.getTime() ?? 0
      const ageMs = Date.now() - lastSyncAt
      const isStale = ageMs > FPL_SYNC_MAX_AGE_MS

      if (fplPlayerCount === 0 || leagueMatchCount === 0 || isStale) {
        const reason =
          fplPlayerCount === 0
            ? `FPL DB empty (0 players)`
            : leagueMatchCount === 0
            ? `LeagueMatch DB empty (0 matches)`
            : `FPL data stale (last sync ${Math.round(ageMs / 60_000)} min ago)`

        console.log(`[instrumentation] ${reason} — triggering FPL sync...`)

        // Fire the FPL sync route. Non-fatal if it fails — the UI renders
        // honest empty states.
        try {
          const fplSyncModule = await import('@/app/api/fpl/sync/route')
          const syncRequest = new Request('http://localhost:3000/api/fpl/sync', {
            method: 'POST',
            headers: {
              'x-admin-password': process.env.ADMIN_PASSWORD || '123456789',
            },
          })
          const syncResponse = await fplSyncModule.POST(syncRequest as any)
          const syncResult = await syncResponse.json()
          if (syncResult.success) {
            console.log(
              '[instrumentation] FPL sync OK:',
              JSON.stringify(syncResult.synced),
            )
          } else {
            console.warn('[instrumentation] FPL sync returned non-success:', syncResult)
          }
        } catch (syncErr) {
          // Non-fatal — app still works, just shows empty states.
          console.error('[instrumentation] FPL sync failed (non-fatal):', syncErr)
        }
      } else {
        console.log(
          `[instrumentation] FPL data OK — ${fplPlayerCount} players, ${leagueMatchCount} matches. Last sync ${Math.round(ageMs / 60_000)} min ago.`,
        )
      }

      await db.$disconnect()
    } catch (error) {
      console.error('[instrumentation] Startup failed (non-fatal):', error)
    }
  }
}
