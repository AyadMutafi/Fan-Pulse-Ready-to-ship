import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

/**
 * Per-monitor admin endpoints:
 *
 * POST   /api/admin/feed-monitor/[id]/refresh  — manual refresh trigger (separate file)
 * PATCH  /api/admin/feed-monitor/[id]          — update status (active | paused | ended)
 * DELETE /api/admin/feed-monitor/[id]          — delete monitor + all its posts (cascade)
 */

// ── PATCH /api/admin/feed-monitor/[id] ───────────────────────────────────────
// Update monitor status. body: { status: 'active' | 'paused' | 'ended' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body || {}

    if (!['active', 'paused', 'ended'].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'active', 'paused', or 'ended'" },
        { status: 400 },
      )
    }

    const database = getDb()
    const updated = await database.feedMonitor.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        matchLabel: true,
        status: true,
        endsAt: true,
      },
    })

    return NextResponse.json({
      monitor: {
        id: updated.id,
        matchLabel: updated.matchLabel,
        status: updated.status,
        endsAt: updated.endsAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to update monitor:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

// ── DELETE /api/admin/feed-monitor/[id] ──────────────────────────────────────
// Delete a monitor + all its FeedPosts (cascade). Does NOT delete PlayerSentiment
// rows — those persist so historical pulse scores remain valid.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const { id } = await params
    const database = getDb()

    await database.feedMonitor.delete({ where: { id } })

    return NextResponse.json({
      deleted: true,
      id,
      note: 'Monitor and all its posts deleted. PlayerSentiment aggregates preserved for historical pulse score validity.',
    })
  } catch (error) {
    console.error('Failed to delete monitor:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
