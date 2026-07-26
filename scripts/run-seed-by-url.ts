/**
 * Manual test runner for seed-by-URL.
 *
 * Tests the user's 4 reported Romano URLs (from 2026-07-26) to verify
 * they can be added via the seed-by-URL escape hatch.
 */
import { seedSagaByUrl } from '../src/lib/transfer-pulse/seed-by-url'
import { db } from '../src/lib/db'

const USER_REPORTED_URLS = [
  'https://x.com/FabrizioRomano/status/2081258099306873241',
  'https://x.com/FabrizioRomano/status/2081257858239189095',
  'https://x.com/FabrizioRomano/status/2081187825832051117',
  'https://x.com/FabrizioRomano/status/2081186511928639734',
]

async function main() {
  console.log(`\n[run-seed-by-url] testing ${USER_REPORTED_URLS.length} URLs`)
  for (const url of USER_REPORTED_URLS) {
    console.log(`\n--- ${url} ---`)
    const r = await seedSagaByUrl(url)
    if (r.ok) {
      console.log(`  ✓ ${r.sagaStatus?.toUpperCase()}: ${r.playerName} ${r.fromClubName} → ${r.toClubName}`)
      console.log(`    posted: ${r.postedAt}  by @${r.handle}`)
      console.log(`    sagaId: ${r.sagaId}`)
    } else {
      console.log(`  ✗ FAILED: ${r.error}`)
    }
  }

  // Final DB state
  const sources = await db.transferSource.findMany({
    where: { url: { in: USER_REPORTED_URLS } },
    select: { url: true, sagaId: true, headline: true, reportedAt: true },
  })
  console.log(`\n=== VERIFICATION: ${sources.length}/${USER_REPORTED_URLS.length} URLs now in DB ===`)
  for (const s of sources) {
    console.log(`  ✓ ${s.url}`)
    console.log(`    headline: ${s.headline.slice(0, 100)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
