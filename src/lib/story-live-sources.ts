import { db } from '@/lib/db'

export interface LiveStorySignal {
  id: string
  kind: 'player' | 'curated-link' | 'feed-post'
  title: string
  detail: string
  sourceUrl: string
  sourceLabel: string
  fetchedAt: string
}

/** Read current app-owned sentiment and curated-post data for live Stories. */
export async function fetchLiveStorySignals(): Promise<LiveStorySignal[]> {
  const fetchedAt = new Date().toISOString()
  const signals: LiveStorySignal[] = []

  try {
    const players = await db.wCSelectionPlayer.findMany({
      where: { sentiment: { not: null } },
      orderBy: [{ pulseScore: 'desc' }],
      take: 5,
      select: { id: true, playerName: true, sentiment: true, trend: true },
    })
    for (const player of players) {
      signals.push({
        id: `player:${player.id}`,
        kind: 'player',
        title: player.playerName,
        detail: `Fan sentiment: ${player.sentiment}; trend: ${player.trend}.`,
        sourceUrl: `/api/sentiments?playerId=${encodeURIComponent(player.id)}`,
        sourceLabel: 'FanPulse Sentiments',
        fetchedAt,
      })
    }
  } catch (error) {
    console.error('[stories/live] Could not load sentiment signals', error)
  }

  try {
    const links = await db.curatedLink.findMany({
      where: { isActive: true },
      orderBy: { postedAt: 'desc' },
      take: 3,
      select: { id: true, url: true, author: true, content: true, sentimentScore: true },
    })
    for (const link of links) {
      signals.push({
        id: `curated:${link.id}`,
        kind: 'curated-link',
        title: link.author || 'Curated fan signal',
        detail: link.content || `Recorded sentiment score: ${link.sentimentScore}.`,
        sourceUrl: link.url,
        sourceLabel: 'Curated link',
        fetchedAt,
      })
    }
  } catch (error) {
    console.error('[stories/live] Could not load curated links', error)
  }

  try {
    const posts = await db.feedPost.findMany({
      where: { sentimentScore: { not: null } },
      orderBy: { postedAt: 'desc' },
      take: 20,
      select: { id: true, url: true, author: true, content: true, sentimentScore: true },
    })
    for (const post of posts) {
      if (!post.url) continue
      signals.push({
        id: `feed:${post.id}`,
        kind: 'feed-post',
        title: post.author || 'Fan post',
        detail: post.content || `Recorded sentiment score: ${post.sentimentScore}.`,
        sourceUrl: post.url,
        sourceLabel: 'Fan feed',
        fetchedAt,
      })
    }
  } catch (error) {
    console.error('[stories/live] Could not load feed posts', error)
  }

  return signals
}
