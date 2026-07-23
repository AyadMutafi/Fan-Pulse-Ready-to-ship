/**
 * Ingest fan posts for a single saga by sagaId or playerName.
 *
 * Usage: bun run scripts/ingest-one.ts <sagaId|playerName>
 */
import { db } from '../src/lib/db'
import { ingestSagaPosts } from '../src/lib/transfer-pulse/ingest'

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: bun run scripts/ingest-one.ts <sagaId|playerName>')
    process.exit(1)
  }

  let saga = await db.transferSaga.findUnique({ where: { id: arg } })
  if (!saga) {
    saga = await db.transferSaga.findFirst({
      where: { playerName: { contains: arg }, status: 'active' },
      orderBy: { lastUpdatedAt: 'desc' },
    })
  }
  if (!saga) {
    console.error(`No saga found for: ${arg}`)
    process.exit(1)
  }

  console.log(`[ingest-one] saga: ${saga.playerName} → ${saga.toClubName} (status=${saga.status})`)
  const result = await ingestSagaPosts(saga.id, 20)
  console.log('── Result ───────────────────────────────────────')
  console.log(`  postsFetched:  ${result.postsFetched}`)
  console.log(`  postsAdded:    ${result.postsAdded}`)
  console.log(`  provider:      ${result.provider}`)
  console.log(`  durationMs:    ${result.durationMs}`)
  if (result.error) console.log(`  error:         ${result.error}`)

  const posts = await db.transferPost.findMany({
    where: { sagaId: saga.id },
    orderBy: { postedAt: 'desc' },
    take: 5,
  })
  console.log(`\n── Top ${posts.length} posts now in DB ──────────────`)
  for (const p of posts) {
    console.log(`  [${p.platform}] @${p.author} | score=${p.sentimentScore.toFixed(0)} label=${p.sentimentLabel}`)
    console.log(`    "${p.content.slice(0, 100)}..."`)
    console.log(`    ${p.url}`)
  }

  // Show updated aggregates
  const updated = await db.transferSaga.findUnique({ where: { id: saga.id } })
  if (updated) {
    console.log('\n── Updated aggregates ──────────────────────────')
    console.log(`  buzzVolume:        ${updated.buzzVolume}`)
    console.log(`  excitedPct:        ${updated.excitedPct}`)
    console.log(`  skepticalPct:      ${updated.skepticalPct}`)
    console.log(`  dreadingPct:       ${updated.dreadingPct}`)
    console.log(`  avgSentiment:      ${updated.avgSentiment}`)
    console.log(`  fanReadLikelihood: ${updated.fanReadLikelihood}`)
  }

  await db.$disconnect()
  process.exit(0)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
