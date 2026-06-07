import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')

    if (!stageId) {
      return NextResponse.json({ error: 'stageId is required' }, { status: 400 })
    }

    const selections = await db.wCSelection.findMany({
      where: { stageId },
      include: {
        players: {
          orderBy: { order: 'asc' }
        },
        stage: true
      }
    })

    const elite = selections.find(s => s.type === 'elite')
    const crisis = selections.find(s => s.type === 'crisis')

    return NextResponse.json({ elite, crisis })
  } catch (error) {
    console.error('Failed to fetch elite-crisis:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
