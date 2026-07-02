import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

/**
 * GET /api/fan-talk?teamCodes=ESP,KSA
 *
 * Public endpoint that powers the "What Fans Are Saying" UI panel on match
 * cards. Returns aggregated fan posts from admin-seeded FeedMonitors that
 * track the requested team codes.
 *
 * Response:
 *   {
 *     posts: FanTalkPost[],       // sorted by selected tab (popular/latest)
 *     sentimentSplit: { positive, neutral, negative },  // 0-100 each
 *     totalPosts: number,
 *     monitorLabel: string | null,
 *     lastUpdated: string | null,  // ISO timestamp of newest post
 *     freshnessLabel: string | null
 *   }
 *
 * This endpoint is the Fan Pulse equivalent of Google Search's
 * "What People Are Saying" panel — but purpose-built for World Cup 2026
 * with per-player sentiment, fan voting, and shareable Fan Cards.
 */

const MAX_POSTS = 8

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamCodesParam = searchParams.get('teamCodes') || ''
    const tab = (searchParams.get('tab') || 'popular') as 'popular' | 'latest'
    const teamCodes = teamCodesParam
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)

    if (teamCodes.length === 0) {
      return NextResponse.json({
        posts: [],
        sentimentSplit: { positive: 0, neutral: 0, negative: 0 },
        totalPosts: 0,
        monitorLabel: null,
        lastUpdated: null,
        freshnessLabel: null,
      })
    }

    const database = getDb()

    // Find monitors that track ANY of the requested team codes.
    // SQLite doesn't have native JSON array queries, so we fetch candidate
    // monitors (active or recently ended) and filter in JS by parsing the
    // teamCodes JSON field.
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000) // last 48h
    const candidateMonitors = await database.feedMonitor.findMany({
      where: {
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Filter monitors that track at least one of the requested team codes
    const matchingMonitors = candidateMonitors.filter((m) => {
      try {
        const codes: string[] = JSON.parse(m.teamCodes)
        return codes.some((c) => teamCodes.includes(c.toUpperCase()))
      } catch {
        return false
      }
    })

    if (matchingMonitors.length === 0) {
      return NextResponse.json({
        posts: [],
        sentimentSplit: { positive: 0, neutral: 0, negative: 0 },
        totalPosts: 0,
        monitorLabel: null,
        lastUpdated: null,
        freshnessLabel: null,
      })
    }

    const monitorIds = matchingMonitors.map((m) => m.id)

    // Fetch posts from matching monitors
    const allPosts = await database.feedPost.findMany({
      where: { monitorId: { in: monitorIds } },
      orderBy: tab === 'latest' ? [{ postedAt: 'desc' }] : undefined,
      take: MAX_POSTS * 3, // over-fetch for popularity sort + sentiment stats
    })

    if (allPosts.length === 0) {
      return NextResponse.json({
        posts: [],
        sentimentSplit: { positive: 0, neutral: 0, negative: 0 },
        totalPosts: 0,
        monitorLabel: matchingMonitors[0]?.matchLabel ?? null,
        lastUpdated: null,
        freshnessLabel: null,
      })
    }

    // Compute sentiment split across ALL posts (not just the displayed subset)
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

    // Sort posts
    let sortedPosts = allPosts
    if (tab === 'popular') {
      // "Popular" = highest sentiment conviction (distance from 50) + recency bonus.
      // We don't have reliable engagement metrics from scrapers, so we use
      // sentiment extremity as a proxy for "notable" — posts that strongly
      // praise or criticize get surfaced first.
      sortedPosts = [...allPosts].sort((a, b) => {
        const aConviction = Math.abs(a.sentimentScore - 50)
        const bConviction = Math.abs(b.sentimentScore - 50)
        if (Math.abs(aConviction - bConviction) > 5) {
          return bConviction - aConviction
        }
        // Tie-break by recency
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

    // Find the newest post timestamp for freshness label
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
    })
  } catch (error) {
    console.error('Failed to fetch fan talk:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fan talk', posts: [] },
      { status: 500 },
    )
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
