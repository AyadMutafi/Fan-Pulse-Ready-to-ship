/**
 * scripts/cleanup-stale-sagas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off cleanup: delete the stale/wrong Florian Wirtz → Man City saga.
 *
 * Background: Wirtz completed his move from Bayer Leverkusen to LIVERPOOL in
 * summer 2025. But the discovery pipeline kept surfacing OLD pre-move Tier 1
 * rumors (Plettenberg + Falk, July 21-22) linking him to MAN CITY — those were
 * speculation that predated his actual move. The saga was created with the
 * WRONG destination and marked "active" even though the player had already
 * moved to a different club.
 *
 * This script:
 *   1. Finds the Wirtz → Man City saga (playerName='Florian Wirtz', toClubName='Man City')
 *   2. Deletes its TransferSource + TransferPost + SentimentTimeline rows (cascade)
 *   3. Deletes the saga itself
 *   4. Prints a before/after summary
 *
 * Run with:  bun run scripts/cleanup-stale-sagas.ts
 */
import { db } from '/home/z/my-project/src/lib/db'

async function main() {
  const target = { playerName: 'Florian Wirtz', toClubName: 'Man City' }
  console.log(`[cleanup] looking for stale saga: ${target.playerName} → ${target.toClubName}`)

  const saga = await db.transferSaga.findFirst({
    where: target,
    include: { sources: true, posts: true, timeline: true },
  })

  if (!saga) {
    console.log('[cleanup] no matching saga found — nothing to delete')
    await db.$disconnect()
    return
  }

  console.log(`[cleanup] found saga ${saga.id}`)
  console.log(`  status: ${saga.status}`)
  console.log(`  firstReported: ${saga.firstReportedAt.toISOString().slice(0, 10)}`)
  console.log(`  sources: ${saga.sources.length} | posts: ${saga.posts.length} | timeline: ${saga.timeline.length}`)

  // Cascade delete (schema has onDelete: Cascade on sources/posts/timeline)
  const delSources = await db.transferSource.deleteMany({ where: { sagaId: saga.id } })
  const delPosts = await db.transferPost.deleteMany({ where: { sagaId: saga.id } })
  const delTimeline = await db.sentimentTimeline.deleteMany({ where: { sagaId: saga.id } })
  const delSaga = await db.transferSaga.delete({ where: { id: saga.id } })

  console.log(`[cleanup] deleted: ${delSources.count} sources, ${delPosts.count} posts, ${delTimeline.count} timeline rows, 1 saga`)

  // Verify
  const remaining = await db.transferSaga.findFirst({ where: target })
  console.log(`[cleanup] verification: ${remaining ? 'STILL PRESENT (FAILED)' : 'gone ✓'}`)

  const totalSagas = await db.transferSaga.count()
  console.log(`[cleanup] total sagas remaining: ${totalSagas}`)

  await db.$disconnect()
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
