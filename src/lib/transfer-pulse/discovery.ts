/**
 * Transfer Pulse — Discovery pipeline.
 *
 * For each tracked player, asks Grok's x_search tool for X posts about their
 * transfer, then keeps ONLY the posts authored by a Tier 1 journalist
 * (handle verified against TIER1_HANDLES). Each such post anchors a saga.
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   - A saga is ONLY created if a Tier 1 journalist's OWN X post is found.
 *     A fan quoting Fabrizio Romano is rejected (the fan's handle != Romano's).
 *   - The destination club is extracted from the journalist's post text by an
 *     LLM. If the LLM cannot confidently determine a destination, the post is
 *     discarded — we never guess.
 *   - ENTITY RESOLUTION (added 2026-07-22): before a saga is created, an LLM
 *     verifies that the player's current club matches `fromClubName`. This
 *     prevents the "Ederson" entity-confusion incident where Tier 1 posts
 *     about the Atalanta MF Ederson were misattributed to the Man City GK
 *     Ederson, fabricating a "Man City → Atalanta" transfer that doesn't
 *     exist. If verification fails, the post is rejected.
 *   - The journalist's real X post URL becomes the TransferSource.url. The
 *     URL must match the real X post pattern (enforced in grok-x-search).
 *   - Duplicate sources (same URL) are never double-counted (@unique).
 *   - Debunked sagas are never deleted — only their status changes.
 */

import { db } from '@/lib/db'
import { ai } from '@/lib/ai'
import { searchXPostsGeneric, type XPost } from '@/lib/grok-x-search'
import { TIER1_HANDLES, getTier1Source } from './tier1-sources'
import { TRACKED_PLAYERS, type TrackedPlayer } from './tracked-players'
import { fetchTier1PostsViaZai, decodeSnowflakeDate, extractStatusId } from './zai-fallback'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveryResult {
  playersScanned: number
  sagasCreated: number
  sagasUpdated: number
  sourcesAdded: number
  skipped: number
  errors: string[]
  durationMs: number
}

