/**
 * Phase 1 verification script — confirms the new Transfer Pulse tables exist
 * and the Prisma client exposes them. Run with: bun run scripts/verify-transfer-pulse-tables.ts
 *
 * Anti-hallucination: this script only READS — it never inserts, updates, or
 * deletes anything. Safe to run any time.
 */
import { getDb } from '../src/lib/db'

async function main() {
  const db = getDb()
  const tableNames = [
    'transferSaga',
    'transferSource',
    'transferPost',
    'sentimentTimeline',
    'transferAlert',
  ] as const

  console.log('── Transfer Pulse table verification ─────────────────────')
  let allOk = true
  for (const name of tableNames) {
    const accessor = name as keyof typeof db
    const model = (db as any)[accessor]
    if (!model || typeof model.count !== 'function') {
      console.error(`  ✗ ${name}: MISSING on PrismaClient`)
      allOk = false
      continue
    }
    try {
      const count = await model.count()
      console.log(`  ✓ ${name}: exists, row count = ${count}`)
    } catch (err) {
      console.error(`  ✗ ${name}: count() failed — ${String(err).slice(0, 200)}`)
      allOk = false
    }
  }

  // Also verify the unique constraints + indexes are queryable by running
  // a harmless findFirst on each. (findFirst on an empty table returns null,
  // which is fine — we just want to confirm the query compiles + runs.)
  console.log('── findFirst smoke test ─────────────────────────────────')
  try {
    await db.transferSaga.findFirst()
    await db.transferSource.findFirst()
    await db.transferPost.findFirst()
    await db.sentimentTimeline.findFirst()
    await db.transferAlert.findFirst()
    console.log('  ✓ all five models respond to findFirst()')
  } catch (err) {
    console.error(`  ✗ findFirst failed — ${String(err).slice(0, 200)}`)
    allOk = false
  }

  console.log('─────────────────────────────────────────────────────────')
  console.log(allOk ? 'RESULT: ALL TABLES VERIFIED ✓' : 'RESULT: VERIFICATION FAILED ✗')
  process.exit(allOk ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
