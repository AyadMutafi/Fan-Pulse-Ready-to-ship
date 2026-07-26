/**
 * Transfer Pulse — PUSH-based Tier 1 Feed Scanner (FULL COVERAGE).
 *
 * PROBLEM (2026-07-26, user report):
 *   The previous version of this module only scanned 3 rotating Tier 1
 *   journalists per run (always the top-3 by reliability: Romano, Ornstein,
 *   Di Marzio). The user reported "there are at least 50+ rumors here reported
 *   by Tier 1 journalists — why are they not showing?" The answer: only 3 of
 *   33 configured Tier 1 journalists were being scanned, so ~90% of Tier 1
 *   rumors never entered the system.
 *
 * SOLUTION (this version):
 *   Scan ALL Tier 1 journalists on every run. To keep latency + xAI budget
 *   reasonable, journalists are batched into groups of JOURNALISTS_PER_BATCH
 *   and each batch is fetched via a SINGLE xAI x_search call that asks for
 *   recent transfer posts from those specific handles. Batches run with
 *   bounded concurrency (BATCH_CONCURRENCY at a time) so the full sweep of
 *   33 journalists completes in ~1 minute.
 *
 *   This module runs the OPPOSITE direction from `discovery.ts`: it asks
 *   "what transfers have Tier 1 journalists reported recently?" — and
 *   creates/upserts sagas for ALL of them, regardless of watchlist.
 *
 * ANTI-HALLUCINATION CONTRACT (preserved):
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
 *   - Web-verified from-club gate on NEW saga creation (verify-club.ts).
 */

import { db } from '@/lib/db'
import { ai } from '@/lib/ai'
import { searchXPostsGeneric, type XPost } from '@/lib/grok-x-search'
import { TIER1_SOURCES, TIER1_HANDLES, getTier1Source } from './tier1-sources'
import { resolveClub } from './clubs'
import { decodeSnowflakeDate, extractStatusId } from './zai-fallback'
import { fetchJournalistPostsViaZai } from './zai-fallback'
import { verifyAndAdjustFromClub } from './verify-club'

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

/**
 * How many journalists to pack into a SINGLE xAI x_search call. Batching
 * keeps the total number of (slow) API calls low while still covering all
 * Tier 1 journalists. 5 handles per call is a good balance — the model can
 * return up to ~15 posts for the batch without truncating.
 */
const JOURNALISTS_PER_BATCH = 5

/**
 * How many xAI batches to run in PARALLEL. Higher = faster but risks xAI
 * rate limits (429). 3 parallel batches × 10-15s each ≈ 30-60s per wave.
 * With 33 journalists / 5 per batch = 7 batches / 3 parallel = 3 waves.
 */
const BATCH_CONCURRENCY = 3

/** Max posts to ask xAI for per batch (covers all journalists in the batch). */
const MAX_POSTS_PER_BATCH = 15

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
 * DEFAULT BEHAVIOR (changed 2026-07-26): scans ALL configured Tier 1
 * journalists on every run (batched + parallel). This ensures every rumor
 * reported by any Tier 1 journalist enters the system, per user request.
 *
 * @param opts.journalistHandles  specific handles to scan this run (default:
 *                                ALL TIER1_SOURCES, batched + parallel)
 * @param opts.maxAgeDays         reject posts older than this (default 14)
 * @param opts.skipVerifyClub     skip the web_search from-club verification
 *                                gate (use for fast bulk scans; the next
 *                                auto-refresh cycle will verify clubs)
 */
