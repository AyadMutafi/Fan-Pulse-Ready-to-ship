/**
 * Standalone script: clean up bad sagas, run discovery for all tracked players,
 * and run ingestion for all active sagas.
 *
 * Run with: bun run scripts/refresh-transfers.ts
 *
 * This bypasses the API rate limits by calling the discovery + ingest modules
 * directly. It's a one-shot maintenance script, not a scheduled job.
 */
import { db } from '@/lib/db'
import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'
import { TRACKED_PLAYERS } from '@/lib/transfer-pulse/tracked-players'

async function main() {
  console.log('=== Transfer Pulse Refresh Script ===')
  console.log(`Tracked players: ${TRACKED_PLAYERS.length}`)
  console.log()

  // ── Phase 1: Clean up bad sagas ──────────────────────────────────────────
  console.log('--- Phase 1: Clean up bad sagas ---')

  // Bad sagas to delete (entity-confusion artifacts + same-club sagas from
  // before the entity-resolution gate existed). These are debunked but should
  // be fully removed because they're factually wrong (not just "debunked
  // rumors" — they were never real rumors at all).
  const badSagaPatterns = [
    // Old Ederson GK confusion — "Man City → Atalanta" never existed
    { playerName: 'Ederson', toClubName: 'Atalanta' },
    // Old Ederson GK confusion — "Ederson → Manchester United" was about the
    // Atalanta MF, not the Man City GK
    { playerName: 'Ederson', toClubName: 'Manchester United' },
    // Same-club sagas (contract renewals misclassified as transfers)
    { playerName: 'Marcus Rashford', toClubName: 'Manchester United' },
    { playerName: 'Bruno Fernandes', toClubName: 'Manchester United' },
  ]

  let deletedCount = 0
  for (const pattern of badSagaPatterns) {
    const found = await db.transferSaga.findMany({
      where: {
        playerName: pattern.playerName,
        toClubName: pattern.toClubName,
      },
      select: { id: true, playerName: true, toClubName: true, status: true },
    })
    for (const saga of found) {
      console.log(
        `  Deleting bad saga: ${saga.playerName} → ${saga.toClubName} (${saga.status})`,
      )
      // Delete sources + posts first (FK constraints), then the saga
      await db.transferSource.deleteMany({ where: { sagaId: saga.id } })
      await db.transferPost.deleteMany({ where: { sagaId: saga.id } })
      await db.sentimentTimeline.deleteMany({ where: { sagaId: saga.id } })
      await db.transferSaga.delete({ where: { id: saga.id } })
      deletedCount++
    }
  }
  console.log(`Deleted ${deletedCount} bad sagas.`)
  console.log()

  // ── Phase 2: Run discovery for all tracked players ───────────────────────
  console.log('--- Phase 2: Run discovery for all tracked players ---')
  console.log(`Scanning ${TRACKED_PLAYERS.length} players in batches of 8...`)
  console.log('(This makes many Z.ai web_search + LLM calls — may take several minutes)')
  console.log()

  const batchSize = 8
  let totalCreated = 0
  let totalUpdated = 0
  let totalSources = 0
  let totalSkipped = 0
  const allErrors: string[] = []

  for (let offset = 0; offset < TRACKED_PLAYERS.length; offset += batchSize) {
    const batchNum = Math.floor(offset / batchSize) + 1
    const totalBatches = Math.ceil(TRACKED_PLAYERS.length / batchSize)
    console.log(`[Batch ${batchNum}/${totalBatches}] offset=${offset}, scanning players ${offset + 1}-${Math.min(offset + batchSize, TRACKED_PLAYERS.length)}...`)

    const result = await discoverTransferSagas({
      maxPlayers: batchSize,
      offset,
    })

    totalCreated += result.sagasCreated
    totalUpdated += result.sagasUpdated
    totalSources += result.sourcesAdded
    totalSkipped += result.skipped
    if (result.errors.length) {
      allErrors.push(...result.errors)
    }

    console.log(
      `  → created=${result.sagasCreated} updated=${result.sagasUpdated} ` +
      `sources=${result.sourcesAdded} skipped=${result.skipped} ` +
      `errors=${result.errors.length} (${result.durationMs}ms)`,
    )

    // Brief pause between batches to avoid hammering the Z.ai API
    if (offset + batchSize < TRACKED_PLAYERS.length) {
      console.log('  (pausing 3s between batches...)')
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  console.log()
  console.log('Discovery totals:')
  console.log(`  Sagas created: ${totalCreated}`)
  console.log(`  Sagas updated: ${totalUpdated}`)
  console.log(`  Sources added: ${totalSources}`)
  console.log(`  Players skipped (no Tier 1 posts): ${totalSkipped}`)
  if (allErrors.length) {
    console.log(`  Errors (${allErrors.length}):`)
    for (const e of allErrors.slice(0, 20)) {
      console.log(`    - ${e}`)
    }
  }
  console.log()

  // ── Phase 3: Run ingestion for all active sagas ──────────────────────────
  console.log('--- Phase 3: Run ingestion for all active sagas ---')
  const activeSagas = await db.transferSaga.findMany({
    where: { status: 'active' },
    select: { id: true, playerName: true, toClubName: true, buzzVolume: true },
    orderBy: { lastUpdatedAt: 'asc' },
  })
  console.log(`Found ${activeSagas.length} active sagas to ingest.`)
  console.log()

  let ingestedCount = 0
  let totalPostsAdded = 0
  for (const saga of activeSagas) {
    console.log(`  Ingesting: ${saga.playerName} → ${saga.toClubName} (current buzz=${saga.buzzVolume})...`)
    try {
      const result = await ingestSagaPosts(saga.id, 20)
      if (result.error) {
        console.log(`    ✗ ${result.error}`)
      } else {
        console.log(
          `    ✓ fetched=${result.postsFetched} added=${result.postsAdded} provider=${result.provider} (${result.durationMs}ms)`,
        )
        totalPostsAdded += result.postsAdded
        ingestedCount++
      }
    } catch (err) {
      console.log(`    ✗ ${String(err).slice(0, 120)}`)
    }
    // Brief pause between sagas
    await new Promise((r) => setTimeout(r, 2000))
  }

  console.log()
  console.log('Ingestion totals:')
  console.log(`  Sagas ingested: ${ingestedCount}/${activeSagas.length}`)
  console.log(`  Total fan posts added: ${totalPostsAdded}`)
  console.log()

  // ── Final summary ────────────────────────────────────────────────────────
  console.log('=== FINAL SUMMARY ===')
  const finalSagas = await db.transferSaga.findMany({
    select: { id: true, playerName: true, toClubName: true, status: true, buzzVolume: true, tier1Count: true },
    orderBy: [{ status: 'asc' }, { buzzVolume: 'desc' }],
  })
  const byStatus: Record<string, typeof finalSagas> = {}
  for (const s of finalSagas) {
    (byStatus[s.status] ??= []).push(s)
  }
  for (const [status, lst] of Object.entries(byStatus)) {
    console.log(`${status} (${lst.length}):`)
    for (const s of lst) {
      console.log(`  - ${s.playerName} → ${s.toClubName} (buzz=${s.buzzVolume}, tier1=${s.tier1Count})`)
    }
  }

  await db.$disconnect()
  console.log()
  console.log('Done.')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
