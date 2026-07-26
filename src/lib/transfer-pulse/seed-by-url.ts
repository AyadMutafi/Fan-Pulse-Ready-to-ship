/**
 * Transfer Pulse — Seed-by-URL.
 *
 * Lets an admin paste a Tier 1 journalist's X post URL and have it analyzed
 * + added to the DB as a saga + source. This is the ESCAPE HATCH for when
 * the automated discovery/feed-scan misses a specific tweet that the user
 * can see but the search engine hasn't indexed yet.
 *
 * WHY THIS EXISTS (2026-07-26):
 *   The user reported 4 specific Romano tweet URLs that weren't appearing
 *   in the app. The feed-scan ran successfully but Z.ai web_search didn't
 *   return those specific URLs (Google/Bing don't index every tweet,
 *   especially same-day ones). The user reasonably expects: "I can see
 *   this tweet, why can't the app?" This module answers that by accepting
 *   the URL directly and processing it through the same anti-hallucination
 *   pipeline as feed-scan.
 *
 * ANTI-HALLUCINATION CONTRACT (preserved):
 *   - The URL MUST match ^https://x.com/<handle>/status/<digits>$
 *   - The handle MUST be in TIER1_HANDLES (Romano, Ornstein, etc.)
 *   - The post date is decoded from the Snowflake ID — we never trust
 *     user-supplied dates
 *   - Posts >60 days old are rejected (matches discovery.ts)
 *   - The post text is fetched via page_reader (Z.ai SDK) — we never
 *     fabricate text. If page_reader can't extract text, we reject.
 *   - The LLM extracts {player, fromClub, toClub, fee, isCompleted} from
 *     the fetched text. If it can't confidently identify player + destination,
 *     we reject — never guess.
 *
 * SECURITY:
 *   - Admin-only (the route handler enforces this)
 *   - The URL is validated BEFORE any network call
 *   - The handle is checked against TIER1_HANDLES before any DB write
 */

