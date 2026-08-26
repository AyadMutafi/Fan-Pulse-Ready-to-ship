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

/**
 * Ensure the Z.ai SDK config file exists.
 *
 * The z-ai-web-dev-sdk reads its config from a `.z-ai-config` JSON file
 * (NOT from env vars). It checks 3 paths:
 *   1. {process.cwd()}/.z-ai-config
 *   2. {os.homedir()}/.z-ai-config
 *   3. /etc/.z-ai-config
 *
 * On the Z.ai sandbox, /etc/.z-ai-config exists with a session token.
 * On Render/production, NONE of these files exist → ZAI.create() throws
 * "Configuration file not found" → page_reader/web_search fail with
 * "Z.ai SDK unavailable".
 *
 * This function creates the config file from env vars if it doesn't exist.
 * Set ZAI_API_KEY (and optionally ZAI_BASE_URL) in the Render dashboard.
 */
async function ensureZaiConfig(): Promise<void> {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const os = await import('node:os')

  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ]

  // Check if any config file already exists (Z.ai sandbox has /etc/.z-ai-config)
  for (const p of configPaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8')
        const config = JSON.parse(content)
        if (config.baseUrl && config.apiKey) {
          console.log(`[instrumentation] Z.ai config found at ${p}`)
          return // Already configured
        }
      }
    } catch {
      // Continue checking
    }
  }

  // No config file found — create one from env vars.
  // The Z.ai SDK requires a config with: baseUrl, apiKey, and optionally
  // token, chatId, userId (for session-based auth used on the Z.ai platform).
  //
  // On production (Render), set these env vars:
  //   ZAI_API_KEY   — the API key (or "Z.ai" if using session token)
  //   ZAI_TOKEN     — the JWT session token (from /etc/.z-ai-config on sandbox)
  //   ZAI_CHAT_ID   — the chat session ID
  //   ZAI_USER_ID   — the user ID
  //   ZAI_BASE_URL  — defaults to https://internal-api.z.ai/v1
  const apiKey = process.env.ZAI_API_KEY
  if (!apiKey) {
    console.warn('[instrumentation] ZAI_API_KEY env var not set — Z.ai SDK features (page_reader, web_search) will be unavailable')
    return
  }

  const config: Record<string, string> = {
    baseUrl: process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1',
    apiKey,
  }

  // Optional session-based auth fields (needed for the Z.ai platform token)
  if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN
  if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID
  if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID

  // Write to the first writable path (cwd is always writable)
  const targetPath = configPaths[0] // {cwd}/.z-ai-config
  try {
    fs.writeFileSync(targetPath, JSON.stringify(config), { mode: 0o600 })
    console.log(`[instrumentation] ✓ Created Z.ai config at ${targetPath} from env vars`)
  } catch (err) {
    console.error(`[instrumentation] Failed to write Z.ai config to ${targetPath}:`, err)
  }
}

export async function register() {
  // Only run on the server (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // ── JOB 0: Ensure Z.ai SDK config exists (before any AI calls) ──────
      await ensureZaiConfig()

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

      // ── JOB 4: Ballon d'Or seed (if empty) ──────────────────────────────
      // Seeds BallonDorContender rows from VERIFIED_BALLON_DOR_CONTENDERS
      // on first boot. Idempotent — skips contenders that already exist.
      const bdCount = await db.ballonDorContender.count().catch(() => 0)
      if (bdCount === 0) {
        console.log('[instrumentation] Ballon d\'Or DB empty — auto-seeding contenders...')
        try {
          const { seedFromHardcoded } = await import('@/lib/ballon-dor-admin/recompute')
          const result = await seedFromHardcoded(db, false)
          console.log(`[instrumentation] Ballon d'Or seeded: ${result.seeded} contenders added`)
        } catch (bdErr) {
          console.error('[instrumentation] Ballon d\'Or seed failed (non-fatal):', bdErr)
        }
      } else {
        console.log(`[instrumentation] Ballon d\'Or OK — ${bdCount} contenders.`)
      }

      await db.$disconnect()
    } catch (error) {
      console.error('[instrumentation] Startup failed (non-fatal):', error)
    }
  }
}
