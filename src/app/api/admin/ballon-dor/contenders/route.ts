import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

export const runtime = 'nodejs'

/**
 * GET /api/admin/ballon-dor/contenders
 *
 * List all BallonDorContender rows with full score breakdown.
 * Used by the admin dashboard to show the current ranking with
 * stats/article/social component scores + source counts.
 *
 * Query params:
 *   ?includeInactive=true — include hidden contenders
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const contenders = await db.ballonDorContender.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { ballonDorScore: 'desc' },
    include: {
      _count: {
        select: { sources: true },
      },
    },
  })

  return NextResponse.json({
    contenders: contenders.map((c) => ({
      ...c,
      totalSources: c._count.sources,
      _count: undefined,
    })),
    count: contenders.length,
  })
}
