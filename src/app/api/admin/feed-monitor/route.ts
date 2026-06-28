import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { refreshMonitor, endExpiredMonitors } from '@/lib/feed-sentiment'

/**
 * Feed Monitor Admin API
 *
 * GET    /api/admin/feed-monitor         — list all monitors
 * POST   /api/admin/feed-monitor         — create a new monitor
 *   body: { matchLabel, stageId?, teamCodes, playerIds, hashtags, seedUrls, refreshInterval, durationHours }
 *
 * POST   /api/admin/feed-monitor/[id]/refresh  — manual refresh trigger (also runs cron logic)
 * PATCH  /api/admin/feed-monitor/[id]          — update status (active | paused | ended)
 * DELETE /api/admin/feed-monitor/[id]          — delete monitor + all its posts
 * GET    /api/admin/feed-monitor/[id]/posts    — list posts for a monitor
 */

// ── GET: list all monitors ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const database = getDb()
    const monitors = await database.feedMonitor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { posts: true } },
      },
    })

    // Augment each monitor with parsed JSON fields + player sentiment summary
    const enriched = await Promise.all(
      monitors.map(async (m) => {
        const playerIds = safeJsonParse<string[]>(m.playerIds, [])
        const playerSentimentCount =
          playerIds.length > 0
            ? await database.playerSentiment.count({
                where: { playerId: { in: playerIds } },
              })
            : 0

        return {
          id: m.id,
          matchLabel: m.matchLabel,
          stageId: m.stageId,
          teamCodes: safeJsonParse<string[]>(m.teamCodes, []),
          playerIds,
          hashtags: safeJsonParse<string[]>(m.hashtags, []),
          seedUrls: safeJsonParse<string[]>(m.seedUrls, []),
          status: m.status,
          refreshInterval: m.refreshInterval,
          lastRefreshedAt: m.lastRefreshedAt?.toISOString() ?? null,
          endsAt: m.endsAt.toISOString(),
          createdAt: m.createdAt.toISOString(),
          postCount: m._count.posts,
          playerSentimentCount,
        }
      }),
    )

    return NextResponse.json({ monitors: enriched })
  } catch (error) {
    console.error('Failed to list feed monitors:', error)
    return NextResponse.json({ error: 'Failed to list monitors' }, { status: 500 })
  }
}

// ── POST: create a new monitor ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const body = await request.json()
    const {
      matchLabel,
      stageId,
      teamCodes,
      playerIds,
      hashtags,
      seedUrls,
      refreshInterval,
      durationHours,
    } = body || {}

    // Validate required fields
    if (!matchLabel || typeof matchLabel !== 'string' || matchLabel.trim().length < 3) {
      return NextResponse.json(
        { error: 'matchLabel is required (min 3 chars)' },
        { status: 400 },
      )
    }
    if (!Array.isArray(teamCodes) || teamCodes.length === 0) {
      return NextResponse.json(
        { error: 'teamCodes must be a non-empty array' },
        { status: 400 },
      )
    }
    if (!Array.isArray(hashtags) || hashtags.length === 0) {
      return NextResponse.json(
        { error: 'hashtags must be a non-empty array' },
        { status: 400 },
      )
    }
    if (!Array.isArray(playerIds)) {
      return NextResponse.json(
        { error: 'playerIds must be an array (can be empty)' },
        { status: 400 },
      )
    }

    const interval = Math.min(60, Math.max(1, Number(refreshInterval) || 5))
    const hours = Math.min(48, Math.max(1, Number(durationHours) || 6))
    const endsAt = new Date(Date.now() + hours * 3600 * 1000)

    const database = getDb()
    const monitor = await database.feedMonitor.create({
      data: {
        matchLabel: matchLabel.trim(),
        stageId: stageId || null,
        teamCodes: JSON.stringify(teamCodes),
        playerIds: JSON.stringify(playerIds),
        hashtags: JSON.stringify(hashtags),
        seedUrls: JSON.stringify(seedUrls || []),
        refreshInterval: interval,
        endsAt,
        status: 'active',
      },
    })

    // Trigger an immediate first refresh (don't wait for the cron job)
    // We do this in the background so the admin gets a fast response.
    refreshMonitor(database, monitor.id)
      .then((result) => {
        console.log(
          `[feed-monitor] Initial refresh for ${monitor.id}: ${result.newPosts} new posts, ${result.playersUpdated} players updated in ${result.durationMs}ms`,
        )
      })
      .catch((err) => {
        console.error(
          `[feed-monitor] Initial refresh failed for ${monitor.id}:`,
          err,
        )
      })

    return NextResponse.json({
      monitor: {
        id: monitor.id,
        matchLabel: monitor.matchLabel,
        status: monitor.status,
        endsAt: monitor.endsAt.toISOString(),
        message:
          'Monitor created. Initial sentiment refresh is running in the background — check back in 30-60 seconds for the first results.',
      },
    })
  } catch (error) {
    console.error('Failed to create feed monitor:', error)
    return NextResponse.json({ error: 'Failed to create monitor' }, { status: 500 })
  }
}

// ── Cron endpoint: refresh all active monitors ──────────────────────────────
// Called by the cron job every 5 minutes. Also callable manually by admin.
// Usage: PATCH /api/admin/feed-monitor  (with admin auth header)
export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const database = getDb()

    // Step 1: end expired monitors
    const endedCount = await endExpiredMonitors(database)

    // Step 2: refresh all active monitors whose lastRefreshedAt is older
    // than their refreshInterval (or never refreshed)
    const now = new Date()
    const activeMonitors = await database.feedMonitor.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        refreshInterval: true,
        lastRefreshedAt: true,
        matchLabel: true,
      },
    })

    const dueMonitors = activeMonitors.filter((m) => {
      if (!m.lastRefreshedAt) return true // never refreshed
      const elapsedMs = now.getTime() - m.lastRefreshedAt.getTime()
      return elapsedMs >= m.refreshInterval * 60 * 1000
    })

    const results = []
    for (const m of dueMonitors) {
      try {
        const result = await refreshMonitor(database, m.id)
        results.push({
          monitorId: m.id,
          matchLabel: m.matchLabel,
          newPosts: result.newPosts,
          playersUpdated: result.playersUpdated,
          durationMs: result.durationMs,
          errors: result.errors.slice(0, 3),
        })
      } catch (err) {
        results.push({
          monitorId: m.id,
          matchLabel: m.matchLabel,
          error: String(err),
        })
      }
    }

    return NextResponse.json({
      cron: true,
      endedExpired: endedCount,
      refreshed: results.length,
      results,
    })
  } catch (error) {
    console.error('Failed to run cron refresh:', error)
    return NextResponse.json({ error: 'Cron refresh failed' }, { status: 500 })
  }
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
