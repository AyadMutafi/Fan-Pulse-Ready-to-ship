/**
 * Latest Transfer Tweets — REAL posts from REAL Tier 1 journalists.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT (STRICT — no DB fallback)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every tweet returned by `fetchLatestTransferTweets()` is a REAL X post from
 * a REAL Tier 1 journalist, obtained exclusively via the xAI Responses API
 * `x_search` tool (see src/lib/grok-x-search.ts).
 *
 * SOURCE OF TRUTH — LIVE X SEARCH ONLY:
 *   We call `ai.searchXPosts()` which hits the xAI Responses API x_search tool.
 *   The underlying grok-x-search.ts validates every URL against
 *   /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i and rejects anything
 *   that doesn't match. We then apply ADDITIONAL layers of validation here:
 *
 *     L1. URL shape: must match the real X post URL regex (defense in depth).
 *     L2. Handle gate: author handle MUST be in TIER1_HANDLES.
 *     L3. URL/handle consistency: the <handle> segment of the URL MUST match
 *         the post's claimed author handle (case-insensitive). This catches
 *         model fabrications where the handle and URL disagree.
 *     L4. Synthetic-ID rejection: X status IDs are 64-bit snowflake IDs that
 *         are NOT sequentially assigned and do NOT share long common prefixes
 *         across different posts. We reject any batch where >50% of IDs share
 *         a 10+ char prefix — a hallmark of fabricated seed data.
 *     L5. Timestamp spread: real posts are spread over hours/days. If every
 *         post in a batch shares the same postedAt to the second, that's a
 *         fabrication signal — we reject the whole batch.
 *
 * NO DB FALLBACK — WHY:
 *   The `TransferSource` Prisma table is populated by a SEED SCRIPT
 *   (scripts/seed-realistic-transfers.ts) that inserts curated-but-INVENTED
 *   transfer headlines with synthetic URLs (e.g. status IDs starting
 *   "205900000012...") and batch timestamps (all within milliseconds of each
 *   other). These are NOT real X posts. Serving them as "latest transfer
 *   tweets" would be a hallucination. We therefore NEVER read from the DB
 *   for this feature.
 *
 *   (The Transfer Pulse /api/transfers feature still uses the DB for its
 *   saga tracker — that's a different feature with different framing. This
 *   module is specifically for the Home tab "Latest Transfer Tweets" section,
 *   which promises real-time real tweets.)
 *
 * HONEST EMPTY STATE:
 *   If the live search returns 0 Tier 1 tweets (XAI_API_KEY not configured,
 *   rate-limited, or simply no recent posts), we return `[]`. The caller
 *   renders an honest "No recent Tier 1 transfer tweets — check back soon"
 *   state. We NEVER fabricate.
 *
 * Every returned tweet has:
 *   - author: real journalist display name (from Tier1Source.name)
 *   - authorHandle: real X handle WITHOUT @ (validated against TIER1_HANDLES)
 *   - outlet: from Tier1Source.outlet
 *   - content: verbatim/near-verbatim post text from the x_search tool
 *   - url: real https://x.com/<handle>/status/<digits> URL (L1+L3 validated)
 *   - postedAt: ISO timestamp or null
 *   - sentimentScore: integer 0-100 (from scoreSentiment, or 50 neutral fallback)
 *   - sentimentLabel: 'positive' | 'neutral' | 'negative'
 *   - source: always 'live' (kept for API shape compatibility; no other source)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ai } from '@/lib/ai'
import {
  TIER1_HANDLES,
  getTier1Source,
  type Tier1Source,
} from '@/lib/transfer-pulse/tier1-sources'

export interface TransferTweet {
  /** Journalist display name, e.g. "Fabrizio Romano". */
  author: string
  /** Real X handle WITHOUT @, e.g. "FabrizioRomano". Validated against TIER1_HANDLES. */
  authorHandle: string
  /** Outlet, e.g. "The Athletic" (from Tier1Source.outlet). */
  outlet: string
  /** Verbatim or near-verbatim post text from the x_search tool. */
  content: string
  /** Real X post URL — matches /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i AND the <handle> segment matches authorHandle. */
  url: string
  /** ISO timestamp if known, else null. */
  postedAt: string | null
  /** Integer 0-100 (50 = neutral fallback when scoring fails). NEVER null. */
  sentimentScore: number
  /** Derived from sentimentScore: >=65 positive, 35-64 neutral, <35 negative. */
  sentimentLabel: 'positive' | 'neutral' | 'negative'
  /** Always 'live' — no DB fallback anymore. Kept for API shape compatibility. */
  source: 'live'
}

