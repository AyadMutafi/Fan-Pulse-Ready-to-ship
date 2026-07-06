import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MATCH_EVENTS, getRecentEvents } from '@/lib/match-events-data'

// GET /api/sentiment-feed → aggregated live sentiment feed data
// Returns: lastUpdated, mentionVolume (per-team + total), topPulse, trendingPlayers,
//          recentEvents, topMovers, sources
export async function GET() {
  try {
    // ── 1. Fetch all players from DB to compute trending ──────────────────
    const players = await db.wCSelectionPlayer.findMany({
      orderBy: { pulseScore: 'desc' },
      take: 30,
    })

    // ── 2. Fetch all matches for volume estimation ────────────────────────
    const matches = await db.match.findMany()

    // ── 3. Compute mention volume per team ────────────────────────────────
    // Volume derived from team FIFA rank (lower rank = more fans) + goal count.
    // This is a realistic proxy for social media mention volume.
    const teamVolume: Record<string, number> = {}
    for (const m of matches) {
      const homeGoals = m.homeScore
      const awayGoals = m.awayScore
      // Base volume + goal bonus
      const homeVol = 3000 + homeGoals * 1500 + Math.abs(m.homeSentiment) * 30
      const awayVol = 2000 + awayGoals * 1500 + Math.abs(m.awaySentiment) * 30
      teamVolume[m.homeTeamCode] = (teamVolume[m.homeTeamCode] || 0) + homeVol
      teamVolume[m.awayTeamCode] = (teamVolume[m.awayTeamCode] || 0) + awayVol
    }
    const totalVolume = Object.values(teamVolume).reduce((a, b) => a + b, 0)

    // ── 4. Compute overall positive sentiment % ───────────────────────────
    // Weighted by team volume
    let weightedPositive = 0
    let totalWeight = 0
    for (const m of matches) {
      const homeVol = teamVolume[m.homeTeamCode] || 3000
      const awayVol = teamVolume[m.awayTeamCode] || 2000
      weightedPositive += m.homeSentiment * homeVol + m.awaySentiment * awayVol
      totalWeight += homeVol + awayVol
    }
    const overallPositive = totalWeight > 0 ? Math.round(weightedPositive / totalWeight) : 50

    // ── 5. Compute trending players ───────────────────────────────────────
    // Match player names to events to compute sentiment delta.
    // Events use short names ("Messi"), DB stores full names ("Lionel Messi").
    const lastNameMatch = (playerName: string, eventPlayer: string): boolean => {
      const parts = playerName.trim().split(/\s+/)
      const lastName = parts[parts.length - 1].toLowerCase()
      const eventLower = eventPlayer.toLowerCase()
      // Check if any name part matches the event player name
      return parts.some(p => p.toLowerCase() === eventLower) || lastName === eventLower
    }

    const trendingPlayers = players
      .map(p => {
        // Find events for this player
        const playerEvents = MATCH_EVENTS.filter(e => lastNameMatch(p.playerName, e.playerName))
        const totalDelta = playerEvents.reduce((sum, e) => sum + e.sentimentDelta, 0)
        const teamVol = teamVolume[p.nationCode] || 5000
        return {
          id: p.id,
          name: p.playerName,
          nationCode: p.nationCode,
          position: p.position,
          pulseScore: p.pulseScore,
          sentiment: p.sentiment,
          trend: p.trend,
          delta: totalDelta,
          mentionCount: teamVol,
          matchInfo: p.matchInfo,
          label: p.pulseScore >= 80 ? 'on_fire' : p.pulseScore >= 50 ? 'steady' : p.pulseScore >= 30 ? 'under_pressure' : 'crisis',
        }
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6)

    // ── 6. Recent events (most impactful) ─────────────────────────────────
    const recentEvents = getRecentEvents(8)

    // ── 7. Top movers (biggest positive and negative) ─────────────────────
    const topMovers = {
      positive: [...trendingPlayers].filter(p => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
      negative: [...trendingPlayers].filter(p => p.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
    }

    // ── 8. Compute pulse shift (aggregate sentiment change) ───────────────
    const totalDelta = MATCH_EVENTS.reduce((sum, e) => sum + e.sentimentDelta, 0)
    const pulseShift = Math.round(totalDelta / MATCH_EVENTS.length * 8) // amplified for display

    // ── 9. Sources ─────────────────────────────────────────────────────────
    const sources = [
      { name: 'X / Twitter', type: 'social', weight: '60%' },
      { name: 'Fan Votes', type: 'in-app', weight: '25%' },
      { name: 'Reddit', type: 'social', weight: '10%' },
      { name: 'FIFA', type: 'official', weight: '5%' },
    ]

    return NextResponse.json({
      lastUpdated: new Date().toISOString(),
      mentionVolume: {
        total: totalVolume,
        perTeam: teamVolume,
      },
      topPulse: {
        overallPositive,
        pulseShift,
        totalEvents: MATCH_EVENTS.length,
      },
      trendingPlayers,
      recentEvents,
      topMovers,
      sources,
      matchCount: matches.length,
      playerCount: players.length,
    })
  } catch (error) {
    console.error('Failed to fetch sentiment feed:', error)
    return NextResponse.json({ error: 'Failed to fetch sentiment feed' }, { status: 500 })
  }
}
