'use client'

import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { findNationalTeam } from '@/lib/national-teams'
import { useFlagMode } from '@/lib/flag-mode'
import FlagImage from '@/components/common/FlagImage'
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center"
      title={`${player.name} · ${team?.name ?? player.nationCode} · ${player.position} · Rating ${ratingValue}`}
    >
      <div
        className={`
          relative flex size-13 sm:size-15 items-center justify-center rounded-full border-2 text-xl shadow-md overflow-hidden
          border-white/60 bg-white/90 dark:bg-white/80 shadow-black/20
          ${isLive ? 'animate-pulse-glow' : ''}
          transition-all duration-300 hover:scale-110
        `}
      >
        {flagMode === 'flag' ? (
          <FlagImage nationCode={player.nationCode} size={36} fallbackEmoji={flagEmoji} />
        ) : (
          <span className="text-lg sm:text-xl leading-none">{faceEmoji}</span>
        )}
        {isLive && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#EF4444] shadow-lg shadow-[#EF4444]/50 animate-live-pulse" />
        )}
        {isCompleted && (
          <Lock className="absolute -right-0.5 -top-0.5 size-3 text-[#666] dark:text-[#CCCCCC]" />
        )}
      </div>
      <p
        className="mt-1 max-w-[90px] sm:max-w-[110px] text-[10px] sm:text-xs font-bold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-tight"
        style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
      >
        {player.name}
      </p>
      {/* Position badge — visually distinct pill (jersey-number slot) */}
      <div className="mt-1">
        <Badge
          variant="outline"
          className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0 bg-white/95 backdrop-blur-sm ${
            isElite ? 'border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]' : 'border-[#EF4444]/30 text-[#EF4444] dark:border-[#F87171]/30 dark:text-[#F87171]'
          }`}
        >
          {player.position}
        </Badge>
      </div>
      {/* Match Rating — clearly labelled, separated from position */}
      <div className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm">
        {flagMode === 'flag' && <span className="text-[10px]">{faceEmoji}</span>}
        <span
          className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        >
          {ratingValue}
        </span>
        <span className="text-[7px] sm:text-[8px] font-semibold text-white/70 uppercase tracking-wide">rtg</span>
      </div>
      {player.matchInfo && (
        <p className="mt-1 text-[8px] text-white/80 truncate max-w-[100px] text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          {player.matchInfo}
        </p>
      )}
    </motion.div>
  )
}
