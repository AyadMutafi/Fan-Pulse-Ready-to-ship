/**
 * Chunked feed-scan runner — scans a SUBSET of Tier 1 journalists so each
 * invocation completes within a reasonable timeout. The scan is idempotent
 * (URL @unique), so running multiple chunks back-to-back accumulates sagas
 * without duplicates.
 *
 * Uses skipVerifyClub=true for speed — the web_search from-club verification
 * gate runs on subsequent auto-refresh cycles (which only process a few sagas
 * at a time).
 *
 * Usage:
 *   bunx tsx scripts/run-feed-scan-chunk.ts <startIdx> <endIdx>
 *   bunx tsx scripts/run-feed-scan-chunk.ts 0 8    # scan journalists 0-7
 *   bunx tsx scripts/run-feed-scan-chunk.ts 8 16   # scan journalists 8-15
 *   bunx tsx scripts/run-feed-scan-chunk.ts all    # scan ALL (skipVerifyClub)
 */
import { db } from '../src/lib/db'
import { scanTier1Feeds } from '../src/lib/transfer-pulse/feed-scan'
import { TIER1_SOURCES } from '../src/lib/transfer-pulse/tier1-sources'

async function main() {
  const arg = process.argv[2] || 'all'
  let startIdx: number
  let endIdx: number
  if (arg === 'all') {
    startIdx = 0
    endIdx = TIER1_SOURCES.length
  } else {
    startIdx = parseInt(arg, 10)
    endIdx = parseInt(process.argv[3] || String(TIER1_SOURCES.length), 10)
  }
  const handles = TIER1_SOURCES.slice(startIdx, endIdx).map((s) => s.handle.replace(/^@/, ''))

  console.log(`\n[chunk] scanning journalists ${startIdx}-${endIdx - 1} (${handles.length} handles):`)
  console.log(`  ${handles.join(', ')}`)
  console.log(`  skipVerifyClub=true (fast bulk scan)`)

  const result = await scanTier1Feeds({ journalistHandles: handles, skipVerifyClub: true })

  console.log(`\n=== CHUNK RESULT ===`)
  console.log(`journalistsScanned: ${result.journalistsScanned}`)
  console.log(`postsConsidered:    ${result.postsConsidered}`)
  console.log(`sagasCreated:       ${result.sagasCreated}`)
  console.log(`sagasUpdated:       ${result.sagasUpdated}`)
  console.log(`sourcesAdded:       ${result.sourcesAdded}`)
  console.log(`skipped:            ${result.skipped}`)
  console.log(`durationMs:         ${result.durationMs} (${(result.durationMs / 1000).toFixed(1)}s)`)
  if (result.errors.length > 0) {
    console.log(`errors:`)
    for (const e of result.errors) console.log(`  - ${e}`)
  }

  // Show total DB state
  const total = await db.transferSaga.count()
  const totalSources = await db.transferSource.count()
  console.log(`\n=== DB TOTAL: ${total} sagas, ${totalSources} sources ===`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
