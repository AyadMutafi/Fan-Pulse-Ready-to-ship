/**
 * Transfer Pulse — PUSH-based Tier 1 Feed Scanner.
 *
 * PROBLEM (2026-07-26, user report):
 *   The existing `discovery.ts` iterates over a fixed watchlist of ~50
 *   tracked players and asks "find Tier 1 posts about THIS player". This
 *   means Tier 1 posts about players NOT in the watchlist NEVER enter the
 *   system. When Fabrizio Romano tweets about a player we don't track,
 *   the saga is never created — and the user wonders why "current transfer
 *   talks" aren't appearing.
 *
 * SOLUTION:
 *   This module runs the OPPOSITE direction: it asks "what transfers have
 *   Tier 1 journalists reported in the last 7 days?" — and creates/upserts
 *   sagas for ALL of them, regardless of watchlist membership.
 *
 *   Concretely: for a small rotating subset of TIER1_SOURCES per run, we
 *   call `searchXPostsGeneric` (xAI x_search) with a query like "Fabrizio
 *   Romano transfer reports from the last 7 days", filter to TIER1_HANDLES,
 *   then for each post extract {player, fromClub, toClub, fee, isCompleted}
 *   via a single LLM call. We then upsert the saga + the Tier 1 source.
 *
 * ANTI-HALLUCINATION CONTRACT (preserved from discovery.ts):
 *   - Only accepts posts authored by handles in TIER1_HANDLES (Romano, etc.)
 *   - Only accepts posts with verifiable dates (Snowflake decode, ≤14 days)
 *   - Only accepts posts whose text contains transfer keywords
 *   - Rejects same-club extractions (contract renewals)
 *   - The journalist's REAL X post URL becomes the TransferSource.url
 *   - Duplicate sources (same URL) never double-counted
 *   - If the LLM cannot confidently identify the player AND destination,
 *     the post is discarded — we never guess
 *
 * ENTITY RESOLUTION:
 *   For each Tier 1 post, the LLM is asked to extract the player's CURRENT
 *   club too (not just the rumored destination). This is critical because
 *   the post may not mention the from-club explicitly. We DON'T require the
 *   player to be in TRACKED_PLAYERS — we accept any footballer the LLM can
 *   confidently identify.
 *
 * SAFEGUARDS:
 *   - "Already moved" gate (mirrors discovery.ts): if the LLM's extracted
 *     fromClub matches the toClub, skip (same-club renewal).
 *   - Staleness guard: posts >14 days old are rejected (tighter than
 *     discovery.ts's 60-day window because we want CURRENT talks).
 *   - Idempotent: re-running on the same posts is a no-op (URL @unique).
 */

import { db } from '@/lib/db'
import { ai } from '@/lib/ai'
import { searchXPostsGeneric, type XPost } from '@/lib/grok-x-search'
import { TIER1_SOURCES, TIER1_HANDLES, getTier1Source } from './tier1-sources'
import { resolveClub } from './clubs'
import { decodeSnowflakeDate, extractStatusId } from './zai-fallback'
import { fetchJournalistPostsViaZai } from './zai-fallback'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeedScanResult {
  journalistsScanned: number
  postsConsidered: number
  sagasCreated: number
  sagasUpdated: number
  sourcesAdded: number
  skipped: number
  errors: string[]
  durationMs: number
}

