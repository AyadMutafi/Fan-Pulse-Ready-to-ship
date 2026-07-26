/**
 * Transfer Pulse — Z.ai SDK fallback for when XAI_API_KEY is not configured.
 *
 * The primary discovery path uses the xAI Responses API `x_search` tool
 * (src/lib/grok-x-search.ts) to fetch real X posts directly from X's own
 * data. But that requires `XAI_API_KEY` in .env, which may be missing in
 * dev/sandbox environments.
 *
 * This module provides a FALLBACK that uses the Z.ai SDK's `web_search`
 * function (which auto-initializes in the Z.ai sandbox without an explicit
 * API key) to find the SAME real X posts — but via web search indexing
 * instead of X's own API.
 *
 * ANTI-HALLUCINATION CONTRACT (preserved):
 *   - We only accept URLs matching ^https://(x.com|twitter.com)/<handle>/status/<digits>$
 *   - For Tier 1 posts: the handle in the URL MUST be in TIER1_HANDLES.
 *     A fan quoting Romano is rejected (the fan's handle != Romano's).
 *   - Post text comes from the search-result snippet (Google/Bing indexes
 *     real tweet text) or from page_reader extraction. We never fabricate.
 *   - If web_search returns nothing, we return [] (empty) — the caller
 *     renders an honest empty state.
 *
 * FRESHNESS CONTRACT (added after the "stale Salah tweet" incident):
 *   - Every accepted post MUST have a verifiable creation date.
 *   - For X posts: the date is decoded from the Snowflake status ID (the
 *     64-bit ID encodes the millisecond timestamp). This is 100% reliable
 *     and does NOT depend on web_search metadata being present.
 *   - For Reddit/web posts: the date comes from web_search's datePublished
 *     field. If absent, the post is REJECTED (can't verify freshness).
 *   - Posts older than `maxAgeDays` (default 60) are REJECTED. This prevents
 *     last year's contract-extension tweet from appearing as "current news."
 *   - Posts with NO parseable date are REJECTED. No date = no trust.
 */
import ZAI from 'z-ai-web-dev-sdk'
import type { XPost } from '@/lib/grok-x-search'
import { TIER1_HANDLES } from './tier1-sources'
import type { TrackedPlayer } from './tracked-players'

const SDK_CALL_DELAY_MS = 2500
const MAX_QUERIES_PER_PLAYER = 3
const MAX_RESULTS_PER_QUERY = 10
const MAX_POSTS_PER_PLAYER = 8
const RATE_LIMIT_BACKOFF_MS = 8000

/** Twitter/X Snowflake epoch: Nov 4, 2010 01:42:54.657 UTC */
const TWITTER_EPOCH_MS = 1288834974657

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface ZaiSearchResult {
  url?: string
  name?: string
  title?: string
  snippet?: string
  description?: string
  summary?: string
  datePublished?: string
  date?: string
  author?: string
  source?: string
  host_name?: string
}

export interface ZaiFallbackOpts {
  /** Reject posts older than this many days. Default 60. */
  maxAgeDays?: number
}

// ── Snowflake ID → timestamp decoder ─────────────────────────────────────────

/**
 * Decode a Twitter/X Snowflake status ID into the post's creation Date.
 *
 * X's 64-bit status IDs are Snowflake IDs: the top 42 bits encode
 * milliseconds since the Twitter epoch (Nov 4, 2010 01:42:54.657 UTC).
 * This is the SAME mechanism X uses internally, so it's 100% reliable for
 * any real x.com/<handle>/status/<id> URL.
 *
 * Returns null if the ID is too short to be a valid Snowflake (pre-2010
 * IDs don't exist; IDs below ~2^22 are invalid).
 *
 * @example
 *   decodeSnowflakeDate('2064644718034649284') // → the real post date
 */
