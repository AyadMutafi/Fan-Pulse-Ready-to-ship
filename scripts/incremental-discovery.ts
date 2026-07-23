/**
 * Incremental discovery + ingest — designed to run slowly to avoid Z.ai 429s.
 *
 * - Runs discovery for 3 more high-profile players (with 20s gaps between).
 * - Runs ingest for ALL active sagas.
 *
 * Usage: bun run scripts/incremental-discovery.ts
 */
import { db } from '../src/lib/db'
import { discoverTransferSagas } from '../src/lib/transfer-pulse/discovery'
import { ingestSagaPosts } from '../src/lib/transfer-pulse/ingest'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Incremental discovery + ingest')
  console.log('═══════════════════════════════════════════════════════════════')

  // ── Phase 1: discovery for a few more players (slow, with gaps) ─────────
  const targetPlayers = [
    'Kylian Mbappé',
    'Lamine Yamal',
    'Mohamed Salah',
  ]

  for (const playerName of targetPlayers) {
    console.log(`\n→ discovering ${playerName} ...`)
    try {
      const result = await discoverTransferSagas({ playerName })
      console.log(
        `  created=${result.sagasCreated} updated=${result.sagasUpdated} skipped=${result.skipped} errors=${result.errors.length}`,
      )
      if (result.errors.length > 0) {
        for (const e of result.errors.slice(0, 3)) console.log(`  err: ${e}`)
      }
    } catch (err) {
      console.log(`  ✗ FAILED: ${String(err).slice(0, 200)}`)
    }
    // Long pause between players to let the Z.ai rate-limit bucket refill.
    console.log('  (pausing 20s to respect Z.ai rate limit)')
    await sleep(20_000)
  }

  // ── Phase 2: ingest for all active sagas ────────────────────────────────
  console.log('\n───────── Ingesting fan posts for all active sagas ─────────')
  const activeSagas = await db.transferSaga.findMany({
    where: { status: 'active' },
    orderBy: { lastUpdatedAt: 'asc' },
  })
  console.log(`Found ${activeSagas.length} active sagas`)
  let totalPostsAdded = 0
  for (const saga of activeSagas) {
    console.log(`\n→ ingesting ${saga.playerName} → ${saga.toClubName} ...`)
    try {
      const r = await ingestSagaPosts(saga.id, 15)
      console.log(
        `  fetched=${r.postsFetched} added=${r.postsAdded} provider=${r.provider}${r.error ? ` err=${r.error.slice(0, 80)}` : ''}`,
      )
      totalPostsAdded += r.postsAdded
    } catch (err) {
      console.log(`  ✗ FAILED: ${String(err).slice(0, 200)}`)
    }
    // Pause between sagas too.
    console.log('  (pausing 12s)')
    await sleep(12_000)
  }
  console.log(`\nPhase 2 totals: ${totalPostsAdded} posts added across ${activeSagas.length} sagas`)

  // ── Final summary ───────────────────────────────────────────────────────
  const allSagas = await db.transferSaga.findMany({
    orderBy: [{ status: 'asc' }, { lastUpdatedAt: 'desc' }],
    select: { playerName: true, fromClubName: true, toClubName: true, status: true, buzzVolume: true, tier1Count: true },
  })
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`  Final saga count: ${allSagas.length}`)
  console.log('═══════════════════════════════════════════════════════════════')
  for (const s of allSagas) {
    console.log(`  [${s.status.padEnd(9)}] ${s.playerName.padEnd(28)} ${s.fromClubName} → ${s.toClubName}  tier1=${s.tier1Count} buzz=${s.buzzVolume}`)
  }

  await db.$disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
