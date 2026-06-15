'use client'

import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { findNationalTeam } from '@/lib/national-teams'
import { useFlagMode } from '@/lib/flag-mode'
import { TrendIcon } from '@/components/common/TrendIcon'
import type { Player, SelectionType, StageStatus, Position } from '@/types'
import { getPulseFaceEmoji, getRatingColor } from '@/types'

interface FormationPlayerCardProps {
  player: Player
  type: SelectionType
  stageStatus: StageStatus
}

export default function FormationPlayerCard({ player, type, stageStatus }: FormationPlayerCardProps) {
  const { mode: flagMode } = useFlagMode()
  const team = findNationalTeam(player.nationCode)
  const flagEmoji = team?.flag ?? '🏳️'
  const faceEmoji = getPulseFaceEmoji(player.pulseScore)
  const ratingValue = (player.pulseScore / 10).toFixed(1)
  const isElite = type === 'elite'
  const isLive = player.isLive && stageStatus === 'live'
  const isCompleted = stageStatus === 'completed'

  // In flag mode: show country flag in circle, face emoji + rating below
  // In emoji mode: show face emoji in circle, rating below (no duplicate emoji)
  const circleContent = flagMode === 'flag' ? flagEmoji : faceEmoji
  const showEmojiNextToRating = flagMode === 'flag'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center"
    >
      <div
        className={`
          relative flex size-13 sm:size-15 items-center justify-center rounded-full border-2 text-xl shadow-md
          ${isElite
            ? 'border-[#6C2BD9]/40 dark:border-[#8B5CF6]/40 bg-white dark:bg-[#2D2D2D] shadow-[#6C2BD9]/10'
            : 'border-[#EF4444]/40 dark:border-[#F87171]/40 bg-white dark:bg-[#2D2D2D] shadow-[#EF4444]/10'
          }
          ${isLive ? 'animate-pulse-glow' : ''}
          transition-all duration-300 hover:scale-110
        `}
      >
        <span className="text-lg sm:text-xl leading-none">{circleContent}</span>
        {isLive && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#EF4444] shadow-lg shadow-[#EF4444]/50 animate-live-pulse" />
        )}
        {isCompleted && (
          <Lock className="absolute -right-0.5 -top-0.5 size-3 text-[#666] dark:text-[#CCCCCC]" />
        )}
      </div>
      <p className="mt-1 max-w-[70px] truncate text-[10px] sm:text-xs font-bold text-[#1A1A1A] dark:text-white text-center">
        {player.name}
      </p>
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className={`text-[7px] sm:text-[8px] font-bold px-1 py-0 ${
            isElite ? 'border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]' : 'border-[#EF4444]/30 text-[#EF4444] dark:border-[#F87171]/30 dark:text-[#F87171]'
          }`}
        >
          {player.position}
        </Badge>
        <TrendIcon trend={player.trend} />
      </div>
      {/* Rating out of 10 - show face emoji only in flag mode */}
      <div className="mt-1 flex items-center gap-0.5">
        {showEmojiNextToRating && <span className="text-[10px]">{faceEmoji}</span>}
        <span
          className="text-[9px] sm:text-[10px] font-black"
          style={{ color: getRatingColor(player.pulseScore / 10) }}
        >
          {ratingValue}
        </span>
      </div>
      {player.matchInfo && (
        <p className="mt-0.5 text-[8px] text-[#666] dark:text-[#CCCCCC] truncate max-w-[80px] text-center">
          {player.matchInfo}
        </p>
      )}
    </motion.div>
  )
}
