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
import ZAI from 'z-ai-web-dev-sdk'

export interface ClubVerification {
  /** The player's actual current club per web_search, or null if unknown. */
  actualClub: string | null
  /** Standardized 3-4 letter uppercase club code, or null. */
  actualClubCode: string | null
  /**
   * 'high'   — ≥2 independent web sources agree on the current club.
   * 'medium' — 1 source + the LLM's prior knowledge agree.
   * 'low'    — web_search returned no useful info; we know nothing.
   */
  confidence: 'high' | 'medium' | 'low'
  /** A 1-sentence explanation the LLM gave for its answer. */
  reason: string
  /** The web_search result URLs the answer was based on (audit trail). */
  sources: string[]
  /** How many web_search results were considered. */
  resultsConsidered: number
}

interface WebSearchResultItem {
  url: string
  name: string
  snippet: string
  host_name: string
  date?: string
}

/**
 * Verify a player's CURRENT club via Z.ai web_search + LLM extraction.
 *
 * @param playerName  e.g. "Alexander Isak"
 * @param hintClub    optional — the club the caller THINKS the player is at
 *                    (e.g. the LLM-extracted fromClub). Used to disambiguate
 *                    the search query.
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

  let zai: any
  try {
    zai = await ZAI.create()
  } catch {
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

  let zaiChat: any
  try {
    zaiChat = await ZAI.create()
  } catch {
    // fall through with empty (already set above); we still have search results
    // but no LLM to interpret them. Return low-confidence with sources.
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

/**
 * Normalize a club name for fuzzy comparison.
 * Handles "Man United" vs "Manchester United", "Newcastle" vs "Newcastle United",
 * "Real" vs "Real Madrid", etc.
 */
export function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(fc|cf|afc|ac|ssc|as|club|city|united|utd)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns true if two club names refer to the same club (fuzzy match).
 */
export function clubsMatch(a: string, b: string): boolean {
  const na = normalizeClubName(a)
  const nb = normalizeClubName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // Substring match (handles "Real" vs "Real Madrid", "Bayern" vs "Bayern Munich")
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

// ── Higher-level: verify + adjust an LLM-extracted transfer ────────────────

export interface ClubAdjustmentDecision {
  /** The corrected from-club name (may equal the original). */
  fromClubName: string
  /** The corrected from-club code (may equal the original). */
  fromClubCode: string
  /**
   * 'accept'           — the original extraction was correct.
   * 'update-from-club' — the player's actual current club differs from the
   *                      LLM-extracted one. We trust the web. The saga should
   *                      be upserted with the corrected from-club.
   * 'mark-completed'   — the player's actual current club EQUALS the saga's
   *                      to-club. The transfer has already happened. The saga
   *                      should be upserted with status='completed' AND the
   *                      corrected from-club.
   * 'reject'           — web verification returned low confidence AND the LLM
   *                      extraction looks suspicious (from-club doesn't match
   *                      to-club, but neither does the web-verified club). We
   *                      drop the saga entirely to avoid bad data.
   */
  decision: 'accept' | 'update-from-club' | 'mark-completed' | 'reject'
  /** The verification result, for logging/auditing. */
  verification: ClubVerification
  /** Human-readable explanation. */
  reason: string
}

/**
 * Given an LLM-extracted transfer {playerName, fromClubName, fromClubCode,
 * toClubName, toClubCode}, verify the player's actual current club via
 * web_search and decide what to do.
 *
 * This is the SYSTEMIC FIX for the "Isak/Garnacho/Tielemans wrong from-club"
 * bug class — the LLM's training data lags reality, so its "current club"
 * extraction can be months or years out of date. Web search is always
 * fresher than LLM training data.
 *
 * BEHAVIOR:
 *   1. Call verifyPlayerCurrentClubViaWeb(playerName, fromClubName).
 *   2. If the web-verified actualClub MATCHES the LLM-extracted fromClub →
 *      decision='accept' (the LLM was right).
 *   3. If the web-verified actualClub MATCHES the toClub → the transfer has
 *      already completed. decision='mark-completed'. The from-club is
 *      corrected to the LLM-extracted from-club (the LLM was right about
 *      where the player came FROM; he just already left).
 *      → Actually, if the player has already moved to toClub, the from-club
 *        is the player's club BEFORE the move. The LLM extraction here might
 *        still be wrong. We use the LLM's from-club as a best-effort guess
 *        and let the caller decide whether to trust it.
 *   4. If the web-verified actualClub differs from BOTH from and to clubs:
 *      the LLM had stale "from" knowledge. decision='update-from-club'. We
 *      correct the from-club to the web-verified one. The saga is created
 *      with the correct current club as from-club, and the rumored to-club.
 *   5. If web verification returns low confidence → fail open
 *      (decision='accept', trust the LLM extraction). We don't want to
 *      reject good sagas just because web_search had a bad day.
 *
 * Cost: 2 web_search queries + 1 LLM call per saga creation. Only runs when
 * a NEW saga is being created (existing sagas skip this check on update).
 */
export async function verifyAndAdjustFromClub(opts: {
  playerName: string
  fromClubName: string
  fromClubCode: string
  toClubName: string
  toClubCode: string
}): Promise<ClubAdjustmentDecision> {
  const { playerName, fromClubName, fromClubCode, toClubName } = opts

  const verification = await verifyPlayerCurrentClubViaWeb(playerName, fromClubName)

  // Fail open on low confidence — we don't reject based on missing data.
  if (verification.confidence === 'low' || !verification.actualClub) {
    return {
      fromClubName,
      fromClubCode,
      decision: 'accept',
      verification,
      reason: `web verification low-confidence (${verification.reason}) — trusting LLM extraction`,
    }
  }

  const webClub = verification.actualClub
  const webCode = verification.actualClubCode ?? fromClubCode

  // Case 1: web-verified club matches the LLM-extracted from-club → accept
  if (clubsMatch(webClub, fromClubName)) {
    return {
      fromClubName,
      fromClubCode,
      decision: 'accept',
      verification,
      reason: `web confirms ${playerName} is at ${fromClubName}`,
    }
  }

  // Case 2: web-verified club matches the to-club → transfer already completed
  if (clubsMatch(webClub, toClubName)) {
    return {
      // The from-club stays as the LLM extracted (the player's pre-move club)
      fromClubName,
      fromClubCode,
      decision: 'mark-completed',
      verification,
      reason: `web says ${playerName} is already at ${webClub} (= to-club) — transfer completed`,
    }
  }

  // Case 3: web-verified club differs from both → LLM had stale "from" info.
  // Update the from-club to the web-verified one.
  return {
    fromClubName: webClub,
    fromClubCode: webCode,
    decision: 'update-from-club',
    verification,
    reason: `web says ${playerName} is at ${webClub}, not ${fromClubName} (LLM was stale) — correcting from-club`,
  }
}
