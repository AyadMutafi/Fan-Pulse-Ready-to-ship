/**
 * scripts/test-concurrent-writes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Concurrency smoke test for SQLite + Prisma under WAL mode.
 *
 * Inserts 100 FanVote rows IN PARALLEL (via Promise.all on 100 create() calls)
 * and confirms that none are lost to SQLITE_BUSY or lock contention.
 *
 * This validates the Saturday EPL load profile: 7 concurrent matches,
 * ~70 vote events/minute. 100 parallel writes is a stress far beyond the
 * real load (which is ~1.2 writes/sec) — if all 100 survive, the real load
 * is safe by a wide margin.
 *
 * Prerequisites:
 *   - `bun run db:push` has applied the WAL pragmas + new indexes.
 *   - The FanVote table exists.
 *
 * Run with:  bun run scripts/test-concurrent-writes.ts
 *
 * The script cleans up its own test rows afterward (deletes all FanVote rows
 * with teamCode='CONTEST') so re-runs are idempotent.
 */
import { db } from '/home/z/my-project/src/lib/db'

const TEAM_CODE = 'CONTEST' // 6 chars — won't collide with real 3-letter team codes
const ROW_COUNT = 100
const RUN_ID = Date.now().toString(36)

interface InsertOutcome {
  index: number
  ok: boolean
  error?: string
  durationMs: number
}

async function main() {
  // 0. Pre-clean any rows from a prior run.
  const deleted = await db.fanVote.deleteMany({ where: { teamCode: TEAM_CODE } })
  console.log(`[setup] deleted ${deleted.count} leftover rows from prior runs`)

  // 1. Confirm WAL is active before the test.
  // NOTE: Prisma returns SQLite integers as BigInt, so we stringify via
  // String() rather than JSON.stringify() (which throws on BigInt).
  const journalMode = await db.$queryRawUnsafe('PRAGMA journal_mode')
  const busyTimeout = await db.$queryRawUnsafe('PRAGMA busy_timeout')
  const synchronous = await db.$queryRawUnsafe('PRAGMA synchronous')
  console.log('[pragma] journal_mode =', String(JSON.stringify(journalMode, (_, v) => (typeof v === 'bigint' ? v.toString() : v))))
  console.log('[pragma] busy_timeout =', String(JSON.stringify(busyTimeout, (_, v) => (typeof v === 'bigint' ? v.toString() : v))))
  console.log('[pragma] synchronous  =', String(JSON.stringify(synchronous, (_, v) => (typeof v === 'bigint' ? v.toString() : v))))

  // 2. Fire 100 parallel inserts. Each gets its own unique sessionId so the
  //    @@unique([teamCode, sessionId]) constraint doesn't fire. We do NOT
  //    await them serially — the whole point is concurrent contention.
  console.log(`\n[test] firing ${ROW_COUNT} parallel inserts...`)
  const testStart = Date.now()
  const promises: Promise<InsertOutcome>[] = []
  for (let i = 0; i < ROW_COUNT; i++) {
    const sessionId = `concurrent-${RUN_ID}-${i}`
    const score = 50 + (i % 50) // 50-99, varied
    const insertStart = Date.now()
    promises.push(
      db.fanVote
        .create({
          data: { teamCode: TEAM_CODE, sessionId, score },
          select: { id: true },
        })
        .then(() => ({
          index: i,
          ok: true,
          durationMs: Date.now() - insertStart,
        }))
        .catch((err: unknown) => ({
          index: i,
          ok: false,
          error: String(err).slice(0, 200),
          durationMs: Date.now() - insertStart,
        })),
    )
  }
  const outcomes = await Promise.all(promises)
  const totalMs = Date.now() - testStart

  // 3. Tally results.
  const succeeded = outcomes.filter((o) => o.ok)
  const failed = outcomes.filter((o) => !o.ok)
  const dbCount = await db.fanVote.count({ where: { teamCode: TEAM_CODE } })
  const maxDur = Math.max(...outcomes.map((o) => o.durationMs))
  const avgDur = Math.round(
    outcomes.reduce((sum, o) => sum + o.durationMs, 0) / outcomes.length,
  )

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`  CONCURRENT WRITE TEST — ${ROW_COUNT} parallel FanVote inserts`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Total wall time:        ${totalMs} ms`)
  console.log(`  Avg per insert:         ${avgDur} ms`)
  console.log(`  Slowest single insert:  ${maxDur} ms`)
  console.log(`  Promises succeeded:     ${succeeded.length} / ${ROW_COUNT}`)
  console.log(`  Promises failed:        ${failed.length} / ${ROW_COUNT}`)
  console.log(`  Rows actually in DB:    ${dbCount} / ${ROW_COUNT}`)
  console.log('───────────────────────────────────────────────────────────────')
  if (failed.length > 0) {
    console.log('  FAILURES (first 5):')
    for (const f of failed.slice(0, 5)) {
      console.log(`    #${f.index}: ${f.error}`)
    }
  }
  if (dbCount === ROW_COUNT) {
    console.log('  ✅ PASS — all 100 rows persisted, none lost to lock contention.')
  } else {
    console.log(
      `  ❌ FAIL — expected ${ROW_COUNT} rows, found ${dbCount}. ${ROW_COUNT - dbCount} lost.`,
    )
  }
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 4. Post-clean.
  const cleanup = await db.fanVote.deleteMany({ where: { teamCode: TEAM_CODE } })
  console.log(`[cleanup] deleted ${cleanup.count} test rows`)

  await db.$disconnect()
  process.exit(dbCount === ROW_COUNT ? 0 : 1)
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