export function decodeSnowflakeDate(statusId: string | number): Date | null {
  let id: bigint
  try {
    id = BigInt(statusId)
  } catch {
    return null
  }
  // Valid Snowflake IDs are > 2^22 (the timestamp bits must be non-zero)
  if (id < 1n << 22n) return null
  // Top 42 bits = ms since Twitter epoch
  const timestampMs = Number(id >> 22n) + TWITTER_EPOCH_MS
  const d = new Date(timestampMs)
  // Sanity check: must be after Twitter epoch and before now + 1 day
  if (d.getTime() < TWITTER_EPOCH_MS) return null
  if (d.getTime() > Date.now() + 24 * 3600 * 1000) return null
  return d
}

/**
 * Extract the numeric status ID from an x.com/twitter.com post URL.
 * Returns null if the URL doesn't match the expected pattern.
 */
export function extractStatusId(url: string): string | null {
  const match = url.match(
    /^https:\/\/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i,
  )
  return match ? match[1] : null
}

/**
 * Determine a post's creation date with multiple fallback strategies.
 * Returns null ONLY if no strategy yields a valid date.
 *
 * Strategy order for X posts:
 *   1. Snowflake ID decode (most reliable — encoded in the URL itself)
 *   2. web_search datePublished / date metadata
 *
 * Strategy order for Reddit/web posts:
 *   1. web_search datePublished / date metadata
 *   2. null (can't verify freshness → caller rejects)
 */
