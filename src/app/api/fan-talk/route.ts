import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  isFakeAuthor,
  fetchLiveFanTalk,
} from '@/lib/live-fan-talk'
import { NATIONAL_TEAMS } from '@/lib/national-teams'
import { findEPLTeam } from '@/lib/epl-teams'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/fan-talk?teamCodes=ESP,KSA
 *
 * Public endpoint that powers the "What Fans Are Saying" UI panel on match
 * cards. Returns aggregated fan posts for the requested team codes.
 *
 * ── ANTI-HALLUCINATION CONTRACT (enforced on EVERY GET) ────────────────────
 *
 * 1. DELETE every FeedPost whose author matches any pattern in
 *    FAKE_AUTHOR_PATTERNS. These are fabricated templated posts originally
 *    seeded by scripts/seed-fan-talk.ts (handles like @angry_supporter,
 *    u/tactical_nerd, "ESPN Match Report"). They are deleted, not merely
 *    filtered, so they cannot re-appear in any future request.
 *
 * 2. After deletion, if fewer than 3 real posts remain for the requested
 *    team codes, the route attempts a LIVE fetch via fetchLiveFanTalk()
 *    (z-ai-web-dev-sdk web_search + LLM scoring). Real posts always carry
 *    a real source URL with a real hostname (espn.com, aljazeera.com,
 *    reddit.com, youtube.com, etc.).
 *
 * 3. If the live fetch returns 0 posts (SDK down, rate-limited, or no
 *    results), the route returns { posts: [], ... } with an honest empty
 *    state. It NEVER falls back to serving fake templated posts.
 *
 * Response:
 *   {
 *     posts: FanTalkPost[],       // sorted by selected tab (popular/latest)
 *     sentimentSplit: { positive, neutral, negative },  // 0-100 each
 *     totalPosts: number,
 *     monitorLabel: string | null,
 *     lastUpdated: string | null,  // ISO timestamp of newest post
 *     freshnessLabel: string | null,
 *     liveFetchAttempted: boolean, // true if fetchLiveFanTalk was called
 *     liveFetchError: string | null // human-readable error if fetch failed
 *   }
 */

const MAX_POSTS = 8
/** Minimum real posts required to skip the live fetch attempt. */
const MIN_REAL_POSTS_BEFORE_FETCH = 3