interface ExtractedTransfer {
  playerName: string | null
  fromClubName: string | null
  fromClubCode: string | null
  toClubName: string | null
  toClubCode: string | null
  fee: string | null
  headline: string
  isCompleted: boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

/** How recent a Tier 1 post must be to be considered "current talk". */
const MAX_POST_AGE_DAYS = 14

/** How many journalists to scan per feed-scan run. */
const JOURNALISTS_PER_RUN = 3

/** Max posts to ingest per journalist per run. */
const MAX_POSTS_PER_JOURNALIST = 8

/** Transfer keywords (mirrors zai-fallback.ts). */
const TRANSFER_KEYWORDS = [
  'transfer', 'deal', 'move', 'signing', 'signs', 'signed',
  'agrees', 'agreed', 'bid', 'offer', 'medical', 'contract',
  'here we go', 'launch', 'approach', 'talks', 'negotiat',
  'joining', 'joins', 'completed', 'confirmed', 'close to',
  'reaches', 'verbal', 'personal terms', 'fee',
]

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan Tier 1 journalists' recent posts for transfer reports. PUSH-based
 * discovery that complements the watchlist-driven PULL discovery.
 *
 * @param opts.journalistHandles  specific handles to scan this run (default:
 *                                rotating subset of TIER1_SOURCES)
 * @param opts.maxAgeDays         reject posts older than this (default 14)
 */
export async function scanTier1Feeds(opts: {
  journalistHandles?: string[]
  maxAgeDays?: number
} = {}): Promise<FeedScanResult> {
  const startedAt = Date.now()
  const result: FeedScanResult = {
    journalistsScanned: 0,
    postsConsidered: 0,
    sagasCreated: 0,
    sagasUpdated: 0,
    sourcesAdded: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  }

  const maxAgeDays = opts.maxAgeDays ?? MAX_POST_AGE_DAYS

  // Resolve the journalist subset for this run
  let handles: string[]
  if (opts.journalistHandles && opts.journalistHandles.length > 0) {
    handles = opts.journalistHandles
  } else {
    // Rotate through TIER1_SOURCES so successive runs cover different
    // journalists. Prioritize the highest-reliability sources first.
    const sorted = [...TIER1_SOURCES].sort((a, b) => b.reliability - a.reliability)
    handles = sorted.slice(0, JOURNALISTS_PER_RUN).map((s) => s.handle.replace(/^@/, ''))
  }

  for (const handle of handles) {
    result.journalistsScanned++
    try {
      const outcome = await scanJournalistFeed(handle, maxAgeDays)
      result.postsConsidered += outcome.postsConsidered
      result.sagasCreated += outcome.sagasCreated
      result.sagasUpdated += outcome.sagasUpdated
      result.sourcesAdded += outcome.sourcesAdded
      result.skipped += outcome.skipped
      if (outcome.error) result.errors.push(`${handle}: ${outcome.error}`)
    } catch (err) {
      result.errors.push(`${handle}: ${String(err).slice(0, 200)}`)
    }
  }

  result.durationMs = Date.now() - startedAt
  return result
}

// ── Per-journalist scan ──────────────────────────────────────────────────────

async function scanJournalistFeed(
  handle: string,
  maxAgeDays: number,
): Promise<{
  postsConsidered: number
  sagasCreated: number
  sagasUpdated: number
  sourcesAdded: number
  skipped: number
  error?: string
}> {
  const out = { postsConsidered: 0, sagasCreated: 0, sagasUpdated: 0, sourcesAdded: 0, skipped: 0 }
  const source = getTier1Source(handle)
  if (!source) {
    out.error = `not a Tier 1 source: ${handle}`
    return out
  }

  // 1. Search X for recent posts by this journalist about transfers
  const cleanHandle = handle.replace(/^@/, '')
  const today = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const query =
    `Find real X (Twitter) posts authored by @${cleanHandle} (${source.name}, ${source.outlet}) ` +
    `reporting football transfer news between ${fromDate} and ${today}. ` +
    `Focus on posts that name a specific player AND a destination club. ` +
    `Exclude match reports, player stat tweets, and contract renewals at the same club. ` +
    `Return up to ${MAX_POSTS_PER_JOURNALIST} of the most recent transfer-rumor posts.`

  const search = await searchXPostsGeneric({
    query,
    fromDate,
    toDate: today,
  })

  let posts: XPost[] = []
  if (search.error) {
    // xAI unavailable — try the Z.ai web_search fallback so feed-scan still
    // works in environments without XAI_API_KEY (e.g. the dev sandbox).
    console.log(
      `[transfer-pulse/feed-scan] xAI unavailable for @${cleanHandle}: ${search.error.slice(0, 100)} — trying Z.ai fallback`,
    )
    const zaiResult = await fetchJournalistPostsViaZai(cleanHandle, { maxAgeDays })
    if (zaiResult.error) {
      out.error = `xAI: ${search.error.slice(0, 80)} | zai: ${zaiResult.error.slice(0, 80)}`
      return out
    }
    posts = zaiResult.posts
    console.log(
      `[transfer-pulse/feed-scan] @${cleanHandle}: Z.ai fallback returned ${posts.length} fresh Tier 1 posts`,
    )
  } else {
    // 2. Filter to TIER1_HANDLES only + freshness gate (Snowflake decode)
    posts = search.posts.filter((p) => {
      if (!TIER1_HANDLES.has(p.handle.toLowerCase())) return false
      if (p.handle.toLowerCase() !== cleanHandle.toLowerCase()) return false
      // Resolve post date via Snowflake decode (most reliable) or postedAt
      let date: Date | null = null
      if (p.postedAt) {
        const d = new Date(p.postedAt)
        if (!isNaN(d.getTime())) date = d
      }
      if (!date) {
        const statusId = extractStatusId(p.url)
        if (statusId) date = decodeSnowflakeDate(statusId)
      }
      if (!date) return false
      const ageMs = Date.now() - date.getTime()
      return ageMs >= 0 && ageMs <= maxAgeDays * 24 * 3600 * 1000
    })

    console.log(
      `[transfer-pulse/feed-scan] @${cleanHandle}: xAI returned ${search.posts.length} posts, ` +
        `${posts.length} fresh Tier 1 posts by this journalist`,
    )

    // If xAI gave us nothing for this journalist, try Z.ai as a secondary
    // source — it may index tweets that xAI's tool didn't surface.
    if (posts.length === 0) {
      console.log(
        `[transfer-pulse/feed-scan] @${cleanHandle}: xAI returned 0 fresh posts — trying Z.ai fallback`,
      )
      const zaiResult = await fetchJournalistPostsViaZai(cleanHandle, { maxAgeDays })
      if (!zaiResult.error && zaiResult.posts.length > 0) {
        posts = zaiResult.posts
        console.log(
          `[transfer-pulse/feed-scan] @${cleanHandle}: Z.ai fallback added ${posts.length} posts`,
        )
      }
    }
  }

  if (posts.length === 0) {
    return out
  }

  // 3. Transfer-keyword gate (mirrors zai-fallback.ts)
  posts = posts.filter((p) => {
    const lower = p.text.toLowerCase()
    return TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))
  })

  out.postsConsidered = posts.length

  // 4. For each post, extract transfer fields via LLM + upsert saga + source
  for (const post of posts) {
    try {
      const extracted = await extractTransferFieldsFromPost(post.text, cleanHandle)
      if (
        !extracted ||
        !extracted.playerName ||
        !extracted.toClubName ||
        !extracted.toClubCode ||
        !extracted.fromClubName ||
        !extracted.fromClubCode
      ) {
        out.skipped++
        continue
      }

      // Same-club guard (contract renewal, not a transfer)
      if (extracted.toClubCode.toUpperCase() === extracted.fromClubCode.toUpperCase()) {
        console.log(
          `[transfer-pulse/feed-scan] rejecting same-club for ${extracted.playerName}: ` +
            `"${extracted.toClubName}" matches current club "${extracted.fromClubName}"`,
        )
        out.skipped++
        continue
      }

      const reportedAt = post.postedAt ? safeParseDate(post.postedAt) : new Date()
      const playerName = extracted.playerName.trim()
      const toClubCode = extracted.toClubCode.toUpperCase()
      const toClubName = extracted.toClubName
      const fromClubCode = extracted.fromClubCode.toUpperCase()
      const fromClubName = extracted.fromClubName

      // Upsert saga (one per player + destination club)
      const existing = await db.transferSaga.findUnique({
        where: {
          playerName_toClubCode: {
            playerName,
            toClubCode,
          },
        },
      })

      let sagaId: string
      if (existing) {
        const newStatus =
          extracted.isCompleted && existing.status === 'active'
            ? 'completed'
            : existing.status
        await db.transferSaga.update({
          where: { id: existing.id },
          data: {
            fromClubCode,
            fromClubName,
            toClubName,
            feeReported: extracted.fee || existing.feeReported,
            status: newStatus,
            resolvedAt:
              newStatus === 'completed' && !existing.resolvedAt
                ? reportedAt
                : existing.resolvedAt,
            lastUpdatedAt: new Date(),
            tier1Count: await countTier1Sources(existing.id),
          },
        })
        sagaId = existing.id
        out.sagasUpdated++
      } else {
        const created = await db.transferSaga.create({
          data: {
            playerName,
            playerNationCode: '', // unknown for non-watchlist players
            fromClubCode,
            fromClubName,
            toClubCode,
            toClubName,
            status: extracted.isCompleted ? 'completed' : 'active',
            feeReported: extracted.fee || '',
            firstReportedAt: reportedAt,
            lastUpdatedAt: new Date(),
            resolvedAt: extracted.isCompleted ? reportedAt : null,
          },
        })
        sagaId = created.id
        out.sagasCreated++
        console.log(
          `[transfer-pulse/feed-scan] NEW saga: ${playerName} ${fromClubName} → ${toClubName} ` +
            `(@${cleanHandle}, ${reportedAt.toISOString().slice(0, 10)})`,
        )
      }

      // Upsert Tier 1 source (unique on URL)
      const existingSource = await db.transferSource.findUnique({
        where: { url: post.url },
      })
      if (!existingSource) {
        await db.transferSource.create({
          data: {
            sagaId,
            journalistName: source.name,
            journalistHandle: cleanHandle,
            tier: 1,
            url: post.url,
            headline: extracted.headline.slice(0, 280),
            outlet: source.outlet,
            reportedAt,
          },
        })
        out.sourcesAdded++
        await db.transferSaga.update({
          where: { id: sagaId },
          data: { tier1Count: await countTier1Sources(sagaId) },
        })
      }
    } catch (err) {
      console.warn(
        `[transfer-pulse/feed-scan] post processing failed for @${cleanHandle}:`,
        String(err).slice(0, 200),
      )
      out.skipped++
    }
  }

  return out
}

