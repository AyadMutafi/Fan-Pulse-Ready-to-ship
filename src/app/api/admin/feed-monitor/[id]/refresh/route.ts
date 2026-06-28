import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { refreshMonitor } from '@/lib/feed-sentiment'

/**
 * POST /api/admin/feed-monitor/[id]/refresh
 *
 * Manually trigger a refresh for a single monitor (regardless of refreshInterval).
 * Useful for testing or when an admin wants immediate fresh data.
 *
 * Returns the refresh result synchronously so the admin sees the outcome.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const { id } = await params
    const database = getDb()

    const monitor = await database.feedMonitor.findUnique({
      where: { id },
      select: { id: true, matchLabel: true, status: true },
    })
    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    // Run the refresh synchronously so the admin sees the result
    const result = await refreshMonitor(database, id)

    return NextResponse.json({
      monitor: {
        id: monitor.id,
        matchLabel: monitor.matchLabel,
        status: monitor.status,
      },
      refresh: {
        newPosts: result.newPosts,
        skippedDuplicates: result.skippedDuplicates,
        failedPosts: result.failedPosts,
        playersUpdated: result.playersUpdated,
        durationMs: result.durationMs,
        errors: result.errors,
      },
    })
  } catch (error) {
    console.error('Failed to refresh monitor:', error)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
