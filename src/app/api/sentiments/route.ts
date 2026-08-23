import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request as any)
  const rl = rateLimit(`endpoint:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  }
  try {
    const { searchParams } = new URL(request.url)
    const league = searchParams.get('league')

    // Get all selection players with their pulse scores, regardless of league filter
    // In a real app, we'd filter by league. For now, we use all players.
    const players = await db.wCSelectionPlayer.findMany({
      include: {
        selection: true,
      },
      orderBy: { pulseScore: 'desc' },
    })

    // Deduplicate by player name (a player might appear in multiple stages)
    const seen = new Set<string>()
    const result = players
      .filter(p => {
        if (seen.has(p.playerName)) return false
        seen.add(p.playerName)
        return true
      })
      .map(p => ({
        id: p.id,
        name: p.playerName,
        nationCode: p.nationCode,
        pulseScore: p.pulseScore,
        sentiment: p.sentiment,
        trend: p.trend,
        league: 'WC', // All from World Cup
        label: p.pulseScore >= 80 ? 'on_fire' : p.pulseScore >= 50 ? 'under_pressure' : 'crisis',
        position: p.position,
        // Wikipedia/CC-BY-SA photo URL (NULL when no photo → UI shows initials fallback).
        // Always https://upload.wikimedia.org/ when set. See src/lib/wikipedia-photo.ts.
        photoUrl: p.photoUrl,
      }))

    return NextResponse.json({ players: result })
  } catch (error) {
    console.error('Failed to fetch sentiments:', error)
    return NextResponse.json({ error: 'Failed to fetch sentiments' }, { status: 500 })
  }
}
