'use client'

import { useState, useEffect, useRef } from 'react'
import { getFallbackAvatar } from '@/lib/wikipedia-photo'

/**
 * Read a cached photo result from localStorage. Returns:
 *   - a URL string when a Wikipedia photo was cached
 *   - `null` when "no photo" was cached (the literal 'null' marker)
 *   - `undefined` when there's no cache entry yet (caller should fetch)
 *
 * Client-only — wrapped in try/catch for private-mode / disabled storage.
 */
function readCachedPhoto(playerName: string): string | null | undefined {
  if (!playerName) return null
  try {
    const cached = localStorage.getItem(`photo:${playerName}`)
    if (cached === null) return undefined // no entry
    return cached === 'null' ? null : cached
  } catch {
    return undefined // storage disabled — treat as uncached
  }
}

/**
 * Persist a photo result to localStorage.
 *   - Stores the URL string for a real photo.
 *   - Stores the literal 'null' for "no photo" (so we don't re-fetch).
 */
function writeCachedPhoto(playerName: string, url: string | null): void {
  try {
    localStorage.setItem(`photo:${playerName}`, url ?? 'null')
  } catch {
    // Storage full or disabled — non-fatal, the in-memory state still works.
  }
}

/**
 * Compute the SYNCHRONOUSLY-resolvable photo URL for a player:
 *   1. If the DB has a Wikipedia photoUrl → return it (fast path, no network)
 *   2. Else if localStorage has a cached result → return it (cache hit)
 *   3. Else → return null (cache miss → caller must fetch)
 *
 * This is pure (no side effects) so it's safe to call during render.
 */
function computeSyncPhoto(playerName: string, existingPhotoUrl?: string | null): string | null {
  if (existingPhotoUrl && existingPhotoUrl.startsWith('https://upload.wikimedia.org/')) {
    return existingPhotoUrl
  }
  const cached = readCachedPhoto(playerName)
  return cached === undefined ? null : cached
}

/**
 * usePlayerPhoto — on-demand Wikipedia photo fetcher for client components.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Players that come from STATIC verified arrays (Ballon d'Or contenders,
 * Tournament Retro Elite XI / Crisis XI) don't have a DB row with a
 * pre-populated photoUrl. Their cards would otherwise show the initials
 * fallback forever.
 *
 * This hook fetches the Wikipedia photo ON-DEMAND the first time a card
 * with that player name renders, then caches the result in localStorage so:
 *   - subsequent renders of the same player are instant (no network)
 *   - navigating away and back doesn't re-fetch
 *   - the cache survives page reloads
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *   - The hook ONLY calls /api/player-photo, which in turn ONLY calls
 *     fetchPlayerPhoto (Wikipedia REST API). No Google Images, no random CDNs.
 *   - The returned URL is always either a https://upload.wikimedia.org/ URL
 *     or the ui-avatars.com fallback (initials on purple). NEVER a photo of
 *     a different person.
 *   - If the API call fails, the hook returns the fallback avatar (graceful
 *     degradation — the card still renders, just with initials).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param playerName   The player's real name (e.g. "Kylian Mbappé")
 * @param existingPhotoUrl  When the DB already has a photoUrl for this player
 *                          (e.g. WCSelectionPlayer rows), pass it here to
 *                          short-circuit the fetch. The hook returns it
 *                          immediately without any network call.
 * @returns The photo URL to render — either the Wikipedia photo or the
 *          initials-on-purple fallback. Always non-null.
 */
export function usePlayerPhoto(playerName: string, existingPhotoUrl?: string | null): string {
  // ── Derived-state-during-render pattern ────────────────────────────────
  // We track the "input key" (playerName + existingPhotoUrl). When it
  // changes between renders, we re-derive the synchronous photo value
  // during render (React allows setState-during-render for this specific
  // "sync to changing props" pattern — it re-renders immediately without
  // committing the stale state). This avoids setState-in-effect (the lint
  // rule) while still handling input changes correctly.
  const inputKey = `${playerName}|${existingPhotoUrl ?? ''}`

  const [photoUrl, setPhotoUrl] = useState<string | null>(() =>
    computeSyncPhoto(playerName, existingPhotoUrl),
  )
  const [prevKey, setPrevKey] = useState(inputKey)

  if (prevKey !== inputKey) {
    setPrevKey(inputKey)
    setPhotoUrl(computeSyncPhoto(playerName, existingPhotoUrl))
  }

  // ── Async fetch (cache-miss path only) ─────────────────────────────────
  // The effect runs whenever the input key changes. It re-checks the sync
  // value (which may have just been re-derived above) and only fetches when
  // there's no sync value. The setState calls are inside async callbacks
  // (.then / .catch), NOT synchronously in the effect body — so the lint
  // rule is satisfied.
  useEffect(() => {
    const syncValue = computeSyncPhoto(playerName, existingPhotoUrl)
    // If we have a sync value (DB photo or cache hit), no fetch needed.
    if (syncValue !== null || !playerName) return

    let cancelled = false
    fetch(`/api/player-photo?name=${encodeURIComponent(playerName)}`)
      .then((res) => res.json())
      .then((data: { photoUrl?: string | null }) => {
        if (cancelled) return
        const url = data.photoUrl ?? null
        setPhotoUrl(url)
        writeCachedPhoto(playerName, url)
      })
      .catch(() => {
        if (cancelled) return
        // Network/API failure → leave photoUrl as null (caller shows fallback).
        // Don't cache the failure (so a transient blip doesn't permanently hide the photo).
        setPhotoUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [inputKey])

  // Always return SOMETHING renderable: the Wikipedia photo, or the fallback
  // avatar (initials on purple).
  return photoUrl ?? getFallbackAvatar(playerName)
}

/**
 * usePlayerPhotoLoading — companion hook that exposes the loading state so
 * the PlayerCard can show the skeleton shimmer while the photo fetches.
 *
 * Returns true while the photo is being fetched, false once resolved
 * (either from the DB, cache, or network). The fast paths (DB photo, cache
 * hit) are resolved synchronously on the first render.
 */
export function usePlayerPhotoLoading(playerName: string, existingPhotoUrl?: string | null): boolean {
  const inputKey = `${playerName}|${existingPhotoUrl ?? ''}`

  // Initial loading: true ONLY when we have no sync value and must fetch.
  const [loading, setLoading] = useState<boolean>(() => {
    const syncValue = computeSyncPhoto(playerName, existingPhotoUrl)
    return syncValue === null && !!playerName
  })
  const [prevKey, setPrevKey] = useState(inputKey)

  // Derived-state-during-render: recompute loading when the input key changes.
  if (prevKey !== inputKey) {
    setPrevKey(inputKey)
    const syncValue = computeSyncPhoto(playerName, existingPhotoUrl)
    setLoading(syncValue === null && !!playerName)
  }

  useEffect(() => {
    const syncValue = computeSyncPhoto(playerName, existingPhotoUrl)
    // If we have a sync value, no fetch → not loading.
    if (syncValue !== null || !playerName) return

    let cancelled = false
    fetch(`/api/player-photo?name=${encodeURIComponent(playerName)}`)
      .then((res) => res.json())
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [inputKey])

  return loading
}