import { db } from '@/lib/db'
import { ai } from '@/lib/ai'
import ZAI from 'z-ai-web-dev-sdk'
import { TIER1_HANDLES, getTier1Source } from './tier1-sources'
import { resolveClub } from './clubs'
import { decodeSnowflakeDate, extractStatusId } from './zai-fallback'
import { verifyAndAdjustFromClub } from './verify-club'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SeedByUrlResult {
  ok: boolean
  url: string
  handle?: string
  postedAt?: string
  sagaId?: string
  sagaStatus?: 'created' | 'updated' | 'unchanged'
  playerName?: string
  fromClubName?: string
  toClubName?: string
  extractedStatus?: 'active' | 'completed'
  error?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_POST_AGE_DAYS = 60

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Process a single Tier 1 journalist's X post URL:
 *   1. Validate URL shape
 *   2. Verify the handle is in TIER1_HANDLES
 *   3. Decode the Snowflake ID to get the real post date
 *   4. Reject if >60 days old
 *   5. Fetch the post text via Z.ai page_reader
 *   6. Reject if no transfer keywords in the text
 *   7. Extract {player, fromClub, toClub, fee, isCompleted} via LLM
 *   8. Apply same-club guard (reject contract renewals)
 *   9. Upsert the saga + Tier 1 source
 *
 * Idempotent: if the URL is already a TransferSource, returns sagaStatus='unchanged'.
 */
export async function seedSagaByUrl(url: string): Promise<SeedByUrlResult> {
  const base: SeedByUrlResult = { ok: false, url }

  // 1. Validate URL shape
  const match = url.match(
    /^https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/i,
  )
  if (!match) {
    return { ...base, error: 'Invalid URL — must be https://x.com/<handle>/status/<id>' }
  }
  const handle = match[1]
  const statusId = match[2]

  // 2. Verify handle is Tier 1
  if (!TIER1_HANDLES.has(handle.toLowerCase())) {
    return {
      ...base,
      handle,
      error: `@${handle} is not in the Tier 1 journalist list — only Tier 1 posts can anchor sagas`,
    }
  }
  const source = getTier1Source(handle)
  if (!source) {
    return { ...base, handle, error: `Internal error: getTier1Source returned null for @${handle}` }
  }

  // 3. Decode Snowflake ID → real post date
  const postDate = decodeSnowflakeDate(statusId)
  if (!postDate) {
    return { ...base, handle, error: 'Could not decode post date from Snowflake ID' }
  }
  // 4. Freshness gate
  const ageDays = (Date.now() - postDate.getTime()) / (24 * 3600 * 1000)
  if (ageDays > MAX_POST_AGE_DAYS) {
    return {
      ...base,
      handle,
      postedAt: postDate.toISOString(),
      error: `Post is ${Math.round(ageDays)}d old — exceeds ${MAX_POST_AGE_DAYS}d freshness window`,
    }
  }

  // Idempotency: if URL already a source, return the existing saga
  const existingSource = await db.transferSource.findUnique({
    where: { url },
    select: { id: true, sagaId: true },
  })
  if (existingSource) {
    const saga = await db.transferSaga.findUnique({
      where: { id: existingSource.sagaId },
      select: { id: true, playerName: true, fromClubName: true, toClubName: true, status: true },
    })
    return {
      ...base,
      ok: true,
      handle,
      postedAt: postDate.toISOString(),
      sagaId: saga?.id,
      sagaStatus: 'unchanged',
      playerName: saga?.playerName,
      fromClubName: saga?.fromClubName,
      toClubName: saga?.toClubName,
    }
  }

  // 5. Fetch the post text via Z.ai page_reader
  let zai: any
  try {
    zai = await ZAI.create()
  } catch (err) {
    return { ...base, handle, postedAt: postDate.toISOString(), error: `ZAI init failed: ${String(err).slice(0, 100)}` }
  }

  let postText = ''
  try {
    const pageData = await zai.functions.invoke('page_reader', { url })
    const raw =
      pageData?.data?.html ||
      pageData?.data?.content ||
      (typeof pageData === 'string' ? pageData : '')
    if (raw) {
      // x.com pages embed tweet text in og:description / "description" JSON
      const ogMatch = raw.match(/"description"\s*:\s*"([^"]{15,500})"/i)
      if (ogMatch) {
        postText = ogMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ')
      } else {
        // Fall back to stripping HTML
        postText = stripHtml(raw).trim().slice(0, 1200)
      }
    }
  } catch (err) {
    return {
      ...base,
      handle,
      postedAt: postDate.toISOString(),
      error: `page_reader failed: ${String(err).slice(0, 120)}`,
    }
  }

  if (postText.length < 20) {
    return {
      ...base,
      handle,
      postedAt: postDate.toISOString(),
      error: 'Could not extract tweet text via page_reader (X login wall). Text too short.',
    }
  }

  // 6. Transfer-keyword gate
  const lowerText = postText.toLowerCase()
  const TRANSFER_KEYWORDS = [
    'transfer', 'deal', 'move', 'signing', 'signs', 'signed',
    'agrees', 'agreed', 'bid', 'offer', 'medical', 'contract',
    'here we go', 'launch', 'approach', 'talks', 'negotiat',
    'joining', 'joins', 'completed', 'confirmed', 'close to',
    'reaches', 'verbal', 'personal terms', 'fee',
  ]
  if (!TRANSFER_KEYWORDS.some((kw) => lowerText.includes(kw))) {
    return {
      ...base,
      handle,
      postedAt: postDate.toISOString(),
      error: 'Post text contains no transfer keyword — likely a non-transfer tweet',
    }
  }

  // 7. LLM extraction (reuses feed-scan.ts's prompt shape)
  const extracted = await extractTransferFieldsFromPost(postText, handle)
  if (
    !extracted ||
    !extracted.playerName ||
    !extracted.toClubName ||
    !extracted.toClubCode ||
    !extracted.fromClubName ||
    !extracted.fromClubCode
  ) {
    return {
      ...base,
      handle,
      postedAt: postDate.toISOString(),
      error: 'Could not confidently extract player + destination from the post text',
    }
  }

  // 8. Same-club guard
  if (extracted.toClubCode.toUpperCase() === extracted.fromClubCode.toUpperCase()) {
    return {
      ...base,
      handle,
      postedAt: postDate.toISOString(),
      error: `Same-club extraction (${extracted.fromClubName}) — likely a contract renewal, not a transfer`,
    }
  }

  // 9. Upsert saga + source
  const playerName = extracted.playerName.trim()
  const toClubCode = extracted.toClubCode.toUpperCase()
  const toClubName = extracted.toClubName
  const fromClubCode = extracted.fromClubCode.toUpperCase()
  const fromClubName = extracted.fromClubName

  const existing = await db.transferSaga.findUnique({
    where: { playerName_toClubCode: { playerName, toClubCode } },
  })

  let sagaId: string
  let sagaStatus: 'created' | 'updated' = 'created'
  if (existing) {
    const newStatus =
      extracted.isCompleted && existing.status === 'active' ? 'completed' : existing.status
    await db.transferSaga.update({
      where: { id: existing.id },
      data: {
        fromClubCode,
        fromClubName,
        toClubName,
        feeReported: extracted.fee || existing.feeReported,
        status: newStatus,
        resolvedAt: newStatus === 'completed' && !existing.resolvedAt ? postDate : existing.resolvedAt,
        lastUpdatedAt: new Date(),
        tier1Count: await db.transferSource.count({ where: { sagaId: existing.id, tier: 1 } }),
      },
    })
    sagaId = existing.id
    sagaStatus = 'updated'
  } else {
    // ── WEB-VERIFIED FROM-CLUB GATE (added 2026-07-26) ─────────────────
    // Before creating a NEW saga, verify the player's actual current club
    // via web_search. The LLM extraction above can have stale "current club"
    // knowledge (e.g. it thinks Tielemans is at Leicester when he's actually
    // at Aston Villa). See feed-scan.ts for the same gate, and
    // src/lib/transfer-pulse/verify-club.ts for the full logic.
    let adjustedFromClubCode = fromClubCode
    let adjustedFromClubName = fromClubName
    let adjustedIsCompleted = extracted.isCompleted

    try {
      const decision = await verifyAndAdjustFromClub({
        playerName,
        fromClubName,
        fromClubCode,
        toClubName,
        toClubCode,
      })
      console.log(
        `[transfer-pulse/seed-by-url] verify-club: ${playerName} → ${decision.decision} ` +
          `(${decision.reason.slice(0, 100)})`,
      )
      if (decision.decision === 'reject') {
        return {
          ...base,
          ok: false,
          handle,
          postedAt: postDate.toISOString(),
          error: `web verification rejected: ${decision.reason.slice(0, 160)}`,
        }
      }
      adjustedFromClubCode = decision.fromClubCode
      adjustedFromClubName = decision.fromClubName
      if (decision.decision === 'mark-completed') {
        adjustedIsCompleted = true
      }
    } catch (err) {
      // Fail open — if verification errors out, trust the LLM extraction.
      console.warn(
        `[transfer-pulse/seed-by-url] verify-club failed for ${playerName}, failing open: ${String(err).slice(0, 100)}`,
      )
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
        firstReportedAt: postDate,
        lastUpdatedAt: new Date(),
        resolvedAt: adjustedIsCompleted ? postDate : null,
      },
    })
    sagaId = created.id
    sagaStatus = 'created'
  }

  await db.transferSource.create({
    data: {
      sagaId,
      journalistName: source.name,
      journalistHandle: handle,
      tier: 1,
      url,
      headline: extracted.headline.slice(0, 280),
      outlet: source.outlet,
      reportedAt: postDate,
    },
  })
  await db.transferSaga.update({
    where: { id: sagaId },
    data: { tier1Count: await db.transferSource.count({ where: { sagaId, tier: 1 } }) },
  })

  console.log(
    `[transfer-pulse/seed-by-url] ${sagaStatus} saga: ${playerName} ${fromClubName} → ${toClubName} ` +
      `(@${handle}, ${postDate.toISOString().slice(0, 10)})`,
  )

  return {
    ok: true,
    url,
    handle,
    postedAt: postDate.toISOString(),
    sagaId,
    sagaStatus,
    playerName,
    fromClubName,
    toClubName,
    extractedStatus: extracted.isCompleted ? 'completed' : 'active',
  }
}