function resolvePostDate(
  url: string,
  searchResult: ZaiSearchResult,
): Date | null {
  // For X posts, Snowflake decode is authoritative
  const statusId = extractStatusId(url)
  if (statusId) {
    const snowflakeDate = decodeSnowflakeDate(statusId)
    if (snowflakeDate) return snowflakeDate
  }
  // Fall back to web_search metadata
  const dateRaw = searchResult.datePublished || searchResult.date
  if (dateRaw) {
    const d = new Date(dateRaw)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

/**
 * Returns true if the post date is within the acceptable freshness window.
 * Posts with no date are rejected (isFresh = false).
 */
function isFresh(date: Date | null, maxAgeDays: number): boolean {
  if (!date) return false
  const ageMs = Date.now() - date.getTime()
  if (ageMs < 0) return false // future-dated = invalid
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000
}

// ── Tier 1 post discovery (for saga creation) ───────────────────────────────

/**
 * Find real X posts by Tier 1 journalists about a player's transfer, using
 * Z.ai web_search. Returns ONLY posts whose URL is a real x.com post AND
 * whose handle is in TIER1_HANDLES AND whose creation date is within
 * `maxAgeDays` of now.
 *
 * @param player     the tracked player to search for
 * @param opts.maxAgeDays  reject posts older than this (default 60)
 */
export async function fetchTier1PostsViaZai(
  player: TrackedPlayer,
  opts: ZaiFallbackOpts = {},
): Promise<{ posts: XPost[]; error?: string }> {
  const maxAgeDays = opts.maxAgeDays ?? 60
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
  const cutoffStr = cutoffDate.toISOString().slice(0, 10)

  let zai: any
  try {
    zai = await ZAI.create()
  } catch (err) {
    return { posts: [], error: `ZAI init failed: ${String(err).slice(0, 100)}` }
  }

  // Build queries that target Tier 1 journalists' X posts about this player.
  // We use site:x.com to restrict to real X post URLs, and add the cutoff
  // date to bias the search engine toward recent results.
  const queries = [
    `site:x.com FabrizioRomano ${player.name} transfer after:${cutoffStr}`,
    `site:x.com (FabrizioRomano OR David_Ornstein OR Plettigoal) ${player.name} transfer 2026 after:${cutoffStr}`,
    `FabrizioRomano ${player.name} ${player.fromClubName} transfer x.com 2026`,
  ].slice(0, MAX_QUERIES_PER_PLAYER)

  const collected: XPost[] = []
  const seenUrls = new Set<string>()
  let rejectedStale = 0
  let rejectedNoDate = 0

  for (const query of queries) {
    if (collected.length >= MAX_POSTS_PER_PLAYER) break
    try {
      await sleep(SDK_CALL_DELAY_MS)
      console.log(`[transfer-pulse/zai-fallback] web_search: "${query.slice(0, 90)}..."`)
      const results = (await zai.functions.invoke('web_search', {
        query,
        num: MAX_RESULTS_PER_QUERY,
      })) as ZaiSearchResult[]
      if (!Array.isArray(results)) continue

      for (const r of results) {
        if (collected.length >= MAX_POSTS_PER_PLAYER) break
        const url = String(r.url || '').trim()
        if (!url) continue

        // Must be a real x.com/<handle>/status/<id> URL
        const match = url.match(
          /^https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/i,
        )
        if (!match) continue
        const handle = match[1]
        const statusId = match[2]
        // Handle MUST be a Tier 1 journalist (anti-hallucination gate)
        if (!TIER1_HANDLES.has(handle.toLowerCase())) continue
        if (seenUrls.has(url)) continue

        // ── FRESHNESS GATE ───────────────────────────────────────────────
        // Decode the real post date from the Snowflake ID. This is the
        // critical fix for the "stale tweet" bug: we no longer trust
        // web_search metadata (which is often absent or wrong); instead
        // we decode the timestamp that X itself baked into the status ID.
        const postDate = resolvePostDate(url, r)
        if (!postDate) {
          rejectedNoDate++
          continue
        }
        if (!isFresh(postDate, maxAgeDays)) {
          rejectedStale++
          console.log(
            `[transfer-pulse/zai-fallback] rejecting stale post (${Math.round(
              (Date.now() - postDate.getTime()) / (24 * 3600 * 1000),
            )}d old): ${url}`,
          )
          continue
        }

        // Build text from snippet + title (search engines index real tweet text)
        const snippet = String(r.snippet || r.description || r.summary || '').trim()
        const title = String(r.name || r.title || '').trim()
        let text = snippet || title
        if (title && snippet && !snippet.startsWith(title)) {
          text = `${title} — ${snippet}`
        }
        // If the snippet is just the URL or too short, try page_reader
        if (text.length < 30 || text === url) {
          const enriched = await enrichViaPageReader(zai, url)
          if (enriched && enriched.length > 30) text = enriched
        }
        if (text.length < 15) continue

        // ── TRANSFER-KEYWORD GATE (added 2026-07-22) ─────────────────────
        // Search engines often return tweets that mention the player's name
        // but aren't transfer rumors (e.g. World Cup stat tweets). Reject
        // any post whose text doesn't contain at least one transfer-related
        // keyword. This prevents non-transfer tweets from anchoring sagas.
        // Also strip the "Missing: X | Show results with: X" Google
        // annotation that web_search appends to snippets — that's a search-
        // engine hint, not part of the tweet text.
        const cleanedText = text
          .replace(/Missing:\s*[^|]+\|\s*Show results with:[^"]*/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
        const lowerText = cleanedText.toLowerCase()
        const TRANSFER_KEYWORDS = [
          'transfer', 'deal', 'move', 'signing', 'signs', 'signed',
          'agrees', 'agreed', 'bid', 'offer', 'medical', 'contract',
          'here we go', 'launch', 'approach', 'talks', 'negotiat',
          'joining', 'joins', 'completed', 'confirmed', 'close to',
          'reaches', 'verbal', 'personal terms', 'fee',
        ]
        const hasTransferKeyword = TRANSFER_KEYWORDS.some((kw) =>
          lowerText.includes(kw),
        )
        if (!hasTransferKeyword) {
          console.log(
            `[transfer-pulse/zai-fallback] rejecting non-transfer post for ${player.name}: ` +
              `no transfer keyword in "${cleanedText.slice(0, 80)}..."`,
          )
          continue
        }
        text = cleanedText

        seenUrls.add(url)
        collected.push({
          url,
          handle,
          text: text.slice(0, 1200),
          postedAt: postDate.toISOString(),
        })
      }
    } catch (err) {
      const msg = String(err)
      console.warn(`[transfer-pulse/zai-fallback] web_search failed: ${msg.slice(0, 150)}`)
      if (msg.includes('429')) {
        console.log(`[transfer-pulse/zai-fallback] 429 hit, backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`)
        await sleep(RATE_LIMIT_BACKOFF_MS)
        // Retry once after backoff
        try {
          const retryResults = (await zai.functions.invoke('web_search', {
            query,
            num: MAX_RESULTS_PER_QUERY,
          })) as ZaiSearchResult[]
          if (Array.isArray(retryResults)) {
            for (const r of retryResults) {
              if (collected.length >= MAX_POSTS_PER_PLAYER) break
              const url = String(r.url || '').trim()
              if (!url) continue
              const match = url.match(
                /^https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/i,
              )
              if (!match) continue
              const handle = match[1]
              if (!TIER1_HANDLES.has(handle.toLowerCase())) continue
              if (seenUrls.has(url)) continue
              const postDate = resolvePostDate(url, r)
              if (!postDate) { rejectedNoDate++; continue }
              if (!isFresh(postDate, maxAgeDays)) { rejectedStale++; continue }
              const snippet = String(r.snippet || r.description || r.summary || '').trim()
              const title = String(r.name || r.title || '').trim()
              let text = snippet || title
              if (title && snippet && !snippet.startsWith(title)) {
                text = `${title} — ${snippet}`
              }
              if (text.length < 15) continue
              seenUrls.add(url)
              collected.push({ url, handle, text: text.slice(0, 1200), postedAt: postDate.toISOString() })
            }
          }
        } catch {
          // give up on this query after retry
        }
      }
      // continue to next query
    }
  }

  if (rejectedStale > 0 || rejectedNoDate > 0) {
    console.log(
      `[transfer-pulse/zai-fallback] ${player.name}: rejected ${rejectedStale} stale, ${rejectedNoDate} no-date posts`,
    )
  }

  return { posts: collected }
}

// ── Fan post discovery (for sentiment ingest) ───────────────────────────────

/**
 * Find real fan posts reacting to a transfer saga. Uses Z.ai web_search to
 * find Reddit threads + X posts by FANS (not journalists). Every post
 * carries a real source URL (reddit.com, x.com, etc.) AND a verifiable
 * creation date within `maxAgeDays`.
 *
 * The sentiment ingest pipeline scores these for excited/skeptical/dreading.
 *
 * @param opts.maxAgeDays  reject posts older than this (default 30 — fan
 *                         reactions are only relevant while fresh)
 */
export async function fetchFanPostsViaZai(opts: {
  playerName: string
  fromClubName: string
  toClubName: string
  maxPosts?: number
  maxAgeDays?: number
}): Promise<{ posts: XPost[]; error?: string }> {
  const maxAgeDays = opts.maxAgeDays ?? 30
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
  const cutoffStr = cutoffDate.toISOString().slice(0, 10)

  let zai: any
  try {
    zai = await ZAI.create()
  } catch (err) {
    return { posts: [], error: `ZAI init failed: ${String(err).slice(0, 100)}` }
  }

  const { playerName, fromClubName, toClubName } = opts
  const max = opts.maxPosts ?? 15

  // Target fan discussion venues: Reddit + X (fans, not journalists)
  // The `after:` operator biases the search engine toward recent results.
  const queries = [
    `site:reddit.com ${playerName} ${toClubName} transfer after:${cutoffStr}`,
    `site:x.com ${playerName} ${toClubName} transfer fan reaction after:${cutoffStr}`,
    `${playerName} ${toClubName} transfer fans reaction reddit 2026`,
  ]

  const collected: XPost[] = []
  const seenUrls = new Set<string>()
  let rejectedStale = 0
  let rejectedNoDate = 0

  for (const query of queries) {
    if (collected.length >= max) break
    try {
      await sleep(SDK_CALL_DELAY_MS)
      console.log(`[transfer-pulse/zai-fallback] fan web_search: "${query.slice(0, 90)}..."`)
      const results = (await zai.functions.invoke('web_search', {
        query,
        num: MAX_RESULTS_PER_QUERY,
      })) as ZaiSearchResult[]
      if (!Array.isArray(results)) continue

      for (const r of results) {
        if (collected.length >= max) break
        const url = String(r.url || '').trim()
        if (!url || seenUrls.has(url)) continue

        // Detect platform from URL
        const platform = detectPlatform(url)
        if (platform === 'unknown') continue

        // For X posts, exclude Tier 1 journalists (we want FAN reactions)
        const xMatch = url.match(
          /^https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\//i,
        )
        if (xMatch && TIER1_HANDLES.has(xMatch[1].toLowerCase())) {
          // This is a journalist's post, not a fan's — skip
          continue
        }

        // ── FRESHNESS GATE ───────────────────────────────────────────────
        const postDate = resolvePostDate(url, r)
        if (!postDate) {
          rejectedNoDate++
          continue
        }
        if (!isFresh(postDate, maxAgeDays)) {
          rejectedStale++
          continue
        }

        // Build text from snippet + title
        const snippet = String(r.snippet || r.description || r.summary || '').trim()
        const title = String(r.name || r.title || '').trim()
        let text = snippet || title
        if (title && snippet && !snippet.startsWith(title)) {
          text = `${title} — ${snippet}`
        }

        // For Reddit, try .json enrichment to get full post text
        if (platform === 'reddit' && url.includes('reddit.com/r/')) {
          try {
            const jsonUrl = url.replace(/\/?$/, '.json')
            await sleep(SDK_CALL_DELAY_MS)
            const pageData = await zai.functions.invoke('page_reader', { url: jsonUrl })
            const rawContent =
              pageData?.data?.html ||
              pageData?.data?.content ||
              (typeof pageData === 'string' ? pageData : '')
            const extracted = extractRedditContent(rawContent)
            if (extracted && extracted.length > text.length) {
              text = extracted
            }
          } catch {
            // snippet fallback
          }
        }

        if (text.length < 20) continue

        // Derive handle from URL
        let handle = ''
        if (xMatch) {
          handle = xMatch[1]
        } else if (platform === 'reddit') {
          const rMatch = url.match(/reddit\.com\/(?:u|user)\/([^/?#]+)/i)
          handle = rMatch ? `u_${rMatch[1]}` : 'reddit'
        } else {
          handle = new URL(url).hostname.replace(/^www\./, '')
        }

        seenUrls.add(url)
        collected.push({
          url,
          handle,
          text: text.slice(0, 1200),
          postedAt: postDate.toISOString(),
        })
      }
    } catch (err) {
      const msg = String(err)
      console.warn(`[transfer-pulse/zai-fallback] fan web_search failed: ${msg.slice(0, 150)}`)
      if (msg.includes('429')) {
        console.log(`[transfer-pulse/zai-fallback] fan 429 hit, backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`)
        await sleep(RATE_LIMIT_BACKOFF_MS)
      }
    }
  }

  if (rejectedStale > 0 || rejectedNoDate > 0) {
    console.log(
      `[transfer-pulse/zai-fallback] fan posts: rejected ${rejectedStale} stale, ${rejectedNoDate} no-date`,
    )
  }

  return { posts: collected }
}

// ── Journalist-feed discovery (for PUSH-based feed-scan) ─────────────────────

/**
 * Find real X posts by a SPECIFIC Tier 1 journalist about ANY transfer
 * (not tied to a tracked player). Used by feed-scan.ts as the PUSH-based
 * discovery path: "what has Romano tweeted about recently?"
 *
 * Strategy:
 *   1. `site:x.com/<handle>/status` restricts Google/Bing to URLs in the
 *      journalist's own X profile path. This is the key trick — Google
 *      indexes individual tweets at x.com/<handle>/status/<id>, and the
 *      path-prefix restricts results to that journalist's posts only.
 *   2. The `transfer` keyword + `after:<cutoff>` date bias the search
 *      toward recent transfer-rumor posts.
 *   3. Snowflake-decode freshness gate (mirrors fetchTier1PostsViaZai).
 *   4. Transfer-keyword gate (mirrors fetchTier1PostsViaZai).
 *
 * ANTI-HALLUCINATION CONTRACT (preserved):
 *   - URL must match ^https://x.com/<handle>/status/<digits>$
 *   - Handle MUST be the requested journalist's handle (case-insensitive)
 *   - The handle MUST be in TIER1_HANDLES (defense in depth)
 *   - Post date decoded from Snowflake ID; posts >maxAgeDays rejected
 *   - Post text must contain a transfer keyword
 *   - If web_search returns nothing, returns [] (empty) — never fabricates
 *
 * @param handle       the journalist's X handle WITHOUT @, e.g. "FabrizioRomano"
 * @param opts.maxAgeDays  reject posts older than this (default 14)
 */
export async function fetchJournalistPostsViaZai(
  handle: string,
  opts: ZaiFallbackOpts = {},
): Promise<{ posts: XPost[]; error?: string }> {
  const maxAgeDays = opts.maxAgeDays ?? 14
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
  const cutoffStr = cutoffDate.toISOString().slice(0, 10)
  const cleanHandle = handle.replace(/^@/, '').trim()
  if (!cleanHandle) return { posts: [], error: 'no handle provided' }

  let zai: any
  try {
    zai = await ZAI.create()
  } catch (err) {
    return { posts: [], error: `ZAI init failed: ${String(err).slice(0, 100)}` }
  }

  // Three query variants — Google/Bing index tweets unevenly, so we try
  // multiple phrasings and dedupe by URL.
  const queries = [
    `site:x.com/${cleanHandle}/status transfer after:${cutoffStr}`,
    `site:x.com/${cleanHandle} transfer deal 2026 after:${cutoffStr}`,
    `from:${cleanHandle} transfer x.com 2026`,
  ].slice(0, MAX_QUERIES_PER_PLAYER)

  const collected: XPost[] = []
  const seenUrls = new Set<string>()
  let rejectedStale = 0
  let rejectedNoDate = 0
  let rejectedNoKeyword = 0

  for (const query of queries) {
    if (collected.length >= MAX_POSTS_PER_PLAYER) break
    try {
      await sleep(SDK_CALL_DELAY_MS)
      console.log(`[transfer-pulse/zai-fallback] journalist web_search: "${query.slice(0, 90)}..."`)
      const results = (await zai.functions.invoke('web_search', {
        query,
        num: MAX_RESULTS_PER_QUERY,
      })) as ZaiSearchResult[]
      if (!Array.isArray(results)) continue

      for (const r of results) {
        if (collected.length >= MAX_POSTS_PER_PLAYER) break
        const url = String(r.url || '').trim()
        if (!url) continue

        // Must be a real x.com/<handle>/status/<id> URL
        const match = url.match(
          /^https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/i,
        )
        if (!match) continue
        const urlHandle = match[1]
        // Defense in depth: URL handle must be the requested journalist
        if (urlHandle.toLowerCase() !== cleanHandle.toLowerCase()) continue
        // And must be in TIER1_HANDLES
        if (!TIER1_HANDLES.has(urlHandle.toLowerCase())) continue
        if (seenUrls.has(url)) continue

        // ── FRESHNESS GATE ───────────────────────────────────────────────
        const postDate = resolvePostDate(url, r)
        if (!postDate) {
          rejectedNoDate++
          continue
        }
        if (!isFresh(postDate, maxAgeDays)) {
          rejectedStale++
          console.log(
            `[transfer-pulse/zai-fallback] rejecting stale journalist post (${Math.round(
              (Date.now() - postDate.getTime()) / (24 * 3600 * 1000),
            )}d old): ${url}`,
          )
          continue
        }

        // Build text from snippet + title
        const snippet = String(r.snippet || r.description || r.summary || '').trim()
        const title = String(r.name || r.title || '').trim()
        let text = snippet || title
        if (title && snippet && !snippet.startsWith(title)) {
          text = `${title} — ${snippet}`
        }
        // If the snippet is too short, try page_reader to extract tweet text
        if (text.length < 30 || text === url) {
          const enriched = await enrichViaPageReader(zai, url)
          if (enriched && enriched.length > 30) text = enriched
        }
        if (text.length < 15) continue

        // ── TRANSFER-KEYWORD GATE ────────────────────────────────────────
        const cleanedText = text
          .replace(/Missing:\s*[^|]+\|\s*Show results with:[^"]*/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
        const lowerText = cleanedText.toLowerCase()
        const TRANSFER_KEYWORDS = [
          'transfer', 'deal', 'move', 'signing', 'signs', 'signed',
          'agrees', 'agreed', 'bid', 'offer', 'medical', 'contract',
          'here we go', 'launch', 'approach', 'talks', 'negotiat',
          'joining', 'joins', 'completed', 'confirmed', 'close to',
          'reaches', 'verbal', 'personal terms', 'fee',
        ]
        const hasTransferKeyword = TRANSFER_KEYWORDS.some((kw) =>
          lowerText.includes(kw),
        )
        if (!hasTransferKeyword) {
          rejectedNoKeyword++
          continue
        }
        text = cleanedText

        seenUrls.add(url)
        collected.push({
          url,
          handle: urlHandle,
          text: text.slice(0, 1200),
          postedAt: postDate.toISOString(),
        })
      }
    } catch (err) {
      const msg = String(err)
      console.warn(`[transfer-pulse/zai-fallback] journalist web_search failed: ${msg.slice(0, 150)}`)
      if (msg.includes('429')) {
        console.log(`[transfer-pulse/zai-fallback] 429 hit, backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`)
        await sleep(RATE_LIMIT_BACKOFF_MS)
      }
      // continue to next query
    }
  }

  if (rejectedStale > 0 || rejectedNoDate > 0 || rejectedNoKeyword > 0) {
    console.log(
      `[transfer-pulse/zai-fallback] @${cleanHandle}: rejected ${rejectedStale} stale, ` +
        `${rejectedNoDate} no-date, ${rejectedNoKeyword} no-keyword posts`,
    )
  }

  return { posts: collected }
}

// ── Internal helpers ────────────────────────────────────────────────────────

async function enrichViaPageReader(zai: any, url: string): Promise<string | null> {
  try {
    await sleep(SDK_CALL_DELAY_MS)
    const pageData = await zai.functions.invoke('page_reader', { url })
    const raw =
      pageData?.data?.html ||
      pageData?.data?.content ||
      (typeof pageData === 'string' ? pageData : '')
    if (!raw || raw.length < 100) return null
    // x.com pages may have OG description meta — extract tweet text
    const ogMatch = raw.match(/"description"\s*:\s*"([^"]{15,500})"/i)
    if (ogMatch) return ogMatch[1].replace(/\\"/g, '"')
    const text = stripHtml(raw).trim()
    return text.length > 30 ? text.slice(0, 1000) : null
  } catch {
    return null
  }
}

function detectPlatform(url: string): 'twitter' | 'reddit' | 'web' | 'unknown' {
  if (/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i.test(url)) return 'twitter'
  if (/^https?:\/\/(?:www\.)?reddit\.com\//i.test(url)) return 'reddit'
  if (/^https?:\/\//i.test(url)) return 'web'
  return 'unknown'
}

function extractRedditContent(json: string): string | null {
  try {
    const parsed = JSON.parse(json)
    const post = parsed?.[0]?.data?.children?.[0]?.data
    if (!post) return null
    const parts = [
      post.title,
      post.selftext || '',
      post.author ? `u/${post.author}` : '',
    ].filter(Boolean)
    return parts.join(' — ').slice(0, 1200) || null
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
