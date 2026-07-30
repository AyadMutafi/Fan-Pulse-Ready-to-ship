'use client'

import { useSyncExternalStore, useCallback } from 'react'

/**
 * Tracks which player cards the user has "seen" (flipped) via localStorage.
 * Drives the Card Collection counter ("Cards seen: X / total") and the
 * share-after-5-cards nudge.
 *
 * Keyed by card id (e.g. "verified:Team of Tournament:Kylian Mbappé").
 * No expiry — cards stay collected (this is a collectible, not a viewed-story).
 *
 * Uses useSyncExternalStore (the React-recommended way to subscribe to an
 * external store like localStorage) — this avoids setState-in-effect cascades
 * AND handles SSR/hydration correctly via the separate server snapshot.
 */

const STORAGE_KEY = 'fanpulse:card-collection'
const EMPTY_SET = new Set<string>()

// ── Module-level external store (singleton) ──────────────────────────────────
// A single cache + listener set shared across all useCardCollection callers,
// so flipping a card in one component updates the counter everywhere.

let cache: Set<string> | null = null
const listeners = new Set<() => void>()

function readSeen(): Set<string> {
  if (typeof window === 'undefined') return EMPTY_SET
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x) => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeSeen(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage might be full or disabled — fail silently.
  }
}

function getSnapshot(): Set<string> {
  if (cache === null) {
    cache = readSeen()
  }
  return cache
}

function getServerSnapshot(): Set<string> {
  return EMPTY_SET
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function notify() {
  for (const cb of listeners) cb()
}

export function useCardCollection() {
  const seen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const markSeen = useCallback((id: string) => {
    if (cache === null) cache = readSeen()
    if (cache.has(id)) return
    const next = new Set(cache)
    next.add(id)
    cache = next
    writeSeen(next)
    notify()
  }, [])

  const isSeen = useCallback((id: string) => seen.has(id), [seen])

  return { seen, seenCount: seen.size, markSeen, isSeen }
}
