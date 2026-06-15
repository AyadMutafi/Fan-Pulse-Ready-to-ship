import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const ratings = await db.fanRating.findMany({
      orderBy: { avgRating: 'desc' },
    })

    const result = ratings.map(r => ({
      id: r.id,
      playerId: r.id,
      playerName: r.playerName,
      nationCode: r.nationCode,
      position: r.position,
      avgRating: r.avgRating,
      totalRatings: r.totalRatings,
      userRating: null,
    }))

    return NextResponse.json({ ratings: result })
  } catch (error) {
    console.error('Failed to fetch ratings:', error)
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { playerId, rating, comment } = body

    if (!playerId || !rating || rating < 1 || rating > 10) {
      return NextResponse.json({ error: 'Invalid rating data' }, { status: 400 })
    }

    const userRating = await db.userRating.create({
      data: {
        sessionId: 'anonymous',
        playerId,
        rating,
        comment: comment?.slice(0, 200) || null,
      },
    })

    const existingRating = await db.fanRating.findFirst({
      where: { id: playerId },
    })

    if (existingRating) {
      const newTotal = existingRating.totalRatings + 1
      const newAvg = ((existingRating.avgRating * existingRating.totalRatings) + rating) / newTotal

      await db.fanRating.update({
        where: { id: playerId },
        data: {
          avgRating: Math.round(newAvg * 10) / 10,
          totalRatings: newTotal,
        },
      })
    }

    return NextResponse.json({ success: true, rating: userRating })
  } catch (error) {
    console.error('Failed to submit rating:', error)
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 })
  }
}
