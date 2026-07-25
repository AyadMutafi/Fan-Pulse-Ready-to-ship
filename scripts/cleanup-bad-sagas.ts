/**
 * cleanup-bad-sagas.ts
 *
 * One-off cleanup of clearly-fabricated / impossible TransferSaga rows.
 *
 * CONSERVATIVE POLICY:
 *   We only delete sagas that are CLEARLY fabricated — i.e. the source headline
 *   names a DIFFERENT player (entity confusion), or the destination is
 *   impossible for that calibre of player AND there's no credible Tier 1 source.
 *   When in doubt, we LEAVE the saga alone.
 *
 * Currently the only saga marked for deletion is:
 *   - "Rodri → Bournemouth [completed]"
 *     The Tier 1 source headline reads:
 *       "Bournemouth agree deal to sign Álvaro Rodríguez from Elche"
 *     That is about Álvaro Rodríguez (a different player whose name starts with
 *     "Rodr"), NOT Rodri the Man City midfielder. The discovery pipeline's
 *     entity-resolution gate failed to catch this because of the name-prefix
 *     overlap. Deleting the saga + cascade-deletes its sources/posts/timeline.
 *
 * Usage: cd /home/z/my-project && bun run scripts/cleanup-bad-sagas.ts
 */
import { db } from '/home/z/my-project/src/lib/db'

interface DeleteTarget {
  playerName: string
  toClubCode: string
  reason: string
}

// Sagas that are CLEARLY fabricated and should be hard-deleted.
// (Cascade delete in the Prisma schema will remove their TransferSource,
// TransferPost, and SentimentTimeline rows automatically.)
const DELETE_TARGETS: DeleteTarget[] = [
  {
    playerName: 'Rodri',
    toClubCode: 'BOU',
    reason:
      'Fabricated: source headline is "Bournemouth agree deal to sign Álvaro ' +
      'Rodríguez from Elche" — that is a DIFFERENT player (Álvaro Rodríguez), ' +
      'not Rodri (Man City midfielder). The discovery entity-resolution gate ' +
      'failed because of the name-prefix overlap "Rodr".',
  },
]

async function main() {
  console.log(
    '═══════════════════════════════════════════════════════════════',
  )
  console.log('  Transfer Pulse — Bad Saga Cleanup')
  console.log('═══════════════════════════════════════════════════════════════')

  const before = await db.transferSaga.count()
  console.log(`\nSagas in DB before cleanup: ${before}\n`)

  let deleted = 0
  let sourcesDeleted = 0
  let postsDeleted = 0
  let timelineDeleted = 0
  const notFound: string[] = []

  for (const target of DELETE_TARGETS) {
    const saga = await db.transferSaga.findUnique({
      where: {
        playerName_toClubCode: {
          playerName: target.playerName,
          toClubCode: target.toClubCode,
        },
      },
      include: {
        sources: { select: { id: true, journalistName: true, url: true, headline: true } },
        posts: { select: { id: true, url: true } },
        timeline: { select: { id: true, date: true } },
      },
    })

    if (!saga) {
      notFound.push(`${target.playerName} → ${target.toClubCode}`)
      console.log(
        `  ⚠ Not found in DB (already deleted?): ${target.playerName} → ${target.toClubCode}`,
      )
      continue
    }

    console.log(`\n► Deleting saga: ${saga.playerName} (${saga.fromClubName}) → ${saga.toClubName}  [${saga.status}]`)
    console.log(`    id=${saga.id}`)
    console.log(`    reason: ${target.reason}`)
    console.log(
      `    cascading: ${saga.sources.length} sources, ${saga.posts.length} posts, ${saga.timeline.length} timeline rows`,
    )
    if (saga.sources.length > 0) {
      console.log(`    source headline: "${saga.sources[0].headline}"`)
      console.log(`    source url: ${saga.sources[0].url}`)
    }

    // Cascade delete is configured in schema.prisma (onDelete: Cascade on
    // TransferSource.saga, TransferPost.saga, SentimentTimeline.saga), so a
    // single delete on the saga removes all dependent rows in one tx.
    const deletedRows = await db.$transaction([
      db.transferPost.deleteMany({ where: { sagaId: saga.id } }),
      db.transferSource.deleteMany({ where: { sagaId: saga.id } }),
      db.sentimentTimeline.deleteMany({ where: { sagaId: saga.id } }),
      db.transferSaga.delete({ where: { id: saga.id } }),
    ])

    sourcesDeleted += deletedRows[1].count
    postsDeleted += deletedRows[0].count
    timelineDeleted += deletedRows[2].count
    deleted++
    console.log(
      `    ✓ deleted (sources=${deletedRows[1].count} posts=${deletedRows[0].count} timeline=${deletedRows[2].count})`,
    )
  }

  console.log('\n───────────────────────────────────────────────────────────────')
  console.log('  CLEANUP SUMMARY')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`  Sagas deleted:           ${deleted}`)
  console.log(`  TransferSource deleted:  ${sourcesDeleted}`)
  console.log(`  TransferPost deleted:    ${postsDeleted}`)
  console.log(`  SentimentTimeline del:   ${timelineDeleted}`)
  if (notFound.length) {
    console.log(`  Not found (skipped):     ${notFound.length}`)
    for (const n of notFound) console.log(`     - ${n}`)
  }
  const after = await db.transferSaga.count()
  console.log(`\n  Sagas in DB before: ${before}`)
  console.log(`  Sagas in DB after:  ${after}`)

  console.log('\n  Remaining sagas:')
  const remaining = await db.transferSaga.findMany({
    orderBy: [{ status: 'asc' }, { lastUpdatedAt: 'desc' }],
    select: {
      playerName: true,
      fromClubName: true,
      toClubName: true,
      toClubCode: true,
      status: true,
      tier1Count: true,
      buzzVolume: true,
      lastUpdatedAt: true,
    },
  })
  for (const s of remaining) {
    console.log(
      `    [${s.status.padEnd(9)}] ${s.playerName.padEnd(26)} ${s.fromClubName} → ${s.toClubName}  tier1=${s.tier1Count} buzz=${s.buzzVolume}  ${s.lastUpdatedAt.toISOString().slice(0, 16)}`,
    )
  }

  await db.$disconnect()
  console.log('\n✓ Done.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
