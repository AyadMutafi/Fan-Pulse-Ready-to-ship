import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Used by Fly.io's HEALTHCHECK and by uptime monitors.
 * Returns 200 ONLY if the Next.js server is up AND the SQLite DB is reachable.
 * Previously this returned 200 unconditionally — meaning Fly would route
 * traffic to a machine whose DB was corrupt or unreachable. Now a DB query
 * failure yields 503 so Fly can restart the machine.
 */
export async function GET() {
  const started = Date.now()
  try {
    // Cheapest possible DB round-trip — just a count.
    await db.wCStage.count()
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dbLatencyMs: Date.now() - started,
    })
  } catch (err) {
    console.error('[health] DB check failed:', err)
    return NextResponse.json(
      {
        status: 'degraded',
        error: 'Database unreachable',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 503 },
    )
  }
}
