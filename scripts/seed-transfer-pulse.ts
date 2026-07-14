/**
 * Seed Transfer Pulse — one-off script that runs the discovery + ingest
 * pipelines directly (bypassing admin auth, which requires ADMIN_PASSWORD).
 *
 * WHY THIS EXISTS:
 *   The /api/transfers/discover route is admin-gated. In dev/sandbox where
 *   ADMIN_PASSWORD is not set, the route is fail-closed (returns 401).
 *   This script calls the pipeline functions directly so we can populate
 *   the DB with real sagas + fan posts without needing the admin password.
 *
 * USAGE:
 *   bun run scripts/seed-transfer-pulse.ts
 *
 * ANTI-HALLUCINATION: this script does NOT fabricate anything. It only
 * calls discoverTransferSagas (which only creates sagas from verified
 * Tier 1 journalist posts) and ingestSagaPosts (which only ingests real
 * fan posts with verified URLs). If the SDKs return nothing, the DB stays
 * empty and the tab shows an honest empty state.
 */
import { discoverTransferSagas } from '../src/lib/transfer-pulse/discovery'
import { ingestSagaPosts } from '../src/lib/transfer-pulse/ingest'
import { db } from '../src/lib/db'

async function main() {
  const args = process.argv.slice(2)
  const maxPlayersIdx = args.indexOf('--max')
  const maxPlayers =
    maxPlayersIdx !== -1 ? parseInt(args[maxPlayersIdx + 1], 10) || 6 : 6
  const playerNameIdx = args.indexOf('--player')
  const playerName =
    playerNameIdx !== -1 ? args[playerNameIdx + 1] : undefined
  const skipIngest = args.includes('--no-ingest')

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Transfer Pulse — Seed Script')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Players: ${playerName || `batch of ${maxPlayers}`}`)
  console.log(`  Ingest:  ${skipIngest ? 'SKIP' : 'ENABLED'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // ── Phase 1: Discover sagas ────────────────────────────────────────────
  console.log('\n▶ Phase 1: Discovery')
  const discovery = await discoverTransferSagas({
    maxPlayers,
    playerName,
  })

  console.log('\n── Discovery Result ──────────────────────────────────────')
  console.log(`  Players scanned: ${discovery.playersScanned}`)
  console.log(`  Sagas created:   ${discovery.sagasCreated}`)
  console.log(`  Sagas updated:   ${discovery.sagasUpdated}`)
  console.log(`  Sources added:   ${discovery.sourcesAdded}`)
  console.log(`  Skipped:         ${discovery.skipped}`)
  console.log(`  Duration:        ${(discovery.durationMs / 1000).toFixed(1)}s`)
  if (discovery.errors.length > 0) {
    console.log(`  Errors (${discovery.errors.length}):`)
    for (const e of discovery.errors.slice(0, 10)) {
      console.log(`    • ${e.slice(0, 150)}`)
    }
  }

  // ── Phase 2: Ingest fan posts for each active saga ─────────────────────
  if (skipIngest) {
    console.log('\n⏭  Skipping ingest (--no-ingest flag)')
  } else {
    console.log('\n▶ Phase 2: Ingest fan posts + sentiment')

    const sagas = await db.transferSaga.findMany({
      where: { status: 'active' },
      orderBy: { lastUpdatedAt: 'desc' },
      take: 10, // cap to avoid hammering the SDK
    })

    console.log(`  Found ${sagas.length} active saga(s) to ingest`)

    for (let i = 0; i < sagas.length; i++) {
      const saga = sagas[i]
      console.log(
        `\n  [${i + 1}/${sagas.length}] ${saga.playerName} → ${saga.toClubName}`,
      )
      const result = await ingestSagaPosts(saga.id, 12)
      console.log(
        `    posts fetched: ${result.postsFetched}, added: ${result.postsAdded}, ` +
          `provider: ${result.provider}, ${(result.durationMs / 1000).toFixed(1)}s` +
          (result.error ? ` ⚠ ${result.error.slice(0, 80)}` : ''),
      )
    }
  }

  // ── Final report ───────────────────────────────────────────────────────
  const total = await db.transferSaga.count()
  const active = await db.transferSaga.count({ where: { status: 'active' } })
  const completed = await db.transferSaga.count({ where: { status: 'completed' } })
  const debunked = await db.transferSaga.count({ where: { status: 'debunked' } })
  const sources = await db.transferSource.count()
  const posts = await db.transferPost.count()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Final DB State')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  TransferSaga:   ${total} total (${active} active, ${completed} completed, ${debunked} debunked)`)
  console.log(`  TransferSource: ${sources} Tier 1 journalist reports`)
  console.log(`  TransferPost:   ${posts} fan posts scored`)
  console.log('═══════════════════════════════════════════════════════════\n')

  await db.$disconnect()
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
