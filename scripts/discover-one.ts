/**
 * Focused discovery for a single high-profile player — designed to NOT hit
 * Z.ai rate limits. Runs ONE player at a time, then exits.
 *
 * Usage: bun run scripts/discover-one.ts <playerName>
 */
import { db } from '../src/lib/db'
import { discoverTransferSagas } from '../src/lib/transfer-pulse/discovery'

async function main() {
  const playerName = process.argv[2]
  if (!playerName) {
    console.error('Usage: bun run scripts/discover-one.ts <playerName>')
    process.exit(1)
  }
  console.log(`[discover-one] Running discovery for: ${playerName}`)
  const result = await discoverTransferSagas({ playerName })
  console.log('── Result ───────────────────────────────────────')
  console.log(`  playersScanned: ${result.playersScanned}`)
  console.log(`  sagasCreated:   ${result.sagasCreated}`)
  console.log(`  sagasUpdated:   ${result.sagasUpdated}`)
  console.log(`  sourcesAdded:   ${result.sourcesAdded}`)
  console.log(`  skipped:        ${result.skipped}`)
  console.log(`  errors:         ${result.errors.length}`)
  for (const e of result.errors.slice(0, 5)) console.log(`    - ${e}`)
  console.log(`  durationMs:     ${result.durationMs}`)
  await db.$disconnect()
  process.exit(0)
}
main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