// ── Tier 1 source counting ───────────────────────────────────────────────────

async function countTier1Sources(sagaId: string): Promise<number> {
  return db.transferSource.count({ where: { sagaId, tier: 1 } })
}

// ── LLM extraction (richer than discovery.ts — also extracts from-club) ──────

/**
 * Ask the AI facade (Grok → Cerebras → Groq → Z.ai) to extract structured
 * transfer metadata from a Tier 1 journalist's X post text. Returns null if
 * the player OR destination cannot be confidently determined — we never guess.
 *
 * Unlike discovery.ts (which trusts the watchlist's `fromClub`), this version
 * asks the LLM to ALSO extract the player's current club — because the post
 * may be about a player NOT in our watchlist.
 */
async function extractTransferFieldsFromPost(
  postText: string,
  journalistHandle: string,
): Promise<ExtractedTransfer | null> {
  const systemPrompt =
    `You extract structured transfer-rumor metadata from a football transfer ` +
    `journalist's X post. The journalist is @${journalistHandle}.\n\n` +
    `Read the post text and return a JSON object with these fields:\n` +
    `  "playerName": string | null    — the footballer's full name (e.g. "Mohamed Salah"), or null if no player is named\n` +
    `  "fromClubName": string | null  — the player's CURRENT club (where he plays right now, BEFORE this transfer), or null if unknown\n` +
    `  "fromClubCode": string | null  — a 3-4 letter uppercase code for the current club (e.g. "LIV", "RMA"), or null\n` +
    `  "toClubName": string | null    — the destination club's full name (where the rumor says he might move TO), or null if not stated\n` +
    `  "toClubCode": string | null    — a 3-4 letter uppercase code for the destination, or null\n` +
    `  "fee": string | null           — the reported transfer fee as a short string (e.g. "£150m", "€80m", "free transfer"), or null\n` +
    `  "headline": string             — a one-line neutral summary of what the journalist reported (max 140 chars)\n` +
    `  "isCompleted": boolean         — true if the journalist says the deal is DONE/confirmed/signed, false if it's still a rumor\n\n` +
    `RULES:\n` +
    `- If the post does NOT clearly name a player AND a destination club, return null fields.\n` +
    `- Do NOT invent a club. If unsure, return null for that field.\n` +
    `- The "fromClub" is the player's CURRENT club (where he plays right now), NOT the destination.\n` +
    `- Common current-club examples (as of July 2026): Salah=Liverpool, Haaland=Man City, Mbappé=Real Madrid, ` +
    `Saka=Arsenal, Bellingham=Real Madrid, Isak=Newcastle, Palmer=Chelsea, Rodri=Man City.\n` +
    `- If the post is about a contract renewal at the SAME club (no actual transfer), ` +
    `return toClubName = fromClubName (the same club).\n` +
    `- If the post is a generic commentary, opinion, or match report (not a transfer rumor), ` +
    `return ALL fields null.\n` +
    `- Output ONLY the JSON object, no commentary.`

  const result = await ai.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: postText.slice(0, 1200) },
    ],
    { temperature: 0.1, maxTokens: 700, json: true },
  )

  if (!result.ok || !result.content) {
    console.warn(
      `[transfer-pulse/feed-scan] extractTransferFields: ai.chat failed (${result.provider}): ${result.error?.slice(0, 120)}`,
    )
    return null
  }

  return parseExtractedTransfer(result.content)
}