// ── LLM extraction (mirrors feed-scan.ts) ────────────────────────────────────

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
      `[transfer-pulse/seed-by-url] extractTransferFields: ai.chat failed (${result.provider}): ${result.error?.slice(0, 120)}`,
    )
    return null
  }

  let cleaned = result.content.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const str = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() ? v.trim() : null
    const playerName = str(obj.playerName)
    let fromClubName = str(obj.fromClubName)
    let toClubName = str(obj.toClubName)
    let fromClubCode = str(obj.fromClubCode)?.toUpperCase().slice(0, 4) ?? null
    let toClubCode = str(obj.toClubCode)?.toUpperCase().slice(0, 4) ?? null
    const fee = str(obj.fee)
    const headline =
      typeof obj.headline === 'string' && obj.headline.trim()
        ? obj.headline.trim().slice(0, 280)
        : ''
    const isCompleted = Boolean(obj.isCompleted)

    if (fromClubName && !fromClubCode) {
      const info = resolveClub(fromClubName)
      fromClubCode = info?.code ?? null
    }
    if (toClubName && !toClubCode) {
      const info = resolveClub(toClubName)
      toClubCode = info?.code ?? null
    }
    // Backfill names from codes if the LLM gave only codes
    if (fromClubCode && !fromClubName) {
      const info = resolveClub(fromClubCode)
      fromClubName = info?.name ?? null
    }
    if (toClubCode && !toClubName) {
      const info = resolveClub(toClubCode)
      toClubName = info?.name ?? null
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

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
