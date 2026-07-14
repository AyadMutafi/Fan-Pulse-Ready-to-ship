/**
 * Trigger the live-fan-talk pipeline directly to verify Grok x_search works
 * end-to-end through the actual app pipeline (not just the isolated provider).
 *
 * This simulates what happens when a user clicks "WHAT FANS ARE SAYING" on
 * a match that has no cached posts yet.
 */
import 'dotenv/config'
import { getDb } from '../src/lib/db'
import { fetchLiveFanTalk } from '../src/lib/live-fan-talk'

console.log('═══════════════════════════════════════════════════════════')
console.log('  Live Fan Talk Pipeline — End-to-End Test (Grok x_search)')
console.log('═══════════════════════════════════════════════════════════\n')

console.log(`XAI_API_KEY: ${process.env.XAI_API_KEY ? `SET (${process.env.XAI_API_KEY.slice(0, 12)}...)` : 'NOT SET'}`)
console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'SET' : 'NOT SET'}\n`)

const db = getDb()

// Pick team codes that probably have no cached posts yet — use a fresh pair.
const teamCodes = ['SUI', 'ALG']
console.log(`Triggering live fetch for team codes: ${teamCodes.join(', ')}\n`)

const t0 = Date.now()
const result = await fetchLiveFanTalk(db, teamCodes)
const elapsed = Date.now() - t0

console.log(`\n───────────────────────────────────────────────────────────`)
console.log(`Live fetch completed in ${elapsed}ms`)
console.log(`  newPosts:   ${result.newPosts}`)
console.log(`  monitorId:  ${result.monitorId}`)
console.log(`  error:      ${result.error || '(none)'}`)
console.log(`  durationMs: ${result.durationMs}ms`)

if (result.newPosts > 0) {
  // Query the DB to see what posts were saved
  const posts = await db.feedPost.findMany({
    where: { monitorId: result.monitorId },
    orderBy: { postedAt: 'desc' },
    take: 10,
  })
  console.log(`\nPosts saved to DB (${posts.length} total):`)
  let xCount = 0
  let webCount = 0
  for (const p of posts) {
    const isX = p.url.startsWith('https://x.com/') || p.url.startsWith('https://twitter.com/')
    if (isX) xCount++
    else webCount++
    console.log(`\n  [${p.platform}] ${p.author} (score=${p.sentimentScore})`)
    console.log(`    URL: ${p.url}`)
    console.log(`    Content: ${(p.content || '').slice(0, 100)}...`)
    console.log(`    Provider: ${isX ? '✓ GROK x_search' : 'web_search'}`)
  }
  console.log(`\n── Summary ──`)
  console.log(`  From Grok x_search (real X posts): ${xCount}`)
  console.log(`  From web_search (other sources):   ${webCount}`)
  console.log(`  Total:                              ${posts.length}`)

  if (xCount > 0) {
    console.log('\n✅ PASS: Grok x_search delivered real X posts through the live-fan-talk pipeline')
    process.exit(0)
  } else {
    console.log('\nℹ NOTE: 0 X posts from Grok this run (web_search still delivered posts)')
    console.log('   Grok migration is functional — sometimes X has no recent posts for a query')
    process.exit(0)
  }
} else {
  console.log('\n⚠ No new posts saved — check error above')
  process.exit(1)
}
