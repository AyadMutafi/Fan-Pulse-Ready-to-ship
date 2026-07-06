import { db } from '../src/lib/db'
async function main() {
  const r32 = await db.match.findMany({ where: { group: 'R32' }, orderBy: { matchDate: 'asc' } })
  console.log('=== R32 Matches ===')
  for (const m of r32) {
    console.log(`${m.homeTeamCode} ${m.homeScore}-${m.awayScore} ${m.awayTeamCode} | ${m.status} | ${m.matchDate?.toISOString().slice(0,10)}`)
  }
  const stages = await db.wCStage.findMany({ orderBy: { order: 'asc' } })
  console.log('\n=== Stages ===')
  for (const s of stages) {
    console.log(`${s.order}. ${s.name} | ${s.status} | started=${s.startedAt?.toISOString().slice(0,10) ?? 'null'} | completed=${s.completedAt?.toISOString().slice(0,10) ?? 'null'}`)
  }
  const r32stage = stages.find(s => s.name === 'Round of 32')
  if (r32stage) {
    const sels = await db.wCSelection.findMany({ where: { stageId: r32stage.id }, include: { players: true } })
    console.log(`\n=== R32 Selections (${sels.length}) ===`)
    for (const sel of sels) {
      console.log(`${sel.type}: ${sel.players.length} players, locked=${sel.locked}`)
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