export async function scanTier1Feeds(opts: {
  journalistHandles?: string[]
  maxAgeDays?: number
  skipVerifyClub?: boolean
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
  const skipVerifyClub = opts.skipVerifyClub ?? false

  // Resolve the journalist set for this run.
  // DEFAULT: scan ALL Tier 1 journalists (full coverage per user request).
  let handles: string[]
  if (opts.journalistHandles && opts.journalistHandles.length > 0) {
    handles = opts.journalistHandles
  } else {
    // Full coverage — every Tier 1 journalist, every run.
    handles = TIER1_SOURCES.map((s) => s.handle.replace(/^@/, ''))
  }

  result.journalistsScanned = handles.length
  console.log(
    `[transfer-pulse/feed-scan] starting FULL Tier 1 sweep: ${handles.length} journalists, ` +
      `batched ${JOURNALISTS_PER_BATCH}/call, ${BATCH_CONCURRENCY} parallel` +
      `${skipVerifyClub ? ', skipVerifyClub=true' : ''}`,
  )

  // Batch handles into groups for parallel xAI calls
  const batches: string[][] = []
  for (let i = 0; i < handles.length; i += JOURNALISTS_PER_BATCH) {
    batches.push(handles.slice(i, i + JOURNALISTS_PER_BATCH))
  }

  // Run batches with bounded concurrency
  const batchResults = await runWithConcurrency(
    batches.map((batch) => () => scanBatch(batch, maxAgeDays, skipVerifyClub)),
    BATCH_CONCURRENCY,
  )

  // Aggregate results
  for (let i = 0; i < batchResults.length; i++) {
    const r = batchResults[i]
    if (r.error) {
      result.errors.push(`batch[${batches[i].join(',')}]${r.error}`)
    }
    result.postsConsidered += r.postsConsidered
    result.sagasCreated += r.sagasCreated
    result.sagasUpdated += r.sagasUpdated
    result.sourcesAdded += r.sourcesAdded
    result.skipped += r.skipped
  }

  result.durationMs = Date.now() - startedAt
  console.log(
    `[transfer-pulse/feed-scan] FULL sweep done in ${(result.durationMs / 1000).toFixed(1)}s: ` +
      `journalists=${result.journalistsScanned} posts=${result.postsConsidered} ` +
      `created=${result.sagasCreated} updated=${result.sagasUpdated} ` +
      `sources=${result.sourcesAdded} skipped=${result.skipped} ` +
      `errors=${result.errors.length}`,
  )
  return result
}

// ── Concurrency helper ───────────────────────────────────────────────────────

/**
 * Run async tasks with bounded concurrency. Returns results in the SAME
 * order as the input tasks (not completion order) so callers can correlate.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0
  async function worker() {
    while (true) {
      const idx = nextIndex++
      if (idx >= tasks.length) return
      try {
        results[idx] = await tasks[idx]()
      } catch (err) {
        // Re-throw wrapped — caller handles per-task errors via the result shape
        results[idx] = { error: String(err).slice(0, 200) } as unknown as T
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ── Batch scan (one xAI call for N journalists) ──────────────────────────────

interface BatchResult {
  postsConsidered: number
  sagasCreated: number
  sagasUpdated: number
  sourcesAdded: number
  skipped: number
  error?: string
}

async function scanBatch(
  handles: string[],
  maxAgeDays: number,
  skipVerifyClub: boolean = false,
): Promise<BatchResult> {
  const out: BatchResult = {
    postsConsidered: 0,
    sagasCreated: 0,
    sagasUpdated: 0,
    sourcesAdded: 0,
    skipped: 0,
  }
  if (handles.length === 0) return out

  const today = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Build a single query asking for transfer posts from ALL handles in the batch
  const handleList = handles.map((h) => `@${h}`).join(', ')
  const sources = handles
    .map((h) => {
      const s = getTier1Source(h)
      return s ? `${s.name} (@${h}, ${s.outlet})` : `@${h}`
    })
    .join('; ')

  const query =
    `Find real X (Twitter) posts authored by these football transfer journalists: ${handleList}. ` +
    `Journalist details: ${sources}. ` +
    `Find posts published between ${fromDate} and ${today} that report a football transfer — ` +
    `the post MUST name a specific player AND a destination club. ` +
    `Include posts about: completed signings, agreed deals, bids, medicals, "here we go", ` +
    `contract talks with a new club, or confirmed transfers. ` +
    `EXCLUDE: match reports, player stats, contract renewals at the SAME club, ` +
    `generic commentary, and retweets with no original reporting. ` +
    `Return up to ${MAX_POSTS_PER_BATCH} of the most recent transfer-rumor posts from these journalists.`

  const search = await searchXPostsGeneric({
    query,
    fromDate,
    toDate: today,
    maxPosts: MAX_POSTS_PER_BATCH,
  })

  let posts: XPost[] = []
  if (search.error) {
    // xAI unavailable — try Z.ai fallback for each journalist in the batch
    console.log(
      `[transfer-pulse/feed-scan] batch [${handles.join(',')}] xAI unavailable: ` +
        `${search.error.slice(0, 80)} — trying Z.ai fallback`,
    )
    for (const h of handles) {
      try {
        const zaiResult = await fetchJournalistPostsViaZai(h, { maxAgeDays })
        if (!zaiResult.error && zaiResult.posts.length > 0) {
          posts = posts.concat(zaiResult.posts)
        }
      } catch (err) {
        out.error = `zai@${h}: ${String(err).slice(0, 80)}`
      }
    }
    if (posts.length === 0) {
      out.error = `xAI: ${search.error.slice(0, 60)} | zai: no posts`
      return out
    }
    console.log(
      `[transfer-pulse/feed-scan] batch [${handles.join(',')}] Z.ai fallback returned ${posts.length} posts`,
    )
  } else {
    // Filter to TIER1_HANDLES only + freshness gate
    posts = search.posts.filter((p) => {
      if (!TIER1_HANDLES.has(p.handle.toLowerCase())) return false
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
      `[transfer-pulse/feed-scan] batch [${handles.join(',')}] xAI returned ${search.posts.length} posts, ` +
        `${posts.length} fresh Tier 1 posts`,
    )

    // If xAI gave nothing for this batch, try Z.ai as secondary
    if (posts.length === 0) {
      console.log(
        `[transfer-pulse/feed-scan] batch [${handles.join(',')}] xAI 0 posts — trying Z.ai fallback`,
      )
      for (const h of handles) {
        try {
          const zaiResult = await fetchJournalistPostsViaZai(h, { maxAgeDays })
          if (!zaiResult.error && zaiResult.posts.length > 0) {
            posts = posts.concat(zaiResult.posts)
          }
        } catch {
          // ignore individual failures
        }
      }
    }
  }

  if (posts.length === 0) {
    return out
  }

  // Deduplicate posts by URL (xAI + Z.ai may overlap)
  const seenUrls = new Set<string>()
  posts = posts.filter((p) => {
    if (seenUrls.has(p.url)) return false
    seenUrls.add(p.url)
    return true
  })

  // Transfer-keyword gate
  posts = posts.filter((p) => {
    const lower = p.text.toLowerCase()
    return TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))
  })

  out.postsConsidered = posts.length

  // For each post, extract transfer fields via LLM + upsert saga + source
  for (const post of posts) {
    try {
      const cleanHandle = post.handle
      const source = getTier1Source(cleanHandle)
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
        // ── WEB-VERIFIED FROM-CLUB GATE ───────────────────────────────────
        // Before creating a NEW saga, verify the player's actual current club
        // via web_search. The LLM extraction can have stale "current club"
        // knowledge. Web search is always fresher than LLM training data.
        // SKIPPED when skipVerifyClub=true (bulk scan mode) — the next
        // auto-refresh cycle will verify clubs for newly-created sagas.
        let adjustedFromClubCode = fromClubCode
        let adjustedFromClubName = fromClubName
        let adjustedIsCompleted = extracted.isCompleted

        if (!skipVerifyClub) {
          try {
            const decision = await verifyAndAdjustFromClub({
              playerName,
              fromClubName,
              fromClubCode,
              toClubName,
              toClubCode,
            })
            console.log(
              `[transfer-pulse/feed-scan] verify-club: ${playerName} → ${decision.decision} ` +
                `(${decision.reason.slice(0, 80)})`,
            )
            if (decision.decision === 'reject') {
              out.skipped++
              continue
            }
            adjustedFromClubCode = decision.fromClubCode
            adjustedFromClubName = decision.fromClubName
            if (decision.decision === 'mark-completed') {
              adjustedIsCompleted = true
            }
          } catch (err) {
            console.warn(
              `[transfer-pulse/feed-scan] verify-club failed for ${playerName}, failing open: ${String(err).slice(0, 80)}`,
            )
          }
        }

        const created = await db.transferSaga.create({
          data: {
            playerName,
            playerNationCode: '',
            fromClubCode: adjustedFromClubCode,
            fromClubName: adjustedFromClubName,
            toClubCode,
            toClubName,
            status: adjustedIsCompleted ? 'completed' : 'active',
            feeReported: extracted.fee || '',
            firstReportedAt: reportedAt,
            lastUpdatedAt: new Date(),
            resolvedAt: adjustedIsCompleted ? reportedAt : null,
          },
        })
        sagaId = created.id
        out.sagasCreated++
        console.log(
          `[transfer-pulse/feed-scan] NEW saga: ${playerName} ${adjustedFromClubName} → ${toClubName} ` +
            `(@${cleanHandle}, ${reportedAt.toISOString().slice(0, 10)}, ${adjustedIsCompleted ? 'completed' : 'active'})`,
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
            journalistName: source?.name ?? cleanHandle,
            journalistHandle: cleanHandle,
            tier: 1,
            url: post.url,
            headline: extracted.headline.slice(0, 280),
            outlet: source?.outlet ?? 'Independent',
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
        `[transfer-pulse/feed-scan] post processing failed:`,
        String(err).slice(0, 160),
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
      `[transfer-pulse/feed-scan] extractTransferFields: ai.chat failed (${result.provider}): ${result.error?.slice(0, 100)}`,
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
