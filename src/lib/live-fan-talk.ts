/**
 * Live Fan Talk — on-demand real social post fetcher for the "What Fans Are
 * Saying" panel.
 *
 * This module is the SINGLE SOURCE OF TRUTH for:
 *   1. The list of fabricated/templated author patterns that must never be
 *      shown to users (FAKE_AUTHOR_PATTERNS). These originated from
 *      scripts/seed-fan-talk.ts which seeded boilerplate posts under fake
 *      handles like @angry_supporter, u/tactical_nerd, "ESPN Match Report".
 *   2. fetchLiveFanTalk() — an on-demand SDK fetch (web_search + LLM score)
 *      used by /api/fan-talk when fewer than 3 real posts remain in the DB.
 *
 * CRITICAL CONTRACT:
 *   - fetchLiveFanTalk NEVER fabricates posts. If the SDK is down, rate-
 *     limited, or returns no results, it returns { newPosts: 0, error? }.
 *   - The caller (the API route) MUST honor that and render an honest empty
 *     state — never fall back to fake templated content.
 *   - Posts saved by fetchLiveFanTalk always carry a REAL source URL with a
 *     real hostname (espn.com, aljazeera.com, reddit.com, youtube.com, etc.)
 *     because they come from web_search results.
 */

import ZAI from 'z-ai-web-dev-sdk'
import type { PrismaClient } from '@prisma/client'
import { searchXPosts } from './grok-x-search'
import { scorePostBatch } from './groq-sentiment'

// ── Fake author detection ────────────────────────────────────────────────────

/**
 * Patterns that identify fabricated seed/demo posts. Any FeedPost whose
 * `author` matches ANY of these is considered fake and MUST be:
 *   - deleted from the DB on every API GET (not just filtered)
 *   - excluded from any new live fetch
 *
 * These patterns are anchored to the exact handles invented in
 * scripts/seed-fan-talk.ts. The "r/soccer · u/" and "r/worldcup · u/"
 * patterns catch the generic templated format too — every seeded reddit
 * post used that exact "· u/<handle>" shape.
 */
export const FAKE_AUTHOR_PATTERNS: readonly (string | RegExp)[] = [
  '@angry_supporter',
  '@football_daily',
  '@neutral_watcher',
  'u/tactical_nerd',
  'u/happy_gooner',
  'u/disappointed_fan',
  'u/stat_lover',
  'espn match report',
  // Templated "subreddit · u/handle" format invented by seed-fan-talk.ts.
  // Catches all the r/soccer · u/... and r/worldcup · u/... variants.
  /^r\/soccer\s*·\s*u\//i,
  /^r\/worldcup\s*·\s*u\//i,
  // Defensive: any author with the exact "· u/" separator pattern that
  // the seed script used. Real Reddit handles from the live SDK come as
  // bare "u/username" or "/u/username" without the "r/subreddit · " prefix
  // glued in by the seed templater.
  /^r\/[a-z]+\s*·\s*u\//i,
]

/**
 * Returns true if the given author string matches any FAKE_AUTHOR_PATTERNS.
 * Case-insensitive for string patterns; regex patterns use their own flags.
 */
export function isFakeAuthor(author: string | null | undefined): boolean {
  if (!author) return false
  const lower = author.toLowerCase()
  return FAKE_AUTHOR_PATTERNS.some((p) => {
    if (typeof p === 'string') return lower.includes(p.toLowerCase())
    return p.test(author)
  })
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  topQuote: string | null
  language: string
}

