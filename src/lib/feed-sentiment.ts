/**
 * Feed Sentiment Service — admin-seeded fan sentiment pipeline.
 *
 * Implements Layers 1+2+3 of the sentiment strategy:
 *   - Layer 1: SDK scraping via z-ai-web-dev-sdk (web_search + page_reader)
 *   - Layer 2: Reddit-focused search (free, high-quality tactical discussion)
 *   - Layer 3: Admin-curated hashtags + seed URLs (anchor the conversation)
 *
 * The cron job (or admin manual trigger) calls refreshMonitor() every 5 min
 * for each active FeedMonitor. The function:
 *   1. Builds a search query from the monitor's hashtags + match label
 *   2. Calls web_search to find new posts (Twitter, Reddit, news)
 *   3. Calls page_reader on each result URL to extract post content
 *   4. Skips URLs already in FeedPost table (de-duplication)
 *   5. Calls LLM to score each post's sentiment (0-100) + extract:
 *        - mentioned player IDs (matched against the monitor's tracked players)
 *        - a notable quote (for UI display)
 *   6. Saves new FeedPost records
 *   7. Recomputes PlayerSentiment aggregates for each tracked player
 *
 * The Pulse Engine then reads PlayerSentiment to compute the 25% Fan Sentiment
 * component of the Pulse Score (replaces the old "95% baseline" placeholder).
 *
 * BUILD-SAFE: the Z.ai SDK is loaded with dynamic import() INSIDE
 * refreshMonitor(), so it is NOT evaluated at module-import time (build time).
 * This prevents "Failed to collect page data" errors when the SDK's config
 * file (.z-ai-config) is unavailable during the build.
 */

import type { PrismaClient } from '@prisma/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedMonitorData {
  id: string
  matchLabel: string
  teamCodes: string[]
  playerIds: string[]
  hashtags: string[]
  seedUrls: string[]
}

interface TrackedPlayer {
  id: string
  playerName: string
  nationCode: string
  position: string
}

interface ScrapedPost {
  url: string
  platform: 'twitter' | 'reddit' | 'web'
  author: string
  content: string
  postedAt: Date
}

interface LLMAnalysisResult {
  sentiment: number // 0-100
  positiveRatio: number // 0-1
  mentionedPlayerIds: string[] // player IDs found in content
  topQuote: string | null // notable fan quote extracted by LLM
  language: string // detected language code
}

