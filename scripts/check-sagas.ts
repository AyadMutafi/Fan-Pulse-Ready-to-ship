import { db } from '../src/lib/db'

async function main() {
  const sagas = await db.transferSaga.findMany({
    orderBy: { lastUpdatedAt: 'desc' },
    select: { id: true, playerName: true, fromClubName: true, toClubName: true, status: true, lastUpdatedAt: true, buzzVolume: true, tier1Count: true, fanReadLikelihood: true, resolvedAt: true, resolutionUrl: true }
  })
  console.log(`TOTAL SAGAS: ${sagas.length}`)
  for (const s of sagas) {
    console.log(`  [${s.status.padEnd(10)}] ${s.playerName.padEnd(28)} ${s.fromClubName.padEnd(15)}-> ${s.toClubName.padEnd(15)} buzz=${String(s.buzzVolume).padEnd(5)} tier1=${String(s.tier1Count).padEnd(3)} read=${String(s.fanReadLikelihood).padEnd(5)} lastUpdate=${s.lastUpdatedAt.toISOString()} resolved=${s.resolvedAt?.toISOString()||'-'}`)
  }
  // sources
  const sources = await db.transferSource.groupBy({
    by: ['sagaId'],
    _count: { id: true },
  })
  console.log(`\nTIER1 SOURCES PER SAGA:`)
  for (const p of sources) {
    console.log(`  ${p.sagaId}: ${p._count.id} sources`)
  }
  // posts
  const posts = await db.transferPost.groupBy({
    by: ['sagaId'],
    _count: { id: true },
  })
  console.log(`\nFAN POSTS PER SAGA:`)
  for (const p of posts) {
    console.log(`  ${p.sagaId}: ${p._count.id} posts`)
  }
  console.log(`\nNOW: ${new Date().toISOString()}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
