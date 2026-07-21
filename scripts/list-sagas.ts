import { db } from '@/lib/db'
async function main() {
  const sagas = await db.transferSaga.findMany({
    orderBy: [{ status: 'asc' }, { lastUpdatedAt: 'desc' }],
    select: { playerName: true, fromClubName: true, toClubName: true, status: true, buzzVolume: true, tier1Count: true, lastUpdatedAt: true }
  })
  for (const s of sagas) {
    console.log(`  [${s.status.padEnd(9)}] ${s.playerName.padEnd(24)} ${s.fromClubName} → ${s.toClubName}  buzz=${s.buzzVolume} tier1=${s.tier1Count}  ${s.lastUpdatedAt.toISOString().slice(0,16)}`)
  }
  await db.$disconnect()
}
main()
