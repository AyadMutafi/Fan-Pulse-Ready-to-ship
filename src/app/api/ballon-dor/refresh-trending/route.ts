import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { db } from '@/lib/db'

let _zai: any = null
async function getZAI(): Promise<any | null> {
  if (_zai) return _zai
  try {
    const ZAIModule = await import('z-ai-web-dev-sdk')
    _zai = await ZAIModule.default.create()
    return _zai
  } catch (err) {
    console.warn(`[ballon-dor/trending] ZAI init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startedAt = Date.now()
  const weekKey = getISOWeekKey()
  const zai = await getZAI()
  if (!zai) {
    return NextResponse.json({ error: 'Z.ai SDK unavailable' }, { status: 503 })
  }
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
      `"${contender.name}" Ballon d'Or 2026`,
      `"${contender.name}" ${contender.clubName} 2026 season performance`,
      `"${contender.name}" disappointing OR overrated OR bad season 2026`,
    ]
    for (const query of queries) {
      try {
        const searchResults = await zai.functions.invoke('web_search', { query, num: 5 })
        if (!Array.isArray(searchResults)) continue
        for (const result of searchResults) {
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
        create: { contenderId: contender.id, weekKey, mentionCount: totalMentions, positiveMentions, negativeMentions, buzzScore: finalBuzzScore, trend, topSnippet: snippets[0]?.slice(0, 280) || null },
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
