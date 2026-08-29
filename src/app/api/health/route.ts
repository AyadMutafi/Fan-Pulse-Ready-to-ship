import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Simple health check endpoint for Render uptime monitoring.
 * Returns 200 OK with basic status info.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'fan-pulse',
    },
    { status: 200 },
  )
}
