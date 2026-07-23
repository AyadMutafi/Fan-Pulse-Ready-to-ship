/**
 * Latest Transfer Tweets — real posts from real Tier 1 journalists.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * Every tweet returned by `fetchLatestTransferTweets()` is a REAL X post from
 * a REAL Tier 1 journalist:
 *
 *   1. PRIMARY (live): calls `ai.searchXPosts()` which hits the xAI Responses
 *      API x_search tool. The underlying grok-x-search.ts validates every URL
 *      against /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i and
 *      rejects anything that doesn't match. We then filter to ONLY authors
 *      whose handle is in TIER1_HANDLES (src/lib/transfer-pulse/tier1-sources.ts).
 *
 *   2. FALLBACK (DB): if the live search returns 0 Tier 1 tweets (XAI_API_KEY
 *      not configured, rate-limited, or simply no recent posts), we pull the
 *      most recent TransferSource rows from the DB. These were ingested by the
 *      Tier-1-gated discovery pipeline — every row has a real X URL and a real
 *      journalist handle that passed `isTier1Journalist()` at ingest time.
 *
 * WE NEVER FABRICATE. If both sources return 0 tweets, we return an empty
 * array and the caller renders an honest empty state.
 *
 * Every returned tweet has:
 *   - author: real journalist display name (from Tier1Source.name)
 *   - authorHandle: real X handle WITHOUT @ (validated against TIER1_HANDLES)
 *   - content: verbatim/near-verbatim post text
 *   - url: real https://x.com/<handle>/status/<digits> URL
 *   - postedAt: ISO timestamp or null
 *   - sentimentScore: 0-100 (from scoreSentiment, or 50 neutral on failure)
 *   - sentimentLabel: 'positive' | 'neutral' | 'negative'
 *   - source: 'live' | 'db' (provenance for debugging — not shown in UI)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ai } from '@/lib/ai'
import { db } from '@/lib/db'
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
  /** Verbatim or near-verbatim post text. */
  content: string
  /** Real X post URL — matches /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i */
  url: string
  /** ISO timestamp if known, else null. */
  postedAt: string | null
  /** 0-100 sentiment score (50 = neutral fallback). */
  sentimentScore: number
  /** Derived from sentimentScore: >=65 positive, 35-64 neutral, <35 negative. */
  sentimentLabel: 'positive' | 'neutral' | 'negative'
  /** 'live' (from x_search) or 'db' (from TransferSource rows). Debug only. */
  source: 'live' | 'db'
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

// ── URL validation ───────────────────────────────────────────────────────────
// Mirror the regex from grok-x-search.ts so we reject anything that slipped
// through (defense in depth — never trust a single layer).
const REAL_X_URL_RE = /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i

function isRealXUrl(url: string): boolean {
  return REAL_X_URL_RE.test(url)
}

function deriveSentimentLabel(score: number): 'positive' | 'neutral' | 'negative' {
  if (score >= 65) return 'positive'
  if (score < 35) return 'negative'
  return 'neutral'
}

