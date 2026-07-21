import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'
const PLAYERS = [
  'Kevin De Bruyne',
  'Leroy Sané',
  'Trent Alexander-Arnold',
  'Rafael Leão',
  'Ederson',
  'Victor Osimhen',
  'Takefusa Kubo',
  'Jarrad Branthwaite',
]
async function main() {
  console.log(`Discovering ${PLAYERS.length} players...`)
  let created = 0, updated = 0, sources = 0, skipped = 0
  for (let i = 0; i < PLAYERS.length; i++) {
    const name = PLAYERS[i]
    console.log(`\n[${i+1}/${PLAYERS.length}] ${name}`)
    try {
      const r = await discoverTransferSagas({ playerName: name })
      created += r.sagasCreated; updated += r.sagasUpdated
      sources += r.sourcesAdded; skipped += r.skipped
      console.log(`  → created=${r.sagasCreated} updated=${r.sagasUpdated} sources=${r.sourcesAdded} skipped=${r.skipped} (${r.durationMs}ms)`)
      if (r.errors.length) console.log(`  errors: ${r.errors.join('; ').slice(0,200)}`)
    } catch (e) { console.log(`  ✗ ${String(e).slice(0,150)}`) }
  }
  console.log(`\n=== TOTAL: created=${created} updated=${updated} sources=${sources} skipped=${skipped} ===`)
}
main().catch(e => { console.error(e); process.exit(1) })
