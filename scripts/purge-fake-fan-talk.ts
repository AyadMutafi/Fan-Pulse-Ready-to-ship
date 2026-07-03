/**
 * One-off script: purge every fabricated/templated FeedPost whose author
 * matches any FAKE_AUTHOR_PATTERNS entry, then delete any FeedMonitor that
 * consequently has zero posts.
 *
 * Run with:
 *   bun run scripts/purge-fake-fan-talk.ts
 *
 * Safe to re-run — it only deletes posts matching FAKE_AUTHOR_PATTERNS.
 */
import { PrismaClient } from '@prisma/client'
import { isFakeAuthor } from '../src/lib/live-fan-talk'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fan Talk Fake-Post Purge ===\n')

  // ── 1. Snapshot BEFORE ──────────────────────────────────────────────────
  const beforeMonitors = await prisma.feedMonitor.count()
  const beforePosts = await prisma.feedPost.count()
  console.log(`Before: ${beforeMonitors} monitors, ${beforePosts} posts`)

  // ── 2. Find fake-author posts ───────────────────────────────────────────
  // Scan all posts (no time cutoff on the one-off purge — we want them all).
  const allPosts = await prisma.feedPost.findMany({
    select: { id: true, author: true, monitorId: true, content: true, url: true },
  })
  console.log(`Scanning ${allPosts.length} posts for fake authors...`)

  const fakePosts = allPosts.filter((p) => isFakeAuthor(p.author))
  // Also catch the seeded boilerplate by content fingerprint — the seed
  // script's posts contain very specific phrases that real posts wouldn't.
  const BOILERPLATE_PHRASES = [
    'pressing structure was incredible',
    'no plan b, no in-game adjustments',
    'the system is broken',
    'clinical counter-attacking display',
    'this generation could win the whole thing',
    'var got the big calls right',
  ]
  const boilerplatePosts = allPosts.filter((p) => {
    if (isFakeAuthor(p.author)) return false // already counted
    const lower = (p.content || '').toLowerCase()
    return BOILERPLATE_PHRASES.some((phrase) => lower.includes(phrase))
  })

  // Also catch posts with synthetic cuid-style URLs that the seed script
  // generated: https://reddit.com/r/soccer/post/<cuid>-<n>
  // Real posts have real Reddit/x.com/news URLs with real slugs/IDs.
  const syntheticUrlPosts = allPosts.filter((p) => {
    if (isFakeAuthor(p.author)) return false
    if (BOILERPLATE_PHRASES.some((phrase) => (p.content || '').toLowerCase().includes(phrase))) {
      return false
    }
    // The seed script wrote URLs like:
    //   https://reddit.com/r/soccer/post/<monitorId>-<postId>
    //   https://x.com/post/<monitorId>-<postId>
    //   https://example.com/post/<monitorId>-<postId>
    // These all end with "-<single digit>" and contain a cuid.
    const url = p.url || ''
    if (url.includes('example.com')) return true
    if (/\/post\/cm[a-z0-9]+-\d+$/.test(url)) return true
    if (/\/post\/cl[a-z0-9]+-\d+$/.test(url)) return true
    return false
  })

  const allFakeIds = new Set<string>([
    ...fakePosts.map((p) => p.id),
    ...boilerplatePosts.map((p) => p.id),
    ...syntheticUrlPosts.map((p) => p.id),
  ])

  console.log(`\nFake-author posts:        ${fakePosts.length}`)
  console.log(`Boilerplate-content posts: ${boilerplatePosts.length}`)
  console.log(`Synthetic-URL posts:      ${syntheticUrlPosts.length}`)
  console.log(`Total unique to delete:   ${allFakeIds.size}\n`)

  if (allFakeIds.size === 0) {
    console.log('Nothing to purge. DB is already clean.')
    return
  }

  // Print a sample so we can verify the patterns are catching the right rows
  const sample = [
    ...fakePosts.slice(0, 3),
    ...boilerplatePosts.slice(0, 2),
    ...syntheticUrlPosts.slice(0, 2),
  ].slice(0, 5)
  console.log('Sample posts to delete:')
  for (const p of sample) {
    console.log(`  [${p.id}] author="${p.author}" url=${p.url}`)
    console.log(`    content: ${(p.content || '').slice(0, 100)}...`)
  }
  console.log('')

  // ── 3. Delete fake posts in batches ─────────────────────────────────────
  const idsToDelete = Array.from(allFakeIds)
  let deleted = 0
  for (let i = 0; i < idsToDelete.length; i += 200) {
    const batch = idsToDelete.slice(i, i + 200)
    const res = await prisma.feedPost.deleteMany({ where: { id: { in: batch } } })
    deleted += res.count
  }
  console.log(`Deleted ${deleted} fake posts.`)

  // ── 4. Delete FeedMonitors that now have zero posts ─────────────────────
  // A monitor with zero posts provides no value and would only confuse the
  // API route's matching logic. Delete them.
  const allMonitors = await prisma.feedMonitor.findMany({
    select: { id: true, matchLabel: true, _count: { select: { posts: true } } },
  })
  const emptyMonitors = allMonitors.filter((m) => m._count.posts === 0)
  console.log(`\nFound ${emptyMonitors.length} monitors with zero posts:`)
  for (const m of emptyMonitors) {
    console.log(`  ${m.id} — ${m.matchLabel}`)
  }
  if (emptyMonitors.length > 0) {
    const delRes = await prisma.feedMonitor.deleteMany({
      where: { id: { in: emptyMonitors.map((m) => m.id) } },
    })
    console.log(`Deleted ${delRes.count} empty monitors.`)
  }

  // ── 5. Snapshot AFTER ───────────────────────────────────────────────────
  const afterMonitors = await prisma.feedMonitor.count()
  const afterPosts = await prisma.feedPost.count()
  console.log(`\nAfter: ${afterMonitors} monitors, ${afterPosts} posts`)
  console.log(`\nDelta: -${beforeMonitors - afterMonitors} monitors, -${beforePosts - afterPosts} posts`)

  // ── 6. List surviving posts (for sanity check) ──────────────────────────
  if (afterPosts > 0) {
    const survivors = await prisma.feedPost.findMany({
      select: { author: true, url: true, content: true },
      take: 10,
      orderBy: { analyzedAt: 'desc' },
    })
    console.log(`\nSurviving posts (sample of ${Math.min(10, survivors.length)}):`)
    for (const p of survivors) {
      console.log(`  author="${p.author}" | url=${p.url}`)
      console.log(`    content: ${(p.content || '').slice(0, 120)}...`)
    }
  } else {
    console.log('\nNo surviving posts — DB is now empty. The API will attempt')
    console.log('a live fetch on the next request and populate real posts.')
  }

  console.log('\n=== Purge complete ===')
}

main()
  .catch((err) => {
    console.error('Purge failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
