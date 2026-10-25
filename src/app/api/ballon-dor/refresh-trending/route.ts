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
 * Use xAI Responses API web_search tool.
 * If the key is missing or the call fails, return [] rather than crashing.
 */
async function searchWeb(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  const key = process.env.XAI_API_KEY
  if (!key) {
    console.warn('[ballon-dor/trending] XAI_API_KEY not set — search unavailable')
    return []
  }

  try {
    const payload = {
      model: 'grok-4-latest',
      input: [
        {
          role: 'user',
          content: `Search the web for: ${query}. Return concise top results with titles, URLs, and short snippets.`,
        },
      ],
      tools: [{ type: 'web_search' }],
      stream: false,
    }

    const res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    })

    const status = res.status
    const contentType = res.headers.get('content-type') || ''
    const raw = await res.text().catch(() => '')

    let parsed: any = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }

    console.log('[ballon-dor/trending] xAI search debug', {
      query,
      hasKey: !!key,
      status,
      contentType,
      bodyPreview: raw ? raw.slice(0, 2000) : '(empty)',
      parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 20) : null,
    })

    if (!res.ok) {
      console.warn(`[ballon-dor/trending] xAI search HTTP ${status} for query="${query}"`)
      return []
    }

    const results: { url: string; title: string; snippet: string }[] = []

    const pushResult = (r: {
      url?: string
      link?: string
      href?: string
      title?: string
      name?: string
      snippet?: string
      summary?: string
      description?: string
      text?: string
    }) => {
      const url = (r.url || r.link || r.href || '').toString()
      const title = (r.title || r.name || '').toString().trim()
      const snippet = (r.snippet || r.summary || r.description || r.text || '').toString().trim()
      if (url || title || snippet) {
        results.push({
          url: url || 'https://x.ai',
          title: title || query,
          snippet: snippet || title || '',
        })
      }
    }

    if (Array.isArray(parsed?.output)) {
      for (const item of parsed.output) {
        try {
          if (item?.type === 'message' && item?.role === 'assistant') {
            const contents = Array.isArray(item.content) ? item.content : [item.content]
            for (const c of contents) {
              if (typeof c?.text === 'string' && c.text.trim()) {
                const chunks = c.text.split(/\n{1,2}/).map((s) => s.trim()).filter(Boolean)
                for (const chunk of chunks.slice(0, 3)) {
                  results.push({
                    url: 'https://x.ai',
                    title: query,
                    snippet: chunk.slice(0, 500),
                  })
                }
              }

              if (Array.isArray(c?.items)) {
                for (const it of c.items) {
                  pushResult({
                    url: it.url || it.link || it.href,
                    title: it.title || it.name,
                    snippet: it.snippet || it.summary || it.description,
                  })
                }
              }
            }
          }

          if (item?.tool_response) {
            const tr = item.tool_response

            if (Array.isArray(tr?.results)) {
              for (const r of tr.results) {
                pushResult({
                  url: r.url || r.link || r.href,
                  title: r.title || r.name,
                  snippet: r.snippet || r.summary || r.description,
                })
              }
            } else if (Array.isArray(tr?.data)) {
              for (const r of tr.data) {
                pushResult({
                  url: r.url || r.link || r.href,
                  title: r.title || r.name,
                  snippet: r.snippet || r.summary || r.description,
                })
              }
            } else {
              const trText = typeof tr === 'string' ? tr : JSON.stringify(tr).slice(0, 1000)
              if (trText) {
                results.push({
                  url: 'https://x.ai',
                  title: query,
                  snippet: trText.slice(0, 500),
                })
              }
            }
          }
        } catch (innerErr) {
          console.warn('[ballon-dor/trending] xAI item parse error', String(innerErr).slice(0, 200))
        }
      }
    }

    if (Array.isArray(parsed?.sources)) {
      for (const s of parsed.sources) {
        pushResult({
          url: s.url || s.link || s.href,
          title: s.title || s.name,
          snippet: s.snippet || s.summary || s.description,
        })
      }
    }

    const seen = new Set<string>()
    const deduped: { url: string; title: string; snippet: string }[] = []
    for (const r of results) {
      const key = `${r.url}::${r.snippet}`.slice(0, 1000)
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(r)
      }
      if (deduped.length >= 10) break
    }

    console.log('[ballon-dor/trending] xAI parsed results count', {
      rawCount: results.length,
      deduped: deduped.length,
    })

    return deduped
  } catch (e) {
    console.warn('[ballon-dor/trending] xAI search failed (exception):', String(e).slice(0, 200))
    return []
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  console.log('[ballon-dor/trending] starting refresh-weekly-buzz (xAI)')

  const weekKey = getISOWeekKey()
  const contenders = await db.ballonDorContender.findMany({ where: { isActive: true } })

  if (contenders.length === 0) {
    return NextResponse.json(
      { error: 'No active contenders. Seed them first via /api/ballon-dor/contenders' },
      { status: 400 }
    )
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
        console.log(
          `[ballon-dor/trending] xAI results for "${query}" => ${Array.isArray(searchResults) ? searchResults.length : 'not-array'}`
        )

        if (!Array.isArray(searchResults) || searchResults.length === 0) {
          console.warn(`[ballon-dor/trending] 0 results for query: "${query}"`)
          continue
        }

        for (const result of searchResults.slice(0, 5)) {
          const text = `${result.title || ''} ${result.snippet || ''}`.toLowerCase()
          snippets.push(result.snippet || result.title || '')
          if (/deserv|favorite|win|best|top|brilliant|unstoppable|incredible|amazing|hero/.test(text)) {
            positiveMentions++
          }
          if (/snub|unfair|rigged|overrated|controvers|disappoint|critic|bad season|flop/.test(text)) {
            negativeMentions++
          }
        }
      } catch (err) {
        console.warn(`[ballon-dor/trending] search failed for ${contender.name}: ${String(err).slice(0, 200)}`)
      }

      await new Promise((r) => setTimeout(r, 2000))
    }

    if (snippets.length === 0) {
      try {
        console.log(`[ballon-dor/trending] xAI fallback search for "${contender.name}"`)
        const fallback = await searchWeb(contender.name)
        console.log(
          `[ballon-dor/trending] xAI fallback results => ${Array.isArray(fallback) ? fallback.length : 'not-array'}`
        )

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

    const hasManualOverride = typeof contender.manualBuzzScore === 'number'
    const finalBuzzScore = hasManualOverride ? contender.manualBuzzScore : liveBuzzScore
    const scoreSource = hasManualOverride ? 'admin-override' : 'live'

    try {
      await db.ballonDorWeeklySnapshot.upsert({
        where: { contenderId_weekKey: { contenderId: contender.id, weekKey } },
        update: {
          mentionCount: totalMentions,
          positiveMentions,
          negativeMentions,
          buzzScore: finalBuzzScore,
          trend,
          topSnippet: snippets[0]?.slice(0, 280) || null,
          refreshedAt: new Date(),
        },
        create: {
          contenderId: contender.id,
          weekKey,
          mentionCount: totalMentions,
          positiveMentions,
          negativeMentions,
          buzzScore: finalBuzzScore,
          trend,
          topSnippet: snippets[0]?.slice(0, 280) || null,
          refreshedAt: new Date(),
        },
      })

      await db.ballonDorContender.update({
        where: { id: contender.id },
        data: {
          ballonDorScore: finalBuzzScore,
          previousScore: contender.ballonDorScore,
          trend,
          lastBuzzRefreshAt: new Date(),
        },
      })
    } catch (dbErr) {
      console.warn(`[ballon-dor/trending] DB save failed for ${contender.name}: ${String(dbErr).slice(0, 100)}`)
    }

    results.push({
      name: contender.name,
      club: contender.clubName,
      nation: contender.nationCode,
      position: contender.position,
      mentionCount: totalMentions,
      positiveMentions,
      negativeMentions,
      liveBuzzScore,
      finalBuzzScore,
      scoreSource,
      trend,
      adminNotes: contender.adminNotes,
      topSnippet: snippets[0]?.slice(0, 280) || null,
    })

    await new Promise((r) => setTimeout(r, 1500))
  }

  results.sort((a, b) => b.finalBuzzScore - a.finalBuzzScore)

  return NextResponse.json({
    ok: true,
    weekKey,
    trending: results,
    playersProcessed: results.length,
    durationMs: Date.now() - startedAt,
    refreshedAt: new Date().toISOString(),
  })
}
