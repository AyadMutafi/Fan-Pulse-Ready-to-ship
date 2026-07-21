import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'
const PLAYERS = ['Kevin De Bruyne', 'Leroy Sané', 'Trent Alexander-Arnold']
async function main() {
  for (const name of PLAYERS) {
    console.log(`\n=== ${name} ===`)
    try {
      const r = await discoverTransferSagas({ playerName: name })
      console.log(`RESULT: created=${r.sagasCreated} updated=${r.sagasUpdated} sources=${r.sourcesAdded} skipped=${r.skipped} (${r.durationMs}ms)`)
    } catch (e) { console.log(`FAIL: ${String(e).slice(0,150)}`) }
  }
  console.log('\nDONE')
}
main().catch(e => { console.error(e); process.exit(1) })