export interface FetchLiveFanTalkResult {
  /** ID of the FeedMonitor that owns the saved posts (created or reused). */
  monitorId: string
  /** Number of NEW posts persisted to the DB by this call. */
  newPosts: number
  /** Number of posts that were skipped because their URL already existed. */
  skippedDuplicates: number
  /** Number of scraped results rejected (block message, fake author, etc). */
  rejected: number
  /** Human-readable error if the SDK was unavailable or all calls failed. */
  error?: string
  /** How long the fetch took, in milliseconds. */
  durationMs: number
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum interval between live fetches for the SAME set of team codes.
 * Prevents the SDK from being hammered when many users click the same card
 * in quick succession. If a monitor was refreshed less than this ago, the
 * fetch short-circuits and returns { newPosts: 0 } without calling the SDK.
 */
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/** Hard cap on posts persisted per fetch — controls LLM cost + DB write load. */
const MAX_POSTS_PER_FETCH = 8

/** Truncate post content to this length before LLM scoring / DB storage. */
const MAX_CONTENT_LENGTH = 1200

/**
 * Delay between SDK calls. The z-ai SDK enforces ~10 req/min on the free
 * tier; we keep this conservative to avoid 429s on the on-demand path.
 */
const SDK_CALL_DELAY_MS = 1200

/** Cap enrichment (page_reader) to top N scrape-friendly results for speed. */
const MAX_PAGE_READER_CALLS = 3

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Parse an ISO date string defensively; returns `now` on failure. */
function safeParseDate(s: string): Date {
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date() : d
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Attempt a LIVE fetch of real social/news posts for the given team codes.
 *
 * Flow:
 *   1. Find or create a FeedMonitor for these teamCodes (status=active).
 *      When `matchId` is provided, the monitor is scoped to THAT match
 *      only — preventing posts from a different match (sharing a team
 *      code) from bleeding in.
 *   2. If the monitor was refreshed less than MIN_REFRESH_INTERVAL_MS ago,
 *      short-circuit and return { newPosts: 0 } — the cached DB posts are
 *      still fresh.
 *   3. Fetch REAL X (Twitter) posts via the xAI Responses API x_search tool
 *      (src/lib/grok-x-search.ts). These posts come straight from X's own
 *      data — no scraping. Each carries a real https://x.com/<h>/status/<id>
 *      URL, real handle, verbatim content, and a timestamp.
 *   4. ALSO call z-ai-web-dev-sdk web_search for additional Reddit + news
 *      coverage (2 queries). For each result, take the title + snippet as
 *      the post content. For scrape-friendly news domains, optionally enrich
 *      via page_reader (capped at MAX_PAGE_READER_CALLS for speed).
 *   5. Reject posts whose author matches FAKE_AUTHOR_PATTERNS, whose content
 *      is a known anti-bot block message, or whose content is too short.
 *   6. De-duplicate against existing FeedPosts by URL.
 *   7. Score the new posts in a single batch via Groq (fast/cheap), with a
 *      Z.ai SDK fallback (src/lib/groq-sentiment.ts).
 *   8. Persist each new FeedPost row.
 *   9. Update monitor.lastRefreshedAt.
 *
 * This function NEVER fabricates posts. On any SDK failure or empty result
 * set, it returns { newPosts: 0, error? } and the caller MUST render an
 * honest empty state.
 *
 * @param database  PrismaClient (from getDb() in API routes)
 * @param teamCodes e.g. ["ESP","AUT"]
 * @param options.matchId  Optional Match.id — when set, the FeedMonitor is
 *   scoped to this match so posts don't bleed across matches sharing a
 *   team code.
 */
export async function fetchLiveFanTalk(
  database: PrismaClient,
  teamCodes: string[],
  options?: { matchId?: string },
): Promise<FetchLiveFanTalkResult> {
  const startedAt = Date.now()
  const codes = teamCodes.map((c) => c.toUpperCase()).filter(Boolean)
  const matchId = options?.matchId
  if (codes.length === 0) {
    return {
      monitorId: '',
      newPosts: 0,
      skippedDuplicates: 0,
      rejected: 0,
      error: 'No team codes provided',
      durationMs: Date.now() - startedAt,
    }
  }

  // ── 1. Find or create a FeedMonitor for these team codes ───────────────
  // When matchId is provided, look for an existing monitor scoped to that
  // matchId first. Only if none exists do we fall back to a team-code-only
  // match (and then create a new matchId-scoped monitor if still none).
  const matchLabel = `${codes.join(' vs ')} — WC 2026`
  const teamCodesJson = JSON.stringify(codes)

  let monitor = matchId
    ? await findMonitorForCodes(database, codes, matchId)
    : await findMonitorForCodes(database, codes)
  if (!monitor) {
    monitor = await database.feedMonitor.create({
      data: {
        matchLabel,
        matchId: matchId ?? null,
        teamCodes: teamCodesJson,
        playerIds: JSON.stringify([]),
        hashtags: JSON.stringify(codes.map((c) => `#${c}`).concat(['#WorldCup2026'])),
        seedUrls: JSON.stringify([]),
        status: 'active',
        refreshInterval: 5,
        lastRefreshedAt: null,
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
    console.log(`[live-fan-talk] Created monitor ${monitor.id} for ${matchLabel} (matchId=${matchId ?? 'none'})`)
  }

  // ── 2. Short-circuit if refreshed too recently ─────────────────────────
  if (monitor.lastRefreshedAt) {
    const ageMs = Date.now() - monitor.lastRefreshedAt.getTime()
    if (ageMs < MIN_REFRESH_INTERVAL_MS) {
      console.log(
        `[live-fan-talk] Monitor ${monitor.id} refreshed ${Math.round(ageMs / 1000)}s ago — skipping SDK call`,
      )
      return {
        monitorId: monitor.id,
        newPosts: 0,
        skippedDuplicates: 0,
        rejected: 0,
        durationMs: Date.now() - startedAt,
      }
    }
  }

  // ── 3. Fetch REAL X (Twitter) posts via xAI Responses API x_search ─────
  // This is the primary social-media source. The x_search tool calls X's
  // own keyword + semantic search and returns real post URLs, handles,
  // verbatim text, and timestamps. No scraping, no login walls.
  const scraped: ScrapedPost[] = []
  let rejected = 0
  let xSearchError: string | undefined

  try {
    console.log(`[live-fan-talk] xAI X-Search for ${matchLabel}`)
    const xResult = await searchXPosts(codes, { matchLabel })
    console.log(
      `[live-fan-talk] X-Search: ${xResult.posts.length} posts in ${xResult.durationMs}ms` +
        (xResult.error ? ` (error: ${xResult.error})` : ''),
    )
    if (xResult.error) xSearchError = xResult.error
    for (const p of xResult.posts) {
      if (scraped.length >= MAX_POSTS_PER_FETCH) break
      // X posts are never block messages and never match FAKE_AUTHOR_PATTERNS
      // (which target seeded templated handles). But we still validate.
      if (isFakeAuthor(p.handle)) {
        rejected++
        continue
      }
      const postedAt = p.postedAt ? safeParseDate(p.postedAt) : new Date()
      scraped.push({
        url: p.url,
        platform: 'twitter',
        author: `@${p.handle}`,
        content: p.text.slice(0, MAX_CONTENT_LENGTH),
        postedAt,
      })
    }
  } catch (err) {
    xSearchError = `X-Search threw: ${String(err).slice(0, 200)}`
    console.warn(`[live-fan-talk] ${xSearchError}`)
  }

  // ── 3b. Initialize Z.ai SDK (needed for web_search + sentiment fallback) ─
  let zai: any
  try {
    zai = await ZAI.create()
  } catch (err) {
    // If X-Search already gave us posts, we can still proceed — we just
    // won't have Reddit/news coverage. Sentiment scoring will use Groq.
    console.warn(`[live-fan-talk] SDK init failed: ${String(err)}`)
    zai = null
  }

  // ── 4. Build search queries for additional Reddit + news coverage ──────
  const queries = buildLiveSearchQueries(codes)

  console.log(
    `[live-fan-talk] Fetching for ${matchLabel} — ${queries.length} web queries`,
  )

  for (const query of queries) {
    if (scraped.length >= MAX_POSTS_PER_FETCH) break
    if (!zai) {
      console.log(`[live-fan-talk] SDK unavailable — skipping web_search`)
      break
    }
    try {
      await sleep(SDK_CALL_DELAY_MS)
      console.log(`[live-fan-talk] web_search: "${query}"`)
      const searchResults = (await zai.functions.invoke('web_search', {
        query,
        num: 10,
      })) as any[]

      if (!Array.isArray(searchResults)) {
        console.log(`[live-fan-talk] web_search returned non-array, skipping`)
        continue
      }
      console.log(`[live-fan-talk] Got ${searchResults.length} results`)

      let pageReaderCalls = 0
      for (const result of searchResults) {
        if (scraped.length >= MAX_POSTS_PER_FETCH) break
        if (!result?.url) continue

        const url = String(result.url)
        const domain = extractDomain(url)
        const platform = detectPlatform(url)

        // ── Baseline content = title + snippet (always available) ───────
        const snippet = String(result.snippet || result.description || result.summary || '').trim()
        const title = String(result.name || result.title || '').trim()
        let content = [title, snippet].filter(Boolean).join(' — ')
        if (!content || content.length < 40) {
          rejected++
          continue
        }

        // ── Optional enrichment for scrape-friendly news domains ────────
        // Skip social media (reddit/x) — page_reader returns block pages.
        if (
          isScrapeFriendlyDomain(domain) &&
          pageReaderCalls < MAX_PAGE_READER_CALLS
        ) {
          try {
            await sleep(SDK_CALL_DELAY_MS)
            pageReaderCalls++
            const pageData = await zai.functions.invoke('page_reader', { url })
            const rawContent =
              pageData?.data?.html ||
              pageData?.data?.content ||
              (typeof pageData === 'string' ? pageData : '')
            if (rawContent && rawContent.length > 200 && !isBlockMessage(rawContent)) {
              const fullText = stripHtml(rawContent).slice(0, MAX_CONTENT_LENGTH)
              if (fullText.length > content.length) {
                content = fullText
              }
            }
          } catch (pageErr) {
            if (String(pageErr).includes('429')) {
              console.log(`[live-fan-talk] 429 on page_reader, waiting 4s...`)
              await sleep(4000)
            }
            // snippet is still our fallback
          }
        }

        // ── Reddit .json enrichment (free, not blocked) ─────────────────
        if (platform === 'reddit' && url.includes('reddit.com/r/')) {
          try {
            const jsonUrl = url.replace(/\/?$/, '.json')
            await sleep(SDK_CALL_DELAY_MS)
            const redditData = await zai.functions.invoke('page_reader', { url: jsonUrl })
            const redditJson =
              redditData?.data?.html ||
              redditData?.data?.content ||
              (typeof redditData === 'string' ? redditData : '')
            const extracted = extractRedditContent(redditJson)
            if (extracted && extracted.length > content.length && !isBlockMessage(extracted)) {
              content = extracted
            }
          } catch {
            // JSON fetch failed — snippet still our fallback
          }
        }

        // ── Final safety: block message check ───────────────────────────
        if (isBlockMessage(content)) {
          rejected++
          continue
        }

        // ── Author extraction (real, from search result metadata) ───────
        let author =
          String(result.author || result.source || result.host_name || domain || '').trim()
        // If still empty, derive from domain (e.g. "espn.com")
        if (!author) author = domain

        // ── Reject if the author looks fabricated (defensive) ───────────
        // Real web_search results won't match FAKE_AUTHOR_PATTERNS, but we
        // check anyway to guarantee the contract.
        if (isFakeAuthor(author)) {
          rejected++
          continue
        }

        // ── Parse posted date (best-effort) ─────────────────────────────
        let postedAt = new Date()
        if (result.datePublished || result.date) {
          const d = new Date(result.datePublished || result.date)
          if (!isNaN(d.getTime())) postedAt = d
        }

        scraped.push({
          url,
          platform,
          author,
          content: content.slice(0, MAX_CONTENT_LENGTH),
          postedAt,
        })
      }
    } catch (searchErr) {
      const msg = String(searchErr)
      console.warn(`[live-fan-talk] web_search failed: ${msg}`)
      if (msg.includes('429')) {
        console.log(`[live-fan-talk] 429 on web_search, waiting 5s...`)
        await sleep(5000)
      }
      // Continue to next query — don't abort the whole fetch
    }
  }

  console.log(
    `[live-fan-talk] Scraped ${scraped.length} posts, rejected ${rejected}`,
  )

  // ── 5. De-duplicate against existing FeedPosts (by URL) ────────────────
  const existingUrls = new Set(
    (
      await database.feedPost.findMany({
        where: { url: { in: scraped.map((p) => p.url) } },
        select: { url: true },
      })
    ).map((p) => p.url),
  )

  const newPosts = scraped.filter((p) => {
    if (existingUrls.has(p.url)) return false
    return true
  })
  const skippedDuplicates = scraped.length - newPosts.length

  // ── 6. Score the new posts via Groq (fast/cheap) with Z.ai SDK fallback ──
  let savedCount = 0
  if (newPosts.length > 0) {
    const { analyses, provider, error: scoreErr } = await scorePostBatch(
      newPosts.map((p) => ({ content: p.content })),
    )
    console.log(
      `[live-fan-talk] Sentiment scoring via ${provider}` +
        (scoreErr ? ` (${scoreErr})` : ''),
    )
    for (let i = 0; i < newPosts.length; i++) {
      const post = newPosts[i]
      const analysis = analyses[i]
      try {
        await database.feedPost.create({
          data: {
            monitorId: monitor.id,
            platform: post.platform,
            url: post.url,
            author: post.author,
            content: post.content,
            language: analysis?.language || 'en',
            sentimentScore: analysis?.sentiment ?? 50,
            positiveRatio: analysis?.positiveRatio ?? 0.5,
            mentionedPlayers: JSON.stringify([]),
            topQuote: analysis?.topQuote ?? null,
            postedAt: post.postedAt,
            analyzedAt: new Date(),
          },
        })
        savedCount++
      } catch (dbErr) {
        // Likely a race condition (URL inserted concurrently) — skip
        console.warn(`[live-fan-talk] feedPost.create failed for ${post.url}: ${String(dbErr)}`)
      }
    }
  }

  // ── 7. Update monitor.lastRefreshedAt ──────────────────────────────────
  await database.feedMonitor.update({
    where: { id: monitor.id },
    data: { lastRefreshedAt: new Date() },
  })

  const result: FetchLiveFanTalkResult = {
    monitorId: monitor.id,
    newPosts: savedCount,
    skippedDuplicates,
    rejected,
    durationMs: Date.now() - startedAt,
  }
  if (savedCount === 0 && scraped.length === 0) {
    result.error = xSearchError
      ? `No posts found (X-Search: ${xSearchError})`
      : 'No usable results from any source'
  }
  console.log(
    `[live-fan-talk] Done in ${result.durationMs}ms — saved ${savedCount}, dup ${skippedDuplicates}, rejected ${rejected}`,
  )
  return result
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Find a FeedMonitor whose teamCodes JSON array contains exactly the same
 * set of codes (order-independent). Returns null if none found.
 *
 * When `matchId` is provided, the search PREFERS monitors scoped to that
 * exact matchId. If a matchId-scoped monitor exists, it's returned. Only
 * if no matchId-scoped monitor exists do we return a team-code-only match
 * (so the caller can later create a properly-scoped monitor).
 */
async function findMonitorForCodes(
  database: PrismaClient,
  codes: string[],
  matchId?: string,
): Promise<{ id: string; lastRefreshedAt: Date | null } | null> {
  // Look at monitors created in the last 7 days to bound the scan.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const candidates = await database.feedMonitor.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { id: true, teamCodes: true, lastRefreshedAt: true, matchId: true },
    take: 50,
    orderBy: { createdAt: 'desc' },
  })
  const targetSet = new Set(codes.map((c) => c.toUpperCase()))

  // Pass 1: when matchId is set, prefer monitors scoped to that matchId.
  if (matchId) {
    for (const m of candidates) {
      if (m.matchId !== matchId) continue
      try {
        const arr = JSON.parse(m.teamCodes) as string[]
        if (Array.isArray(arr) && arr.length === targetSet.size) {
          const arrSet = new Set(arr.map((c) => String(c).toUpperCase()))
          let match = true
          for (const c of targetSet) {
            if (!arrSet.has(c)) {
              match = false
              break
            }
          }
          if (match) {
            return { id: m.id, lastRefreshedAt: m.lastRefreshedAt }
          }
        }
      } catch {
        // malformed JSON — skip
      }
    }
    // No matchId-scoped monitor found — fall through to team-code-only match
    // so the caller can still find a legacy monitor (and create a scoped one
    // for next time). Return null to force creation of a scoped monitor.
    return null
  }

  // Pass 2 (no matchId): original team-code-only matching.
  for (const m of candidates) {
    try {
      const arr = JSON.parse(m.teamCodes) as string[]
      if (Array.isArray(arr) && arr.length === targetSet.size) {
        const arrSet = new Set(arr.map((c) => String(c).toUpperCase()))
        let match = true
        for (const c of targetSet) {
          if (!arrSet.has(c)) {
            match = false
            break
          }
        }
        if (match) {
          return { id: m.id, lastRefreshedAt: m.lastRefreshedAt }
        }
      }
    } catch {
      // malformed JSON — skip
    }
  }
  return null
}

/**
 * Build 1-2 search queries from team codes. We keep this minimal for the
 * on-demand path (vs. the cron path in feed-sentiment.ts which builds 3).
 */
function buildLiveSearchQueries(codes: string[]): string[] {
  const queries: string[] = []
  const label = `${codes.join(' vs ')} World Cup 2026`
  // Query 1: Match + "fan reaction" — catches news + reddit threads
  queries.push(`"${label}" fan reaction`)
  // Query 2: Reddit-focused tactical discussion
  if (codes.length >= 2) {
    queries.push(`"${codes.join(' vs ')}" site:reddit.com soccer`)
  }
  return queries.slice(0, 2)
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function detectPlatform(url: string): 'twitter' | 'reddit' | 'instagram' | 'youtube' | 'facebook' | 'tiktok' | 'web' {
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('x.com') || url.includes('twitter.com')) return 'twitter'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'web'
}

const SCRAPE_FRIENDLY_DOMAINS: readonly string[] = [
  'yahoo.com',
  'espn.com',
  'espn.co.uk',
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
  'sportskeeda.com',
  'essentiallysports.com',
  'aljazeera.com',
  'bleacherreport.com',
  'thesun.co.uk',
  'dailymail.co.uk',
  'mirror.co.uk',
  'independent.co.uk',
  'telegraph.co.uk',
  'nytimes.com',
  'washingtonpost.com',
  'cnn.com',
]

function isScrapeFriendlyDomain(domain: string): boolean {
  if (!domain) return false
  return SCRAPE_FRIENDLY_DOMAINS.some(
    (d) => domain === d || domain.endsWith('.' + d),
  )
}

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

function isBlockMessage(content: string): boolean {
  if (!content) return true
  const lower = content.toLowerCase()
  return BLOCK_MESSAGE_PATTERNS.some((p) => lower.includes(p))
}

function stripHtml(html: string): string {
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

/**
 * Extract post title + body + top comment from a Reddit .json API response.
 */
function extractRedditContent(rawJson: string): string {
  try {
    let jsonStr = rawJson
    if (jsonStr.includes('<')) {
      jsonStr = stripHtml(jsonStr)
    }
    const parsed = JSON.parse(jsonStr)
    const postListing = Array.isArray(parsed) ? parsed[0] : parsed
    const postData = postListing?.data?.children?.[0]?.data
    if (!postData) return ''
    const title = String(postData.title || '').trim()
    const body = String(postData.selftext || '').trim()
    const subreddit = String(
      postData.subreddit_name_prefixed || postData.subreddit || '',
    ).trim()
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
    return ''
  }
}

// ── LLM scoring ──────────────────────────────────────────────────────────────

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
 * LLM-score a batch of scraped posts in a single chat.completions call.
 * Returns analyses aligned with the input array (null on parse failure).
 */
async function scorePostBatchWithLLM(
  batch: ScrapedPost[],
  zai: any,
): Promise<(LLMAnalysisResult | null)[]> {
  const results: (LLMAnalysisResult | null)[] = new Array(batch.length).fill(null)
  if (batch.length === 0) return results

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
    console.warn(`[live-fan-talk] LLM call failed: ${String(err)}`)
    return results
  }

  if (!raw.trim()) return results

  let parsed: any[] = []
  try {
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    const arrayParsed = JSON.parse(cleaned)
    if (Array.isArray(arrayParsed)) {
      parsed = arrayParsed
    } else {
      parsed = [arrayParsed]
    }
  } catch {
    const lines = raw.split('\n').filter((l) => l.trim().startsWith('{'))
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line.trim()))
      } catch {
        // skip malformed line
      }
    }
  }

  for (let responseIdx = 0; responseIdx < parsed.length; responseIdx++) {
    const item = parsed[responseIdx]
    if (!item || typeof item !== 'object') continue
    let idx: number
    if (typeof item.i === 'number') {
      idx = item.i
    } else if (typeof item.i === 'string' && item.i.trim()) {
      idx = parseInt(item.i, 10)
    } else {
      idx = responseIdx
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length) continue

    const score = typeof item.s === 'number' ? item.s : parseFloat(String(item.s))
    if (!Number.isFinite(score)) continue
    const positiveRatio =
      typeof item.p === 'number' ? item.p : parseFloat(String(item.p)) || 0.5
    const language = typeof item.l === 'string' ? item.l : 'en'
    const topQuote =
      typeof item.q === 'string' && item.q.trim() ? item.q.trim() : null

    results[idx] = {
      sentiment: Math.max(0, Math.min(100, Math.round(score))),
      positiveRatio: Math.max(0, Math.min(1, positiveRatio)),
      topQuote,
      language,
    }
  }
  return results
}
