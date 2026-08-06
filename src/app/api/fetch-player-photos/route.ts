import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { fetchPlayerPhoto } from '@/lib/wikipedia-photo'

/**
 * POST /api/fetch-player-photos
 *
 * Admin-only batch endpoint that fetches Wikipedia photos for a list of
 * players and writes the URLs back to the corresponding DB row's photoUrl
 * (WCSelectionPlayer) or playerPhotoUrl (TransferSaga) column.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *   - Photos come from Wikipedia REST API ONLY (src/lib/wikipedia-photo.ts).
 *     Never Google Images, never random CDNs.
 *   - Only URLs starting with https://upload.wikimedia.org/ are stored.
 *     Anything else is rejected and the DB column stays NULL.
 *   - When no Wikipedia photo exists, the column stays NULL — the UI then
 *     renders a graceful initials-on-purple fallback. We NEVER substitute
 *     a photo of a different person.
 *
 * Rate-limit: 1 request / min / IP (this is a heavy batch admin operation
 * that hits Wikipedia sequentially with 200ms delays).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Request body:
 *   {
 *     players: [
 *       { id: "...", name: "Kylian Mbappé", model: "WCSelectionPlayer" },
 *       { id: "...", name: "Mohamed Salah", model: "TransferSaga" },
 *       ...
 *     ]
 *   }
 *
 * `model` is one of: "WCSelectionPlayer" | "TransferSaga"
 *
 * (LeaguePlayer and TOTWPlayer Prisma models do not exist in this project —
 *  TOTW / Ballon d'Or players come from static verified arrays and are
 *  fetched on-demand via the /api/player-photo public route + the
 *  usePlayerPhoto hook instead. See worklog entry for player-photos-phase-1.)
 *
 * Processes in sub-batches of 10 with a 200ms inter-call delay to respect
 * Wikipedia's rate-limit policy. For 33 WC players this takes ~8 seconds.
 *
 * Response:
 *   { updated: N, skipped: M, errors: [...], total: T }
 *   - updated: rows where a photo URL was found and written
 *   - skipped: rows where Wikipedia returned no photo (NULL written / kept)
 *   - errors: rows where the DB update itself failed
 *   - total: total rows processed
 */

type PlayerModel = 'WCSelectionPlayer' | 'TransferSaga'

interface PlayerInput {
  id: string
  name: string
  model: PlayerModel
}

const BATCH_SIZE = 10
const INTER_CALL_DELAY_MS = 200

export async function POST(request: Request) {
  // ── Admin auth (fail-closed: no ADMIN_PASSWORD env = deny all) ──
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  // ── Rate limit: 1 / min / IP ──
  const ip = getClientIp(request)
  const rl = rateLimit(`fetch-player-photos:${ip}`, 1, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limited — this batch endpoint is limited to 1 call/min' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  // ── Parse body ──
  let body: { players?: PlayerInput[] }
  try {
    body = (await request.json()) as { players?: PlayerInput[] }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const players = body?.players
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json(
      { error: 'Request body must include a non-empty `players` array' },
      { status: 400 },
    )
  }

  // Cap to a sane max so a runaway caller can't tie up the server for an hour.
  const MAX_PLAYERS = 200
  const queued = players.slice(0, MAX_PLAYERS)

  let updated = 0
  let skipped = 0
  const errors: { id: string; name: string; error: string }[] = []

  // ── Process in sub-batches of BATCH_SIZE ──
  for (let i = 0; i < queued.length; i += BATCH_SIZE) {
    const subBatch = queued.slice(i, i + BATCH_SIZE)

    // Fire the Wikipedia lookups for this sub-batch sequentially (the
    // fetchPlayerPhotosBatch helper already paces 200ms between calls).
    for (const p of subBatch) {
      if (!p?.id || !p?.name || !p?.model) {
        errors.push({ id: p?.id ?? '?', name: p?.name ?? '?', error: 'Missing id/name/model' })
        continue
      }

      try {
        const photoUrl = await fetchPlayerPhoto(p.name)
        await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS))

        if (!photoUrl) {
          // No Wikipedia photo — leave the DB column NULL (graceful fallback).
          skipped++
          continue
        }

        // Defensive: only store upload.wikimedia.org URLs.
        if (!photoUrl.startsWith('https://upload.wikimedia.org/')) {
          skipped++
          continue
        }

        // Write back to the correct model/column.
        if (p.model === 'WCSelectionPlayer') {
          await db.wCSelectionPlayer.update({
            where: { id: p.id },
            data: { photoUrl },
          })
        } else if (p.model === 'TransferSaga') {
          await db.transferSaga.update({
            where: { id: p.id },
            data: { playerPhotoUrl: photoUrl },
          })
        } else {
          errors.push({ id: p.id, name: p.name, error: `Unknown model: ${p.model}` })
          continue
        }

        updated++
      } catch (err) {
        errors.push({
          id: p.id,
          name: p.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return NextResponse.json({
    updated,
    skipped,
    errors,
    total: queued.length,
    truncated: players.length > MAX_PLAYERS,
  })
}

/**
 * GET — convenience endpoint that auto-discovers ALL WCSelectionPlayer and
 * TransferSaga rows missing a photo, and queues them for batch fetching.
 *
 * Usage (admin):
 *   curl -H "x-admin-password: $ADMIN_PASSWORD" \
 *        http://localhost:3000/api/fetch-player-photos
 *
 * This is the "populate everything" path — the admin runs it once after
 * seeding new players, instead of manually POSTing the full player list.
 */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`fetch-player-photos:${ip}`, 1, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limited — 1 call/min' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // Find all WCSelectionPlayer rows with NULL photoUrl.
  const wcPlayers = await db.wCSelectionPlayer.findMany({
    where: { photoUrl: null },
    select: { id: true, playerName: true },
  })

  // Find all TransferSaga rows with NULL playerPhotoUrl.
  const sagas = await db.transferSaga.findMany({
    where: { playerPhotoUrl: null },
    select: { id: true, playerName: true },
  })

  const players: PlayerInput[] = [
    ...wcPlayers.map((p) => ({ id: p.id, name: p.playerName, model: 'WCSelectionPlayer' as const })),
    ...sagas.map((p) => ({ id: p.id, name: p.playerName, model: 'TransferSaga' as const })),
  ]

  if (players.length === 0) {
    return NextResponse.json({
      updated: 0,
      skipped: 0,
      errors: [],
      total: 0,
      message: 'No players missing photos — all rows already have a photoUrl or playerPhotoUrl.',
    })
  }

  // Process in sub-batches (same logic as POST).
  let updated = 0
  let skipped = 0
  const errors: { id: string; name: string; error: string }[] = []

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const subBatch = players.slice(i, i + BATCH_SIZE)
    for (const p of subBatch) {
      try {
        const photoUrl = await fetchPlayerPhoto(p.name)
        await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS))

        if (!photoUrl || !photoUrl.startsWith('https://upload.wikimedia.org/')) {
          skipped++
          continue
        }

        if (p.model === 'WCSelectionPlayer') {
          await db.wCSelectionPlayer.update({
            where: { id: p.id },
            data: { photoUrl },
          })
        } else {
          await db.transferSaga.update({
            where: { id: p.id },
            data: { playerPhotoUrl: photoUrl },
          })
        }
        updated++
      } catch (err) {
        errors.push({
          id: p.id,
          name: p.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return NextResponse.json({
    updated,
    skipped,
    errors,
    total: players.length,
  })
}