interface ExtractedTransfer {
  toClubName: string | null
  toClubCode: string | null
  fee: string | null
  headline: string
  isCompleted: boolean
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Discover transfer sagas for a batch of tracked players.
 *
 * Processes players in a rotating window so the cron can cycle through the
 * full watchlist without hammering the xAI API.
 *
 * SYSTEMIC STALENESS GUARD (added 2026-07-26):
 *   Before running discovery for a player, `checkPlayerAlreadyMoved()` asks
 *   the AI whether the player has already completed a transfer AWAY from
 *   their watchlist `fromClubName`. If yes, ALL of that player's active
 *   sagas are marked `completed` (or `debunked` if the actual destination
 *   differs from the saga's `toClubName`), and the player is SKIPPED for
 *   the rest of this discovery run. This prevents the "Wirtz → Man City"
 *   class of bug where a player who already moved keeps getting surfaced
 *   as an active rumor based on stale pre-move Tier 1 posts.
 *
 * @param opts.maxPlayers  how many players to scan this run (default 5)
 * @param opts.offset      starting index into TRACKED_PLAYERS (default 0)
 * @param opts.playerName  scan a single named player instead of a batch
 */
export async function discoverTransferSagas(opts: {
  maxPlayers?: number
  offset?: number
  playerName?: string
} = {}): Promise<DiscoveryResult> {
  const startedAt = Date.now()
  const result: DiscoveryResult = {
    playersScanned: 0,
    sagasCreated: 0,
    sagasUpdated: 0,
    sourcesAdded: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  }

  // Resolve the batch of players to scan
  let batch: TrackedPlayer[]
  if (opts.playerName) {
    const found = TRACKED_PLAYERS.find(
      (p) => p.name.toLowerCase() === opts.playerName!.toLowerCase(),
    )
    batch = found ? [found] : []
    if (batch.length === 0) {
      result.errors.push(`Player not in watchlist: ${opts.playerName}`)
      result.durationMs = Date.now() - startedAt
      return result
    }
  } else {
    const max = opts.maxPlayers ?? 5
    const offset = opts.offset ?? 0
    batch = TRACKED_PLAYERS.slice(offset, offset + max)
  }

  for (const player of batch) {
    result.playersScanned++
    try {
      // ── STALENESS GUARD ──────────────────────────────────────────────────
      // Before spending xAI/LLM budget on discovery, check whether the player
      // has ALREADY moved. If so, resolve their sagas and skip discovery.
      const movedCheck = await checkPlayerAlreadyMoved(player)
      if (movedCheck.alreadyMoved) {
        console.log(
          `[transfer-pulse/discovery] ${player.name} already moved to ${movedCheck.actualClub} ` +
            `(watchlist had ${player.fromClubName}) — resolving sagas and skipping discovery`,
        )
        const resolved = await resolvePlayerSagas(
          player,
          movedCheck.actualClub ?? 'unknown',
          movedCheck.confidence,
        )
        result.sagasUpdated += resolved
        result.skipped += 1
        continue
      }

      const outcome = await discoverForPlayer(player)
      result.sagasCreated += outcome.sagasCreated
      result.sagasUpdated += outcome.sagasUpdated
      result.sourcesAdded += outcome.sourcesAdded
      result.skipped += outcome.skipped
      if (outcome.error) result.errors.push(`${player.name}: ${outcome.error}`)
    } catch (err) {
      result.errors.push(`${player.name}: ${String(err).slice(0, 200)}`)
    }
  }

  result.durationMs = Date.now() - startedAt
  return result
}

// ── Per-player discovery ─────────────────────────────────────────────────────

async function discoverForPlayer(
  player: TrackedPlayer,
): Promise<{
  sagasCreated: number
  sagasUpdated: number
  sourcesAdded: number
  skipped: number
  error?: string
}> {
  const out = { sagasCreated: 0, sagasUpdated: 0, sourcesAdded: 0, skipped: 0 }

  // 1. Search X for posts about this player's transfer
  const query =
    `Find real X (Twitter) posts by football transfer journalists reporting ` +
    `a possible transfer of ${player.name} (currently at ${player.fromClubName}) ` +
    `during the summer 2026 window. Look especially for posts from Fabrizio ` +
    `Romano, David Ornstein, Florian Plettenberg, Matteo Moretto, and other ` +
    `known transfer journalists. Return posts that name a destination club.`
  const today = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const search = await searchXPostsGeneric({
    query,
    fromDate,
    toDate: today,
  })

  // ── Tier 1 post collection ─────────────────────────────────────────────
  // Primary: xAI x_search (if XAI_API_KEY configured).
  // Fallback: Z.ai web_search with site:x.com queries (works in sandbox
  //   without an explicit API key — the SDK auto-initializes).
  // We MERGE both sources and dedupe by URL so the widest coverage wins.
  let tier1Posts: XPost[] = []
  let primaryError: string | undefined

  if (search.error) {
    primaryError = search.error
    console.log(
      `[transfer-pulse/discovery] xAI search unavailable for ${player.name}: ${search.error.slice(0, 100)}`,
    )
  } else {
    // Filter to Tier 1 journalists AND enforce freshness (≤60 days).
    // The Snowflake ID decoder gives us the real post date from the URL,
    // so this works even if xAI doesn't return a postedAt timestamp.
    const MAX_TIER1_AGE_DAYS = 60
    tier1Posts = search.posts.filter((p) => {
      if (!TIER1_HANDLES.has(p.handle.toLowerCase())) return false
      // Resolve the post date: postedAt field, or Snowflake decode fallback
      let date: Date | null = null
      if (p.postedAt) {
        const d = new Date(p.postedAt)
        if (!isNaN(d.getTime())) date = d
      }
      if (!date) {
        const statusId = extractStatusId(p.url)
        if (statusId) date = decodeSnowflakeDate(statusId)
      }
      if (!date) return false // no date = reject (anti-hallucination)
      const ageMs = Date.now() - date.getTime()
      return ageMs >= 0 && ageMs <= MAX_TIER1_AGE_DAYS * 24 * 3600 * 1000
    })
    console.log(
      `[transfer-pulse/discovery] xAI: ${search.posts.length} posts, ${tier1Posts.length} fresh Tier 1 for ${player.name}`,
    )
  }

  // If xAI gave us nothing (key missing OR 0 Tier 1 posts), try Z.ai fallback
  if (tier1Posts.length === 0) {
    console.log(`[transfer-pulse/discovery] trying Z.ai fallback for ${player.name}`)
    // maxAgeDays=60: only accept Tier 1 reports from the last 60 days.
    // This prevents last year's tweets from appearing as "current news."
    const zaiResult = await fetchTier1PostsViaZai(player, { maxAgeDays: 60 })
    if (zaiResult.error) {
      console.log(
        `[transfer-pulse/discovery] Z.ai fallback error: ${zaiResult.error.slice(0, 100)}`,
      )
    } else if (zaiResult.posts.length > 0) {
      // Merge + dedupe by URL
      const seen = new Set(tier1Posts.map((p) => p.url))
      for (const p of zaiResult.posts) {
        if (!seen.has(p.url)) {
          tier1Posts.push(p)
          seen.add(p.url)
        }
      }
      console.log(
        `[transfer-pulse/discovery] Z.ai fallback: +${zaiResult.posts.length} fresh Tier 1 posts for ${player.name}`,
      )
    }
  }

  if (tier1Posts.length === 0) {
    // No Tier 1 anchor from either source → no saga created (anti-hallucination)
    out.skipped = 1
    if (primaryError) out.error = primaryError
    return out
  }

  // ── ENTITY-RESOLUTION GATE (added 2026-07-22) ──────────────────────────────
  // Verify ONCE per player that the Tier 1 posts are actually about THIS
  // tracked player (current club = fromClubName). Without this gate, posts
  // about the Atalanta MF "Ederson" can be misattributed to the Man City GK
  // "Ederson", fabricating a "Man City → Atalanta" saga that doesn't exist.
  //
  // We pass ALL the Tier 1 posts in one LLM call (concatenated) so we only
  // make one verification request per player, not one per post — important
  // for staying under Z.ai's rate limit. If verification fails, ALL posts
  // for this player are rejected.
  //
  // Skip the gate if the player already has any existing saga in the DB —
  // we trust prior verification and only need to add new Tier 1 sources.
  const hasExistingSaga = await db.transferSaga.findFirst({
    where: { playerName: player.name },
    select: { id: true },
  })
  if (!hasExistingSaga) {
    const combinedPostText = tier1Posts
      .slice(0, 5)
      .map((p, i) => `POST ${i + 1} (@${p.handle}):\n${p.text.slice(0, 400)}`)
      .join('\n\n')
    const verification = await verifyPlayerCurrentClub(
      combinedPostText,
      player.name,
      player.fromClubName,
    )
    if (!verification.verified) {
      console.log(
        `[transfer-pulse/discovery] rejecting ALL Tier 1 posts for ${player.name}: ` +
          `posts are about "${verification.actualClub ?? 'unknown'}", not "${player.fromClubName}" — ` +
          `likely a same-name-different-player confusion (e.g. Ederson GK vs Ederson MF)`,
      )
      out.skipped = 1
      return out
    }
  }

  // 3. For each Tier 1 post, extract destination club + upsert saga + source
  for (const post of tier1Posts) {
    const source = getTier1Source(post.handle)
    if (!source) continue

    const extracted = await extractTransferFields(post.text, player.name)
    if (!extracted || !extracted.toClubName || !extracted.toClubCode) {
      // Could not confidently determine destination → skip this post
      continue
    }

    const toClubCode = extracted.toClubCode.toUpperCase()
    const toClubName = extracted.toClubName
    const reportedAt = post.postedAt ? safeParseDate(post.postedAt) : new Date()

    // ── SAME-CLUB GUARD (added 2026-07-21) ─────────────────────────────────
    // If the LLM extracted a destination that matches the player's CURRENT club,
    // this is a contract renewal / "stay" post, NOT a transfer. Reject it.
    // This fixes the "Bruno Fernandes Man United → Manchester United" and
    // "Marcus Rashford Man United → Manchester United" bad sagas where Romano
    // posts about contract talks were misclassified as same-club transfers.
    if (
      toClubCode.toUpperCase() === player.fromClubCode.toUpperCase() ||
      toClubName.toLowerCase().includes(player.fromClubName.toLowerCase()) ||
      player.fromClubName.toLowerCase().includes(toClubName.toLowerCase())
    ) {
      console.log(
        `[transfer-pulse/discovery] rejecting same-club extraction for ${player.name}: ` +
          `"${toClubName}" matches current club "${player.fromClubName}" — likely a contract-renewal post, not a transfer`,
      )
      continue
    }

    // ── ENTITY-NAME-OVERLAP GUARD (added 2026-07-26) ───────────────────────
    // Reject posts where the text mentions a DIFFERENT player whose name
    // CONTAINS the tracked player's name as a substring — e.g. a post about
    // "Álvaro Rodríguez" should NOT create a saga for "Rodri" (Man City MF),
    // even though "Rodríguez" contains "Rodri". This class of false-match
    // created the bad "Rodri → Bournemouth" saga from a Romano post that was
    // actually about Álvaro Rodríguez (Elche → Bournemouth).
    //
    // Heuristic: if the post text contains a longer name that starts with or
    // contains the tracked player's name AND the tracked player's EXACT full
    // name does NOT appear as a standalone token in the post, reject it.
    const entityOverlap = hasEntityNameOverlap(post.text, player.name)
    if (entityOverlap) {
      console.log(
        `[transfer-pulse/discovery] rejecting entity-name-overlap for ${player.name}: ` +
          `post appears to be about "${entityOverlap}" (a different player whose name contains "${player.name}")`,
      )
      continue
    }

    // Upsert the saga (one per player + destination club)
    const existing = await db.transferSaga.findUnique({
      where: {
        playerName_toClubCode: {
          playerName: player.name,
          toClubCode,
        },
      },
    })

    let sagaId: string
    if (existing) {
      // Update metadata; keep status unless the journalist confirmed completion
      const newStatus =
        extracted.isCompleted && existing.status === 'active'
          ? 'completed'
          : existing.status
      await db.transferSaga.update({
        where: { id: existing.id },
        data: {
          fromClubCode: player.fromClubCode,
          fromClubName: player.fromClubName,
          toClubName,
          feeReported: extracted.fee || existing.feeReported,
          playerNationCode: player.nationCode,
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
          playerName: player.name,
          playerNationCode: player.nationCode,
          fromClubCode: player.fromClubCode,
          fromClubName: player.fromClubName,
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
    }

    // Upsert the Tier 1 source (unique on URL — never double-counted)
    const existingSource = await db.transferSource.findUnique({
      where: { url: post.url },
    })
    if (!existingSource) {
      await db.transferSource.create({
        data: {
          sagaId,
          journalistName: source.name,
          // Store the handle WITHOUT the leading '@' to match existing DB
          // rows and the UI render convention (`@{s.journalistHandle}` in
          // TransferSagaDetail.tsx). Tier1Source.handle carries the '@' for
          // display, so we strip it here.
          journalistHandle: source.handle.replace(/^@/, ''),
          tier: 1,
          url: post.url,
          headline: extracted.headline.slice(0, 280),
          outlet: source.outlet,
          reportedAt,
        },
      })
      out.sourcesAdded++
      // Recompute tier1Count for the saga
      await db.transferSaga.update({
        where: { id: sagaId },
        data: { tier1Count: await countTier1Sources(sagaId) },
      })
    }
  }

  return out
}

// ── Tier 1 source counting ───────────────────────────────────────────────────

async function countTier1Sources(sagaId: string): Promise<number> {
  return db.transferSource.count({ where: { sagaId, tier: 1 } })
}

// ── LLM extraction of transfer fields ────────────────────────────────────────

/**
 * Ask the AI facade (Grok → Cerebras → Groq → Z.ai) to extract structured
 * transfer metadata from a Tier 1 journalist's X post text. Returns null if
 * the destination cannot be confidently determined — we never guess.
 */
async function extractTransferFields(
  postText: string,
  playerName: string,
): Promise<ExtractedTransfer | null> {
  const systemPrompt =
    `You extract structured transfer-rumor metadata from a football journalist's ` +
    `X post. The player is ${playerName}. Read the post text and return a JSON ` +
    `object with these fields:\n` +
    `  "toClubName": string | null   — the destination club's full name, or null if not stated\n` +
    `  "toClubCode": string | null   — a 3-4 letter uppercase code for the destination (e.g. "LIV", "RMA", "SAU"), or null\n` +
    `  "fee": string | null          — the reported transfer fee as a short string (e.g. "£150m", "€80m", "free transfer"), or null\n` +
    `  "headline": string            — a one-line neutral summary of what the journalist reported (max 140 chars)\n` +
    `  "isCompleted": boolean        — true if the journalist says the deal is DONE/confirmed/signed, false if it's still a rumor\n\n` +
    `RULES:\n` +
    `- If the post does NOT clearly name a destination club, return toClubName=null and toClubCode=null.\n` +
    `- Do NOT invent a club. If unsure, return null.\n` +
    `- Output ONLY the JSON object, no commentary.`

  const result = await ai.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: postText.slice(0, 1000) },
    ],
    { temperature: 0.1, maxTokens: 600, json: true },
  )

  if (!result.ok || !result.content) {
    console.warn(
      `[transfer-pulse/discovery] extractTransferFields: ai.chat failed (${result.provider}): ${result.error?.slice(0, 120)}`,
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
    const toClubName =
      typeof obj.toClubName === 'string' && obj.toClubName.trim()
        ? obj.toClubName.trim()
        : null
    const toClubCode =
      typeof obj.toClubCode === 'string' && obj.toClubCode.trim()
        ? obj.toClubCode.trim().toUpperCase().slice(0, 4)
        : null
    const fee =
      typeof obj.fee === 'string' && obj.fee.trim() ? obj.fee.trim() : null
    const headline =
      typeof obj.headline === 'string' && obj.headline.trim()
        ? obj.headline.trim().slice(0, 280)
        : ''
    const isCompleted = Boolean(obj.isCompleted)
    // Require BOTH name and code to be confident about the destination
    if (!toClubName || !toClubCode) return null
    return { toClubName, toClubCode, fee, headline, isCompleted }
  } catch {
    return null
  }
}

// ── Entity-resolution gate ───────────────────────────────────────────────────

/**
 * ENTITY RESOLUTION — verify that a Tier 1 post is actually about THIS
 * tracked player (the one currently at `expectedFromClub`), not a same-name
 * different-player.
 *
 * BACKGROUND:
 *   In July 2026, Romano posted reports about "Ederson" being linked with
 *   Manchester United. Our tracked-players list had "Ederson" as the Man City
 *   GK. The discovery pipeline extracted "Manchester United" as the
 *   destination and fabricated a "Man City → Manchester United" saga — but
 *   Romano was actually reporting on the Atalanta MF Ederson (also Brazilian,
 *   also "Ederson"). The same-name confusion produced a fabricated saga.
 *
 * GATE:
 *   Before creating a new saga, we ask the LLM: "Given this post and this
 *   player's expected current club, is the post actually about THIS player?"
 *   The LLM returns {verified: bool, actualClub: string | null}. If
 *   verified=false, the post is rejected and no saga is created.
 *
 * FALLBACK:
 *   If the LLM call fails entirely, we FAIL OPEN (verified=true) to avoid
 *   blocking all discovery — but log a warning. The same-club guard and
 *   Tier 1 handle gate still apply as secondary defenses.
 */
async function verifyPlayerCurrentClub(
  postText: string,
  playerName: string,
  expectedFromClub: string,
): Promise<{ verified: boolean; actualClub: string | null }> {
  const systemPrompt =
    `You are an entity-resolution gate for a football transfer pipeline.\n` +
    `A Tier 1 journalist's X post is being considered for a saga about ${playerName} ` +
    `(expected current club: ${expectedFromClub}).\n\n` +
    `Read the post and answer ONE question: is this post about ${playerName} ` +
    `(the footballer who currently plays for ${expectedFromClub}), or is it about ` +
    `a DIFFERENT footballer who happens to share the name?\n\n` +
    `IMPORTANT CONTEXT:\n` +
    `- Transfer rumor posts naturally mention the DESTINATION club (where the player ` +
    `  might move TO). The destination is NOT the player's current club. So a post ` +
    `  saying "${playerName} to Al-Hilal?" is consistent with the player being at ` +
    `  ${expectedFromClub} — Al-Hilal is the rumored destination, not the current club.\n` +
    `- This gate exists ONLY to catch same-name confusion (e.g. two different Brazilian ` +
    `  players both named "Ederson" — one a GK at Man City, the other a MF at Atalanta).\n` +
    `- For unique names like "Mohamed Salah", "Kylian Mbappé", "Erling Haaland", ` +
    `  "Lamine Yamal", "Vinícius Júnior", "Jude Bellingham" — there is only ONE ` +
    `  famous footballer by that name. The gate should ALMOST ALWAYS return verified=true.\n\n` +
    `Return a JSON object with these fields:\n` +
    `  "verified": boolean    — true if the post is about ${playerName} (the footballer at ${expectedFromClub})\n` +
    `  "actualClub": string | null — only set if verified=false AND you can identify the other player's actual club\n` +
    `  "reason": string       — a 1-sentence explanation\n\n` +
    `RULES:\n` +
    `- Default to verified=true UNLESS the post explicitly mentions a DIFFERENT club as ` +
    `  the player's current team (e.g. "Ederson from Atalanta" when we expected Man City).\n` +
    `- Mentioning a destination club (rumored move) does NOT count as a different current club.\n` +
    `- If unsure, return verified=true (be permissive — other gates handle same-club and bad extractions).\n` +
    `- Output ONLY the JSON object, no commentary.`

  const result = await ai.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: postText.slice(0, 2000) },
    ],
    { temperature: 0.1, maxTokens: 400, json: true },
  )

