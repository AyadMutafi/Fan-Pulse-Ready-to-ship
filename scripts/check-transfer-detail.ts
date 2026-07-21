import { db } from '@/lib/db'
async function main() {
  const all = await db.transferSaga.findMany({
    include: { sources: true },
    orderBy: { lastUpdatedAt: 'desc' },
  })
  for (const s of all) {
    console.log('---')
    console.log(`${s.playerName} | ${s.fromClubName} → ${s.toClubName} | ${s.status} | buzz=${s.buzzVolume} tier1=${s.tier1Count}`)
    console.log(`  firstReported: ${s.firstReportedAt}  lastUpdated: ${s.lastUpdatedAt}`)
    for (const src of s.sources) {
      console.log(`  src: ${src.journalistHandle || src.journalistName || '?'} @ ${src.outlet} — ${src.headline?.slice(0,80)}`)
      console.log(`       url: ${src.url}`)
      console.log(`       reportedAt: ${src.reportedAt}`)
    }
  }
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
