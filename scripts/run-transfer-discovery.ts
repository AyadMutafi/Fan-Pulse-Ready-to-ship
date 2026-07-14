/**
 * Phase 2 verification — runs discoverTransferSagas() once with a small cap
 * and prints what was created/skipped. Confirms sagas are created ONLY for
 * Tier-1-sourced rumors (no fabricated sagas).
 *
 * Usage: bun run scripts/run-transfer-discovery.ts [playerCap]
 */
import { discoverTransferSagas } from '../src/lib/transfer-pulse/discovery'
import { db } from '../src/lib/db'

async function main() {
  const cap = parseInt(process.argv[2] || '3', 10)
  console.log(`[discovery] Running with playerCap=${cap} ...`)

  const result = await discoverTransferSagas({ playerCap: cap, offset: 0 })
  console.log('── Discovery result ──────────────────────────────')
  console.log(`  playersProcessed: ${result.playersProcessed}`)
  console.log(`  created:          ${result.created}`)
  console.log(`  updated:          ${result.updated}`)
  console.log(`  skipped:          ${result.skipped}`)
  console.log(`  errors:           ${result.errors.length}`)
  for (const e of result.errors) console.log(`    - ${e}`)
  console.log(`  durationMs:       ${result.durationMs}`)

  // Verify: list all sagas + their Tier 1 source count
  const sagas = await db.transferSaga.findMany({
    include: { sources: { where: { tier: 1 } } },
    orderBy: { createdAt: 'desc' },
  })
  console.log('── Sagas in DB ───────────────────────────────────')
  if (sagas.length === 0) {
    console.log('  (none — search returned no Tier 1 reports this run; this is honest, not a bug)')
  }
  for (const s of sagas) {
    console.log(
      `  • [${s.id}] ${s.playerName} → ${s.toClubName} (${s.toClubCode}) | tier1Count=${s.tier1Count} | sources=${s.sources.length} | status=${s.status}`,
    )
    for (const src of s.sources) {
      console.log(`      - ${src.journalistName} (${src.journalistHandle}): ${src.headline.slice(0, 80)}`)
      console.log(`        ${src.url}`)
    }
  }

  // ANTI-HALLUCINATION audit: every saga MUST have ≥1 Tier 1 source
  const noTier1 = sagas.filter((s) => s.tier1Count === 0)
  if (noTier1.length > 0) {
    console.error(`  ✗ ANTI-HALLUCINATION VIOLATION: ${noTier1.length} sagas have tier1Count=0`)
    for (const s of noTier1) {
      console.error(`      - ${s.playerName} → ${s.toClubName}`)
    }
    process.exit(1)
  }
  console.log('  ✓ Anti-hallucination audit: every saga has ≥1 Tier 1 source')

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
