/**
 * scripts/migrate-sqlite-to-postgres.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off migration: SQLite → PostgreSQL for the Fan Pulse app.
 *
 * Reads every row from the legacy SQLite DB (SQLITE_SOURCE_URL) and inserts it
 * into the new Postgres DB (DATABASE_URL) via Prisma, preserving primary-key
 * IDs so foreign-key relations resolve.
 *
 * ANTI-HALLUCINATION contract (per Task ID: postgres-migration runbook):
 *   - Tables are migrated in strict dependency order so FK parents exist
 *     before their children.
 *   - If any single row fails to insert (type mismatch, constraint violation,
 *     etc.), the failure is LOGGED and the migration CONTINUES. The script
 *     never aborts on a per-row error — every other row still gets a chance.
 *   - A full failure report is printed at the end so operators can re-run for
 *     any missed table.
 *   - The source SQLite DB is opened READ-ONLY; it is never mutated.
 *
 * Run with:  bun run scripts/migrate-sqlite-to-postgres.ts
 *
 * Prerequisite: `bun run db:push` has already created all tables in Postgres.
 */
import { Database } from 'bun:sqlite'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'

// ─── Resolve env ─────────────────────────────────────────────────────────────
// Prisma loads .env automatically, but this script also needs SQLITE_SOURCE_URL.
// Parse .env manually to be resilient to shell-export quirks.
function loadEnvFile(path: string): Record<string, string> {
  try {
    const txt = readFileSync(path, 'utf8')
    const out: Record<string, string> = {}
    for (const rawLine of txt.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      // strip surrounding quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[key] = val
    }
    return out
  } catch {
    return {}
  }
}

const fileEnv = loadEnvFile('/home/z/my-project/.env')
const SQLITE_SOURCE_URL =
  process.env.SQLITE_SOURCE_URL ?? fileEnv.SQLITE_SOURCE_URL ?? ''
const DATABASE_URL =
  process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? ''

if (!SQLITE_SOURCE_URL) {
  console.error('✖ SQLITE_SOURCE_URL is not set. Cannot read legacy SQLite DB.')
  process.exit(1)
}
if (!DATABASE_URL || !DATABASE_URL.startsWith('postgres')) {
  console.error(
    '✖ DATABASE_URL must be a postgresql:// URL for the migration target.',
  )
  process.exit(1)
}

// SQLite path = the part after "file:" in SQLITE_SOURCE_URL
const sqlitePath = SQLITE_SOURCE_URL.replace(/^file:/, '')

// ─── Per-model metadata ──────────────────────────────────────────────────────
// Prisma stores DateTime as INTEGER (epoch ms) and Boolean as 0/1 in SQLite.
// We must convert these before handing the row to Prisma (Postgres), because
// Prisma's Postgres connector expects JS Date for DateTime and boolean for
// Boolean. Int fields stay as numbers.
interface ModelMeta {
  /** SQLite table name (PascalCase, == Prisma model name). */
  table: string
  /** Prisma client accessor (model name with first letter lowercased). */
  prismaAccessor: string
  /** Boolean fields that need 0/1 → false/true conversion. */
  booleanFields: string[]
  /** DateTime fields (epoch ms → Date). Nullables included. */
  datetimeFields: string[]
}

