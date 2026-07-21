import { db } from '@/lib/db'
async function main() {
  const total = await db.transferSaga.count()
  const active = await db.transferSaga.count({ where: { status: 'active' } })
  const completed = await db.transferSaga.count({ where: { status: 'completed' } })
  const debunked = await db.transferSaga.count({ where: { status: 'debunked' } })
  console.log('TransferSaga counts:', { total, active, completed, debunked })
  const recent = await db.transferSaga.findMany({
    orderBy: { lastUpdatedAt: 'desc' },
    take: 5,
    select: { playerName: true, fromClubName: true, toClubName: true, status: true, lastUpdatedAt: true, firstReportedAt: true, buzzVolume: true, tier1Count: true }
  })
  console.log('Recent sagas:')
  for (const r of recent) console.log('  -', r)
  const sourceCount = await db.transferSource.count()
  console.log('TransferSource count:', sourceCount)
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
