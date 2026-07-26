import { db } from '../src/lib/db'
async function main() {
  await db.$connect()
  const ts = await db.transferSaga.findMany({ where: { playerName: { contains: 'Trafford' } }, select: { id: true, playerName: true, fromClubName: true, fromClubCode: true, toClubName: true, toClubCode: true, status: true, tier1Count: true } })
  for (const t of ts) console.log(JSON.stringify(t))
  await db.$disconnect()
}
main()