  if (!result.ok || !result.content) {
    console.warn(
      `[transfer-pulse/discovery] verifyPlayerCurrentClub: ai.chat failed (${result.provider}), failing OPEN:`,
      result.error?.slice(0, 100),
    )
    return { verified: true, actualClub: null }
  }

  // Parse the JSON response
  let cleaned = result.content.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    // Unparseable → fail open (other gates still apply)
    return { verified: true, actualClub: null }
  }
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const verified = obj.verified === true
    const actualClub =
      typeof obj.actualClub === 'string' && obj.actualClub.trim()
        ? obj.actualClub.trim()
        : null
    return { verified, actualClub }
  } catch {
    return { verified: true, actualClub: null }
  }
}

// ── Staleness guard: "has this player already moved?" ────────────────────────

/**
 * SYSTEMIC STALENESS GUARD — checks whether a tracked player has ALREADY
 * completed a transfer AWAY from their watchlist `fromClubName`.
 *
 * BACKGROUND:
 *   This guard was added 2026-07-26 after the "Florian Wirtz → Man City" bug.
 *   Wirtz completed his move to Liverpool in summer 2025, but the watchlist
 *   still had him at Leverkusen. The discovery pipeline kept finding OLD
 *   pre-move Tier 1 posts (Plettenberg/Falk, July 21-22) linking him to Man
 *   City — speculation that predated his actual move. The saga was created
 *   with the WRONG destination and marked "active" even though the player
 *   had already moved to a different club. The Arnold bug was the same
 *   class (Alexander-Arnold → Real Madrid completed in 2025, still surfaced).
 *
 * GATE:
 *   Before running discovery for a player, we ask the AI: "Has {player}
 *   already completed a transfer away from {fromClubName}? If so, to which
 *   club?" The AI returns {alreadyMoved: bool, actualClub: string|null,
 *   confidence: 'high'|'medium'|'low'}.
 *
 * If `alreadyMoved=true` with high/medium confidence, the caller resolves the
 * player's active sagas (see `resolvePlayerSagas`) and SKIPS discovery. This
 * prevents stale pre-move rumors from being re-surfaced as "active" news.
 *
 * FALLBACK:
 *   If the LLM call fails entirely, we FAIL OPEN (alreadyMoved=false) to
 *   avoid blocking all discovery. The entity-resolution gate, same-club
 *   guard, and 60-day freshness filter still apply as secondary defenses.
 *   We only RESOLVE sagas on a positive, confident "already moved" answer.
 *
 * COST:
 *   One LLM call per player per discovery run. Cheaper than the xAI x_search
 *   call it replaces when the player has already moved (skips xAI entirely).
 */