export async function GET(request: NextRequest) {
  try {
    // ── H1: Rate limit FIRST (20/min/IP) ──────────────────────────────────
    // fan-talk triggers a z-ai-web-dev-sdk web_search + LLM scoring call when
    // real posts are scarce. Without a rate limit, an attacker can exhaust the
    // SDK quota (observed 429s on /api/fetch-live-matches) and amplify costs.
    // 20/min is generous for browsing (one user clicking through matches) but
    // blocks scripted abuse.
    const ip = getClientIp(request)
    const rl = rateLimit(`fan-talk:${ip}`, 20, 60_000)
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }

    const { searchParams } = new URL(request.url)
    const teamCodesParam = searchParams.get('teamCodes') || ''
    const tab = (searchParams.get('tab') || 'popular') as 'popular' | 'latest'
    // matchId is parsed from the query so posts can be scoped to THIS match
    // only — preventing posts from a different match (that shares a team code)
    // from bleeding in. e.g. ESP vs ARG and ESP vs FRA would otherwise share
    // the same ESP-related posts.
    const matchId = searchParams.get('matchId') || null
    const teamCodes = teamCodesParam
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)

    // ── H1: Validate teamCodes BEFORE any SDK call ────────────────────────
    // Previously, arbitrary teamCodes (5000-char strings, nonexistent teams)
    // were passed straight to fetchLiveFanTalk → 5-6s SDK call per request.
    // Now: max 2 codes, each exactly 3 letters, must exist in NATIONAL_TEAMS
    // OR in EPL_TEAMS (for club matches — EPL team codes like ARS, CHE, LIV).
    // Invalid input returns 400 instantly with zero SDK cost.
    if (teamCodes.length === 0) {
      return NextResponse.json(
        { error: 'teamCodes must contain 1-2 codes' },
        { status: 400 },
      )
    }
    if (teamCodes.length > 2) {
      return NextResponse.json(
        { error: 'teamCodes must contain 1-2 codes' },
        { status: 400 },
      )
    }
    for (const code of teamCodes) {
      if (!/^[A-Z]{3}$/.test(code)) {
        return NextResponse.json(
          { error: `Invalid teamCode format: ${code.slice(0, 20)}` },
          { status: 400 },
        )
      }
      // Accept BOTH national team codes (WC) AND EPL club codes (ARS, CHE, etc.)
      const isNationalTeam = NATIONAL_TEAMS.find((t) => t.code === code)
      const isEplTeam = findEPLTeam(code)
      if (!isNationalTeam && !isEplTeam) {
        return NextResponse.json(
          { error: `Unknown team code: ${code}` },
          { status: 400 },
        )
      }
    }

    const database = getDb()

    // ── 1. PURGE fake-author posts on EVERY GET ────────────────────────────
    // This is a defensive delete that runs unconditionally. It catches:
    //   - legacy seeded fake posts that survived the one-off purge script
    //   - any future accidental seeding of fake authors
    // We delete posts whose author matches any FAKE_AUTHOR_PATTERNS entry.
    // SQLite doesn't support regex in WHERE, so we fetch candidate authors
    // and filter in JS. Authors are short strings, so this is cheap.
    await purgeFakeAuthorPosts(database)

    // ── 2. Find matching monitors for these team codes ─────────────────────
    // When matchId is provided, we scope to monitors with that EXACT matchId
    // first — this is the per-match filter that prevents posts from a
    // different match (sharing a team code) from bleeding in. If no
    // matchId-scoped monitor exists yet, we fall back to the team-code
    // overlap query (legacy behavior) so the live fetch below can create a
    // matchId-scoped monitor.
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000) // last 48h
    const candidateMonitors = await database.feedMonitor.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const matchingMonitors = candidateMonitors.filter((m) => {
      // ── matchId scoping (preferred when provided) ──────────────────────
      // If matchId is set, ONLY match monitors that have the SAME matchId
      // (or null matchId on legacy monitors — those still match by team code
      // so the live fetch can later create a properly-scoped monitor).
      if (matchId) {
        if (m.matchId && m.matchId !== matchId) return false
      }
      try {
        const codes: string[] = JSON.parse(m.teamCodes)
        return codes.some((c) => teamCodes.includes(c.toUpperCase()))
      } catch {
        return false
      }
    })

    // ── matchId-scoped filter (strongest guarantee) ───────────────────────
    // When matchId is provided, prefer monitors that have the EXACT matchId
    // set. If any exist, use ONLY those (drop legacy null-matchId monitors
    // so we don't mix in posts from a different match that shares a team code).
    let monitorIds: string[]
    if (matchId) {
      const scoped = matchingMonitors.filter((m) => m.matchId === matchId)
      monitorIds = scoped.length > 0
        ? scoped.map((m) => m.id)
        : matchingMonitors.map((m) => m.id)
    } else {
      monitorIds = matchingMonitors.map((m) => m.id)
    }

    const realPostCount =
      monitorIds.length > 0
        ? await database.feedPost.count({
            where: { monitorId: { in: monitorIds } },
          })
        : 0

    // ── 4. Attempt live fetch if too few real posts ────────────────────────
    let liveFetchAttempted = false
    let liveFetchError: string | null = null
    if (realPostCount < MIN_REAL_POSTS_BEFORE_FETCH) {
      liveFetchAttempted = true
      console.log(
        `[fan-talk] Only ${realPostCount} real posts for ${teamCodes.join(',')} (matchId=${matchId ?? 'none'}) — attempting live fetch`,
      )
      try {
        // Pass matchId so any newly-created FeedMonitor is scoped to THIS
        // match — future requests with the same matchId will then read
        // only this match's posts, not posts from other matches sharing
        // a team code.
        const result = await fetchLiveFanTalk(database, teamCodes, { matchId: matchId ?? undefined })
        if (result.error) {
          liveFetchError = result.error
        }
        // The fetch may have created a new monitor — re-query monitors.
        // If matchId was provided, prefer the matchId-scoped monitor.
        if (result.monitorId) {
          const refreshed = await database.feedMonitor.findUnique({
            where: { id: result.monitorId },
          })
          if (refreshed && !monitorIds.includes(refreshed.id)) {
            // If we have a matchId and the refreshed monitor is scoped to
            // it, REPLACE the monitor list with just this one — the per-match
            // filter is now in effect.
            if (matchId && refreshed.matchId === matchId) {
              monitorIds = [refreshed.id]
            } else {
              monitorIds.push(refreshed.id)
            }
          }
        }
        console.log(
          `[fan-talk] Live fetch: +${result.newPosts} new posts (${result.durationMs}ms)`,
        )
      } catch (err) {
        console.error(`[fan-talk] fetchLiveFanTalk threw:`, err)
        // H3: don't leak SDK/internal error details to the client.
        liveFetchError = process.env.NODE_ENV === 'production'
          ? 'Live fetch failed'
          : `Live fetch failed: ${String(err)}`
      }
    }

    // ── 5. If still no monitors, return honest empty state ─────────────────
    if (monitorIds.length === 0) {
      return NextResponse.json({
        ...emptyResponse(),
        liveFetchAttempted,
        liveFetchError,
      })
    }

    // ── 6. Fetch real posts from matching monitors ─────────────────────────
    let allPosts = await database.feedPost.findMany({
      where: { monitorId: { in: monitorIds } },
      orderBy: tab === 'latest' ? [{ postedAt: 'desc' }] : undefined,
      take: MAX_POSTS * 4, // over-fetch for popularity sort + sentiment stats
    })

    // ── 7. Defensive filter (block messages, fake authors, short content) ──
    // The purge above should have removed fake authors, but we filter again
    // here as a belt-and-suspenders safety net (in case a fake-author row
    // was inserted between purge and this read).
    allPosts = allPosts.filter((p) => {
      if (isFakeAuthor(p.author)) return false
      const content = p.content || ''
      if (content.length < 40) return false
      const lower = content.toLowerCase()
      return !BLOCK_PATTERNS.some((pat) => lower.includes(pat))
    })

    // ── 8. Honest empty state if no real posts remain ──────────────────────
    if (allPosts.length === 0) {
      const monitorLabel =
        (matchingMonitors[0]?.matchLabel) ??
        (await database.feedMonitor.findUnique({
          where: { id: monitorIds[0] },
          select: { matchLabel: true },
        }))?.matchLabel ??
        null
      return NextResponse.json({
        ...emptyResponse(),
        monitorLabel,
        liveFetchAttempted,
        liveFetchError: liveFetchError ?? (liveFetchAttempted ? 'No posts found' : null),
      })
    }

    // ── 9. Compute sentiment split across ALL real posts ───────────────────
    const totalForStats = allPosts.length
    let positive = 0
    let neutral = 0
    let negative = 0
    for (const p of allPosts) {
      if (p.sentimentScore >= 65) positive++
      else if (p.sentimentScore <= 35) negative++
      else neutral++
    }
    const sentimentSplit = {
      positive: totalForStats > 0 ? Math.round((positive / totalForStats) * 100) : 0,
      neutral: totalForStats > 0 ? Math.round((neutral / totalForStats) * 100) : 0,
      negative: totalForStats > 0 ? Math.round((negative / totalForStats) * 100) : 0,
    }

    // ── 10. Sort posts ─────────────────────────────────────────────────────
    let sortedPosts = allPosts
    if (tab === 'popular') {
      sortedPosts = [...allPosts].sort((a, b) => {
        const aHasQuote = a.topQuote ? 1 : 0
        const bHasQuote = b.topQuote ? 1 : 0
        if (aHasQuote !== bHasQuote) return bHasQuote - aHasQuote
        const aConviction = Math.abs(a.sentimentScore - 50)
        const bConviction = Math.abs(b.sentimentScore - 50)
        if (Math.abs(aConviction - bConviction) > 5) {
          return bConviction - aConviction
        }
        return b.postedAt.getTime() - a.postedAt.getTime()
      })
    }

    const displayPosts = sortedPosts.slice(0, MAX_POSTS).map((p) => ({
      id: p.id,
      platform: p.platform,
      author: p.author || (p.platform === 'reddit' ? 'r/soccer' : 'fan'),
      content: truncate(p.content, 180),
      topQuote: p.topQuote,
      sentimentScore: Math.round(p.sentimentScore),
      sentimentLabel: getSentimentLabel(p.sentimentScore),
      postedAt: p.postedAt.toISOString(),
      timeLabel: getRelativeTime(p.postedAt),
      url: p.url,
    }))

    const newestPost = allPosts.reduce(
      (latest, p) => (p.postedAt > latest ? p.postedAt : latest),
      allPosts[0].postedAt,
    )

    return NextResponse.json({
      posts: displayPosts,
      sentimentSplit,
      totalPosts: allPosts.length,
      monitorLabel: matchingMonitors[0]?.matchLabel ?? null,
      lastUpdated: newestPost.toISOString(),
      freshnessLabel: getRelativeTime(newestPost),
      liveFetchAttempted,
      liveFetchError,
    })
  } catch (error) {
    console.error('Failed to fetch fan talk:', error)
    return NextResponse.json(
      {
        ...emptyResponse(),
        error: 'Failed to fetch fan talk',
        liveFetchAttempted: false,
        liveFetchError: null,
      },
      { status: 500 },
    )
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyResponse() {
  return {
    posts: [],
    sentimentSplit: { positive: 0, neutral: 0, negative: 0 },
    totalPosts: 0,
    monitorLabel: null,
    lastUpdated: null,
    freshnessLabel: null,
    liveFetchAttempted: false,
    liveFetchError: null as string | null,
  }
}

/**
 * Delete every FeedPost whose author matches any FAKE_AUTHOR_PATTERNS entry.
 * Runs on every GET request as a defensive cleanup. Cheap because:
 *   - We only scan FeedPosts created in the last 7 days (cutoff)
 *   - Authors are short strings, JS-side filter is fast
 */
async function purgeFakeAuthorPosts(database: ReturnType<typeof getDb>): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  // Fetch candidate posts (id + author only) created in the last 7 days.
  // This bounds the scan even if the table grows large.
  const candidates = await database.feedPost.findMany({
    where: { analyzedAt: { gte: cutoff } },
    select: { id: true, author: true },
    take: 5000,
  })
  const fakeIds = candidates.filter((p) => isFakeAuthor(p.author)).map((p) => p.id)
  if (fakeIds.length === 0) return
  // Delete in batches of 200 to avoid SQLite param limits
  for (let i = 0; i < fakeIds.length; i += 200) {
    const batch = fakeIds.slice(i, i + 200)
    await database.feedPost.deleteMany({ where: { id: { in: batch } } })
  }
  console.log(`[fan-talk] Purged ${fakeIds.length} fake-author posts`)
}

const BLOCK_PATTERNS = [
  'blocked by network security',
  'log into instagram',
  'please enable javascript',
  'access denied',
  'attention required',
  'enable javascript and cookies',
  'are you a robot',
  'unusual traffic',
  'sorry, you have been blocked',
  'checking your browser',
  'cloudflare',
  'please verify you are a human',
  'request blocked',
  'see everyday moments from your close friends',
]

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).trimEnd() + '…'
}

function getSentimentLabel(score: number): 'positive' | 'neutral' | 'negative' {
  if (score >= 65) return 'positive'
  if (score <= 35) return 'negative'
  return 'neutral'
}

function getRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
