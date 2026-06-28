import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

/**
 * GET /api/admin/feed-monitor/[id]/posts
 *
 * Lists all FeedPosts for a monitor (paginated, newest first).
 * Used by the admin UI to inspect what posts were scraped + their sentiment scores.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

    const database = getDb()

    // Verify monitor exists
    const monitor = await database.feedMonitor.findUnique({
      where: { id },
      select: { id: true, matchLabel: true },
    })
    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    const [posts, total] = await Promise.all([
      database.feedPost.findMany({
        where: { monitorId: id },
        orderBy: { analyzedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          platform: true,
          url: true,
          author: true,
          content: true,
          language: true,
          sentimentScore: true,
          positiveRatio: true,
          mentionedPlayers: true,
          topQuote: true,
          postedAt: true,
          analyzedAt: true,
        },
      }),
      database.feedPost.count({ where: { monitorId: id } }),
    ])

    return NextResponse.json({
      monitor: { id: monitor.id, matchLabel: monitor.matchLabel },
      posts: posts.map((p) => ({
        ...p,
        mentionedPlayers: safeJsonParse<string[]>(p.mentionedPlayers, []),
        postedAt: p.postedAt.toISOString(),
        analyzedAt: p.analyzedAt.toISOString(),
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Failed to list posts:', error)
    return NextResponse.json({ error: 'Failed to list posts' }, { status: 500 })
  }
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
