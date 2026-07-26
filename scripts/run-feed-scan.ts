/**
 * Manual test runner for the PUSH-based Tier 1 feed scanner.
 *
 * Usage:
 *   bun run scripts/run-feed-scan.ts                  # scan default journalists
 *   bun run scripts/run-feed-scan.ts FabrizioRomano   # scan specific handle
 *
 * Prints a summary of what was scanned + created, and verifies the user's
 * 4 Romano tweet URLs (from the 2026-07-26 user report) are now in the DB.
 */
import { db } from '../src/lib/db'
import { scanTier1Feeds } from '../src/lib/transfer-pulse/feed-scan'

// The 4 Romano tweet URLs the user reported as "not showing" on 2026-07-26
const USER_REPORTED_ROMANO_URLS = [
  'https://x.com/FabrizioRomano/status/2081258099306873241',
  'https://x.com/FabrizioRomano/status/2081257858239189095',
  'https://x.com/FabrizioRomano/status/2081187825832051117',
  'https://x.com/FabrizioRomano/status/2081186511928639734',
]

async function main() {
  const handleArg = process.argv[2]
  const opts = handleArg
    ? { journalistHandles: [handleArg] }
    : {}

  console.log(`\n[run-feed-scan] starting scan with opts=${JSON.stringify(opts)}`)
  const result = await scanTier1Feeds(opts)

  console.log(`\n=== FEED SCAN RESULT ===`)
  console.log(`journalistsScanned: ${result.journalistsScanned}`)
  console.log(`postsConsidered:    ${result.postsConsidered}`)
  console.log(`sagasCreated:       ${result.sagasCreated}`)
  console.log(`sagasUpdated:       ${result.sagasUpdated}`)
  console.log(`sourcesAdded:       ${result.sourcesAdded}`)
  console.log(`skipped:            ${result.skipped}`)
  console.log(`durationMs:         ${result.durationMs}`)
  if (result.errors.length > 0) {
    console.log(`errors:`)
    for (const e of result.errors) console.log(`  - ${e}`)
  }

  // Verify the user's reported URLs are now in the DB (as TransferSource rows)
  console.log(`\n=== USER-REPORTED ROMANO URLS ===`)
  for (const url of USER_REPORTED_ROMANO_URLS) {
    const src = await db.transferSource.findUnique({
      where: { url },
      select: { id: true, sagaId: true, journalistName: true, headline: true, reportedAt: true },
    })
    if (src) {
      const saga = await db.transferSaga.findUnique({
        where: { id: src.sagaId },
        select: { playerName: true, fromClubName: true, toClubName: true, status: true },
      })
      console.log(`  ✓ IN DB: ${url}`)
      console.log(`           saga: ${saga?.playerName} ${saga?.fromClubName} → ${saga?.toClubName} [${saga?.status}]`)
      console.log(`           headline: ${src.headline.slice(0, 100)}`)
    } else {
      console.log(`  ✗ NOT IN DB: ${url}`)
    }
  }

  // Show all sagas now in the DB
  const sagas = await db.transferSaga.findMany({
    orderBy: { lastUpdatedAt: 'desc' },
    select: { playerName: true, fromClubName: true, toClubName: true, status: true, lastUpdatedAt: true, tier1Count: true },
  })
  console.log(`\n=== ALL SAGAS IN DB (${sagas.length}) ===`)
  for (const s of sagas) {
    console.log(`  [${s.status.padEnd(10)}] ${s.playerName.padEnd(28)} ${s.fromClubName.padEnd(15)} → ${s.toClubName.padEnd(15)} tier1=${s.tier1Count} updated=${s.lastUpdatedAt.toISOString()}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
