'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, RotateCcw, BadgeCheck } from 'lucide-react'
import { CARD_TIERS } from '@/lib/player-card-tiers'
import { PULSE_FORMULA, type PlayerCardData } from '@/lib/player-card-data'
import { findNationalTeam } from '@/lib/national-teams'
import FlagImage from '@/components/common/FlagImage'
import { toast } from 'sonner'

export type PlayerCardSize = 'full' | 'compact'

interface PlayerCardProps {
  data: PlayerCardData
  size?: PlayerCardSize
  /** Called when the card is viewed (flipped) — drives the card-collection counter. */
  onView?: (id: string) => void
  /** Override the share handler (defaults to /api/card-image + Web Share API). */
  onShare?: (data: PlayerCardData) => void
  className?: string
}

// Dimensions: full = 240×336 (5:7), compact = 160×224 (5:7)
const SIZE_DIMS: Record<PlayerCardSize, { w: number; h: number }> = {
  full: { w: 240, h: 336 },
  compact: { w: 160, h: 224 },
}

export default function PlayerCard({ data, size = 'full', onView, onShare, className }: PlayerCardProps) {
  const [flipped, setFlipped] = useState(false)
  const tier = CARD_TIERS[data.tier]
  const team = findNationalTeam(data.nationCode)
  const flagEmoji = team?.flag ?? '🏳️'
  const dims = SIZE_DIMS[size]

  // Emoji + label sizes scale with card size
  const emojiSize = size === 'full' ? 48 : 32
  const scoreSize = size === 'full' ? 48 : 32
  const labelSize = size === 'full' ? 'text-[11px]' : 'text-[8px]'
  const nameSize = size === 'full' ? 'text-[20px]' : 'text-[14px]'
  const clubSize = size === 'full' ? 'text-[11px]' : 'text-[8px]'

  const handleFlip = useCallback(() => {
    setFlipped((f) => {
      const next = !f
      if (next && onView) onView(data.id)
      return next
    })
  }, [data.id, onView])

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onShare) {
        onShare(data)
        return
      }
      // Default share: fetch the PNG from /api/card-image and use Web Share API
      const params = new URLSearchParams({
        name: data.name,
        nation: data.nationCode,
        position: data.position,
        score: String(data.pulseScore),
        scoreLabel: data.scoreLabel,
        tier: data.tier,
        club: data.clubName ?? '',
      })
      const url = `/api/card-image?${params.toString()}`
      const shareText = `${data.name} ${tier.emoji} ${data.scoreLabel} ${data.pulseScore} — see more at fp.io`
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const file = new File([blob], `fanpulse-${data.name.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText, title: `${data.name} · Fan Pulse Card` })
        } else if (navigator.share) {
          await navigator.share({ text: shareText, title: `${data.name} · Fan Pulse Card` })
        } else {
          // Desktop fallback: download the PNG + copy share text
          const dlUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = dlUrl
          a.download = file.name
          a.click()
          URL.revokeObjectURL(dlUrl)
          await navigator.clipboard?.writeText(shareText).catch(() => {})
          toast.success('Card image downloaded · share text copied')
        }
      } catch (err) {
        // If image generation fails, fall back to text-only share
        try {
          if (navigator.share) {
            await navigator.share({ text: shareText })
          } else {
            await navigator.clipboard?.writeText(shareText).catch(() => {})
            toast.success('Share text copied')
          }
        } catch {
          toast.error('Could not share card')
        }
      }
    },
    [data, tier, onShare],
  )

  return (
    <div
      className={`relative select-none ${className ?? ''}`}
      style={{ width: dims.w, height: dims.h, perspective: 1200 }}
    >
      <motion.div
        className="relative w-full h-full cursor-pointer"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0.0, 0.2, 1] }}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        aria-label={`${data.name} player card — click to flip`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleFlip()
          }
        }}
      >
        {/* ── CARD FRONT ── */}
        <div
          className="glass-card absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            boxShadow: `0 0 24px ${tier.glow}, 0 8px 32px rgba(0,0,0,0.15)`,
            borderColor: tier.glow,
          }}
        >
          {/* Tier-mood tint overlay (subtle, never a solid color) */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: tier.tint }} />
          {/* Subtle diagonal sheen */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.05) 100%)' }}
          />

          {/* Top: tier emoji (HERO) + label */}
          <div className="relative flex flex-col items-center pt-3" style={{ paddingTop: size === 'full' ? 14 : 10 }}>
            <span style={{ fontSize: emojiSize, lineHeight: 1 }} className="drop-shadow-sm select-none">
              {tier.emoji}
            </span>
            <span
              className={`brutalist-number ${labelSize} font-black tracking-[0.15em] mt-1`}
              style={{ color: tier.accent }}
            >
              {tier.label}
            </span>
            {data.isAwardWinner && data.awardName && (
              <span className={`mt-0.5 ${size === 'full' ? 'text-[9px]' : 'text-[7px]'} font-bold text-[#F59E0B] text-center px-2 leading-tight`}>
                {data.awardName}
              </span>
            )}
          </div>

          {/* Center: player name */}
          <div className="relative flex flex-col items-center px-2 mt-2">
            <p
              className={`font-extrabold text-center leading-tight text-[#1A1A1A] dark:text-white ${nameSize}`}
              style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
            >
              {data.name}
            </p>
            {/* Flag + position */}
            <div className="flex items-center gap-1.5 mt-1">
              <FlagImage nationCode={data.nationCode} size={size === 'full' ? 24 : 18} fallbackEmoji={flagEmoji} />
              <span
                className={`brutalist-number ${size === 'full' ? 'text-[10px]' : 'text-[8px]'} font-black px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[#1A1A1A] dark:text-white`}
              >
                {data.position}
              </span>
            </div>
          </div>

          {/* Big center number: Pulse Score (hero number) */}
          <div className="relative flex flex-col items-center mt-2">
            <span
              className="brutalist-number-lg text-[#1A1A1A] dark:text-white"
              style={{ fontSize: scoreSize, fontWeight: 900 }}
            >
              {data.pulseScore}
            </span>
            <span className={`mt-0.5 ${size === 'full' ? 'text-[9px]' : 'text-[7px]'} font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]`}>
              {data.scoreLabel}
            </span>
          </div>

          {/* Bottom: club + trend */}
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
            <div className="flex items-center justify-between gap-1">
              <span className={`truncate font-semibold text-[#666] dark:text-[#CCCCCC] ${clubSize}`}>
                {data.clubName ?? '—'}
              </span>
              <TrendArrow trend={data.trend} size={size} />
            </div>
          </div>

          {/* Share button (bottom-right corner) */}
          <button
            onClick={handleShare}
            aria-label={`Share ${data.name} card`}
            className={`absolute bottom-1.5 right-1.5 flex items-center justify-center rounded-full glass-card hover:scale-110 transition-transform focus-visible:ring-2 focus-visible:ring-[#6C2BD9] ${
              size === 'full' ? 'size-7' : 'size-5'
            }`}
            style={{ borderColor: tier.glow }}
          >
            <Share2 className={size === 'full' ? 'size-3.5' : 'size-2.5'} style={{ color: tier.accent }} />
          </button>
        </div>

        {/* ── CARD BACK ── */}
        <div
          className="glass-card absolute inset-0 rounded-2xl overflow-hidden p-3 flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: `0 0 24px ${tier.glow}, 0 8px 32px rgba(0,0,0,0.15)`,
            borderColor: tier.glow,
          }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: tier.tint }} />

          {/* Back header */}
          <div className="relative flex items-center justify-between mb-2">
            <span className={`brutalist-number ${size === 'full' ? 'text-[11px]' : 'text-[8px]'} font-black tracking-wider`} style={{ color: tier.accent }}>
              {tier.emoji} {tier.label}
            </span>
            <span className={`brutalist-number ${size === 'full' ? 'text-[20px]' : 'text-[14px]'} font-black text-[#1A1A1A] dark:text-white`}>
              {data.pulseScore}
            </span>
          </div>

          {/* Formula breakdown — 4 bars */}
          <div className="relative flex-1 flex flex-col gap-1.5 justify-center">
            {PULSE_FORMULA.map((comp) => (
              <div key={comp.key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`${size === 'full' ? 'text-[9px]' : 'text-[7px]'} font-bold text-[#1A1A1A] dark:text-white`}>
                    {comp.label}
                  </span>
                  <span className={`brutalist-number ${size === 'full' ? 'text-[10px]' : 'text-[8px]'} font-black`} style={{ color: tier.accent }}>
                    {comp.weight}%
                  </span>
                </div>
                <div className={`w-full rounded-full overflow-hidden ${size === 'full' ? 'h-1.5' : 'h-1'} bg-black/10 dark:bg-white/10`}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${comp.weight}%`, background: tier.accent }}
                  />
                </div>
                {size === 'full' && (
                  <p className="text-[7px] text-[#666] dark:text-[#CCCCCC] mt-0.5 leading-tight">{comp.note}</p>
                )}
              </div>
            ))}
          </div>

          {/* Verified data badge */}
          <div className="relative flex items-center gap-1 mt-2 pt-1.5 border-t border-black/10 dark:border-white/10">
            <BadgeCheck className={size === 'full' ? 'size-3.5' : 'size-2.5'} style={{ color: tier.accent }} />
            <span className={`${size === 'full' ? 'text-[8px]' : 'text-[6px]'} font-bold text-[#666] dark:text-[#CCCCCC]`}>
              Verified · {data.source}
            </span>
          </div>

          {/* Flip-back hint */}
          <div className="relative flex items-center justify-center mt-1">
            <span className={`flex items-center gap-1 ${size === 'full' ? 'text-[8px]' : 'text-[6px]'} text-[#999] dark:text-[#999]`}>
              <RotateCcw className={size === 'full' ? 'size-2.5' : 'size-2'} /> tap to flip back
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function TrendArrow({ trend, size }: { trend: string; size: PlayerCardSize }) {
  // Sentiment trend is always conveyed with an emoji.
  const s = size === 'full' ? 'text-base' : 'text-sm'
  if (trend === 'rising') return <span className={`${s} leading-none`} title="Rising">📈</span>
  if (trend === 'falling') return <span className={`${s} leading-none`} title="Falling">📉</span>
  return <span className={`${s} leading-none`} title="Stable">➡️</span>
}

/**
 * A lightweight grid of cards for testing/showcasing all tiers.
 * Renders one card per tier using verified data samples.
 */
export function PlayerCardShowcase({ cards, onView }: { cards: PlayerCardData[]; onView?: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <AnimatePresence>
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <PlayerCard data={c} onView={onView} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
