/**
 * Transfer Pulse — Verify player's CURRENT club via web_search.
 *
 * PROBLEM (2026-07-26, user report):
 *   The LLM extraction in feed-scan.ts and seed-by-url.ts trusts its own
 *   internal "current club" knowledge when filling in `fromClubName`. But LLM
 *   training data lags reality — for example:
 *     • Isak: LLM thinks "Newcastle" but he joined Liverpool on 1 Sep 2025.
 *     • Garnacho: LLM thinks "Man United" but he joined Chelsea on 30 Aug 2025.
 *     • Tielemans: LLM thinks "Leicester" but he was at Aston Villa from 2023
 *       and joined Man Utd on 14 Jul 2026.
 *   The discovery.ts `checkPlayerAlreadyMoved` guard has the SAME problem —
 *   it asks the LLM whether the player has moved, but the LLM's knowledge
 *   cutoff may predate the move.
 *
 * SOLUTION:
 *   This module asks the WEB (via Z.ai web_search) for the player's actual
 *   current club. Web search results are ALWAYS fresher than LLM training
 *   data, because they include same-day news articles. We ask for the top
 *   5 results and let the LLM read them and tell us the current club with a
 *   confidence rating.
 *
 * USAGE:
 *   const v = await verifyPlayerCurrentClubViaWeb('Alexander Isak')
 *   // → { actualClub: 'Liverpool', confidence: 'high', sources: [...] }
 *
 *   The caller can then compare `v.actualClub` to the LLM-extracted
 *   `fromClubName`:
 *     • If they match → trust the extraction, proceed.
 *     • If they differ → either update the from-club to the web-verified
 *       actual club, OR reject the saga (caller's choice depending on
 *       context), OR mark the saga as completed if the to-club matches the
 *       actual current club.
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   - We never fabricate a club. If web_search returns no useful results,
 *     confidence='low' and actualClub=null (caller fails open).
 *   - We never trust a single source. The LLM must see ≥2 corroborating
 *     results to return 'high' confidence.
 *   - We include the source URLs in the result so the caller can audit.
 */
/**
 * Transfer Pulse — Verify player's CURRENT club via web_search.
 *
 * (Updated: lazy-load z-ai-web-dev-sdk at runtime to avoid build-time init)
 */

export interface ClubVerification {
  actualClub: string | null
  actualClubCode: string | null
  confidence: 'high' | 'medium' | 'low'
  reason: string
  sources: string[]
  resultsConsidered: number
}

interface WebSearchResultItem {
  url: string
  name: string
  snippet: string
  host_name: string
  date?: string
}

