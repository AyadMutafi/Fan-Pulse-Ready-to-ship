/**
 * Simple ingestion script — fetches fan posts for all active sagas.
 * Writes progress to a file. Robust against individual saga failures.
 *
 * Run with: bun run scripts/ingest-active.ts
 */
import { writeFileSync, appendFileSync } from 'fs'
import { db } from '@/lib/db'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'

const LOG = '/home/z/my-project/ingest-progress.log'

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try { appendFileSync(LOG, line + '\n') } catch {}
}

async function main() {
  writeFileSync(LOG, '')
  log('=== Ingest Active Sagas Script ===')

  const activeSagas = await db.transferSaga.findMany({
    where: { status: 'active' },
    select: { id: true, playerName: true, toClubName: true, buzzVolume: true },
    orderBy: { buzzVolume: 'asc' }, // ingest 0-buzz sagas first
  })
  log(`Found ${activeSagas.length} active sagas:`)
  for (const s of activeSagas) {
    log(`  ${s.playerName} → ${s.toClubName} (buzz=${s.buzzVolume})`)
  }
  log('')

  let ok = 0
  let fail = 0
  for (const saga of activeSagas) {
    log(`--- Ingesting: ${saga.playerName} → ${saga.toClubName} ---`)
    try {
      const result = await ingestSagaPosts(saga.id, 20)
      if (result.error) {
        log(`  ✗ error: ${result.error}`)
        fail++
      } else {
        log(`  ✓ fetched=${result.postsFetched} added=${result.postsAdded} provider=${result.provider} (${result.durationMs}ms)`)
        ok++
      }
    } catch (err) {
      log(`  ✗ EXCEPTION: ${String(err).slice(0, 200)}`)
      fail++
    }
    // Pause between sagas to avoid rate limits
    log('  (pausing 5s...)')
    await new Promise((r) => setTimeout(r, 5000))
  }

  log('')
  log(`=== Done: ${ok} ok, ${fail} failed ===`)

  // Show final state
  log('--- Final Active Saga State ---')
  const finalSagas = await db.transferSaga.findMany({
    where: { status: 'active' },
    select: { playerName: true, toClubName: true, buzzVolume: true, excitedPct: true, skepticalPct: true, dreadingPct: true },
    orderBy: { buzzVolume: 'desc' },
  })
  for (const s of finalSagas) {
    log(`  ${s.playerName.padEnd(25)} → ${s.toClubName.padEnd(25)} buzz=${s.buzzVolume} exc=${s.excitedPct}% skep=${s.skepticalPct}% dread=${s.dreadingPct}%`)
  }

  await db.$disconnect()
}

main().catch((err) => {
  log(`FATAL: ${String(err).slice(0, 300)}`)
  process.exit(1)
})
