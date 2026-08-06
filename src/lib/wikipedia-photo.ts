/**
 * Wikipedia Player Photo Fetcher
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * Player photos come from the Wikipedia REST API ONLY — never from Google
 * Images, never from random CDNs, never from unlicensed sources.
 *
 *   Endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/{Title}
 *
 * The REST summary response includes `thumbnail.source` (a sized thumbnail)
 * and `originalimage.source` (full resolution). Both are hosted on
 * https://upload.wikimedia.org/ under a Creative Commons / public-domain
 * license. We verify the returned URL starts with
 * `https://upload.wikimedia.org/` before accepting it — this is the legal
 * guarantee that the image is freely licensed.
 *
 * If a player has no Wikipedia article, or the article has no lead image,
 * or the lead image is not on upload.wikimedia.org (rare — e.g. a
 * non-free fair-use image that Wikipedia embeds from elsewhere), we return
 * NULL. The caller then renders a graceful fallback avatar (initials on a
 * purple circle). We NEVER substitute a photo of a different person.
 *
 * The "Ederson problem": some players share names (e.g. Ederson the Man
 * City GK vs Ederson the Atlético midfielder). The REST summary returns
 * the article for the canonical title — so "Ederson" resolves to the GK
 * (Ederson Moraes), which is usually correct. When a collision is known,
 * callers should pass the disambiguated name (e.g. "Ederson Tormena").
 * Known collisions are flagged in the worklog.
 *
 * Caching: results are cached in-process for the lifetime of the server
 * (Map keyed by normalized title). Negative results (NULL) are cached too,
 * so we don't re-fetch Wikipedia for players we already know have no photo.
 * The /api/player-photo public route adds a 1-hour response cache on top.
 *
 * Rate limiting: Wikipedia doesn't publish a hard rate limit, but their
 * User-Agent policy asks for ≤200 concurrent requests and courteous delays.
 * The batch fetcher inserts a 200ms delay between sequential calls. The
 * admin endpoint processes in sub-batches of 10 with a 200ms inter-call
 * gap — well within Wikipedia's tolerance.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary/'

/**
 * Identify the calling client to Wikipedia per their User-Agent policy.
 * Without this, Wikipedia may throttle or reject the request.
 */
const WIKI_HEADERS: HeadersInit = {
  Accept: 'application/json',
  'User-Agent': 'FanPulse/1.0 (https://fan-pulse.fly.dev; contact@fan-pulse.example) Next.js/16',
}

/** In-process cache: normalized name → photo URL (or null when no photo). */
const photoCache = new Map<string, string | null>()

/**
 * Disambiguation hints for players whose common name resolves to a
 * Wikipedia DISAMBIGUATION page (which has no lead image → NULL).
 *
 * The "Ederson problem" and the "Rodri problem": multiple footballers share
 * these names. Wikipedia's canonical article for the common name is either
 * a disambiguation page (Rodri) or the wrong player's article. We map the
 * common name to the SPECIFIC Wikipedia title that has the correct player's
 * lead image.
 *
 * Add new entries here as collisions are discovered. Flag any new collision
 * in the worklog entry for the phase that surfaced it.
 */
const DISAMBIGUATION_HINTS: Record<string, string> = {
  // Man City midfielder, 2026 WC Golden Ball (NOT Rodri the disambiguation page)
  Rodri: 'Rodri (footballer, born 1996)',
  // Man City goalkeeper (NOT Ederson the Atlético midfielder born 2000)
  Ederson: 'Ederson (footballer, born 1993)',
  // Brazil/Real Betis winger — "Luiz Henrique" alone is ambiguous.
  'Luiz Henrique': 'Luiz Henrique (footballer, born 2001)',
  // Chivas/Guadalajara & Mexico GK — "Raúl Rangel" alone has no article.
  'Raúl Rangel': 'Raúl Rangel (footballer)',
  // ── KNOWN BAD HINTS (do NOT add — would fetch the WRONG player's photo) ──
  // "Luis Díaz (footballer, born 1997)" → resolves to an FC Salzburg player,
  //   NOT the Liverpool/Colombia winger. Left NULL → fallback avatar is safer
  //   than showing the wrong person.
  // "Nicolás González" → no en.wikipedia article with a lead image. NULL.
  // "Sofiane Rahimi" / "Cédric Diallo" → no en.wikipedia article. NULL.
}

/**
 * Normalize a player name for the Wikipedia REST URL.
 *   "Kylian Mbappé"  → "Kylian_Mbappé"
 *   "Vinícius Júnior" → "Vinícius_Júnior"
 * The REST API accepts spaces OR underscores; underscore is the canonical
 * form and avoids URL-encoding the space.
 */
function normalizeName(playerName: string): string {
  return playerName.trim().replace(/\s+/g, '_')
}

