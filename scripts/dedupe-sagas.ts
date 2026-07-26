/**
 * Deduplicate sagas with the same playerName + toClubCode (should be unique
 * by schema, but a race condition in parallel feed-scan created a duplicate).
 * Keeps the one with more Tier 1 sources; merges sources into the keeper.
 */
import { db } from '../src/lib/db'

async function main() {
  await db.$connect()
  // Find all sagas grouped by playerName + toClubCode
  const sagas = await db.transferSaga.findMany({
    select: { id: true, playerName: true, toClubCode: true, toClubName: true, fromClubName: true, status: true, tier1Count: true, lastUpdatedAt: true },
    orderBy: { lastUpdatedAt: 'desc' },
  })

  const groups = new Map<string, typeof sagas>()
  for (const s of sagas) {
    const key = `${s.playerName}|${s.toClubCode}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  let removed = 0
  for (const [key, group] of groups) {
    if (group.length <= 1) continue
    // Keep the one with the most tier1 sources (or most recent if tied)
    const sorted = [...group].sort((a, b) => b.tier1Count - a.tier1Count || b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime())
    const keeper = sorted[0]
    const dupes = sorted.slice(1)
    console.log(`Duplicate group: ${key}`)
    console.log(`  KEEP:   ${keeper.id} [${keeper.status}] ${keeper.fromClubName} → ${keeper.toClubName} tier1=${keeper.tier1Count}`)
    for (const d of dupes) {
      console.log(`  REMOVE: ${d.id} [${d.status}] ${d.fromClubName} → ${d.toClubName} tier1=${d.tier1Count}`)
      // Move sources from dupe to keeper
      await db.transferSource.updateMany({ where: { sagaId: d.id }, data: { sagaId: keeper.id } })
      // Move posts from dupe to keeper
      await db.transferPost.updateMany({ where: { sagaId: d.id }, data: { sagaId: keeper.id } })
      // Move timeline from dupe to keeper
      await db.sagaTimeline.updateMany({ where: { sagaId: d.id }, data: { sagaId: keeper.id } })
      // Delete the dupe
      await db.transferSaga.delete({ where: { id: d.id } })
      removed++
    }
  }

  // Update tier1Count on keepers
  const all = await db.transferSaga.findMany({ select: { id: true } })
  for (const s of all) {
    const count = await db.transferSource.count({ where: { sagaId: s.id, tier: 1 } })
    await db.transferSaga.update({ where: { id: s.id }, data: { tier1Count: count } })
  }

  const total = await db.transferSaga.count()
  const totalSources = await db.transferSource.count()
  console.log(`\nRemoved ${removed} duplicate sagas. Final: ${total} sagas, ${totalSources} sources.`)
  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