// Strict dependency order: every FK parent is migrated before its children.
// FK graph (from schema.prisma):
//   WCSelection → WCStage
//   WCSelectionPlayer → WCSelection
//   FeedMonitor → WCStage (optional)
//   FeedPost → FeedMonitor
//   PulseBreakdown → WCSelectionPlayer
//   PlayerSentiment → WCSelectionPlayer, FeedMonitor (optional)
//   TransferSource → TransferSaga
//   TransferPost → TransferSaga
//   SentimentTimeline → TransferSaga
// Standalone (no FK): User, NationalTeam, Match, FanVote, SentimentSummary,
//   FanRating, UserRating, SocialPost
const MODELS: ModelMeta[] = [
  {
    table: 'User',
    prismaAccessor: 'user',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'NationalTeam',
    prismaAccessor: 'nationalTeam',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'WCStage',
    prismaAccessor: 'wCStage',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt', 'startedAt', 'completedAt'],
  },
  {
    table: 'Match',
    prismaAccessor: 'match',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt', 'matchDate'],
  },
  {
    table: 'FanVote',
    prismaAccessor: 'fanVote',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'WCSelection',
    prismaAccessor: 'wCSelection',
    booleanFields: ['locked'],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'WCSelectionPlayer',
    prismaAccessor: 'wCSelectionPlayer',
    booleanFields: ['isLive'],
    datetimeFields: ['createdAt', 'updatedAt', 'lastBuzzRefreshAt'],
  },
  {
    table: 'FeedMonitor',
    prismaAccessor: 'feedMonitor',
    booleanFields: [],
    datetimeFields: [
      'createdAt',
      'updatedAt',
      'lastRefreshedAt',
      'endsAt',
    ],
  },
  {
    table: 'FeedPost',
    prismaAccessor: 'feedPost',
    booleanFields: [],
    datetimeFields: ['postedAt', 'analyzedAt'],
  },
  {
    table: 'PulseBreakdown',
    prismaAccessor: 'pulseBreakdown',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'PlayerSentiment',
    prismaAccessor: 'playerSentiment',
    booleanFields: [],
    datetimeFields: ['analyzedAt', 'updatedAt'],
  },
  {
    table: 'SentimentSummary',
    prismaAccessor: 'sentimentSummary',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'FanRating',
    prismaAccessor: 'fanRating',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'UserRating',
    prismaAccessor: 'userRating',
    booleanFields: [],
    datetimeFields: ['createdAt'],
  },
  {
    table: 'TransferSaga',
    prismaAccessor: 'transferSaga',
    booleanFields: [],
    datetimeFields: [
      'firstReportedAt',
      'lastUpdatedAt',
      'resolvedAt',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    table: 'TransferSource',
    prismaAccessor: 'transferSource',
    booleanFields: [],
    datetimeFields: ['reportedAt', 'createdAt'],
  },
  {
    table: 'TransferPost',
    prismaAccessor: 'transferPost',
    booleanFields: [],
    datetimeFields: ['postedAt', 'analyzedAt', 'createdAt'],
  },
  {
    table: 'SentimentTimeline',
    prismaAccessor: 'sentimentTimeline',
    booleanFields: [],
    datetimeFields: ['createdAt', 'updatedAt'],
  },
  {
    table: 'SocialPost',
    prismaAccessor: 'socialPost',
    booleanFields: [],
    datetimeFields: ['postedAt', 'createdAt', 'updatedAt'],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
interface FailureRecord {
  model: string
  id: string
  error: string
  row: unknown
}

function transformRow(
  row: Record<string, unknown>,
  booleanFields: string[],
  datetimeFields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const f of booleanFields) {
    if (f in out) {
      const v = out[f]
      out[f] = v === 1 || v === true || v === '1' || v === 'true'
    }
  }
  for (const f of datetimeFields) {
    if (f in out && out[f] !== null && out[f] !== undefined) {
      const v = out[f]
      if (typeof v === 'number' || typeof v === 'string') {
        out[f] = new Date(v)
      }
    }
  }
  return out
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('  Fan Pulse — SQLite → Postgres migration')
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log(`  Source (SQLite): ${sqlitePath}`)
  console.log(`  Target (Postgres): ${DATABASE_URL.replace(/:[^:@/]+@/, ':****@')}`)
  console.log('────────────────────────────────────────────────────────────────────────')

  const sqlite = new Database(sqlitePath, { readonly: true })
  const prisma = new PrismaClient({
    log: ['warn', 'error'],
  })

  const failures: FailureRecord[] = []
  const summary: Array<{
    model: string
    before: number
    inserted: number
    failed: number
  }> = []

  // 1) Capture before-counts from SQLite (source of truth for verification)
  const beforeCounts: Record<string, number> = {}
  for (const m of MODELS) {
    try {
      const row = sqlite
        .query(`SELECT count(*) AS c FROM "${m.table}"`)
        .get() as { c: number }
      beforeCounts[m.table] = row.c
    } catch (err) {
      // Table may not exist in this SQLite DB (e.g. a model added after the
      // last SQLite push). Treat as 0 rows and continue.
      beforeCounts[m.table] = 0
      console.log(
        `  ⚠ Table "${m.table}" not readable from SQLite (${(err as Error).message}); treating as 0 rows.`,
      )
    }
  }

  console.log('\n── Migrating rows (dependency order) ──────────────────────────────────')
  for (const m of MODELS) {
    const before = beforeCounts[m.table] ?? 0
    if (before === 0) {
      console.log(`  ${m.table.padEnd(22)} 0 rows (skipped)`)
      summary.push({ model: m.table, before: 0, inserted: 0, failed: 0 })
      continue
    }

    const rows = sqlite
      .query(`SELECT * FROM "${m.table}"`)
      .all() as Record<string, unknown>[]

    let inserted = 0
    let failed = 0
    const accessor = (
      prisma as unknown as Record<string, { create: (args: { data: unknown }) => Promise<unknown> }>
    )[m.prismaAccessor]

    if (!accessor || typeof accessor.create !== 'function') {
      console.log(
        `  ✖ ${m.table.padEnd(22)} no Prisma accessor "${m.prismaAccessor}" — SKIPPED`,
      )
      summary.push({ model: m.table, before, inserted: 0, failed })
      continue
    }

    for (const row of rows) {
      const id = String(row.id ?? '<no-id>')
      const data = transformRow(row, m.booleanFields, m.datetimeFields)
      try {
        await accessor.create({ data })
        inserted++
      } catch (err) {
        failed++
        const msg = (err as Error)?.message ?? String(err)
        failures.push({ model: m.table, id, error: msg, row })
        // Continue to next row — anti-hallucination: never abort the whole run.
      }
    }

    console.log(
      `  ${m.table.padEnd(22)} Migrated ${inserted}/${before}` +
        (failed > 0 ? `  (${failed} failed — logged)` : ''),
    )
    summary.push({ model: m.table, before, inserted, failed })
  }

  // 2) Verify: count rows now in Postgres, compare against SQLite before-count
  console.log('\n── Verification: row counts (SQLite before → Postgres after) ─────────')
  console.log(
    `  ${'Model'.padEnd(22)} ${'SQLite'.padStart(8)} ${'Postgres'.padStart(10)} ${'Match'.padStart(8)}`,
  )
  console.log(`  ${'─'.repeat(22)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(8)}`)
  let allMatch = true
  let totalSqlite = 0
  let totalPostgres = 0
  for (const m of MODELS) {
    const before = beforeCounts[m.table] ?? 0
    let after = -1
    try {
      // Use Prisma's generated count. The accessor is `prisma.<model>.count()`.
      const accessor = (
        prisma as unknown as Record<string, { count: (args?: unknown) => Promise<number> }>
      )[m.prismaAccessor]
      after = await accessor.count()
    } catch (err) {
      after = -1
      console.log(`  ✖ could not count ${m.table}: ${(err as Error).message}`)
    }
    totalSqlite += before
    totalPostgres += after > 0 ? after : 0
    const match = after === before ? '✓' : after === -1 ? '?' : '✗'
    if (after !== before) allMatch = false
    console.log(
      `  ${m.table.padEnd(22)} ${String(before).padStart(8)} ${String(after).padStart(10)} ${match.padStart(8)}`,
    )
  }
  console.log(`  ${'─'.repeat(22)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(8)}`)
  console.log(
    `  ${'TOTAL'.padEnd(22)} ${String(totalSqlite).padStart(8)} ${String(totalPostgres).padStart(10)}`,
  )

  // 3) Failure report
  if (failures.length > 0) {
    console.log(`\n── Failure report (${failures.length} rows failed) ────────────────────`)
    for (const f of failures) {
      console.log(`  ✖ ${f.model} id=${f.id}`)
      console.log(`      error: ${f.error}`)
    }
    console.log(
      '\n  These rows were NOT migrated. Inspect the errors above and re-run\n' +
        '  targeted inserts for the affected tables if needed. All other rows\n' +
        '  were migrated successfully.',
    )
  } else {
    console.log('\n── No per-row failures. All rows inserted cleanly. ✓ ──────────────────')
  }

  console.log('\n── Migration finished ─────────────────────────────────────────────────')
  if (allMatch && failures.length === 0) {
    console.log('  ✓ All table counts match. Migration verified.')
  } else if (allMatch) {
    console.log(
      '  ✓ All table counts match, but some rows failed individually — check the failure report.',
    )
  } else {
    console.log(
      '  ✗ Some table counts do NOT match. See the table above for details.',
    )
  }

  await prisma.$disconnect()
  sqlite.close()
}

main().catch((err) => {
  console.error('✖ Migration script crashed:', err)
  process.exit(1)
})
