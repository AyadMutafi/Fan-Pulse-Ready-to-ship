import { db } from '@/lib/db'
async function main() {
  // Find the duplicate Ederson→Atalanta sagas
  const dupes = await db.transferSaga.findMany({
    where: { playerName: 'Ederson', toClubName: 'Atalanta' },
    orderBy: { lastUpdatedAt: 'asc' },
    include: { _count: { select: { sources: true } } },
  })
  console.log(`Found ${dupes.length} Ederson→Atalanta sagas:`)
  for (const d of dupes) {
    console.log(`  id=${d.id} status=${d.status} tier1=${d.tier1Count} sources=${d._count.sources} updated=${d.lastUpdatedAt.toISOString().slice(0,16)}`)
  }
  // Keep the one with more sources; mark the other as debunked (duplicate)
  if (dupes.length > 1) {
    const [keep, ...rest] = dupes.sort((a, b) => b._count.sources - a._count.sources)
    console.log(`\nKeeping: ${keep.id} (${keep._count.sources} sources)`)
    for (const d of rest) {
      // Move sources to the kept saga, then delete the duplicate
      await db.transferSource.updateMany({ where: { sagaId: d.id }, data: { sagaId: keep.id } })
      await db.transferSaga.delete({ where: { id: d.id } })
      console.log(`  Deleted duplicate: ${d.id}`)
    }
  }
  // Also check for any other same-player same-club duplicates
  const allSagas = await db.transferSaga.findMany()
  const seen = new Map<string, string[]>()
  for (const s of allSagas) {
    const key = `${s.playerName}|${s.toClubCode}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(s.id)
  }
  for (const [key, ids] of seen) {
    if (ids.length > 1) console.log(`  DUP KEY: ${key} → ${ids.join(', ')}`)
  }
  console.log('\nFinal saga count:', await db.transferSaga.count())
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