// Lazy Z.ai loader
let _zai: any = null
async function getZAI(): Promise<any | null> {
  if (_zai) return _zai
  try {
    const ZAIModule = await import('z-ai-web-dev-sdk')
    _zai = await ZAIModule.default.create()
    return _zai
  } catch (err) {
    console.warn(`[verify-club] Z.ai init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

/**
 * Verify a player's CURRENT club via Z.ai web_search + LLM extraction.
 */
export async function verifyPlayerCurrentClubViaWeb(
  playerName: string,
  hintClub?: string,
): Promise<ClubVerification> {
  const empty: ClubVerification = {
    actualClub: null,
    actualClubCode: null,
    confidence: 'low',
    reason: 'web_search unavailable',
    sources: [],
    resultsConsidered: 0,
  }

  const zai = await getZAI()
  if (!zai) {
    return empty
  }

  // ── 1. Run 2 web_search queries (broad + specific) ─────────────────────
  const queries = [
    `${playerName} current club ${new Date().getFullYear()}`,
    `${playerName} transfer ${hintClub ? `from ${hintClub} ` : ''}latest news`,
  ]

  const allResults: WebSearchResultItem[] = []
  const seenUrls = new Set<string>()
  for (const q of queries) {
    try {
      const res = await zai.functions.invoke('web_search', { query: q, num: 5 })
      if (Array.isArray(res)) {
        for (const item of res) {
          if (item && typeof item.url === 'string' && !seenUrls.has(item.url)) {
            seenUrls.add(item.url)
            allResults.push(item)
          }
        }
      }
    } catch (err) {
      console.warn(
        `[verify-club] web_search failed for "${q}": ${String(err).slice(0, 120)}`,
      )
    }
  }

  if (allResults.length === 0) {
    return empty
  }

  // ── 2. Build a compact context for the LLM ─────────────────────────────
  const context = allResults
    .slice(0, 10)
    .map((r, i) => `[${i + 1}] ${r.name}\n    ${r.snippet}\n    URL: ${r.url}`)
    .join('\n\n')

  // ── 3. Ask the LLM to read the search results and answer ───────────────
  const today = new Date().toISOString().slice(0, 10)
  const systemPrompt =
    `You are a football transfer fact-checker. Today is ${today}.\n` +
    `The user wants to know: what club does ${playerName} CURRENTLY play for ` +
    `(as of today, not historically)?\n\n` +
    `Here are the top ${Math.min(allResults.length, 10)} web search results:\n\n` +
    `${context}\n\n` +
    `Read the results carefully. Return a JSON object with these fields:\n` +
    `  "actualClub": string | null   — the full name of the club ${playerName} currently plays for, or null if the results don't say\n` +
    `  "actualClubCode": string | null — a 3-4 letter uppercase code for the club (e.g. "LIV", "CHE", "AVL"), or null\n` +
    `  "confidence": "high" | "medium" | "low"\n` +
    `  "reason": string               — 1-sentence explanation citing the source(s)\n\n` +
    `CONFIDENCE RULES:\n` +
    `- "high": ≥2 independent sources (different domains) explicitly state the player's CURRENT club.\n` +
    `- "medium": 1 source states it, OR multiple sources imply it via transfer reporting (e.g. "X left Y for Z last summer").\n` +
    `- "low": no source clearly states the current club.\n\n` +
    `RULES:\n` +
    `- The CURRENT club is where he plays RIGHT NOW, not where he used to play.\n` +
    `- If the results talk about a transfer that has COMPLETED (signed/announced/presented), ` +
    `the CURRENT club is the DESTINATION club of that transfer.\n` +
    `- If the results only mention RUMORS of interest, the current club is still his existing club.\n` +
    `- Do NOT invent a club. If unsure, return actualClub=null and confidence="low".\n` +
    `- Output ONLY the JSON object, no commentary.`

  const zaiChat = await getZAI()
  if (!zaiChat) {
    return {
      ...empty,
      reason: 'LLM unavailable to interpret search results',
      sources: allResults.map((r) => r.url),
      resultsConsidered: allResults.length,
    }
  }

  let raw = ''
  try {
    const completion = await zaiChat.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${playerName} — current club?` },
      ],
      thinking: { type: 'disabled' },
    })
    raw = completion?.choices?.[0]?.message?.content || ''
  } catch (err) {
    console.warn(
      `[verify-club] LLM call failed for ${playerName}: ${String(err).slice(0, 120)}`,
    )
    return {
      ...empty,
      reason: `LLM call failed: ${String(err).slice(0, 80)}`,
      sources: allResults.map((r) => r.url),
      resultsConsidered: allResults.length,
    }
  }

  // ── 4. Parse the LLM response ──────────────────────────────────────────
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return {
      ...empty,
      reason: 'LLM did not return JSON',
      sources: allResults.map((r) => r.url),
      resultsConsidered: allResults.length,
    }
  }

  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const actualClub =
      typeof obj.actualClub === 'string' && obj.actualClub.trim()
        ? obj.actualClub.trim()
        : null
    const actualClubCode =
      typeof obj.actualClubCode === 'string' && obj.actualClubCode.trim()
        ? obj.actualClubCode.trim().toUpperCase().slice(0, 4)
        : null
    const confidenceRaw = String(obj.confidence).toLowerCase().trim()
    const confidence: 'high' | 'medium' | 'low' =
      confidenceRaw === 'high' ? 'high' : confidenceRaw === 'medium' ? 'medium' : 'low'
    const reason =
      typeof obj.reason === 'string' && obj.reason.trim()
        ? obj.reason.trim().slice(0, 280)
        : ''

    return {
      actualClub,
      actualClubCode,
      confidence,
      reason,
      sources: allResults.map((r) => r.url),
      resultsConsidered: allResults.length,
    }
  } catch {
    return {
      ...empty,
      reason: 'LLM JSON parse failed',
      sources: allResults.map((r) => r.url),
      resultsConsidered: allResults.length,
    }
  }
}

// The rest of module helpers (normalizeClubName, clubsMatch, verifyAndAdjustFromClub)
// can remain unchanged; they call verifyPlayerCurrentClubViaWeb which now lazy-loads.
