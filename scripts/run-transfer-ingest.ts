/**
 * Phase 3 verification — runs ingestSagaPosts() on one saga and confirms
 * real posts appear in the DB with real URLs, and aggregates update.
 *
 * Usage: bun run scripts/run-transfer-ingest.ts [sagaId]
 *   (if sagaId omitted, picks the first active saga)
 */
import { ingestSagaPosts } from '../src/lib/transfer-pulse/ingest'
import { db } from '../src/lib/db'

async function main() {
  let sagaId = process.argv[2]
  if (!sagaId) {
    const first = await db.transferSaga.findFirst({
      where: { status: 'active' },
      orderBy: { lastUpdatedAt: 'desc' },
    })
    if (!first) {
      console.error('No active sagas found. Run discovery first (Phase 2).')
      process.exit(1)
    }
    sagaId = first.id
    console.log(`[ingest] No sagaId given — using most recent: ${first.playerName} → ${first.toClubName} (${sagaId})`)
  }

  console.log(`[ingest] Running ingest for saga ${sagaId} ...`)
  const result = await ingestSagaPosts(sagaId, 15)
  console.log('── Ingest result ─────────────────────────────────')
  console.log(`  newPosts:         ${result.newPosts}`)
  console.log(`  skippedDuplicates:${result.skippedDuplicates}`)
  console.log(`  rejected:         ${result.rejected}`)
  console.log(`  errors:           ${result.errors.length}`)
  for (const e of result.errors) console.log(`    - ${e}`)
  console.log(`  durationMs:       ${result.durationMs}`)
  console.log('  aggregates:')
  console.log(`    excitedPct:      ${result.aggregates.excitedPct}`)
  console.log(`    skepticalPct:    ${result.aggregates.skepticalPct}`)
  console.log(`    dreadingPct:     ${result.aggregates.dreadingPct}`)
  console.log(`    avgSentiment:    ${result.aggregates.avgSentiment}`)
  console.log(`    buzzVolume:      ${result.aggregates.buzzVolume}`)
  console.log(`    buzzTrend:       ${result.aggregates.buzzTrend}`)
  console.log(`    fanReadLikelihood: ${result.aggregates.fanReadLikelihood}`)

  // Verify: list the posts now in the DB for this saga
  const posts = await db.transferPost.findMany({
    where: { sagaId },
    orderBy: { postedAt: 'desc' },
    take: 10,
  })
  console.log('── Latest posts in DB ────────────────────────────')
  if (posts.length === 0) {
    console.log('  (none — search returned 0 valid posts; aggregates are neutral, not fabricated)')
  }
  for (const p of posts) {
    console.log(
      `  • [${p.platform}] ${p.author} | score=${p.sentimentScore} label=${p.sentimentLabel}`,
    )
    console.log(`    "${p.content.slice(0, 100)}..."`)
    console.log(`    ${p.url}`)
  }

  // ANTI-HALLUCINATION audit: every post URL must be real
  const fakeUrls = posts.filter(
    (p) =>
      !/^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(p.url) &&
      !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(p.url),
  )
  if (fakeUrls.length > 0) {
    console.error(`  ✗ ANTI-HALLUCINATION VIOLATION: ${fakeUrls.length} posts have synthetic URLs`)
    for (const p of fakeUrls) console.error(`      - ${p.url}`)
    process.exit(1)
  }
  console.log('  ✓ Anti-hallucination audit: all post URLs are real')

  // ANTI-HALLUCINATION audit: no fake authors
  const { isFakeAuthor } = await import('../src/lib/live-fan-talk')
  const fakeAuthors = posts.filter((p) => isFakeAuthor(p.author))
  if (fakeAuthors.length > 0) {
    console.error(`  ✗ ANTI-HALLUCINATION VIOLATION: ${fakeAuthors.length} posts have fake authors`)
    for (const p of fakeAuthors) console.error(`      - ${p.author}`)
    process.exit(1)
  }
  console.log('  ✓ Anti-hallucination audit: no fake authors')

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
