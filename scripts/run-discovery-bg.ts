/**
 * Background discovery script — writes progress to a file directly to avoid
 * stdout buffering. Runs discovery in batches for all tracked players, then
 * ingestion for all active sagas.
 *
 * Run with: bun run scripts/run-discovery-bg.ts
 */
import { writeFileSync, appendFileSync } from 'fs'
import { db } from '@/lib/db'
import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'
import { TRACKED_PLAYERS } from '@/lib/transfer-pulse/tracked-players'

const LOG = '/home/z/my-project/discovery-progress.log'

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  appendFileSync(LOG, line + '\n')
}

async function main() {
  writeFileSync(LOG, '') // clear log
  log('=== Discovery + Ingest Script Started ===')
  log(`Tracked players: ${TRACKED_PLAYERS.length}`)

  // ── Discovery ────────────────────────────────────────────────────────────
  log('--- Phase 1: Discovery ---')
  const batchSize = 6
  let totalCreated = 0
  let totalUpdated = 0
  let totalSources = 0
  let totalSkipped = 0

  for (let offset = 0; offset < TRACKED_PLAYERS.length; offset += batchSize) {
    const batchNum = Math.floor(offset / batchSize) + 1
    const totalBatches = Math.ceil(TRACKED_PLAYERS.length / batchSize)
    const playerNames = TRACKED_PLAYERS
      .slice(offset, offset + batchSize)
      .map((p) => p.name)
      .join(', ')
    log(`[Batch ${batchNum}/${totalBatches}] offset=${offset}: ${playerNames}`)

    try {
      const result = await discoverTransferSagas({ maxPlayers: batchSize, offset })
      totalCreated += result.sagasCreated
      totalUpdated += result.sagasUpdated
      totalSources += result.sourcesAdded
      totalSkipped += result.skipped
      log(
        `  → created=${result.sagasCreated} updated=${result.sagasUpdated} ` +
        `sources=${result.sourcesAdded} skipped=${result.skipped} ` +
        `errors=${result.errors.length} (${result.durationMs}ms)`,
      )
      if (result.errors.length) {
        for (const e of result.errors.slice(0, 3)) {
          log(`  error: ${e}`)
        }
      }
    } catch (err) {
      log(`  BATCH FAILED: ${String(err).slice(0, 200)}`)
    }

    // Brief pause between batches
    if (offset + batchSize < TRACKED_PLAYERS.length) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  log(`Discovery totals: created=${totalCreated} updated=${totalUpdated} sources=${totalSources} skipped=${totalSkipped}`)

  // ── Ingestion ────────────────────────────────────────────────────────────
  log('--- Phase 2: Ingestion for active sagas ---')
  const activeSagas = await db.transferSaga.findMany({
    where: { status: 'active' },
    select: { id: true, playerName: true, toClubName: true, buzzVolume: true },
    orderBy: { lastUpdatedAt: 'asc' },
  })
  log(`Active sagas to ingest: ${activeSagas.length}`)

  let ingestedCount = 0
  let totalPostsAdded = 0
  for (const saga of activeSagas) {
    log(`  Ingesting: ${saga.playerName} → ${saga.toClubName} (buzz=${saga.buzzVolume})`)
    try {
      const result = await ingestSagaPosts(saga.id, 20)
      if (result.error) {
        log(`    ✗ ${result.error}`)
      } else {
        log(`    ✓ fetched=${result.postsFetched} added=${result.postsAdded} provider=${result.provider} (${result.durationMs}ms)`)
        totalPostsAdded += result.postsAdded
        ingestedCount++
      }
    } catch (err) {
      log(`    ✗ ${String(err).slice(0, 150)}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  log(`Ingestion totals: ingested=${ingestedCount}/${activeSagas.length} postsAdded=${totalPostsAdded}`)

  // ── Final summary ────────────────────────────────────────────────────────
  log('--- Final Saga State ---')
  const finalSagas = await db.transferSaga.findMany({
    select: { playerName: true, toClubName: true, status: true, buzzVolume: true, tier1Count: true },
    orderBy: [{ status: 'asc' }, { buzzVolume: 'desc' }],
  })
  for (const s of finalSagas) {
    log(`  ${s.status.padEnd(10)} | ${s.playerName.padEnd(25)} → ${s.toClubName.padEnd(25)} buzz=${s.buzzVolume} tier1=${s.tier1Count}`)
  }

  await db.$disconnect()
  log('=== Done ===')
}

main().catch((err) => {
  log(`SCRIPT FAILED: ${String(err).slice(0, 300)}`)
  process.exit(1)
})
