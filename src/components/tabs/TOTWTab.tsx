'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam } from '@/lib/national-teams'
import FlagImage from '@/components/common/FlagImage'
import { useWCStages } from '@/hooks/queries/use-wc-stages'
import { useEliteCrisis } from '@/hooks/queries/use-elite-crisis'
import type { Player, Position } from '@/types'

// ── Formation Layout 4-3-3 ──────────────────────────────────

const FORMATION_ROWS: { pos: Position }[][] = [
  [{ pos: 'GK' }],
  [{ pos: 'RB' }, { pos: 'CB' }, { pos: 'CB' }, { pos: 'LB' }],
  [{ pos: 'CM' }, { pos: 'CAM' }, { pos: 'CM' }],
  [{ pos: 'RW' }, { pos: 'ST' }, { pos: 'LW' }],
]

// ── Helpers ──────────────────────────────────────────────────

function getFlagEmoji(nationCode: string): string {
  const team = findNationalTeam(nationCode)
  return team?.flag ?? '🏳️'
}

function findPlayerForPosition(players: Player[], pos: Position): Player | undefined {
  return players.find(p => p.position === pos)
}

// ── TOTW Tab ─────────────────────────────────────────────────

export default function TOTWTab() {
  const { t } = useLanguage()
  const { data: stages } = useWCStages()

  // Auto-select stage: prefer LIVE > latest COMPLETED > first stage.
  // Once the tournament is over, this defaults to the Final stage so the
  // Team of the Tournament (Best XI) is shown rather than the Group Stage XI.
  const stageId = useMemo(() => {
    if (!stages || stages.length === 0) return null
    const liveStage = stages.find(s => s.status === 'live')
    if (liveStage) return liveStage.id
    const completedStages = stages.filter(s => s.status === 'completed')
    const latestCompleted = completedStages[completedStages.length - 1]
    return (latestCompleted ?? stages[0]).id
  }, [stages])

  const { data: eliteCrisisData, isLoading } = useEliteCrisis(stageId)

  // Get elite players (these become the TOTW)
  const elitePlayers = eliteCrisisData?.elite?.players ?? []

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          {t('totw.title')}
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('totw.formation')}</p>
      </motion.div>

      {/* Loading state */}
      {isLoading && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
          <CardContent className="p-4">
            <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
              {FORMATION_ROWS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                  {row.map((slot, ci) => (
                    <div key={`${ri}-${ci}`} className="flex flex-col items-center gap-1">
                      <Skeleton className="size-12 sm:size-14 rounded-full" />
                      <Skeleton className="h-3 w-10 rounded" />
                      <Skeleton className="h-3 w-6 rounded" />
                      <Skeleton className="h-3 w-8 rounded" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data state (upcoming or no elite data) */}
      {!isLoading && elitePlayers.length === 0 && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto size-8 text-[#666]/30 dark:text-[#CCCCCC]/30 mb-3" />
            <p className="text-sm text-[#666] dark:text-[#CCCCCC]">No Team of the Week data yet — stage starts soon</p>
          </CardContent>
        </Card>
      )}

      {/* Formation card */}
      {!isLoading && elitePlayers.length > 0 && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
          <CardContent className="p-4">
            <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
              {FORMATION_ROWS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                  {row.map((slot, ci) => {
                    const player = findPlayerForPosition(elitePlayers, slot.pos)
                    return (
                      <motion.div
                        key={`${ri}-${ci}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: ri * 0.1 + ci * 0.05 }}
                        className="flex flex-col items-center"
                        title={player ? `${player.name} · ${player.nationCode} · ${player.position} · Rating ${(player.pulseScore / 10).toFixed(1)}` : slot.pos}
                      >
                        <div className="flex size-12 sm:size-14 items-center justify-center rounded-full border-2 border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 bg-white dark:bg-[#2D2D2D] shadow-md overflow-hidden">
                          {player ? (
                            <FlagImage nationCode={player.nationCode} size={32} fallbackEmoji={getFlagEmoji(player.nationCode)} />
                          ) : (
                            <span className="text-lg">👤</span>
                          )}
                        </div>
                        {/* Player name — full name (no truncation), word-break keeps long names visible */}
                        <p
                          className="mt-1 max-w-[72px] sm:max-w-[88px] text-[10px] font-bold text-[#1A1A1A] dark:text-white text-center leading-tight"
                          style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                        >
                          {player?.name ?? slot.pos}
                        </p>
                        {/* Position badge — clearly labelled "POS" pill, visually distinct from rating */}
                        <div className="mt-0.5 flex flex-col items-center gap-0.5">
                          <Badge variant="outline" className="text-[8px] font-bold px-1 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                            {slot.pos}
                          </Badge>
                          {player && (
                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#6C2BD9] dark:bg-[#8B5CF6]">
                              <span className="text-[9px] font-black text-white leading-none">
                                {(player.pulseScore / 10).toFixed(1)}
                              </span>
                              <span className="text-[6px] font-semibold text-white/70 uppercase tracking-wide leading-none">rtg</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