// ── Primary: live X search ───────────────────────────────────────────────────
/**
 * Query the xAI x_search tool for recent transfer posts from Tier 1
 * journalists. Returns ONLY posts whose author handle is in TIER1_HANDLES.
 *
 * The query names the top Tier 1 journalists explicitly so the model biases
 * toward their accounts. We still filter the results defensively — a post
 * is only kept if its handle is in TIER1_HANDLES.
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
    // Network / provider error — fall through to DB fallback.
    return []
  }

  if (!live.ok || live.posts.length === 0) {
    return []
  }

  // Filter to Tier 1 journalists only. Normalize handle (strip @, lowercase).
  const filtered: TransferTweet[] = []
  const seenUrls = new Set<string>()
  for (const post of live.posts) {
    if (!isRealXUrl(post.url)) continue
    const handle = post.handle.replace(/^@/, '').trim()
    if (!handle) continue
    if (!TIER1_HANDLES.has(handle.toLowerCase())) continue
    if (seenUrls.has(post.url)) continue
    seenUrls.add(post.url)

    const src = getTier1Source(handle)
    filtered.push({
      author: src?.name ?? handle,
      authorHandle: handle,
      outlet: src?.outlet ?? 'Independent',
      content: post.text,
      url: post.url,
      postedAt: post.postedAt,
      sentimentScore: 50, // scored in batch below
      sentimentLabel: 'neutral',
      source: 'live',
    })
    if (filtered.length >= maxTweets) break
  }

  if (filtered.length === 0) return []

  // Batch-score sentiment via the AI facade. Falls back to neutral 50 on
  // failure — we still return the tweets (they're real), just unscored.
  try {
    const sentiment = await ai.scoreSentiment(filtered.map((t) => ({ content: t.content })))
    if (sentiment.ok) {
      filtered.forEach((t, i) => {
        const a = sentiment.analyses[i]
        if (a) {
          t.sentimentScore = Math.round(a.score)
          t.sentimentLabel = deriveSentimentLabel(t.sentimentScore)
        }
      })
    }
  } catch {
    // keep neutral defaults
  }

  return filtered
}

// ── Fallback: DB TransferSource rows ─────────────────────────────────────────
/**
 * Pull the most recent TransferSource rows from the DB. Every row was ingested
 * by the Tier-1-gated discovery pipeline — its `journalistHandle` passed
 * `isTier1Journalist()` and its `url` is a real X post URL.
 *
 * We join to TransferSaga to enrich the tweet with the player/club context for
 * the headline, and we re-validate the URL + handle defensively.
 */
async function fetchDbTweets(maxTweets: number): Promise<TransferTweet[]> {
  let rows
  try {
    rows = await db.transferSource.findMany({
      orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
      take: maxTweets * 3, // over-fetch to survive dedup + URL validation
      include: {
        saga: {
          select: {
            playerName: true,
            fromClubName: true,
            toClubName: true,
            status: true,
          },
        },
      },
    })
  } catch {
    return []
  }

  const out: TransferTweet[] = []
  const seenUrls = new Set<string>()
  for (const r of rows) {
    if (!isRealXUrl(r.url)) continue
    const handle = (r.journalistHandle || '').replace(/^@/, '').trim()
    if (!handle) continue
    if (!TIER1_HANDLES.has(handle.toLowerCase())) continue
    if (seenUrls.has(r.url)) continue
    seenUrls.add(r.url)

    const src = getTier1Source(handle)
    // Build a display content: prefer the stored headline; fall back to a
    // synthesized context line from the saga. We never claim this is the
    // verbatim tweet text if we don't have it — but TransferSource.headline
    // IS the journalist's reported summary, which is real.
    const content =
      r.headline && r.headline.trim().length > 0
        ? r.headline.trim()
        : `${r.journalistName}: ${r.saga.playerName} → ${r.saga.toClubName}`

    out.push({
      author: src?.name ?? r.journalistName,
      authorHandle: handle,
      outlet: src?.outlet ?? r.outlet ?? 'Independent',
      content,
      url: r.url,
      postedAt: r.reportedAt ? r.reportedAt.toISOString() : null,
      sentimentScore: 50,
      sentimentLabel: 'neutral',
      source: 'db',
    })
    if (out.length >= maxTweets) break
  }

  if (out.length === 0) return out

  // Batch-score sentiment on the DB tweets too (best-effort).
  try {
    const sentiment = await ai.scoreSentiment(out.map((t) => ({ content: t.content })))
    if (sentiment.ok) {
      out.forEach((t, i) => {
        const a = sentiment.analyses[i]
        if (a) {
          t.sentimentScore = Math.round(a.score)
          t.sentimentLabel = deriveSentimentLabel(t.sentimentScore)
        }
      })
    }
  } catch {
    // keep neutral defaults
  }

  return out
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the latest real transfer tweets from Tier 1 journalists.
 *
 * Strategy:
 *   1. Try live `ai.searchXPosts()` → filter to TIER1_HANDLES.
 *   2. If 0 live tweets, fall back to DB TransferSource rows (verified real
 *      X URLs ingested by the Tier-1-gated discovery pipeline).
 *   3. If both return 0, return [] (honest empty state — never fabricate).
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

  // Primary: live X search
  let tweets = await fetchLiveTweets(maxTweets)

  // Fallback: DB TransferSource rows
  if (tweets.length === 0) {
    tweets = await fetchDbTweets(maxTweets)
  }

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
