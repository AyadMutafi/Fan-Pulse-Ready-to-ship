import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$connect()
  const sagas = await prisma.transferSaga.findMany({
    select: { id: true, playerName: true, fromClubName: true, toClubName: true, status: true, lastUpdatedAt: true, tier1Count: true },
    orderBy: { lastUpdatedAt: 'desc' },
  })
  console.log('Total sagas:', sagas.length)
  const byStatus = sagas.reduce((acc, s) => { acc[s.status] = (acc[s.status]||0)+1; return acc }, {} as Record<string, number>)
  console.log('By status:', byStatus)
  console.log('\nAll sagas:')
  for (const s of sagas) {
    console.log(`  [${s.status.padEnd(10)}] ${s.playerName} ${s.fromClubName} -> ${s.toClubName} | tier1=${s.tier1Count} | ${s.lastUpdatedAt.toISOString().slice(0,16)}`)
  }
  const sources = await prisma.transferSource.findMany({
    select: { journalistHandle: true, url: true, reportedAt: true },
    orderBy: { reportedAt: 'desc' },
  })
  console.log('\nTotal sources:', sources.length)
  const byJourno = sources.reduce((acc, s) => { acc[s.journalistHandle] = (acc[s.journalistHandle]||0)+1; return acc }, {} as Record<string, number>)
  console.log('Sources by journalist:', byJourno)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
