'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PulseStory, StoryCtaTarget } from '@/lib/story-generator'

// ── Stories fetch (direct fetch + useState, matching the existing app pattern) ─
//
// Stories are cached server-side for 1 hour (see /api/stories/route.ts) and
// are deterministic per UTC day. We refetch every 10 minutes on the client so
// a user who keeps the app open across midnight UTC sees the new day's stories
// without a manual reload.
//
// NOTE: the app does NOT wrap pages in a QueryClientProvider (the TanStack
// Query hooks in src/hooks/queries/* are referenced only by dead-code tab
// components). This hook follows the same direct-fetch pattern used by the
// inline HomeTab/SentimentsTab/WorldCupTab in page.tsx.

interface StoriesResponse {
  stories: PulseStory[]
  dayKey: string
  cachedAt: number
  cached: boolean
}

export function useStories() {
  const [stories, setStories] = useState<PulseStory[]>([])
  const [dayKey, setDayKey] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/stories')
        if (!res.ok) return
        const data: StoriesResponse = await res.json()
        if (!cancelled) {
          setStories(data.stories)
          setDayKey(data.dayKey)
          setIsLoading(false)
        }
      } catch {
        // Network error — keep stories as [] (honest empty state).
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    // Refetch every 10 minutes so a user who keeps the app open across
    // midnight UTC sees the new day's stories without a manual reload.
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { data: stories, dayKey, isLoading }
}

// ── Viewed-state tracking (localStorage) ─────────────────────────────────────
//
// Viewed story IDs persist in localStorage so a user who reloads sees gray
// borders on stories they've already tapped through. We key by dayKey so a
// new day's stories start unviewed (fresh engagement each day).
//
// Storage shape: { [dayKey]: string[] } — an array of viewed story IDs per day.

const STORAGE_KEY = 'fanpulse:story-viewed'

interface ViewedState {
  [dayKey: string]: string[]
}

function readViewed(): ViewedState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as ViewedState
    return {}
  } catch {
    return {}
  }
}

function writeViewed(state: ViewedState) {
  if (typeof window === 'undefined') return
  try {
    // Prune: keep only the last 7 days to avoid unbounded growth.
    const keys = Object.keys(state).sort()
    const pruned: ViewedState = {}
    for (const k of keys.slice(-7)) {
      pruned[k] = state[k]
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
  } catch {
    // localStorage might be full or disabled — fail silently.
  }
}

/**
 * Track which stories the user has viewed, keyed by day.
 * Returns the viewed set for the given day, plus a function to mark a story
 * as viewed (idempotent — safe to call multiple times for the same id).
 *
 * Hydration uses the "adjust state when a prop changes" pattern (see React
 * docs: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
 * rather than setState-in-an-effect, to avoid cascading renders.
 */
export function useViewedStories(dayKey: string | undefined) {
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const [lastDayKey, setLastDayKey] = useState<string | undefined>(dayKey)

  // If dayKey changed (or first mount with a real dayKey), re-hydrate from
  // localStorage. setState-during-render is safe here because it's conditional
  // and converges to a stable value — React re-renders immediately without
  // committing the intermediate state.
  if (dayKey !== lastDayKey) {
    setLastDayKey(dayKey)
    if (dayKey) {
      const state = readViewed()
      setViewedIds(new Set(state[dayKey] ?? []))
    } else {
      setViewedIds(new Set())
    }
  }

  const markViewed = useCallback(
    (storyId: string) => {
      if (!dayKey) return
      setViewedIds((prev) => {
        if (prev.has(storyId)) return prev
        const next = new Set(prev)
        next.add(storyId)
        // Persist to localStorage (don't block render).
        const state = readViewed()
        const arr = state[dayKey] ?? []
        if (!arr.includes(storyId)) {
          state[dayKey] = [...arr, storyId]
          writeViewed(state)
        }
        return next
      })
    },
    [dayKey],
  )

  return { viewedIds, markViewed }
}

// ── CTA navigation helper ────────────────────────────────────────────────────
//
// Maps a story's CTA target to the app's tab system. 'ballon-dor' is a
// section within the Home tab (there is no separate Ballon d'Or tab), so it
// maps to 'home'. The others map directly.

export function ctaTargetToTab(target: StoryCtaTarget): string {
  switch (target) {
    case 'home':
      return 'home'
    case 'sentiments':
      return 'sentiments'
    case 'worldcup':
      return 'worldcup'
    case 'transfers':
      return 'transfers'
    case 'ballon-dor':
      return 'home' // Ballon d'Or Race is a section on the Home tab
    default:
      return 'home'
  }
}
