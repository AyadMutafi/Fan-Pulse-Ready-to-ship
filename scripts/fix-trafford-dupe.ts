import { db } from '../src/lib/db'
async function main() {
  await db.$connect()
  // Keep the one with tier1Count=1 (LU), delete the one with tier1Count=0 (LUFC)
  const keeper = await db.transferSaga.findFirst({ where: { playerName: 'James Trafford', toClubCode: 'LU' } })
  const dupe = await db.transferSaga.findFirst({ where: { playerName: 'James Trafford', toClubCode: 'LUFC' } })
  if (!keeper || !dupe) { console.log('not found'); await db.$disconnect(); return }
  console.log(`Keeper: ${keeper.id} (tier1=${keeper.tier1Count})`)
  console.log(`Dupe:   ${dupe.id} (tier1=${dupe.tier1Count})`)
  // Move sources
  const moved = await db.transferSource.updateMany({ where: { sagaId: dupe.id }, data: { sagaId: keeper.id } })
  console.log(`Moved ${moved.count} sources`)
  await db.transferPost.updateMany({ where: { sagaId: dupe.id }, data: { sagaId: keeper.id } })
  await db.SentimentTimeline.updateMany({ where: { sagaId: dupe.id }, data: { sagaId: keeper.id } })
  await db.transferSaga.delete({ where: { id: dupe.id } })
  const count = await db.transferSource.count({ where: { sagaId: keeper.id, tier: 1 } })
  await db.transferSaga.update({ where: { id: keeper.id }, data: { tier1Count: count } })
  console.log(`Deleted dupe. Keeper tier1Count updated to ${count}`)
  const total = await db.transferSaga.count()
  console.log(`Final saga count: ${total}`)
  await db.$disconnect()
}
main()
