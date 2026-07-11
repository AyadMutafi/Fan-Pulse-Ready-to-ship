import { getDb } from '../src/lib/db'
const db = getDb()

console.log('=== WCStage ===')
const stages = await db.wCStage.findMany({ orderBy: { order: 'asc' } })
for (const s of stages) {
  console.log(`  ${s.order}. ${s.name} — status=${s.status}, started=${s.startedAt?.toISOString()||'-'}, completed=${s.completedAt?.toISOString()||'-'}`)
}

console.log('\n=== Matches (count by group) ===')
const matches = await db.match.findMany({ orderBy: { matchDate: 'asc' } })
console.log(`Total matches: ${matches.length}`)
const byGroup: Record<string, number> = {}
for (const m of matches) {
  byGroup[m.group] = (byGroup[m.group] || 0) + 1
}
for (const [g, c] of Object.entries(byGroup).sort()) {
  console.log(`  ${g}: ${c}`)
}

console.log('\n=== Recent matches (last 15 by matchDate) ===')
const recent = matches.slice(-15)
for (const m of recent) {
  console.log(`  ${m.matchDate?.toISOString().slice(0,16) || '-'} | ${m.homeTeamCode} ${m.homeScore}-${m.awayScore} ${m.awayTeamCode} [${m.group}] ${m.status}`)
}

console.log('\n=== WCSelection counts ===')
const selCount = await db.wCSelection.count()
console.log(`Total selections: ${selCount}`)
const sels = await db.wCSelection.findMany({ include: { stage: true } })
for (const s of sels) {
  const pc = await db.wCSelectionPlayer.count({ where: { selectionId: s.id } })
  console.log(`  ${s.type} — ${s.stage.name} (${s.stage.status}) — ${pc} players, locked=${s.locked}`)
}

console.log('\n=== FanVotes ===')
const votes = await db.fanVote.count()
console.log(`Total votes: ${votes}`)

console.log('\n=== FeedMonitors (last 5) ===')
const monitors = await db.feedMonitor.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
console.log(`Total monitors: ${await db.feedMonitor.count()}`)
for (const m of monitors) {
  const pc = await db.feedPost.count({ where: { monitorId: m.id } })
  console.log(`  ${m.matchLabel} [${m.status}] — ${pc} posts, created=${m.createdAt.toISOString().slice(0,16)}`)
}

console.log('\n=== Current time ===')
console.log(`UTC: ${new Date().toISOString()}`)
console.log(`Asia/Aden: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Aden' })}`)
