// Purge all existing FeedPosts + FeedMonitors so the next /api/fan-talk call
// triggers a fresh fetch through the new Grok X-Search + Groq sentiment path.
import { db } from '../src/lib/db'

async function main() {
  const posts = await db.feedPost.count()
  const monitors = await db.feedMonitor.count()
  console.log(`Before purge: ${posts} posts, ${monitors} monitors`)
  await db.feedPost.deleteMany({})
  await db.feedMonitor.deleteMany({})
  console.log('Purged all feed posts and monitors.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
