import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

async function searchWeb(query: string): Promise<any[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const html = await res.text()
    const results: any[] = []
    // match DuckDuckGo result title + snippet pattern
    const re = /<a[^>]*class="result__a"[^>]*href="([^"']+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gs
    for (const match of html.matchAll(re)) {
      try {
        const url = match[1]
        const title = match[2].replace(/<[^>]+>/g, '').trim()
        const snippet = (match[3] || '').replace(/<[^>]+>/g, '').trim()
        results.push({ url, title, snippet })
      } catch {
        // skip malformed match
      }
    }
    return results
  } catch (e) {
    console.warn('[ballon-dor/trending] DuckDuckGo search failed:', String(e).slice(0, 100))
    return []
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startedAt = Date.now()

  const weekKey = getISOWeekKey()
  const contenders = await db.ballonDorContender.findMany({ where: { isActive: true } })
  if (contenders.length === 0) {
    return NextResponse.json({ error: 'No active contenders. Seed them first via /api/ballon-dor/contenders' }, { status: 400 })
  }
  const results: any[] = []
  for (const contender of contenders) {
    let positiveMentions = 0
    let negativeMentions = 0
    const snippets: string[] = []
    const queries = [
      `${contender.name} Ballon d'Or 2026`,
      `${contender.name} ${contender.clubName} 2026`,
      `${contender.name} football 2026`,
    ]
    for (const query of queries) {
      try {
        const searchResults = await searchWeb(query)
        if (!Array.isArray(searchResults) || searchResults.length === 0) {
          console.warn(`[ballon-dor/trending] 0 results for query: "${query}"`)
          continue
        }
        for (const result of searchResults.slice(0, 5)) {
          const text = `${result.title || ''} ${result.snippet || ''}`.toLowerCase()
          snippets.push(result.snippet || result.title || '')
          if (/deserv|favorite|win|best|top|brilliant|unstoppable|incredible|amazing|hero/.test(text)) positiveMentions++
          if (/snub|unfair|rigged|overrated|controvers|disappoint|critic|bad season|flop/.test(text)) negativeMentions++
        }
      } catch (err) {
        console.warn(`[ballon-dor/trending] search failed for ${contender.name}: ${String(err).slice(0, 100)}`)
      }
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Fallback if no mentions found from the standard queries
    if (snippets.length === 0) {
      try {
        const fallback = await searchWeb(contender.name)
        if (Array.isArray(fallback)) {
          if (fallback.length === 0) {
            console.warn(`[ballon-dor/trending] 0 results for fallback query: "${contender.name}"`)
          }
          for (const result of fallback.slice(0, 5)) {
            snippets.push(result.snippet || result.title || '')
          }
        } else {
          console.warn(`[ballon-dor/trending] fallback returned non-array for ${contender.name}`)
        }
      } catch (e) {
        console.warn(`[ballon-dor/trending] fallback search failed for ${contender.name}: ${String(e).slice(0, 100)}`)
      }
    }

    const totalMentions = snippets.length
    const volumeBonus = Math.min(20, totalMentions * 2)
    const sentimentBonus = Math.min(15, positiveMentions * 3) - Math.min(20, negativeMentions * 4)
    const liveBuzzScore = Math.max(5, Math.min(99, Math.round(50 + volumeBonus + sentimentBonus)))
    let trend: 'rising' | 'stable' | 'falling' = 'stable'
    if (positiveMentions > negativeMentions + 2) trend = 'rising'
    else if (negativeMentions > positiveMentions + 2) trend = 'falling'
    const hasManualOverride = contender.manualBuzzScore !== null
    const finalBuzzScore = hasManualOverride ? (contender.manualBuzzScore as number) : liveBuzzScore
    const scoreSource = hasManualOverride ? 'admin-override' : 'live'
    try {
      await db.ballonDorWeeklySnapshot.upsert({
        where: { contenderId_weekKey: { contenderId: contender.id, weekKey } },
        update: { mentionCount: totalMentions, positiveMentions, negativeMentions, buzzScore: finalBuzzScore, trend, topSnippet: snippets[0]?.slice(0, 280) || null, refreshedAt: new Date() },
        create: { contenderId: contender.id, weekKey, mentionCount: totalMentions, positiveMentions, negativeMentions, buzzScore: finalBuzzScore, trend, topSnippet: snippets[0]?.slice(0, 280) || null, refreshedAt: new Date() },
      })
      await db.ballonDorContender.update({
        where: { id: contender.id },
        data: { ballonDorScore: finalBuzzScore, previousScore: contender.ballonDorScore, trend, lastBuzzRefreshAt: new Date() },
      })
    } catch (dbErr) {
      console.warn(`[ballon-dor/trending] DB save failed for ${contender.name}: ${String(dbErr).slice(0, 100)}`)
    }
    results.push({
      name: contender.name, club: contender.clubName, nation: contender.nationCode, position: contender.position,
      mentionCount: totalMentions, positiveMentions, negativeMentions, liveBuzzScore, finalBuzzScore, scoreSource, trend,
      adminNotes: contender.adminNotes, topSnippet: snippets[0]?.slice(0, 280) || null,
    })
    await new Promise((r) => setTimeout(r, 1500))
  }
  results.sort((a, b) => b.finalBuzzScore - a.finalBuzzScore)
  return NextResponse.json({
    ok: true, weekKey, trending: results, playersProcessed: results.length,
    durationMs: Date.now() - startedAt, refreshedAt: new Date().toISOString(),
  })
}
