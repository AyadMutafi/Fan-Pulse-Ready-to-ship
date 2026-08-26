import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const revalidate = 60 // 1-minute ISR cache

/**
 * GET /api/fpl/last-sync
 *
 * Returns the timestamp of the last successful FPL data sync.
 * Used to display "Last synced: X minutes ago" trust signals on
 * the TOTW and Fantasy tabs.
 *
 * Checks 3 tables for the most recent syncedAt:
 *   - FPLPlayer.syncedAt
 *   - FPLFixture.syncedAt
 *   - FPLGameweek.syncedAt
 *
 * Returns the LATEST of the three (most recent sync activity).
 *
 * Rate-limit: 60 req/min/IP (light endpoint, cached 1 min).
 */

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = rateLimit(`fpl-last-sync:${ip}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 },
    )
  }

  try {
    // Query the most recent syncedAt from each FPL table
    const [latestPlayer, latestFixture, latestGameweek] = await Promise.all([
      db.fPLPlayer.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }).catch(() => null),
      db.fPLFixture.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }).catch(() => null),
      db.fPLGameweek.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }).catch(() => null),
    ])

    const timestamps = [
      latestPlayer?.syncedAt,
      latestFixture?.syncedAt,
      latestGameweek?.syncedAt,
    ].filter((ts): ts is Date => ts !== null && ts !== undefined)

    const lastSync = timestamps.length > 0
      ? new Date(Math.max(...timestamps.map((t) => t.getTime())))
      : null

    if (!lastSync) {
      return NextResponse.json({
        lastSyncedAt: null,
        ageMinutes: null,
        message: 'No sync data yet',
      })
    }

    const ageMs = Date.now() - lastSync.getTime()
    const ageMinutes = Math.round(ageMs / 60_000)

    let freshness: 'fresh' | 'stale' | 'very-stale'
    if (ageMinutes < 30) freshness = 'fresh'
    else if (ageMinutes < 360) freshness = 'stale' // < 6 hours
    else freshness = 'very-stale'

    return NextResponse.json({
      lastSyncedAt: lastSync.toISOString(),
      ageMinutes,
      freshness,
      message: ageMinutes < 1
        ? 'Just now'
        : ageMinutes < 60
        ? `${ageMinutes} min ago`
        : ageMinutes < 1440
        ? `${Math.round(ageMinutes / 60)} hours ago`
        : `${Math.round(ageMinutes / 1440)} days ago`,
    })
  } catch (error) {
    console.error('[api/fpl/last-sync] Error:', error)
    return NextResponse.json({
      lastSyncedAt: null,
      ageMinutes: null,
      message: 'Sync status unavailable',
    })
  }
}
