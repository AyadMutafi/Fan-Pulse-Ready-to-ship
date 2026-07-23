import { db } from '../src/lib/db'
async function main() {
  const sagas = await db.transferSaga.findMany({
    orderBy: [{ status: 'asc' }, { lastUpdatedAt: 'desc' }],
    include: { sources: true, posts: true }
  })
  console.log(`Total sagas: ${sagas.length}`)
  for (const s of sagas) {
    console.log(`  [${s.status.padEnd(9)}] ${s.playerName.padEnd(24)} ${s.fromClubName} → ${s.toClubName}  buzz=${s.buzzVolume} tier1=${s.tier1Count} posts=${s.posts.length} src=${s.sources.length}  ${s.lastUpdatedAt.toISOString().slice(0,16)}`)
  }
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