// ── In-memory cache (10 minute TTL) ──────────────────────────────────────────
// Transfer tweets don't change faster than every few minutes; caching avoids
// hammering the xAI API on every Home tab load.
interface CacheEntry {
  at: number
  tweets: TransferTweet[]
}
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
let cache: CacheEntry | null = null

// ── Validation layers ────────────────────────────────────────────────────────

/** L1: real X post URL shape. */
const REAL_X_URL_RE = /^https:\/\/(x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/i

function isRealXUrl(url: string): boolean {
  return REAL_X_URL_RE.test(url)
}

/**
 * Extract the <handle> segment from a real X post URL.
 * Returns '' if the URL doesn't match the expected shape.
 */
function extractHandleFromUrl(url: string): string {
  const m = REAL_X_URL_RE.exec(url)
  return m ? m[2] : ''
}

/**
 * Extract the numeric status ID from a real X post URL.
 * Returns '' if the URL doesn't match.
 */
function extractStatusIdFromUrl(url: string): string {
  const m = REAL_X_URL_RE.exec(url)
  return m ? m[3] : ''
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

/**
 * L3: the <handle> segment of the URL MUST match the post's claimed author
 * handle (case-insensitive). Real X posts always satisfy this; a mismatch is
 * a fabrication signal.
 */
function urlHandleMatchesAuthor(url: string, authorHandle: string): boolean {
  const urlHandle = normalizeHandle(extractHandleFromUrl(url))
  const claimed = normalizeHandle(authorHandle)
  return urlHandle !== '' && urlHandle === claimed
}

function deriveSentimentLabel(score: number): 'positive' | 'neutral' | 'negative' {
  if (score >= 65) return 'positive'
  if (score < 35) return 'negative'
  return 'neutral'
}

// ── Synthetic-batch detection (L4 + L5) ──────────────────────────────────────
//
// Real X status IDs are 64-bit snowflake IDs. They are NOT sequentially
// assigned and they do NOT share long common prefixes across unrelated posts.
// The seeded fake data in the DB used IDs like "2059000000129807827",
// "2059000000128224027", "2059000000125848327" — all sharing the 10-char
// prefix "2059000000". We reject a batch where >50% of IDs share a 10+ char
// prefix.
//
// Likewise, real posts are spread over hours/days. If every post in a batch
// shares the same postedAt to the second, that's a fabrication signal.

/**
 * L4: if more than half the posts share a 10-character status-ID prefix,
 * reject the whole batch as likely fabricated.
 */
function hasSyntheticIdPrefix(posts: { url: string }[]): boolean {
  if (posts.length < 3) return false // not enough signal
  const prefixes = posts.map((p) => extractStatusIdFromUrl(p.url).slice(0, 10))
  const counts = new Map<string, number>()
  for (const pre of prefixes) {
    if (pre.length < 10) continue
    counts.set(pre, (counts.get(pre) ?? 0) + 1)
  }
  for (const [, count] of counts) {
    if (count > posts.length / 2) return true // majority share a prefix → synthetic
  }
  return false
}

/**
 * L5: if more than half the posts share the exact same postedAt to the
 * second, reject the batch as likely fabricated (real posts don't all land
 * in the same second).
 */
function hasSyntheticTimestampClustering(posts: { postedAt: string | null }[]): boolean {
  if (posts.length < 3) return false
  const withTs = posts.filter((p) => p.postedAt)
  if (withTs.length < 3) return false
  const buckets = new Map<string, number>()
  for (const p of withTs) {
    // Bucket to the second (truncate sub-second precision)
    const sec = (p.postedAt as string).replace(/\.\d{3,9}Z$/, 'Z').replace(/\.\d{3,9}$/, '')
    buckets.set(sec, (buckets.get(sec) ?? 0) + 1)
  }
  for (const [, count] of buckets) {
    if (count > withTs.length / 2) return true // majority in same second → synthetic
  }
  return false
}

// ── Primary (and only): live X search ────────────────────────────────────────
/**
 * Query the xAI x_search tool for recent transfer posts from Tier 1
 * journalists. Returns ONLY posts that survive all 5 validation layers:
 *   L1 real URL shape
 *   L2 handle in TIER1_HANDLES
 *   L3 URL handle matches claimed author handle
 *   L4 no synthetic ID-prefix clustering
 *   L5 no synthetic timestamp clustering
 *
 * The query names the top Tier 1 journalists explicitly so the model biases
 * toward their accounts. We still filter the results defensively — a post
 * is only kept if its handle is in TIER1_HANDLES AND the URL handle agrees.
 */
async function fetchLiveTweets(maxTweets: number): Promise<TransferTweet[]> {
  // Build a query that targets Tier 1 journalists + transfer keywords.
  const tier1HandlesForQuery = ['FabrizioRomano', 'David_Ornstein', 'Plettigoal', 'MatteMoretto']
  const query =
    `Find recent real X (Twitter) posts about football transfers, signings, or deals ` +
    `from these Tier 1 journalists: ${tier1HandlesForQuery.map((h) => '@' + h).join(', ')}. ` +
    `Include the verbatim post text, the real post URL, and the posted_at timestamp. ` +
    `Return up to ${maxTweets} posts.`

  let live
  try {
    live = await ai.searchXPosts(query)
  } catch {
    // Network / provider error — return empty (honest state).
    return []
  }

  if (!live.ok || live.posts.length === 0) {
    return []
  }

  // ── L4 + L5: reject the WHOLE batch if it looks synthetic ──
  // We do this BEFORE per-post filtering so a fabricated batch can't survive
  // by happening to include one Tier 1 handle.
  if (hasSyntheticIdPrefix(live.posts)) {
    // If the model returned a batch of posts that all share a 10-char status
    // ID prefix, that's a fabrication signal. Bail out.
    return []
  }
  if (hasSyntheticTimestampClustering(live.posts)) {
    return []
  }

  // ── L1 + L2 + L3: per-post validation ──
  const filtered: TransferTweet[] = []
  const seenUrls = new Set<string>()
  for (const post of live.posts) {
    if (!isRealXUrl(post.url)) continue // L1
    const handle = post.handle.replace(/^@/, '').trim()
    if (!handle) continue
    if (!TIER1_HANDLES.has(handle.toLowerCase())) continue // L2
    if (!urlHandleMatchesAuthor(post.url, handle)) continue // L3
    if (seenUrls.has(post.url)) continue
    seenUrls.add(post.url)

    const src: Tier1Source | null = getTier1Source(handle)
    filtered.push({
      author: src?.name ?? handle,
      authorHandle: handle,
      outlet: src?.outlet ?? 'Independent',
      content: post.text,
      url: post.url,
      postedAt: post.postedAt,
      sentimentScore: 50, // neutral default; overwritten below if scoring succeeds
      sentimentLabel: 'neutral',
      source: 'live',
    })
    if (filtered.length >= maxTweets) break
  }

  if (filtered.length === 0) return []

  // ── Sentiment scoring ──
  // NOTE: SentimentAnalysis (src/lib/groq-sentiment.ts) uses the field name
  // `sentiment` for the 0-100 score — NOT `score`. Reading `a.score` returns
  // undefined, Math.round(undefined) = NaN, and JSON.stringify(NaN) = null,
  // which is why the old API returned `sentimentScore: null`. We read
  // `a.sentiment` and coerce to a finite integer, falling back to 50.
  try {
    const sentiment = await ai.scoreSentiment(filtered.map((t) => ({ content: t.content })))
    if (sentiment.ok) {
      filtered.forEach((t, i) => {
        const a = sentiment.analyses[i]
        if (a && typeof a.sentiment === 'number' && Number.isFinite(a.sentiment)) {
          const score = Math.max(0, Math.min(100, Math.round(a.sentiment)))
          t.sentimentScore = score
          t.sentimentLabel = deriveSentimentLabel(score)
        }
        // else: keep the neutral default (sentimentScore: 50, label: 'neutral')
      })
    }
  } catch {
    // keep neutral defaults — tweets are still real, just unscored
  }

  return filtered
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the latest REAL transfer tweets from Tier 1 journalists.
 *
 * Strategy: LIVE X SEARCH ONLY.
 *   1. Call `ai.searchXPosts()` → filter through 5 validation layers.
 *   2. If 0 tweets survive (no XAI_API_KEY, rate-limited, no recent posts,
 *      or synthetic-batch rejection), return `[]`.
 *
 * There is NO DB fallback. The TransferSource table contains seeded synthetic
 * data and is not a trustworthy source of "real tweets". Returning an honest
 * empty state is always preferable to serving fabricated content.
 *
 * Cached in-memory for 10 minutes.
 *
 * @param maxTweets  cap on returned tweets (default 8)
 */
export async function fetchLatestTransferTweets(
  maxTweets = 8,
): Promise<TransferTweet[]> {
  // Serve from cache if fresh
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.tweets.slice(0, maxTweets)
  }

  // Live X search — the ONLY source
  const tweets = await fetchLiveTweets(maxTweets)

  cache = { at: now, tweets }
  return tweets.slice(0, maxTweets)
}

/**
 * Force-clear the cache. Used by the API route on demand (not currently
 * exposed, but available for a future "refresh" admin endpoint).
 */
export function clearTransferTweetsCache(): void {
  cache = null
}