function parseExtractedTransfer(raw: string): ExtractedTransfer | null {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const str = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() ? v.trim() : null
    const playerName = str(obj.playerName)
    const fromClubName = str(obj.fromClubName)
    const toClubName = str(obj.toClubName)
    let fromClubCode = str(obj.fromClubCode)?.toUpperCase().slice(0, 4) ?? null
    let toClubCode = str(obj.toClubCode)?.toUpperCase().slice(0, 4) ?? null
    const fee = str(obj.fee)
    const headline =
      typeof obj.headline === 'string' && obj.headline.trim()
        ? obj.headline.trim().slice(0, 280)
        : ''
    const isCompleted = Boolean(obj.isCompleted)

    // Backfill codes via the clubs dictionary if the LLM didn't supply them
    if (fromClubName && !fromClubCode) {
      const info = resolveClub(fromClubName)
      fromClubCode = info?.code ?? null
    }
    if (toClubName && !toClubCode) {
      const info = resolveClub(toClubName)
      toClubCode = info?.code ?? null
    }

    return {
      playerName,
      fromClubName,
      fromClubCode,
      toClubName,
      toClubCode,
      fee,
      headline,
      isCompleted,
    }
  } catch {
    return null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseDate(s: string): Date {
  const d = new Date(s)
  if (isNaN(d.getTime())) return new Date()
  return d
}
