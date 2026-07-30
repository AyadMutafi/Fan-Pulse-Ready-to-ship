'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, X } from 'lucide-react'
import { useCardCollection } from '@/hooks/use-card-collection'

/**
 * "Share this card" nudge — a gentle, dismissible prompt that appears after
 * the user has flipped (viewed) 5 player cards. Encourages sharing without
 * being aggressive.
 *
 * Uses useCardCollection's seenCount to detect the 5-card threshold. Once
 * dismissed, it stays dismissed for the session (sessionStorage).
 *
 * Hydration uses the "adjust state when a prop changes" pattern (React docs)
 * rather than setState-in-an-effect, to avoid cascading renders.
 */
const DISMISS_KEY = 'fanpulse:share-nudge-dismissed'

export function ShareNudge() {
  const { seenCount } = useCardCollection()
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // On first client render, hydrate the dismissed flag from sessionStorage.
  // setState-during-render is safe here because it's conditional and converges
  // immediately — React re-renders without committing the intermediate state.
  if (!hydrated) {
    setHydrated(true)
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true)
      }
    } catch {
      // ignore
    }
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  // Show after 5 cards viewed, unless dismissed
  const shouldShow = seenCount >= 5 && !dismissed

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="glass-card rounded-2xl border-[#6C2BD9]/20 dark:border-[#8B5CF6]/20 p-4 flex items-center gap-3 shadow-lg">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C2BD9] to-[#FF6B35]">
              <Share2 className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                Loving the cards?
              </p>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                Share your favorite one → tap the share icon on any card
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-full size-7 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9]"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