async function checkPlayerAlreadyMoved(player: TrackedPlayer): Promise<{
  alreadyMoved: boolean
  actualClub: string | null
  confidence: 'high' | 'medium' | 'low'
}> {
  const systemPrompt =
    `You are a football transfer fact-checker. Answer ONE question with ` +
    `high precision: has the footballer ${player.name} ALREADY COMPLETED a ` +
    `transfer AWAY from ${player.fromClubName} (his watchlist club) to a ` +
    `DIFFERENT club — as of ${new Date().toISOString().slice(0, 10)}?\n\n` +
    `Context:\n` +
    `- The watchlist says ${player.name} is currently at ${player.fromClubName}.\n` +
    `- If he is STILL at ${player.fromClubName}, answer alreadyMoved=false.\n` +
    `- If he has COMPLETED a permanent transfer to another club (signed, ` +
    `announced, presented — not just rumored), answer alreadyMoved=true and ` +
    `name the actual destination club in actualClub.\n` +
    `- Loan moves DO count as "moved" only if the loan is long-term (≥1 season) ` +
    `and the player is no longer training/playing for ${player.fromClubName}.\n` +
    `- A mere RUMOR of interest (even from Tier 1 journalists) does NOT count ` +
    `as "moved" — only a COMPLETED transfer counts.\n\n` +
    `Return a JSON object:\n` +
    `  "alreadyMoved": boolean\n` +
    `  "actualClub": string | null   — the destination club's full name, or null if not moved\n` +
    `  "confidence": "high" | "medium" | "low"   — how sure you are\n` +
    `  "reason": string              — 1-sentence explanation\n\n` +
    `RULES:\n` +
    `- Be CONSERVATIVE. If you are not sure the transfer is COMPLETED, answer ` +
    `alreadyMoved=false. Resolving a saga prematurely hides real ongoing rumors.\n` +
    `- Output ONLY the JSON object, no commentary.`

  const result = await ai.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${player.name} — current club per watchlist: ${player.fromClubName}` },
    ],
    { temperature: 0.1, maxTokens: 400, json: true },
  )

  if (!result.ok || !result.content) {
    console.warn(
      `[transfer-pulse/discovery] checkPlayerAlreadyMoved: ai.chat failed (${result.provider}), failing OPEN:`,
      result.error?.slice(0, 100),
    )
    return { alreadyMoved: false, actualClub: null, confidence: 'low' }
  }

  let cleaned = result.content.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return { alreadyMoved: false, actualClub: null, confidence: 'low' }
  }
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const alreadyMoved = obj.alreadyMoved === true
    const actualClub =
      typeof obj.actualClub === 'string' && obj.actualClub.trim()
        ? obj.actualClub.trim()
        : null
    const confidenceRaw = String(obj.confidence).toLowerCase().trim()
    const confidence: 'high' | 'medium' | 'low' =
      confidenceRaw === 'high' ? 'high' : confidenceRaw === 'medium' ? 'medium' : 'low'
    // Only trust high/medium confidence "alreadyMoved=true" answers. Low
    // confidence = fail open (keep the saga active, let discovery run).
    if (alreadyMoved && confidence === 'low') {
      console.log(
        `[transfer-pulse/discovery] ${player.name}: LLM says moved but low confidence — failing open (keeping active)`,
      )
      return { alreadyMoved: false, actualClub: null, confidence: 'low' }
    }
    return { alreadyMoved, actualClub, confidence }
  } catch {
    return { alreadyMoved: false, actualClub: null, confidence: 'low' }
  }
}

/**
 * Resolve all of a player's active sagas after determining they've already
 * moved. For each active saga:
 *   - If the saga's `toClubName` matches the player's ACTUAL new club →
 *     mark `completed` (the rumor was correct and came true).
 *   - If the saga's `toClubName` DIFFERS from the actual new club →
 *     mark `debunked` (the rumor was wrong; he went elsewhere).
 *
 * Resolved sagas keep all their sources/posts/timeline (audit trail
 * preserved per the anti-hallucination contract). Only the `status` and
 * `resolvedAt` fields change.
 *
 * @returns the number of sagas whose status was updated.
 */
async function resolvePlayerSagas(
  player: TrackedPlayer,
  actualClub: string,
  confidence: 'high' | 'medium' | 'low',
): Promise<number> {
  // Only resolve on confident answers (the checkPlayerAlreadyMoved gate
  // already filters low confidence, but double-guard here for safety).
  if (confidence === 'low') return 0

  const activeSagas = await db.transferSaga.findMany({
    where: { playerName: player.name, status: 'active' },
  })
  if (activeSagas.length === 0) return 0

  const actualLower = actualClub.toLowerCase().trim()
  let updated = 0
  for (const saga of activeSagas) {
    const sagaToLower = saga.toClubName.toLowerCase().trim()
    // Match if either string contains the other (handles "Manchester City"
    // vs "Man City" naming differences).
    const isMatch =
      actualLower.includes(sagaToLower) || sagaToLower.includes(actualLower)
    const newStatus: 'completed' | 'debunked' = isMatch ? 'completed' : 'debunked'
    await db.transferSaga.update({
      where: { id: saga.id },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    console.log(
      `[transfer-pulse/discovery] resolved ${player.name} → ${saga.toClubName} ` +
        `as [${newStatus}] (actual club: ${actualClub})`,
    )
    updated++
  }
  return updated
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseDate(s: string): Date {
  const d = new Date(s)
  if (isNaN(d.getTime())) return new Date()
  return d
}

/**
 * ENTITY-NAME-OVERLAP DETECTOR — catches substring false-matches between
 * tracked players and other footballers whose names contain the tracked
 * name. Returns the longer (different) name if a collision is detected, or
 * null if the post is safely about the tracked player.
 *
 * EXAMPLES (tracked player = "Rodri"):
 *   • post mentions "Álvaro Rodríguez" → returns "Álvaro Rodríguez" (REJECT)
 *   • post mentions "Rodri" standalone  → returns null (ACCEPT)
 *   • post mentions "Rodri Hernández"   → returns null (ACCEPT — full name
 *     contains "Rodri" but the standalone short name also appears, so it's
 *     plausibly the same player)
 *
 * The detector is deliberately conservative: it only fires when (a) the
 * tracked player's EXACT name does NOT appear as a standalone word in the
 * post, AND (b) the post contains a longer name that starts with or contains
 * the tracked name as a substring. This avoids false rejections of posts
 * that genuinely mention the tracked player alongside others.
 *
 * Known overlap pairs this guards against:
 *   "Rodri" ⊂ "Rodríguez", "Rodri Hernández"
 *   "Pedri" ⊂ "Pedrinho"
 *   "Gavi" ⊂ "Gavilán"
 *   (single-name players are most at risk — that's why the entity-resolution
 *   gate + this heuristic both exist)
 */
function hasEntityNameOverlap(postText: string, playerName: string): string | null {
  const text = postText
  const playerLower = playerName.toLowerCase()
  // Check if the tracked player's EXACT name appears as a standalone token.
  // Word-boundary regex: \b ensures "Rodri" doesn't match inside "Rodríguez".
  const exactRe = new RegExp(`\\b${escapeRegex(playerLower)}\\b`, 'i')
  if (exactRe.test(text)) {
    // The exact name appears standalone — accept the post.
    return null
  }
  // The exact name does NOT appear standalone. Now check whether a LONGER
  // name containing the tracked name appears (e.g. "Álvaro Rodríguez").
  // We look for patterns like "<Word> <tracked-name>..." or "<tracked-name><suffix>".
  // Specifically: any capitalized word sequence where one token starts with
  // or contains the tracked name as a substring.
  //
  // To keep this cheap and false-positive-free, we only flag the specific
  // known-dangerous pattern: a longer surname that STARTS WITH the tracked
  // name and continues with more letters (no word boundary). This catches
  // "Rodríguez" from "Rodri", "Pedrinho" from "Pedri", etc.
  const suffixRe = new RegExp(`\\b[A-Z][a-z]+\\s+${escapeRegex(playerLower)}[a-záéíóúñ]+`, 'i')
  // Also catch the pattern where a full name is given and the tracked name
  // is a prefix of the surname: "Álvaro Rodríguez" → "Rodri" + "guez"
  const prefixRe = new RegExp(`\\b[A-Z][a-záéíóúñ]+\\s+${escapeRegex(playerLower)}[a-záéíóúñ]*`, 'i')
  const match = text.match(prefixRe) || text.match(suffixRe)
  if (match) {
    return match[0]
  }
  return null
}

/** Escape special regex characters in a string so it can be used in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
