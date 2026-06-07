import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const stages = await db.wCStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        selections: {
          include: {
            players: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    return NextResponse.json({ stages })
  } catch (error) {
    console.error('Failed to fetch stages:', error)
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
  }
}
