'use client'

import { motion } from 'framer-motion'
import { LayoutGrid, X, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import PlayerCard from '@/components/PlayerCard'
import { collectibleCardCatalog, type PlayerCardData } from '@/lib/player-card-data'
import { CARD_TIERS } from '@/lib/player-card-tiers'
import { useCardCollection } from '@/hooks/use-card-collection'

interface CardCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Card Collection modal — shows every collectible player card in the app.
 * Cards the user has "seen" (flipped) render in full color; unseen cards
 * render as a locked silhouette with the tier emoji faintly visible.
 *
 * This is the gamification hook: "Cards seen: X / total" encourages users to
 * browse all tabs (Sentiments, World Cup, Ballon d'Or, Transfers) to collect
 * every 🔥 🏆 🚀 💀 card.
 *
 * The catalog is sourced entirely from verified data (Elite XI + Crisis XI +
 * Ballon d'Or contenders) — see collectibleCardCatalog(). NO invented cards.
 */
export function CardCollectionModal({ open, onOpenChange }: CardCollectionModalProps) {
  const { seen, seenCount, markSeen } = useCardCollection()
  const catalog = collectibleCardCatalog()
  const total = catalog.length
  const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0

  // Group cards by tier for display
  const byTier = catalog.reduce<Record<string, PlayerCardData[]>>((acc, c) => {
    ;(acc[c.tier] ??= []).push(c)
    return acc
  }, {})
  const tierOrder: PlayerCardData['tier'][] = ['award', 'breakout', 'elite', 'rising', 'steady', 'crisis']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto bg-white dark:bg-[#1A1A1A] border-[#E0E0E0] dark:border-white/10 p-0">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur border-b border-[#E0E0E0]/50 dark:border-white/10 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-[#1A1A1A] dark:text-white">
                <LayoutGrid className="size-5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
                Card Collection
              </DialogTitle>
              <DialogDescription className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                Flip cards across all tabs to collect them all
              </DialogDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="rounded-full size-8 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span className="text-[#1A1A1A] dark:text-white">
                Cards seen: <span className="brutalist-number text-[#6C2BD9] dark:text-[#8B5CF6]">{seenCount}</span> / {total}
              </span>
              <span className="text-[#666] dark:text-[#CCCCCC]">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#F0F0F0] dark:bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#6C2BD9] to-[#FF6B35]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Card grid grouped by tier */}
        <div className="p-5 space-y-6">
          {tierOrder.map((tier) => {
            const cards = byTier[tier]
            if (!cards || cards.length === 0) return null
            const info = CARD_TIERS[tier]
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{info.emoji}</span>
                  <h3
                    className="text-xs font-black tracking-[0.15em] uppercase"
                    style={{ color: info.accent }}
                  >
                    {info.label}
                  </h3>
                  <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                    {cards.filter((c) => seen.has(c.id)).length} / {cards.length} collected
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {cards.map((card) => {
                    const isSeen = seen.has(card.id)
                    return (
                      <div key={card.id} className={isSeen ? '' : 'relative'}>
                        {isSeen ? (
                          <PlayerCard data={card} size="compact" onView={markSeen} />
                        ) : (
                          <LockedCard data={card} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Encouragement footer */}
          {seenCount < total && (
            <div className="rounded-xl bg-[#6C2BD9]/5 dark:bg-[#8B5CF6]/10 border border-[#6C2BD9]/15 dark:border-[#8B5CF6]/20 p-4 text-center">
              <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                {total - seenCount} card{total - seenCount === 1 ? '' : 's'} left to collect!
              </p>
              <p className="mt-1 text-[11px] text-[#666] dark:text-[#CCCCCC]">
                Browse Sentiments, World Cup, Ballon d&rsquo;Or, and Transfers tabs — flip any card to add it to your collection.
              </p>
            </div>
          )}
          {seenCount === total && total > 0 && (
            <div className="rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 p-4 text-center">
              <p className="text-2xl mb-1">🎉</p>
              <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                Collection complete! You&rsquo;ve found every card.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A locked (unseen) card — silhouette with faint tier emoji. */
function LockedCard({ data }: { data: PlayerCardData }) {
  const tier = CARD_TIERS[data.tier]
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-dashed border-[#E0E0E0] dark:border-white/15 bg-[#F8F9FA] dark:bg-[#2D2D2D]/50 flex items-center justify-center"
      style={{ width: 160, height: 224 }}
    >
      <div className="flex flex-col items-center gap-2 opacity-40">
        <Lock className="size-6 text-[#999] dark:text-[#666]" />
        <span className="text-3xl opacity-50">{tier.emoji}</span>
        <span
          className="text-[8px] font-black tracking-[0.15em] uppercase"
          style={{ color: tier.accent }}
        >
          {tier.label}
        </span>
        <span className="text-[9px] text-[#999] dark:text-[#666] text-center px-2">
          Not yet discovered
        </span>
      </div>
    </div>
  )
}
