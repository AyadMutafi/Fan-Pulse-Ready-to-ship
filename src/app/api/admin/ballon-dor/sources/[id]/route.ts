import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { recomputePlayer } from '@/lib/ballon-dor-admin/recompute'

export const runtime = 'nodejs'

/**
 * DELETE /api/admin/ballon-dor/sources/[id]
 *
 * Soft-deletes a BallonDorSource row (sets isActive=false).
 * Triggers a recompute for the affected player.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const { id } = await params

  try {
    const source = await db.ballonDorSource.findUnique({ where: { id } })
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    await db.ballonDorSource.update({
      where: { id },
      data: { isActive: false },
    })

    // Trigger recompute for the affected player
    const recompute = await recomputePlayer(db, source.playerName)

    return NextResponse.json({ success: true, recompute })
  } catch (err) {
    console.error('[api/admin/ballon-dor/sources/[id]] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  }
}
