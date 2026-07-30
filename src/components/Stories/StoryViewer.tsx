'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Share2, ArrowRight } from 'lucide-react'
import type { PulseStory } from '@/lib/story-generator'
import { ctaTargetToTab } from '@/hooks/queries/use-stories'

interface StoryViewerProps {
  stories: PulseStory[]
  startIndex: number
  onClose: () => void
  onViewed: (storyId: string) => void
  onNavigate: (tabId: string) => void
}

const DEFAULT_DURATION_MS = 5000

export default function StoryViewer({
  stories,
  startIndex,
  onClose,
  onViewed,
  onNavigate,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(startIndex, stories.length - 1)),
  )
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1 for the current story
  const [direction, setDirection] = useState<1 | -1>(1)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [swipeDownOffset, setSwipeDownOffset] = useState(0) // px dragged down (for swipe-to-close gesture)

  const currentStory = stories[currentIndex]
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const touchStartY = useRef<number | null>(null)

  // ── Navigation (declared before the rAF effect which references goNext) ────
  const goNext = useCallback(() => {
    setDirection(1)
    setCurrentIndex((i) => {
      if (i >= stories.length - 1) {
        onClose()
        return i
      }
      return i + 1
    })
  }, [stories.length, onClose])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((i) => Math.max(0, i - 1))
    // Reset progress fully when going back.
    lastTickRef.current = performance.now()
    setProgress(0)
  }, [])

  // ── Reset progress when switching stories (adjust-state-during-render) ─────
  // Sets progress to 0 synchronously during render when currentIndex changes,
  // so the new story's progress bar starts at 0 with no one-frame flash of the
  // previous story's 100%. Uses the React-recommended pattern:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // Initialized to -1 so the reset also fires on first mount (0 !== -1).
  const [lastResetIndex, setLastResetIndex] = useState(-1)
  if (currentIndex !== lastResetIndex) {
    setLastResetIndex(currentIndex)
    setProgress(0)
  }

  // ── Progress bar animation (rAF-based for smoothness + pause support) ──────
  // The tick reference (lastTickRef) is reset unconditionally at the start of
  // each effect run (i.e. whenever currentIndex or isPaused changes). This is
  // a ref mutation — NOT a setState — so it doesn't trigger the
  // react-hooks/set-state-in-effect lint rule, and it doesn't cause cascading
  // renders. The first tick after a story change computes elapsed ≈ 16ms.
  useEffect(() => {
    if (!currentStory) return
    // Mark viewed on mount of each story.
    onViewed(currentStory.id)

    // Reset the tick reference so the new story's timer starts fresh.
    // This covers both the first mount AND every subsequent story change.
    lastTickRef.current = performance.now()

    const tick = (now: number) => {
      if (!isPaused && currentStory) {
        const elapsed = now - lastTickRef.current
        const duration = currentStory.durationMs || DEFAULT_DURATION_MS
        const next = Math.min(1, elapsed / duration)
        setProgress(next)
        if (next >= 1) {
          // Auto-advance.
          goNext()
          return
        }
      } else {
        // While paused, shift the reference so resuming doesn't jump.
        lastTickRef.current = now - (progress * (currentStory.durationMs || DEFAULT_DURATION_MS))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [currentIndex, isPaused])

  // ── Body scroll lock while viewer is open ──────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === ' ') {
        e.preventDefault()
        setIsPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  // ── Share handler ──────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!currentStory) return
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?story=${currentStory.id}`
        : ''
    const shareText = `${currentStory.emoji} ${currentStory.content}\n\n— via Fan Pulse`
    // Web Share API (mobile + supporting browsers).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Fan Pulse', text: shareText, url: shareUrl })
        return
      } catch {
        // User cancelled — fall through to clipboard copy.
      }
    }
    // Desktop fallback: copy link to clipboard.
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setShareToast('Link copied to clipboard')
      setTimeout(() => setShareToast(null), 2200)
    } catch {
      setShareToast('Could not copy — share manually')
      setTimeout(() => setShareToast(null), 2200)
    }
  }, [currentStory])

  // ── CTA navigation ─────────────────────────────────────────────────────────
  const handleCta = useCallback(() => {
    if (!currentStory) return
    const tabId = ctaTargetToTab(currentStory.cta.target)
    onClose()
    // Defer the tab switch so the viewer exit animation plays first.
    setTimeout(() => onNavigate(tabId), 50)
  }, [currentStory, onClose, onNavigate])

  // ── Touch handlers (tap zones + hold-to-pause + swipe-down-to-close) ───────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    setIsPaused(true)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) {
      setSwipeDownOffset(dy)
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false)
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null

    // Swipe down → close.
    if (dy > 80) {
      onClose()
      return
    }
    // Otherwise treat as a tap (left/right zone).
    const screenWidth = window.innerWidth
    const tapX = e.changedTouches[0].clientX
    if (tapX < screenWidth * 0.35) {
      goPrev()
    } else if (tapX > screenWidth * 0.65) {
      goNext()
    }
    setSwipeDownOffset(0)
  }

  // ── Mouse handlers (desktop: click zones + hold-to-pause) ──────────────────
  const onMouseDown = () => setIsPaused(true)
  const onMouseUp = (e: React.MouseEvent) => {
    setIsPaused(false)
    const screenWidth = window.innerWidth
    const tapX = e.clientX
    if (tapX < screenWidth * 0.35) goPrev()
    else if (tapX > screenWidth * 0.65) goNext()
  }

  if (!currentStory) return null

  return (
    <AnimatePresence>
      <motion.div
        key="story-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Pulse Stories"
      >
        {/* Story container — full-screen on mobile, max-width 420px on desktop */}
        <div
          className="relative w-full h-full sm:w-[420px] sm:h-[90vh] sm:max-h-[840px] sm:rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: currentStory.backgroundImage,
            transform:
              swipeDownOffset.current > 0
                ? `translateY(${swipeDownOffset.current * 0.5}px)`
                : undefined,
            transition: swipeDownOffset.current === 0 ? 'transform 0.2s ease' : undefined,
          }}
        >
          {/* ── Progress bars (one per story) ──────────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3 pointer-events-none">
            {stories.map((s, i) => (
              <div
                key={s.id}
                className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    width:
                      i < currentIndex ? '100%' : i === currentIndex ? `${progress * 100}%` : '0%',
                    transition: i === currentIndex ? 'none' : 'width 0.2s ease',
                  }}
                />
              </div>
            ))}
          </div>

          {/* ── Top bar: close button + source label ───────────────────────── */}
          <div className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-4 pointer-events-none">
            <span className="pointer-events-auto rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold text-white/90 uppercase tracking-wider">
              {currentStory.source}
            </span>
            <button
              onClick={onClose}
              aria-label="Close stories"
              className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* ── Story content (animated transition between stories) ────────── */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStory.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-0 flex flex-col"
            >
              <StoryContent story={currentStory} />
            </motion.div>
          </AnimatePresence>

          {/* ── Tap / swipe overlay (transparent, captures all gestures) ───── */}
          <div
            className="absolute inset-0 z-20"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            aria-hidden="true"
          />

          {/* ── Bottom action bar (CTA + Share) ────────────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
            <div className="flex items-end gap-3 pointer-events-auto">
              <button
                onClick={handleCta}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-white text-[#1A1A1A] px-5 py-3 text-sm font-bold shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              >
                {currentStory.cta.label}
                <ArrowRight className="size-4" />
              </button>
              <button
                onClick={handleShare}
                aria-label="Share story"
                className="flex size-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              >
                <Share2 className="size-5" />
              </button>
            </div>
            {/* Verified-event citation footer */}
            <p className="mt-3 text-[10px] text-white/60 leading-relaxed line-clamp-2">
              {currentStory.verifiedEvent}
            </p>
          </div>

          {/* ── Desktop arrow nav (hidden on touch) ────────────────────────── */}
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="Previous story"
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 size-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={goNext}
            aria-label="Next story"
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 size-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="size-5" />
          </button>

          {/* ── Pause indicator ────────────────────────────────────────────── */}
          {isPaused && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <span className="rounded-full bg-black/50 backdrop-blur-sm px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                Paused
              </span>
            </div>
          )}

          {/* ── Share toast ────────────────────────────────────────────────── */}
          <AnimatePresence>
            {shareToast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-full bg-black/80 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-white shadow-lg"
              >
                {shareToast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Per-type story content rendering ─────────────────────────────────────────

function StoryContent({ story }: { story: PulseStory }) {
  switch (story.type) {
    case 'player-spike':
      return <PlayerSpikeContent story={story} />
    case 'mood-shift':
      return <MoodShiftContent story={story} />
    case 'transfer-buzz':
      return <TransferBuzzContent story={story} />
    case 'ranking-change':
      return <RankingChangeContent story={story} />
    case 'award':
      return <AwardContent story={story} />
    case 'archive-moment':
      return <ArchiveMomentContent story={story} />
    default:
      return null
  }
}

function PlayerSpikeContent({ story }: { story: PulseStory }) {
  const p = story.player
  if (!p) return null
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center text-white pt-16 pb-32">
      <div className="text-7xl mb-4 drop-shadow-lg">{story.emoji}</div>
      <h1 className="text-3xl font-black tracking-tight drop-shadow-md mb-1">{p.name}</h1>
      <p className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-6">
        {p.nationName} · {p.nationCode}
      </p>
      <div className="flex items-baseline gap-3">
        <span className="brutalist-number-lg text-white drop-shadow-lg">{p.pulseScore}</span>
        <span className="text-sm font-bold text-white/70 uppercase tracking-wider">Pulse</span>
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/30 backdrop-blur-sm px-3 py-1.5">
        <span className="text-[#10B981] font-black text-lg">↑{p.delta}</span>
        <span className="text-xs font-semibold text-white/90">sentiment spike</span>
      </div>
      <p className="mt-8 text-sm text-white/85 leading-relaxed max-w-xs">{p.verifiedEvent}</p>
    </div>
  )
}

function MoodShiftContent({ story }: { story: PulseStory }) {
  const m = story.moodShift
  if (!m) return null
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center text-white pt-16 pb-32">
      <p className="text-sm font-bold text-white/80 uppercase tracking-wider mb-8">
        {m.teamName} fan mood
      </p>
      <div className="flex items-center gap-6 mb-8">
        <div className="flex flex-col items-center">
          <span className="text-7xl drop-shadow-lg">{m.oldEmoji}</span>
          <span className="mt-2 text-[10px] font-bold text-white/60 uppercase tracking-wider">
            Before
          </span>
        </div>
        <span className="text-4xl text-white/60">→</span>
        <div className="flex flex-col items-center">
          <span className="text-7xl drop-shadow-lg">{m.newEmoji}</span>
          <span className="mt-2 text-[10px] font-bold text-white/60 uppercase tracking-wider">
            After {m.minutesLabel}
          </span>
        </div>
      </div>
      <p className="text-base font-semibold text-white/90 mb-2">{m.matchName}</p>
      <p className="text-sm text-white/70 max-w-xs">
        Fan sentiment shifted in {m.minutesLabel} of match action.
      </p>
    </div>
  )
}

function TransferBuzzContent({ story }: { story: PulseStory }) {
  const t = story.transferBuzz
  if (!t) return null
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center text-white pt-16 pb-32">
      <div className="flex size-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm mb-5 text-3xl">
        {story.emoji}
      </div>
      <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">Tier 1 Source</p>
      <h1 className="text-2xl font-black tracking-tight mb-1">{t.journalistName}</h1>
      <p className="text-sm font-semibold text-white/80 mb-4">
        @{t.handle} · {t.outlet}
      </p>
      <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 max-w-sm">
        <p className="text-sm text-white/90 leading-relaxed">{t.rumorHeadline}</p>
      </div>
      <p className="mt-6 text-xs text-white/60 max-w-xs">
        Transfer Pulse tracks 32 verified Tier 1 journalists. Tap through to see active sagas.
      </p>
    </div>
  )
}

function RankingChangeContent({ story }: { story: PulseStory }) {
  const r = story.rankingChange
  if (!r) return null
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center text-white pt-16 pb-32">
      <div className="text-6xl mb-4 drop-shadow-lg">{story.emoji}</div>
      <p className="text-sm font-bold text-white/70 uppercase tracking-wider mb-2">
        Ballon d&apos;Or Race
      </p>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-white/60">#</span>
        <span className="brutalist-number-lg text-white drop-shadow-lg">{r.rank}</span>
      </div>
      <h1 className="text-3xl font-black tracking-tight mb-3">{r.playerName}</h1>
      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2">
        <span className="brutalist-number text-2xl text-white">{r.score}</span>
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
          Pulse Score
        </span>
        {r.trend === 'rising' && <span className="text-[#10B981] font-black text-lg">↑</span>}
        {r.trend === 'falling' && <span className="text-[#EF4444] font-black text-lg">↓</span>}
      </div>
    </div>
  )
}

function AwardContent({ story }: { story: PulseStory }) {
  const a = story.award
  if (!a) return null
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center text-white pt-16 pb-32">
      <div className="text-8xl mb-6 drop-shadow-2xl">{story.emoji}</div>
      <p className="text-sm font-bold text-white/70 uppercase tracking-wider mb-2">
        FIFA Official Award
      </p>
      <h1 className="text-3xl font-black tracking-tight mb-2">{a.awardName}</h1>
      <p className="text-xl font-bold text-white/90 mb-6">{a.playerName}</p>
      <p className="text-sm text-white/75 leading-relaxed max-w-xs">{a.matchFact}</p>
    </div>
  )
}

function ArchiveMomentContent({ story }: { story: PulseStory }) {
  const a = story.archiveMoment
  if (!a) return null
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center text-white pt-16 pb-32">
      <div className="text-6xl mb-4 drop-shadow-lg">{story.emoji}</div>
      <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">
        WC 2026 · Archive Moment
      </p>
      <h1 className="text-4xl font-black tracking-tight mb-3 drop-shadow-md">{a.matchName}</h1>
      <p className="text-lg font-bold text-white/90 mb-1">
        {a.playerName} · {a.minute}&apos;
      </p>
      <p className="text-sm text-white/75 leading-relaxed max-w-xs mt-3">{a.description}</p>
    </div>
  )
}