export interface RefreshResult {
  monitorId: string
  newPosts: number
  skippedDuplicates: number
  failedPosts: number
  playersUpdated: number
  errors: string[]
  durationMs: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_POSTS_PER_REFRESH = 20 // cap to control LLM cost
const MAX_CONTENT_LENGTH = 2000 // truncate long pages before LLM scoring
const LLM_BATCH_SIZE = 5 // posts per LLM call

// Rate limiting: the z-ai SDK enforces ~10 requests/min on free tier.
// We add a delay between SDK calls to avoid 429 errors.
// At 2s delay between page_reader calls, 20 posts = 40s — acceptable.
const SDK_CALL_DELAY_MS = 2000

/** Sleep helper for rate limiting. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ── Lazy ZAI SDK loader (BUILD-SAFE) ──────────────────────────────────────────
// The SDK is loaded via dynamic import() ONLY when refreshMonitor() is called.
// At build time, this module is never evaluated → no crash.
let _zai: any = null
async function getZAI(): Promise<any> {
  if (_zai) return _zai
  const ZAIModule = await import('z-ai-web-dev-sdk')
  _zai = await ZAIModule.default.create()
  return _zai
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Refresh a single FeedMonitor: search → scrape → score → aggregate.
 * Called by the cron job (every 5 min) or admin manual trigger.
 */
export async function refreshMonitor(
  database: PrismaClient,
  monitorId: string,
): Promise<RefreshResult> {
  const startedAt = Date.now()
  const errors: string[] = []
  let newPosts = 0
  let skippedDuplicates = 0
  let failedPosts = 0
  let playersUpdated = 0

  // ── 1. Load the monitor + tracked players ──────────────────────────────
  const monitor = await database.feedMonitor.findUnique({
    where: { id: monitorId },
  })
  if (!monitor) {
    return {
      monitorId,
      newPosts: 0,
      skippedDuplicates: 0,
      failedPosts: 0,
      playersUpdated: 0,
      errors: ['Monitor not found'],
      durationMs: Date.now() - startedAt,
    }
  }
  if (monitor.status !== 'active') {
    return {
      monitorId,
      newPosts: 0,
      skippedDuplicates: 0,
      failedPosts: 0,
      playersUpdated: 0,
      errors: [`Monitor status is '${monitor.status}', skipping refresh`],
      durationMs: Date.now() - startedAt,
    }
  }

  const monitorData: FeedMonitorData = {
    id: monitor.id,
    matchLabel: monitor.matchLabel,
    teamCodes: safeJsonParse(monitor.teamCodes, []),
    playerIds: safeJsonParse(monitor.playerIds, []),
    hashtags: safeJsonParse(monitor.hashtags, []),
    seedUrls: safeJsonParse(monitor.seedUrls, []),
  }

  // Load tracked players so we can match them in post content
  const trackedPlayers: TrackedPlayer[] = monitorData.playerIds.length
    ? await database.wCSelectionPlayer.findMany({
        where: { id: { in: monitorData.playerIds } },
        select: {
          id: true,
          playerName: true,
          nationCode: true,
          position: true,
        },
      })
    : []
  // Map of lowercase name → player ID for case-insensitive matching
  const playerNameIndex = new Map<string, string>()
  for (const p of trackedPlayers) {
    playerNameIndex.set(p.playerName.toLowerCase(), p.id)
    // Also index by last name (more common in tweets)
    const lastWord = p.playerName.split(' ').pop()
    if (lastWord && lastWord.length >= 4) {
      playerNameIndex.set(lastWord.toLowerCase(), p.id)
    }
  }

  // ── 2. Initialize SDK + run searches ───────────────────────────────────
  let zai: any
  try {
    zai = await getZAI()
  } catch (err) {
    return {
      monitorId,
      newPosts: 0,
      skippedDuplicates: 0,
      failedPosts: 0,
      playersUpdated: 0,
      errors: [`SDK init failed: ${String(err)}`],
      durationMs: Date.now() - startedAt,
    }
  }

  // Build search queries from hashtags + match label
  const queries = buildSearchQueries(monitorData)
  const scrapedPosts: ScrapedPost[] = []

  console.log(
    `[feed-sentiment] Refreshing monitor ${monitor.id} (${monitor.matchLabel}) — ${queries.length} queries`,
  )

  for (const query of queries) {
    try {
      console.log(`[feed-sentiment] web_search: "${query}"`)
      await sleep(SDK_CALL_DELAY_MS) // rate limit
      const searchResults = (await zai.functions.invoke('web_search', {
        query,
        num: 10,
      })) as any[]

      if (!Array.isArray(searchResults)) {
        console.log(`[feed-sentiment] web_search returned non-array: ${typeof searchResults}`)
        continue
      }
      console.log(`[feed-sentiment] Got ${searchResults.length} search results`)

      for (const result of searchResults) {
        if (!result?.url) continue
        // Stop if we've hit the per-refresh cap
        if (scrapedPosts.length >= MAX_POSTS_PER_REFRESH) break

        const domain = extractDomain(result.url)
        const platform = detectPlatform(result.url)

        // ── ANTI-BLOCK STRATEGY ────────────────────────────────────────────
        // Primary content = search snippet + title. These come straight from
        // the search engine's index and are NEVER blocked (Reddit/Instagram
        // block page_reader, but they can't block the search snippet Google
        // already cached). This is our reliable baseline.
        const snippet = String(result.snippet || result.description || result.summary || '').trim()
        const title = String(result.name || result.title || '').trim()
        let content = [title, snippet].filter(Boolean).join(' — ')

        // Skip results with no usable snippet at all
        if (!content || content.length < 20) {
          console.log(`[feed-sentiment] No snippet for ${domain}, skipping`)
          continue
        }

        // ── ENRICHMENT (optional, domain-specific) ─────────────────────────
        // Only call page_reader for domains known to allow scraping (news
        // sites). Social media (Reddit, Instagram, X, TikTok) get snippet-
        // only — page_reader returns anti-bot block pages for them.
        if (isScrapeFriendlyDomain(domain)) {
          try {
            await sleep(SDK_CALL_DELAY_MS) // rate limit
            const pageData = await zai.functions.invoke('page_reader', {
              url: result.url,
            })
            const rawContent =
              pageData?.data?.html ||
              pageData?.data?.content ||
              (typeof pageData === 'string' ? pageData : '')
            // Only use enriched content if it's substantial AND not a block msg
            if (rawContent && rawContent.length > 200 && !isBlockMessage(rawContent)) {
              const fullText = stripHtml(rawContent).slice(0, MAX_CONTENT_LENGTH)
              if (fullText.length > content.length) {
                content = fullText
              }
            }
          } catch (pageErr) {
            // page_reader failed — fall back to snippet (already set above)
            if (String(pageErr).includes('429')) {
              console.log(`[feed-sentiment] 429 rate limit, waiting 5s...`)
              await sleep(5000)
            }
          }
        }

        // ── REDDIT JSON API FALLBACK ───────────────────────────────────────
        // Reddit exposes a public JSON API: append .json to any reddit.com
        // URL and you get the post + comments as JSON (no auth, not blocked).
        // This gives us the actual post body + top comment, far richer than
        // the snippet. We fetch via page_reader on the .json URL.
        if (platform === 'reddit' && result.url.includes('reddit.com/r/')) {
          try {
            const jsonUrl = result.url.replace(/\/?$/, '.json')
            await sleep(SDK_CALL_DELAY_MS) // rate limit
            const redditData = await zai.functions.invoke('page_reader', {
              url: jsonUrl,
            })
            const redditJson =
              redditData?.data?.html ||
              redditData?.data?.content ||
              (typeof redditData === 'string' ? redditData : '')
            const extracted = extractRedditContent(redditJson)
            if (extracted && extracted.length > content.length && !isBlockMessage(extracted)) {
              content = extracted
            }
          } catch {
            // JSON fetch failed — snippet is still our fallback
          }
        }

        // ── FINAL SAFETY CHECK ─────────────────────────────────────────────
        // Reject the post entirely if the final content (even snippet-based)
        // looks like an anti-bot block page. This catches cases where the
        // search snippet itself is a block message (e.g. Instagram's
        // "Log into Instagram" or Reddit's "blocked by network security").
        if (isBlockMessage(content)) {
          console.log(`[feed-sentiment] Block message detected in content for ${domain}, skipping`)
          failedPosts++
          continue
        }

        scrapedPosts.push({
          url: result.url,
          platform,
          author: result.author || result.source || result.host_name || '',
          content: content.slice(0, MAX_CONTENT_LENGTH),
          postedAt: result.datePublished || result.date
            ? new Date(result.datePublished || result.date)
            : new Date(),
        })
      }
    } catch (searchErr) {
      errors.push(`web_search failed for query="${query}": ${String(searchErr)}`)
      // If web_search itself hit 429, wait longer
      if (String(searchErr).includes('429')) {
        console.log(`[feed-sentiment] web_search 429 rate limit, waiting 5s...`)
        await sleep(5000)
      }
    }

    if (scrapedPosts.length >= MAX_POSTS_PER_REFRESH) break
  }

  console.log(
    `[feed-sentiment] Scraped ${scrapedPosts.length} posts, ${failedPosts} failed, ${skippedDuplicates} duplicates`,
  )

  // ── 3. De-duplicate against existing FeedPosts (by URL) ───────────────
  const existingUrls = new Set(
    (
      await database.feedPost.findMany({
        where: { url: { in: scrapedPosts.map((p) => p.url) } },
        select: { url: true },
      })
    ).map((p) => p.url),
  )

  const newPostsToAnalyze = scrapedPosts.filter((p) => {
    if (existingUrls.has(p.url)) {
      skippedDuplicates++
      return false
    }
    return true
  })

  // ── 4. LLM scoring (batches of LLM_BATCH_SIZE) ────────────────────────
  console.log(
    `[feed-sentiment] LLM scoring ${newPostsToAnalyze.length} posts in batches of ${LLM_BATCH_SIZE}`,
  )
  for (let i = 0; i < newPostsToAnalyze.length; i += LLM_BATCH_SIZE) {
    const batch = newPostsToAnalyze.slice(i, i + LLM_BATCH_SIZE)
    try {
      const analyses = await scorePostBatchWithLLM(batch, playerNameIndex, zai)
      const successCount = analyses.filter((a) => a !== null).length
      console.log(
        `[feed-sentiment] LLM batch ${Math.floor(i / LLM_BATCH_SIZE) + 1}: ${successCount}/${batch.length} scored`,
      )
      for (let j = 0; j < batch.length; j++) {
        const post = batch[j]
        const analysis = analyses[j]
        if (!analysis) {
          failedPosts++
          continue
        }
        try {
          await database.feedPost.create({
            data: {
              monitorId: monitor.id,
              platform: post.platform,
              url: post.url,
              author: post.author,
              content: post.content,
              language: analysis.language,
              sentimentScore: analysis.sentiment,
              positiveRatio: analysis.positiveRatio,
              mentionedPlayers: JSON.stringify(analysis.mentionedPlayerIds),
              topQuote: analysis.topQuote,
              postedAt: post.postedAt,
              analyzedAt: new Date(),
            },
          })
          newPosts++
        } catch (dbErr) {
          // Likely a race condition (URL inserted by another refresh) — skip
          errors.push(`feedPost.create failed: ${String(dbErr)}`)
        }
      }
    } catch (llmErr) {
      errors.push(`LLM batch failed: ${String(llmErr)}`)
      failedPosts += batch.length
    }
    // Rate limit between LLM batches too
    if (i + LLM_BATCH_SIZE < newPostsToAnalyze.length) {
      await sleep(SDK_CALL_DELAY_MS)
    }
  }

  // ── 5. Recompute PlayerSentiment aggregates ───────────────────────────
  // For each tracked player: average sentiment across all FeedPosts in this
  // monitor that mention the player. Weighted by recency (last 24h preferred).
  if (trackedPlayers.length > 0) {
    const allMonitorPosts = await database.feedPost.findMany({
      where: { monitorId: monitor.id },
      select: {
        sentimentScore: true,
        positiveRatio: true,
        mentionedPlayers: true,
        topQuote: true,
        analyzedAt: true,
      },
    })

    for (const player of trackedPlayers) {
      const mentioningPosts = allMonitorPosts.filter((p) => {
        try {
          const ids = JSON.parse(p.mentionedPlayers || '[]') as string[]
          return ids.includes(player.id)
        } catch {
          return false
        }
      })

      if (mentioningPosts.length === 0) continue

      const avgSentiment =
        mentioningPosts.reduce((s, p) => s + p.sentimentScore, 0) /
        mentioningPosts.length
      const avgPositive =
        mentioningPosts.reduce((s, p) => s + p.positiveRatio, 0) /
        mentioningPosts.length

      // Pick top 3 quotes (highest sentiment for elite, lowest for crisis,
      // mixed for neutral — we just pick the most extreme ones for variety)
      const quotesWithScores = mentioningPosts
        .filter((p) => p.topQuote)
        .map((p) => ({ quote: p.topQuote!, score: p.sentimentScore }))
        .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
        .slice(0, 3)

      await database.playerSentiment.upsert({
        where: { playerId: player.id },
        create: {
          playerId: player.id,
          monitorId: monitor.id,
          sentiment: Math.round(avgSentiment * 10) / 10,
          postCount: mentioningPosts.length,
          positiveRatio: Math.round(avgPositive * 100) / 100,
          topQuotes: JSON.stringify(quotesWithScores),
          avgEngagement: 0, // not available from scraping
          analyzedAt: new Date(),
        },
        update: {
          monitorId: monitor.id,
          sentiment: Math.round(avgSentiment * 10) / 10,
          postCount: mentioningPosts.length,
          positiveRatio: Math.round(avgPositive * 100) / 100,
          topQuotes: JSON.stringify(quotesWithScores),
          avgEngagement: 0,
          analyzedAt: new Date(),
        },
      })
      playersUpdated++
    }
  }

  // ── 6. Update monitor's lastRefreshedAt ───────────────────────────────
  await database.feedMonitor.update({
    where: { id: monitor.id },
    data: { lastRefreshedAt: new Date() },
  })

  return {
    monitorId,
    newPosts,
    skippedDuplicates,
    failedPosts,
    playersUpdated,
    errors,
    durationMs: Date.now() - startedAt,
  }
}

/**
 * Mark all monitors past their endsAt time as 'ended'.
 * Called by the cron job before triggering refreshes.
 */
export async function endExpiredMonitors(
  database: PrismaClient,
): Promise<number> {
  const result = await database.feedMonitor.updateMany({
    where: {
      status: 'active',
      endsAt: { lt: new Date() },
    },
    data: { status: 'ended' },
  })
  return result.count
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function stripHtml(html: string): string {
  // Crude HTML stripper — good enough for content extraction.
  // The LLM only needs the text, not the markup.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Anti-block helpers ───────────────────────────────────────────────────────

/** Extract the hostname from a URL (without www. prefix). */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Classify a URL into a platform for display in the UI. */
function detectPlatform(url: string): 'twitter' | 'reddit' | 'web' {
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('x.com') || url.includes('twitter.com')) return 'twitter'
  return 'web'
}

/**
 * Domains known to allow page_reader scraping (news sites, sports media).
 * Social media (Reddit, Instagram, X, TikTok) are deliberately EXCLUDED —
 * they return anti-bot block pages to page_reader. For those, we rely on
 * the search snippet (always available) + Reddit's public .json API.
 */
const SCRAPE_FRIENDLY_DOMAINS: readonly string[] = [
  'yahoo.com',
  'espn.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'goal.com',
  'skysports.com',
  'reuters.com',
  'apnews.com',
  'cbssports.com',
  'sportingnews.com',
  'fourfourtwo.com',
  'marca.com',
  'as.com',
  'mundodeportivo.com',
  'sportsmole.com',
  '90min.com',
  'football365.com',
  'talksport.com',
  'fifa.com',
  'mlssoccer.com',
  'worldsoccer.com',
  'espn.co.uk',
  'sportskeeda.com',
  'essentiallysports.com',
]

/** Returns true if the domain is in the scrape-friendly allowlist. */
function isScrapeFriendlyDomain(domain: string): boolean {
  if (!domain) return false
  return SCRAPE_FRIENDLY_DOMAINS.some(
    (d) => domain === d || domain.endsWith('.' + d),
  )
}

/**
 * Known anti-bot block-message patterns. If page_reader returns content
 * matching any of these, we discard it and fall back to the search snippet.
 * This catches Reddit's "blocked by network security", Instagram's
 * "Log into Instagram", Cloudflare's "Attention Required", etc.
 */
const BLOCK_MESSAGE_PATTERNS: readonly string[] = [
  'blocked by network security',
  'log into instagram',
  'please enable javascript',
  'access denied',
  'attention required',
  'enable javascript and cookies to continue',
  'are you a robot',
  'unusual traffic',
  'sorry, you have been blocked',
  'checking your browser',
  'cf-browser-verification',
  'cloudflare',
  'please verify you are a human',
  'captcha-bypass',
  'request blocked',
  'whoops, looks like this page',
  'this page is not available',
  'sorry, this content',
]

/** Returns true if the content looks like an anti-bot block page. */
function isBlockMessage(content: string): boolean {
  if (!content) return true
  const lower = content.toLowerCase()
  return BLOCK_MESSAGE_PATTERNS.some((p) => lower.includes(p))
}

/**
 * Extract post title + body + top comment from a Reddit .json API response.
 * Reddit's public JSON API (append .json to any reddit URL) returns the
 * post + comments as JSON — no auth, not blocked by anti-bot measures.
 * We parse out the most useful text for sentiment scoring.
 */
function extractRedditContent(rawJson: string): string {
  try {
    // page_reader may return the JSON wrapped in HTML or as raw text.
    // Try to extract the JSON payload either way.
    let jsonStr = rawJson
    // If it's HTML-wrapped, extract text content
    if (jsonStr.includes('<')) {
      jsonStr = stripHtml(jsonStr)
    }
    const parsed = JSON.parse(jsonStr)

    // Reddit JSON structure: [{ data: { children: [{ data: { title, selftext, ... } }] } }, { data: { children: [comments] } }]
    const postListing = Array.isArray(parsed) ? parsed[0] : parsed
    const postData = postListing?.data?.children?.[0]?.data
    if (!postData) return ''

    const title = String(postData.title || '').trim()
    const body = String(postData.selftext || '').trim()
    const author = String(postData.author || '').trim()
    const subreddit = String(postData.subreddit_name_prefixed || postData.subreddit || '').trim()

    // Try to get top comment (second listing in the array)
    let topComment = ''
    if (Array.isArray(parsed) && parsed[1]?.data?.children) {
      const comments = parsed[1].data.children
      for (const c of comments) {
        const text = String(c?.data?.body || '').trim()
        if (text && text.length > 20 && !text.includes('[deleted]')) {
          topComment = text
          break
        }
      }
    }

    const parts = [
      subreddit ? `[${subreddit}]` : '',
      title,
      body,
      topComment ? `Top comment: ${topComment}` : '',
    ].filter(Boolean)

    return parts.join(' — ').slice(0, MAX_CONTENT_LENGTH)
  } catch {
    // Not valid JSON — return empty so caller falls back to snippet
    return ''
  }
}

/**
 * Build search queries from the monitor's hashtags + match label.
 * We run multiple targeted queries to maximize coverage:
 *   1. Hashtag-focused query (catches X/Twitter posts)
 *   2. Reddit-focused query (catches r/soccer tactical threads)
 *   3. Match-label query (catches news articles quoting fans)
 */
function buildSearchQueries(monitor: FeedMonitorData): string[] {
  const queries: string[] = []

  // Query 1: Hashtags combined with match label (last 24h implied by freshness)
  if (monitor.hashtags.length > 0) {
    const hashtagPart = monitor.hashtags.slice(0, 3).join(' OR ')
    queries.push(`${hashtagPart} ${monitor.matchLabel}`.trim())
  }

  // Query 2: Reddit-focused (free, high-quality tactical discussion)
  if (monitor.teamCodes.length > 0) {
    const teams = monitor.teamCodes.join(' OR ')
    queries.push(`"${monitor.matchLabel}" (${teams}) site:reddit.com`)
  }

  // Query 3: General match label + "World Cup 2026"
  queries.push(`"${monitor.matchLabel}" "World Cup 2026" fan reaction`)

  return queries.slice(0, 3) // cap at 3 queries per refresh for cost control
}

const LLM_SENTIMENT_SYSTEM_PROMPT = `You are a football fan sentiment analyzer. For each post, output a JSON object with these fields:
{
  "s": <number 0-100>,           // sentiment score: 0=furious, 50=neutral, 100=euphoric
  "p": <number 0-1>,              // positive ratio: fraction of post that is positive
  "q": <string|null>,             // notable quote: a short, punchy, quotable fan reaction (max 140 chars) or null
  "l": <string>                   // detected language code: "en", "es", "ar", "fr", etc.
}

Scoring guidance:
- 90-100: Euphoric (won dramatically, hat-trick heroics, last-minute winner)
- 70-89: Happy (won comfortably, good performance)
- 50-69: Neutral (draw, mixed feelings)
- 30-49: Worried (lost narrowly, underperformed)
- 0-29: Furious (humiliated, defensive collapse, historic defeat)

Rules:
- Score based on the post's tone about the team/player, not the post's existence
- "q" should be a memorable quote IF one exists in the post, otherwise null
- Output ONE JSON object per post, separated by newlines
- Do not output anything else`

/**
 * LLM-score a batch of posts. Returns analyses aligned with the input array.
 * Also extracts mentioned player IDs by matching post content against the
 * tracked-player name index.
 */
async function scorePostBatchWithLLM(
  batch: ScrapedPost[],
  playerNameIndex: Map<string, string>,
  zai: any,
): Promise<(LLMAnalysisResult | null)[]> {
  const results: (LLMAnalysisResult | null)[] = new Array(batch.length).fill(null)

  // Build user payload: array of {i, t} where t is truncated to 600 chars
  const userPayload = batch.map((p, idx) => ({
    i: idx,
    t: (p.content || '').slice(0, 600),
  }))

  let raw = ''
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: LLM_SENTIMENT_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      thinking: { type: 'disabled' },
    })
    raw = completion?.choices?.[0]?.message?.content || ''
  } catch (err) {
    console.warn('[feed-sentiment] LLM call failed:', String(err))
    return results
  }

  if (!raw.trim()) return results

  // The LLM may return either a JSON array OR newline-separated JSON objects.
  // Handle both formats gracefully. Also handle the case where the LLM omits
  // the "i" field (we fall back to the response position as the index).
  let parsed: any[] = []
  try {
    // Try array first
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    const arrayParsed = JSON.parse(cleaned)
    if (Array.isArray(arrayParsed)) {
      parsed = arrayParsed
    } else {
      // Single object, not an array — wrap it
      parsed = [arrayParsed]
    }
  } catch {
    // Fall back to newline-delimited JSON objects
    const lines = raw.split('\n').filter((l) => l.trim().startsWith('{'))
    for (const line of lines) {
      try {
        const obj = JSON.parse(line.trim())
        parsed.push(obj)
      } catch {
        // skip malformed line
      }
    }
  }

  console.log(
    `[feed-sentiment] LLM returned ${parsed.length} parsed objects for batch of ${batch.length}`,
  )
  if (parsed.length > 0) {
    console.log(`[feed-sentiment] Sample LLM output: ${JSON.stringify(parsed[0]).substring(0, 200)}`)
  }

  for (let responseIdx = 0; responseIdx < parsed.length; responseIdx++) {
    const item = parsed[responseIdx]
    if (!item || typeof item !== 'object') continue

    // Use the "i" field if present, otherwise fall back to the response position
    let idx: number
    if (typeof item.i === 'number') {
      idx = item.i
    } else if (typeof item.i === 'string' && item.i.trim()) {
      idx = parseInt(item.i, 10)
    } else {
      // LLM omitted "i" — assume responses are in the same order as inputs
      idx = responseIdx
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length) continue

    const score =
      typeof item.s === 'number' ? item.s : parseFloat(String(item.s))
    if (!Number.isFinite(score)) continue

    const positiveRatio =
      typeof item.p === 'number'
        ? item.p
        : parseFloat(String(item.p)) || 0.5

    const language = typeof item.l === 'string' ? item.l : 'en'
    const topQuote =
      typeof item.q === 'string' && item.q.trim() ? item.q.trim() : null

    // Match mentioned players by scanning content for tracked player names
    const content = batch[idx].content.toLowerCase()
    const mentionedPlayerIds: string[] = []
    for (const [nameLower, playerId] of playerNameIndex) {
      if (content.includes(nameLower)) {
        mentionedPlayerIds.push(playerId)
      }
    }

    results[idx] = {
      sentiment: Math.max(0, Math.min(100, Math.round(score))),
      positiveRatio: Math.max(0, Math.min(1, positiveRatio)),
      mentionedPlayerIds,
      topQuote,
      language,
    }
  }

  return results
}
