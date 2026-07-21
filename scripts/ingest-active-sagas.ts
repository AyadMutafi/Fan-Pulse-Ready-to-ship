import { db } from '@/lib/db'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'
async function main() {
  const active = await db.transferSaga.findMany({ where: { status: 'active' } })
  console.log(`Ingesting fan posts for ${active.length} active sagas...`)
  for (const s of active) {
    console.log(`\n  ${s.playerName} → ${s.toClubName} (id=${s.id})`)
    try {
      const r = await ingestSagaPosts(s.id, 15)
      console.log(`    → postsAdded=${r.postsAdded} provider=${r.provider} buzz=${r.buzzVolume} excited=${r.excitedPct}% skept=${r.skepticalPct}% dread=${r.dreadingPct}%`)
      if (r.error) console.log(`    error: ${r.error}`)
    } catch (e) { console.log(`    FAIL: ${String(e).slice(0,150)}`) }
  }
  console.log('\nDONE')
  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
