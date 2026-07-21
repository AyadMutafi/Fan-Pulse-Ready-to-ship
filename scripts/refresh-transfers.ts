/**
 * scripts/refresh-transfers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off refresh script (run on 2026-07-21):
 *   1. Cleans up the 3 bad/overdue sagas:
 *      - "Bruno Fernandes Man United → Manchester United" (completed) — bad LLM
 *        extraction; the source post was about contract-renewal talks, not a
 *        transfer. Mark debunked.
 *      - "Marcus Rashford Man United → Manchester United" (completed) — same
 *        issue; source post was "Rashford to remain at Manchester United as
 *        Barcelona's buy option expires." Mark debunked.
 *      - "Marcus Rashford Man United → Barcelona" (active) — Romano's Jun 10
 *        post confirmed "Barcelona will NOT exercise €30m buy option" which
 *        DEBUNKS the saga, but the status was never updated. Mark debunked.
 *   2. Runs a fresh discovery batch for high-profile players using the Z.ai
 *      web_search fallback (works without XAI_API_KEY in the sandbox).
 *   3. Reports what changed.
 *
 * Run with: bun run scripts/refresh-transfers.ts
 */
import { db } from '@/lib/db'
import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'

// Players most likely to have current July 2026 transfer rumors (post-WC final
// Jul 19, pre-EPL kickoff mid-Aug). Picked from the watchlist based on
// pre-tournament hype + WC 2026 performance driving transfer interest.
const FRESH_BATCH_PLAYERS = [
  'Florian Wirtz',        // Leverkusen → rumored Liverpool/City
  'Mohamed Salah',        // Liverpool contract entering final year
  'Alexander Isak',       // Newcastle → rumored big-money move
  'Bryan Mbeumo',         // Brentford → rumored Spurs
  'Nico Williams',        // Athletic Bilbao → rumored Barca/Bayern
  'Viktor Gyökeres',      // Sporting CP → rumored Arsenal/United
  'Dean Huijsen',         // Bournemouth → rumored Real Madrid
  'Cole Palmer',          // Chelsea — always buzz-worthy
]

async function main() {
  console.log('━'.repeat(72))
  console.log('REFRESH: Transfer Pulse — cleanup + fresh discovery')
  console.log('━'.repeat(72))

  // ── Step 1: Clean up bad/overdue sagas ────────────────────────────────────
  console.log('\n[1] Cleaning up bad/overdue sagas...')

  // 1a. Mark the 2 same-club "completed" sagas as debunked (bad extractions)
  const badSagas = await db.transferSaga.findMany({
    where: {
      OR: [
        {
          playerName: 'Bruno Fernandes',
          toClubName: 'Manchester United',
          status: 'completed',
        },
        {
          playerName: 'Marcus Rashford',
          toClubName: 'Manchester United',
          status: 'completed',
        },
      ],
    },
  })
  for (const s of badSagas) {
    await db.transferSaga.update({
      where: { id: s.id },
      data: {
        status: 'debunked',
        resolvedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    console.log(`    ✓ debunked (bad extraction): ${s.playerName} → ${s.toClubName} (was "completed")`)
  }

  // 1b. Mark Rashford → Barcelona as debunked (Romano confirmed Barca pulled out)
  const rashBarca = await db.transferSaga.findFirst({
    where: { playerName: 'Marcus Rashford', toClubName: 'Barcelona', status: 'active' },
  })
  if (rashBarca) {
    await db.transferSaga.update({
      where: { id: rashBarca.id },
      data: {
        status: 'debunked',
        resolvedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    console.log(`    ✓ debunked (Barca pulled out Jun 10): Marcus Rashford → Barcelona (was "active")`)
  }

  // 1c. Mark Bruno → Tottenham as debunked (source was a retrospective quote
  // about "years ago" — not a current rumor)
  const bruSpurs = await db.transferSaga.findFirst({
    where: { playerName: 'Bruno Fernandes', toClubName: 'Tottenham', status: 'active' },
  })
  if (bruSpurs) {
    await db.transferSaga.update({
      where: { id: bruSpurs.id },
      data: {
        status: 'debunked',
        resolvedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    console.log(`    ✓ debunked (retrospective quote, not current): Bruno Fernandes → Tottenham (was "active")`)
  }

  // ── Step 2: Run fresh discovery for high-profile players ──────────────────
  console.log(`\n[2] Running fresh discovery for ${FRESH_BATCH_PLAYERS.length} high-profile players...`)
  console.log('    (Uses Z.ai web_search fallback — works without XAI_API_KEY)')
  console.log('    (Each player: 3 web_search calls + LLM extraction ≈ 15-20s)')

  let totalCreated = 0
  let totalUpdated = 0
  let totalSources = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (let i = 0; i < FRESH_BATCH_PLAYERS.length; i++) {
    const playerName = FRESH_BATCH_PLAYERS[i]
    console.log(`\n    [${i + 1}/${FRESH_BATCH_PLAYERS.length}] Discovering: ${playerName}`)
    try {
      const result = await discoverTransferSagas({ playerName })
      totalCreated += result.sagasCreated
      totalUpdated += result.sagasUpdated
      totalSources += result.sourcesAdded
      totalSkipped += result.skipped
      if (result.errors.length) errors.push(...result.errors)
      console.log(
        `      → created=${result.sagasCreated} updated=${result.sagasUpdated} ` +
          `sources=${result.sourcesAdded} skipped=${result.skipped} ` +
          `(${result.durationMs}ms)`,
      )
    } catch (err) {
      const msg = `${playerName}: ${String(err).slice(0, 150)}`
      errors.push(msg)
      console.log(`      ✗ failed: ${msg}`)
    }
  }

  // ── Step 3: Report final state ────────────────────────────────────────────
  console.log('\n' + '━'.repeat(72))
  console.log('SUMMARY')
  console.log('━'.repeat(72))
  console.log(`  Sagas created:  ${totalCreated}`)
  console.log(`  Sagas updated:  ${totalUpdated}`)
  console.log(`  Sources added:  ${totalSources}`)
  console.log(`  Players skipped (no Tier 1 posts): ${totalSkipped}`)
  if (errors.length) {
    console.log(`  Errors (${errors.length}):`)
    for (const e of errors.slice(0, 10)) console.log(`    - ${e}`)
  }

  const finalActive = await db.transferSaga.count({ where: { status: 'active' } })
  const finalDebunked = await db.transferSaga.count({ where: { status: 'debunked' } })
  const finalCompleted = await db.transferSaga.count({ where: { status: 'completed' } })
  console.log(`\n  Final DB state: ${finalActive} active, ${finalCompleted} completed, ${finalDebunked} debunked`)

  const recentSagas = await db.transferSaga.findMany({
    where: { status: 'active' },
    orderBy: { lastUpdatedAt: 'desc' },
    take: 10,
    select: { playerName: true, fromClubName: true, toClubName: true, buzzVolume: true, tier1Count: true, lastUpdatedAt: true },
  })
  if (recentSagas.length > 0) {
    console.log('\n  Active sagas now:')
    for (const s of recentSagas) {
      console.log(`    - ${s.playerName} | ${s.fromClubName} → ${s.toClubName} | buzz=${s.buzzVolume} tier1=${s.tier1Count} | ${s.lastUpdatedAt.toISOString().slice(0, 16)}`)
    }
  }

  console.log('\n' + '━'.repeat(72))
  console.log('DONE.')
  console.log('━'.repeat(72))
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
