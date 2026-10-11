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

/**
 * Use xAI Responses API (Grok) with built-in web_search tool.
 * Falls back to [] if XAI_API_KEY is not set or the call fails.
 */
async function searchWeb(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  const key = process.env.XAI_API_KEY
  if (!key) {
    console.warn('[ballon-dor/trending] XAI_API_KEY not set — search unavailable')
    return []
  }

  try {
    const res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'grok-4-latest',
        input: [
          {
            role: 'user',
            content: `Search the web for: ${query}. Summarize the top results with titles, URLs, and key snippets. Return concise snippets only.`,
          },
        ],
        tools: [{ type: 'web_search' }],
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      console.warn(`[ballon-dor/trending] xAI search HTTP ${res.status}`)
      return []
    }

    const json = await res.json().catch(() => null)
    const results: { url: string; title: string; snippet: string }[] = []

    // xAI responses vary in structure; look for assistant messages with text
    if (Array.isArray(json?.output)) {
      for (const item of json.output) {
        if (item?.type === 'message' && item?.role === 'assistant') {
          const contentArr = Array.isArray(item.content) ? item.content : [item.content]
          for (const c of contentArr) {
            if (typeof c?.text === 'string' && c.text.trim()) {
              // The assistant's text may contain multiple lines summarizing results.
              // Split into lines and take top chunk(s) as snippets.
              const text = c.text.trim()
              // Heuristic: split on newlines and blank lines, take up to first 3
              const parts = text.split(/\n{1,2}/).map((p: string) => p.trim()).filter(Boolean)
              for (const p of parts.slice(0, 3)) {
                results.push({ url: 'https://x.ai', title: query, snippet: p.slice(0, 500) })
              }
            }
            // Some tool outputs may embed structured items under c?.items or c?.results
            if (Array.isArray(c?.items)) {
              for (const it of c.items) {
                const title = (it.title || it.name || '').toString().slice(0, 200)
                const url = (it.url || it.link || '').toString()
                const snippet = (it.snippet || it.description || it.summary || '').toString().slice(0, 500)
                if (title || snippet || url) results.push({ url: url || 'https://x.ai', title: title || query, snippet: snippet || title || '' })
              }
            }
          }
        }
        // Some tool results may appear under tool_response shapes
        if (item?.tool_response && typeof item.tool_response === 'object') {
          try {
            const tr = item.tool_response
            // if tr.results array exists
            if (Array.isArray(tr.results)) {
              for (const r of tr.results) {
                const title = (r.title || r.name || '').toString().slice(0, 200)
                const url = (r.url || r.link || '').toString()
                const snippet = (r.snippet || r.description || r.summary || '').toString().slice(0, 500)
                if (title || snippet || url) results.push({ url: url || 'https://x.ai', title: title || query, snippet: snippet || title || '' })
              }
            }
          } catch {
            /* ignore parsing errors */
          }
        }
      }
    }

    // Deduplicate and limit
    const seen = new Set()
    const dedup: { url: string; title: string; snippet: string }[] = []
    for (const r of results) {
      const k = `${r.url}::${r.snippet}`
      if (!seen.has(k)) {
        seen.add(k)
        dedup.push(r)
      }
      if (dedup.length >= 10) break
    }

    return dedup
  } catch (e) {
    console.warn(`[ballon-dor/trending] xAI search failed: ${String(e).slice(0, 200)}`)
    return []
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startedAt = Date.now()

  console.log('[ballon-dor/trending] starting refresh-weekly-buzz (xAI search)')

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
        console.log(`[ballon-dor/trending] xAI search query="${query}"`)
        const searchResults = await searchWeb(query)
        console.log(`[ballon-dor/trending] xAI results for "${query}" => ${Array.isArray(searchResults) ? searchResults.length : 'not-array'}`)
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
        console.warn(`[ballon-dor/trending] search failed for ${contender.name}: ${String(err).slice(0, 200)}`)
      }
      await new Promise((r) => setTimeout(r, 2000))
    }

    // Fallback if no mentions found from the standard queries
    if (snippets.length === 0) {
      try {
        console.log(`[ballon-dor/trending] xAI fallback search for "${contender.name}"`)
        const fallback = await searchWeb(contender.name)
        console.log(`[ballon-dor/trending] xAI fallback results => ${Array.isArray(fallback) ? fallback.length : 'not-array'}`)
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
        console.warn(`[ballon-dor/trending] fallback search failed for ${contender.name}: ${String(e).slice(0, 200)}`)
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