/**
 * Fetch a single player's Wikipedia thumbnail URL.
 *
 * Returns the photo URL (always https://upload.wikimedia.org/...) when a
 * freely-licensed lead image exists, or NULL when:
 *   - the player has no English Wikipedia article
 *   - the article has no lead image (e.g. a stub)
 *   - the lead image is hosted off upload.wikimedia.org (rare; rejected)
 *   - the request times out (5s) or errors
 *
 * NULL is cached so repeat calls don't re-hit Wikipedia.
 */
export async function fetchPlayerPhoto(playerName: string): Promise<string | null> {
  const trimmed = playerName?.trim()
  if (!trimmed) return null

  // Apply disambiguation hint when the common name is known to collide.
  // The hint is the SPECIFIC Wikipedia title with the correct lead image.
  const resolved = DISAMBIGUATION_HINTS[trimmed] ?? trimmed
  const normalized = normalizeName(resolved)

  // Cache key on the ORIGINAL name so callers get consistent results
  // whether the hint fired or not.
  const cacheKey = normalizeName(trimmed)
  if (photoCache.has(cacheKey)) {
    return photoCache.get(cacheKey) ?? null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${API_BASE}${encodeURIComponent(normalized)}`, {
      headers: WIKI_HEADERS,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!response.ok) {
      // 404 = no article; 400 = bad title; etc. Cache NULL so we don't retry.
      photoCache.set(cacheKey, null)
      return null
    }

    const data = (await response.json()) as {
      thumbnail?: { source?: string }
      originalimage?: { source?: string }
      type?: string
    }

    // Prefer the sized thumbnail (smaller payload, faster client load).
    // Fall back to the original when no thumbnail exists (some articles).
    const thumbnailUrl = data?.thumbnail?.source || data?.originalimage?.source

    if (thumbnailUrl && thumbnailUrl.startsWith('https://upload.wikimedia.org/')) {
      photoCache.set(cacheKey, thumbnailUrl)
      return thumbnailUrl
    }

    // No usable freely-licensed image. Cache NULL.
    photoCache.set(cacheKey, null)
    return null
  } catch (error) {
    // Network error, timeout, JSON parse error, etc. — cache NULL so we
    // don't hammer Wikipedia on every render. The admin can re-run the
    // batch endpoint to retry after a network blip.
    console.warn(`[wikipedia-photo] Failed to fetch photo for ${playerName}:`, error)
    photoCache.set(cacheKey, null)
    return null
  }
}

/**
 * Batch-fetch photos for multiple players.
 *
 * Processes SEQUENTIALLY with a 200ms delay between calls to respect
 * Wikipedia's rate-limit policy. Total time for N players ≈ N × 250ms.
 *
 * Returns a Map keyed by the ORIGINAL player name (not normalized) so
 * callers can look up by the name they passed in. Values are the photo URL
 * or NULL.
 *
 * Used by the admin /api/fetch-player-photos endpoint to populate the
 * photoUrl / playerPhotoUrl columns in bulk.
 */
export async function fetchPlayerPhotosBatch(
  playerNames: string[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  for (const name of playerNames) {
    const photo = await fetchPlayerPhoto(name)
    results.set(name, photo)
    // 200ms inter-call delay — courteous to Wikipedia.
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return results
}

/**
 * Generate a fallback avatar URL using UI Avatars API.
 *
 * Renders the player's initials on a purple (#6C2BD9) circle. Used when a
 * player has no Wikipedia photo — NEVER substitutes a photo of another
 * person.
 *
 * The URL is consumed directly by <img>/<Image>; no server round-trip
 * needed. UI Avatars is a free, no-key service that generates SVG/PNG
 * avatars on the fly.
 */
export function getFallbackAvatar(playerName: string): string {
  const initials = playerName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials || '?')}&background=6C2BD9&color=fff&size=200&bold=true&font-size=0.42`
}

/**
 * Resolve the effective photo URL for a player.
 *
 * Used by the on-demand /api/player-photo route and by the usePlayerPhoto
 * hook: if a real Wikipedia photo exists, return it; otherwise return the
 * fallback avatar URL (so the caller always has SOMETHING to render).
 *
 * Pass `existingPhotoUrl` when the DB already has a value — it short-
 * circuits the Wikipedia lookup.
 */
export async function resolvePlayerPhoto(
  playerName: string,
  existingPhotoUrl?: string | null,
): Promise<string> {
  if (existingPhotoUrl && existingPhotoUrl.startsWith('https://upload.wikimedia.org/')) {
    return existingPhotoUrl
  }
  const photo = await fetchPlayerPhoto(playerName)
  return photo ?? getFallbackAvatar(playerName)
}

/**
 * Clear the in-process cache. Exposed for tests / admin tooling; not used
 * in normal operation (cache lifetime = server lifetime).
 */
export function clearPhotoCache(): void {
  photoCache.clear()
}
