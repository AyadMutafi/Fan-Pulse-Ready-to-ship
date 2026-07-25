/**
 * run-discovery.ts
 *
 * Runs the Transfer Pulse discovery pipeline for a batch of 8 tracked players
 * (offset 0) and prints the full result + any errors in full.
 *
 * Pulls Tier 1 journalist posts via xAI x_search (primary) with a Z.ai
 * web_search fallback. Each Tier 1 post that names a destination club anchors
 * (or updates) a TransferSaga row.
 *
 * Usage: cd /home/z/my-project && bun run scripts/run-discovery.ts
 *
 * Expected runtime: 30-90 seconds (xAI API + LLM calls).
 */
import { db } from '/home/z/my-project/src/lib/db'
import { discoverTransferSagas } from '/home/z/my-project/src/lib/transfer-pulse/discovery'
import { TRACKED_PLAYERS } from '/home/z/my-project/src/lib/transfer-pulse/tracked-players'

async function main() {
  const startedAt = Date.now()
  // Allow override via env so we can chunk the run when the sandbox's bash
  // timeout is shorter than the full discovery duration (each player can take
  // 30-60s due to xAI x_search + Z.ai fallback + LLM extraction).
  const maxPlayers = Number(process.env.MAX_PLAYERS ?? '8')
  const offset = Number(process.env.OFFSET ?? '0')
  const batch = TRACKED_PLAYERS.slice(offset, offset + maxPlayers)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Transfer Pulse — Discovery Run (maxPlayers=${maxPlayers}, offset=${offset})`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(
    `  Players in batch (${batch.length}):`,
    batch.map((p) => p.name).join(', '),
  )
  console.log()

  const result = await discoverTransferSagas({ maxPlayers, offset })

  console.log('\n───────────────────────────────────────────────────────────────')
  console.log('  DISCOVERY RESULT')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`  playersScanned: ${result.playersScanned}`)
  console.log(`  sagasCreated:   ${result.sagasCreated}`)
  console.log(`  sagasUpdated:   ${result.sagasUpdated}`)
  console.log(`  sourcesAdded:   ${result.sourcesAdded}`)
  console.log(`  skipped:        ${result.skipped}`)
  console.log(`  durationMs:     ${result.durationMs} (${(result.durationMs / 1000).toFixed(1)}s)`)
  console.log(`  errors.length:  ${result.errors.length}`)

  if (result.errors.length > 0) {
    console.log('\n  FULL ERRORS (untruncated):')
    for (let i = 0; i < result.errors.length; i++) {
      console.log(`\n  [${i + 1}/${result.errors.length}] ${result.errors[i]}`)
    }
  } else {
    console.log('\n  (no errors)')
  }

  // ── Print updated saga list ──────────────────────────────────────────────
  const elapsed = Date.now() - startedAt
  console.log('\n───────────────────────────────────────────────────────────────')
  console.log(`  Updated saga list (after discovery, wall=${elapsed}ms)`)
  console.log('───────────────────────────────────────────────────────────────')
  const sagas = await db.transferSaga.findMany({
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
  console.log(`  Total sagas: ${sagas.length}\n`)
  for (const s of sagas) {
    console.log(
      `    [${s.status.padEnd(9)}] ${s.playerName.padEnd(26)} ${s.fromClubName} → ${s.toClubName}  tier1=${s.tier1Count} buzz=${s.buzzVolume}  ${s.lastUpdatedAt.toISOString().slice(0, 16)}`,
    )
  }

  // Also print the newest sources added in the last 30 minutes (sanity check)
  const since = new Date(Date.now() - 30 * 60 * 1000)
  const freshSources = await db.transferSource.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: {
      journalistName: true,
      journalistHandle: true,
      url: true,
      headline: true,
      reportedAt: true,
      saga: { select: { playerName: true, toClubName: true } },
    },
    take: 30,
  })
  console.log(
    `\n  Sources added in the last 30 minutes: ${freshSources.length}`,
  )
  for (const s of freshSources) {
    console.log(
      `    @${s.journalistHandle} → ${s.saga.playerName} → ${s.saga.toClubName}: "${s.headline.slice(0, 100)}"`,
    )
  }

  await db.$disconnect()
  console.log('\n✓ Done.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
