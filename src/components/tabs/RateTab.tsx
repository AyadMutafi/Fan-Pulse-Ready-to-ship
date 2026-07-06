'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam } from '@/lib/national-teams'
import { useFanRatings, useSubmitRating } from '@/hooks/queries/use-ratings'
import { getRatingEmoji, getRatingColor, getRatingLabel } from '@/types'

// ── Helpers ──────────────────────────────────────────────────

function getFlag(nationCode: string): string {
  const team = findNationalTeam(nationCode)
  return team?.flag ?? '🏳️'
}

/** Get the face emoji for each rating position 1-10 */
function getPositionEmoji(pos: number): string {
  if (pos >= 9) return '🤩'
  if (pos >= 7) return '😊'
  if (pos >= 5) return '😐'
  if (pos >= 3) return '😟'
  return '😵'
}

// ── Skeleton Card ────────────────────────────────────────────

function SkeletonRatingCard() {
  return (
    <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-8 rounded" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="size-4 rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Emoji Rating Picker ──────────────────────────────────────

function EmojiRatingPicker({
  rating,
  onRate,
  disabled,
}: {
  rating: number
  onRate: (value: number) => void
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const displayValue = hovered ?? rating

  return (
    <div className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pos) => {
        const isActive = pos <= displayValue
        const emoji = getPositionEmoji(pos)

        return (
          <button
            key={pos}
            onClick={() => onRate(pos)}
            onMouseEnter={() => !disabled && setHovered(pos)}
            onMouseLeave={() => setHovered(null)}
            disabled={disabled}
            className={`
              relative flex items-center justify-center size-6 sm:size-7 rounded-md text-xs
              transition-all duration-150
              ${isActive
                ? 'scale-110 opacity-100'
                : 'scale-100 opacity-30'
              }
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-125'}
            `}
          >
            <span className="text-sm sm:text-base">{emoji}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Rating Emoji Bar (visual display) ────────────────────────

function RatingEmojiBar({ rating, max = 10 }: { rating: number; max?: number }) {
  const color = getRatingColor(rating)

  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: max }).map((_, i) => {
        const pos = i + 1
        const filled = pos <= Math.round(rating)

        return (
          <div
            key={i}
            className={`
              size-2 sm:size-2.5 rounded-full transition-all duration-300
              ${filled ? 'scale-100' : 'scale-75 opacity-30'}
            `}
            style={{ backgroundColor: filled ? color : '#E0E0E0' }}
          />
        )
      })}
    </div>
  )
}

// ── Rate Tab ─────────────────────────────────────────────────

export default function RateTab() {
  const { t } = useLanguage()
  const { data: ratings, isLoading, error } = useFanRatings()
  const submitRating = useSubmitRating()
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({})

  const handleRate = (playerId: string, value: number) => {
    setLocalRatings(prev => ({ ...prev, [playerId]: value }))
    submitRating.mutate({ playerId, rating: value })
  }

  const getPlayerRating = (playerId: string, userRating: number | null) => {
    return localRatings[playerId] ?? userRating ?? 0
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          {t('ratings.title')}
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('ratings.desc')}</p>
      </motion.div>

      {/* Error state */}
      {error && (
        <Card className="border-[#EF4444]/30 dark:border-[#EF4444]/20">
          <CardContent className="p-4 text-center">
            <span className="text-3xl">😵</span>
            <p className="text-sm text-[#EF4444] mt-2">Failed to load ratings. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <SkeletonRatingCard />
            </motion.div>
          ))}
        </div>
      )}

      {/* Rating cards */}
      {ratings && ratings.length > 0 && (
        <div className="space-y-3">
          {ratings.map((player, i) => {
            const currentRating = getPlayerRating(player.playerId, player.userRating)
            const avgRating = player.avgRating
            const emoji = getRatingEmoji(avgRating)
            const color = getRatingColor(avgRating)
            const label = getRatingLabel(avgRating)

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                  <CardContent className="p-4">
                    {/* Player info + avg rating */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getFlag(player.nationCode)}</span>
                        <div>
                          <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">{player.playerName}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                              {player.position}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Avg rating display with emoji */}
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{emoji}</span>
                        <div className="flex flex-col items-end">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black" style={{ color }}>
                              {avgRating.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-[#999] dark:text-gray-500">/10</span>
                          </div>
                          <span className="text-[9px] font-semibold" style={{ color }}>
                            {label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Avg rating emoji bar */}
                    <div className="mt-3 flex items-center justify-between">
                      <RatingEmojiBar rating={avgRating} />
                      <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                        {player.totalRatings.toLocaleString()} ratings
                      </span>
                    </div>

                    {/* Interactive emoji rating picker */}
                    <div className="mt-3 pt-3 border-t border-[#E0E0E0]/50 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#666] dark:text-[#CCCCCC]">
                          {t('ratings.your_rating')}:
                        </span>
                        <EmojiRatingPicker
                          rating={currentRating}
                          onRate={(value) => handleRate(player.playerId, value)}
                          disabled={submitRating.isPending}
                        />
                      </div>

                      {/* Rating feedback */}
                      <AnimatePresence>
                        {currentRating > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg">{getRatingEmoji(currentRating)}</span>
                              <span
                                className="text-xs font-bold"
                                style={{ color: getRatingColor(currentRating) }}
                              >
                                {currentRating}/10
                              </span>
                            </div>
                            <Progress
                              value={(currentRating / 10) * 100}
                              className="h-1.5 w-24"
                              style={{
                                // @ts-expect-error CSS custom property
                                '--progress-color': getRatingColor(currentRating),
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {ratings && ratings.length === 0 && !isLoading && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="py-12 text-center">
            <span className="text-4xl">😐</span>
            <p className="text-sm text-[#666] dark:text-[#CCCCCC] mt-3">No players available for rating</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
