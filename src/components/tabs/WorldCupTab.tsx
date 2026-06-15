'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Clock, Activity, TrendingUp, TrendingDown, Users, Shield, Star, CircleDot } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { LiveBadge } from '@/components/common/LiveBadge'
import { TrendIcon } from '@/components/common/TrendIcon'
import PulseScoreRing from '@/components/pulse/PulseScoreRing'
import { useLanguage } from '@/context/LanguageContext'
import { useEliteCrisis } from '@/hooks/queries/use-elite-crisis'
import { usePulseScore } from '@/hooks/queries/use-pulse-score'
import { findNationalTeam } from '@/lib/national-teams'
import { useFlagMode } from '@/lib/flag-mode'
import FlagImage from '@/components/common/FlagImage'
import type { WCStage, SelectionType, StageStatus, Player } from '@/types'
import { getPulseFaceEmoji } from '@/types'

// ── World Cup Tab ────────────────────────────────────────

interface WorldCupTabProps {
  stages: WCStage[]
}

export default function WorldCupTab({ stages }: WorldCupTabProps) {
  const { t, lang } = useLanguage()
  const { mode: flagMode, toggle: toggleFlag } = useFlagMode()
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<SelectionType>('elite')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  // Auto-select first LIVE stage
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      const liveStage = stages.find(s => s.status === 'live')
      setSelectedStageId((liveStage ?? stages[0]).id)
    }
  }, [stages, selectedStageId])

  // Fetch elite/crisis data with auto-refresh
  const { data: eliteCrisisData, isLoading } = useEliteCrisis(selectedStageId)

  // Fetch pulse score for selected player
  const { data: pulseScoreData } = usePulseScore(selectedPlayerId)

  const selectedStage = stages.find(s => s.id === selectedStageId)
  const stageStatus: StageStatus = selectedStage?.status ?? 'upcoming'
  const eliteData = eliteCrisisData?.elite ?? null
  const crisisData = eliteCrisisData?.crisis ?? null
  const currentData = activeView === 'elite' ? eliteData : crisisData

  const getStatusBadge = (status: StageStatus) => {
    switch (status) {
      case 'live':
        return <LiveBadge />
      case 'completed':
        return (
          <Badge className="bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border-[#E0E0E0] dark:border-white/10 gap-1 text-[9px] font-bold px-1.5 py-0">
            <Lock className="size-2.5" />
            COMPLETED
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[#FF6B35] border-[#FF6B35]/30 gap-1 text-[9px] font-bold px-1.5 py-0">
            <Clock className="size-2.5" />
            UPCOMING
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          🏆 {t('wc.title')}
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('wc.new_stage')}</p>
        </div>
      </motion.div>

      {/* Loading state when stages haven't loaded yet */}
      {stages.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin size-8 rounded-full border-2 border-[#6C2BD9]/30 border-t-[#6C2BD9]" />
        </div>
      )}

      {/* Stage Selector */}
      {stages.length > 0 && (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {stages.map((stage) => {
          const isActive = selectedStageId === stage.id
          return (
            <motion.button
              key={stage.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedStageId(stage.id)}
              className={`
                relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold
                transition-all duration-300
                ${isActive
                  ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
                }
              `}
            >
              {stage.order <= 3 && <CircleDot className="size-3" />}
              {stage.order > 3 && stage.order < 6 && <Shield className="size-3" />}
              {stage.order === 6 && <Star className="size-3" />}
              <span>{lang === 'AR' ? stage.nameAr : stage.name}</span>
              {getStatusBadge(stage.status)}
            </motion.button>
          )
        })}
      </div>
      )}

      {/* Upcoming stage message */}
      {stageStatus === 'upcoming' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-[#E0E0E0]/50 dark:border-white/5 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-16 text-center"
        >
          <Clock className="size-10 text-[#666]/50 dark:text-[#CCCCCC]/50 mb-3" />
          <p className="text-lg font-bold text-[#666] dark:text-[#CCCCCC]">{t('wc.countdown')}</p>
          <p className="mt-1 text-sm text-[#666]/70 dark:text-[#CCCCCC]/70">{t('wc.no_data')}</p>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && stageStatus !== 'upcoming' && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin size-8 rounded-full border-2 border-[#6C2BD9]/30 border-t-[#6C2BD9]" />
        </div>
      )}

      {/* Elite/Crisis Content */}
      {!isLoading && stageStatus !== 'upcoming' && (
        <>
          {/* Toggle Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveView('elite'); setSelectedPlayerId(null) }}
              className={`
                rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200
                ${activeView === 'elite'
                  ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
                }
              `}
            >
              {t('wc.pulse_elite')}
            </button>
            <button
              onClick={() => { setActiveView('crisis'); setSelectedPlayerId(null) }}
              className={`
                rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200
                ${activeView === 'crisis'
                  ? 'bg-[#EF4444] text-white shadow-md shadow-[#EF4444]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#EF4444]/30'
                }
              `}
            >
              {t('wc.crisis_radar')}
            </button>
          </div>

          {/* LIVE timestamp */}
          {stageStatus === 'live' && eliteCrisisData?.lastUpdated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-[10px] text-[#666] dark:text-[#CCCCCC]"
            >
              <span className="size-2 rounded-full bg-[#10B981] animate-live-pulse" />
              Updated {Math.round((Date.now() - new Date(eliteCrisisData.lastUpdated).getTime()) / 60000)} min ago
              <span className="text-[#999]">· Auto-refresh 60s</span>
            </motion.div>
          )}

          {/* Formation Card */}
          {currentData && (
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className={`overflow-hidden border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none ${activeView === 'elite' ? 'purple-glow' : 'red-glow'}`}>
                {/* Top accent bar */}
                <div className={`h-1 w-full ${activeView === 'elite' ? 'bg-gradient-to-r from-[#6C2BD9] via-[#8B5CF6] to-[#FF6B35]' : 'bg-gradient-to-r from-[#EF4444] via-[#DC2626] to-[#FF6B35]'}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{activeView === 'elite' ? '🌟' : '⚠️'}</span>
                    <div>
                      <CardTitle className={`text-xl font-bold ${activeView === 'elite' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#EF4444] dark:text-[#F87171]'}`}>
                        {activeView === 'elite' ? t('wc.pulse_elite') : t('wc.crisis_radar')}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#666] dark:text-[#CCCCCC]">
                        {activeView === 'elite' ? t('wc.stars_of_week') : t('wc.flops_of_week')}
                      </CardDescription>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      {/* Flag/Emoji Toggle Switch */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold transition-colors ${flagMode === 'emoji' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#999] dark:text-[#666]'}`}>Emoji</span>
                        <Switch
                          checked={flagMode === 'flag'}
                          onCheckedChange={() => toggleFlag()}
                          className="data-[state=checked]:bg-[#6C2BD9] data-[state=unchecked]:bg-[#6C2BD9]/40"
                        />
                        <span className={`text-[11px] font-bold transition-colors ${flagMode === 'flag' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#999] dark:text-[#666]'}`}>Flag</span>
                      </div>
                      {stageStatus === 'completed' && (
                        <Badge className="bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border-[#E0E0E0] dark:border-white/10 gap-1 text-[10px]">
                          <Lock className="size-3" /> 🔒 {t('wc.locked')}
                        </Badge>
                      )}
                      {stageStatus === 'live' && <LiveBadge />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 pt-3">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Formation Pitch */}
                    <div className="flex-1">
                      <div className={`pitch-bg relative ${activeView === 'crisis' ? 'crisis-pitch' : ''}`}>
                        {/* Football Pitch Markings - SVG overlay */}
                        <PitchMarkings crisis={activeView === 'crisis'} />

                        {/* Player Formation Columns - landscape layout GK→DEF→MID→FWD */}
                        <div className="relative z-10 px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center h-full">
                          {organizeFormationLandscape(currentData.players).map((col, ci) => (
                            <div key={ci} className="flex flex-col items-center gap-1 sm:gap-1.5">
                              {col.map((player) => (
                                <motion.div
                                  key={player.id}
                                  className="flex flex-col items-center cursor-pointer"
                                  onClick={() => setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id)}
                                  whileHover={{ scale: 1.08 }}
                                >
                                  <FormationPlayerCardInline
                                    player={player}
                                    type={activeView}
                                    stageStatus={stageStatus}
                                    isSelected={player.id === selectedPlayerId}
                                  />
                                </motion.div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pulse Score Detail Panel */}
                    <AnimatePresence>
                      {pulseScoreData && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 240 }}
                          exit={{ opacity: 0, width: 0 }}
                          className="shrink-0 hidden lg:block"
                        >
                          <Card className="border-[#E0E0E0]/50 dark:border-white/5 h-full">
                            <CardContent className="p-3 flex flex-col items-center">
                              <div className="flex items-center gap-2 mb-2">
                                <FlagImage nationCode={pulseScoreData.player.nationCode} size={20} fallbackEmoji={findNationalTeam(pulseScoreData.player.nationCode)?.flag ?? '🏳️'} />
                                <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">
                                  {pulseScoreData.player.name}
                                </p>
                              </div>
                              <PulseScoreRing
                                pulseScore={pulseScoreData.pulseScore}
                                size={100}
                                showBreakdown
                              />
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Stats bar */}
          {eliteData && crisisData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { label: t('wc.elite_avg'), value: (eliteData.players.reduce((a, p) => a + p.pulseScore, 0) / eliteData.players.length / 10).toFixed(1), icon: TrendingUp, color: 'text-[#6C2BD9]' },
                { label: t('wc.crisis_avg'), value: (crisisData.players.reduce((a, p) => a + p.pulseScore, 0) / crisisData.players.length / 10).toFixed(1), icon: TrendingDown, color: 'text-[#EF4444]' },
                { label: t('wc.live_players'), value: [...eliteData.players, ...crisisData.players].filter(p => p.isLive).length, icon: Activity, color: 'text-[#FF6B35]' },
                { label: t('wc.total_votes'), value: '1.2M', icon: Users, color: 'text-[#1A1A1A] dark:text-white' },
              ].map((stat, i) => (
                <Card key={i} className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                  <CardContent className="p-3 text-center">
                    <stat.icon className={`mx-auto size-4 mb-1.5 ${stat.color}`} />
                    <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC]">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

// ── Inline Formation Player Card (with team logo + selection state) ──

function FormationPlayerCardInline({
  player,
  type,
  stageStatus,
  isSelected,
}: {
  player: Player
  type: SelectionType
  stageStatus: StageStatus
  isSelected: boolean
}) {
  const { mode: flagMode } = useFlagMode()
  const team = findNationalTeam(player.nationCode)
  const flagEmoji = team?.flag ?? '🏳️'
  const faceEmoji = getPulseFaceEmoji(player.pulseScore)
  const ratingValue = (player.pulseScore / 10).toFixed(1)
  const isElite = type === 'elite'
  const isLive = player.isLive && stageStatus === 'live'
  const isCompleted = stageStatus === 'completed'

  return (
    <div className="flex flex-col items-center">
      {/* Player Circle - always shows face emoji */}
      <div
        className={`
          relative flex size-10 sm:size-12 items-center justify-center rounded-full border-2 shadow-md overflow-hidden
          border-white/70 bg-white/95 dark:bg-white/90 shadow-black/15
          ${isLive ? 'animate-pulse-glow' : ''}
          ${isSelected ? 'ring-2 ring-[#6C2BD9] ring-offset-1 ring-offset-transparent' : ''}
          transition-all duration-300
        `}
      >
        <span className="text-lg sm:text-xl leading-none select-none">{faceEmoji}</span>
        {isLive && (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[#EF4444] shadow-lg shadow-[#EF4444]/50 animate-live-pulse" />
        )}
        {isCompleted && (
          <Lock className="absolute -right-0.5 -top-0.5 size-2.5 text-[#666] dark:text-[#CCCCCC]" />
        )}
      </div>
      {/* Player Name */}
      <p className="mt-0.5 max-w-[60px] truncate text-[9px] sm:text-[10px] font-bold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {player.name}
      </p>
      {/* Position + Rating inline */}
      <div className="flex items-center gap-0.5">
        <Badge
          variant="outline"
          className={`text-[6px] sm:text-[7px] font-bold px-0.5 py-0 bg-white/90 backdrop-blur-sm ${
            isElite ? 'border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]' : 'border-[#EF4444]/30 text-[#EF4444] dark:border-[#F87171]/30 dark:text-[#F87171]'
          }`}
        >
          {player.position}
        </Badge>
        <TrendIcon trend={player.trend} />
      </div>
      {/* Rating + Flag next to score */}
      <div className="flex items-center gap-0.5">
        {flagMode === 'flag' ? (
          <FlagImage nationCode={player.nationCode} size={12} fallbackEmoji={flagEmoji} />
        ) : (
          <span className="text-[10px] leading-none">{flagEmoji}</span>
        )}
        <span
          className="text-[9px] sm:text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        >
          {ratingValue}
        </span>
      </div>
    </div>
  )
}



function organizeFormationLandscape(players: Player[]): Player[][] {
  const gk = players.filter(p => p.position === 'GK')
  const def = players.filter(p => ['CB', 'LB', 'RB'].includes(p.position))
  const mid = players.filter(p => ['CM', 'CAM', 'CDM'].includes(p.position))
  const fwd = players.filter(p => ['LW', 'RW', 'ST', 'CF'].includes(p.position))
  return [gk, def, mid, fwd]  // Landscape: GK on left, FWD on right
}

// ── Pitch Markings SVG Overlay (Landscape 4:3) ──────────────
function PitchMarkings({ crisis }: { crisis: boolean }) {
  const lineColor = crisis ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)'
  const dotFill = crisis ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)'

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke={lineColor} strokeWidth="1.5" fill="none">
        {/* Outer boundary */}
        <rect x="6" y="6" width="388" height="288" rx="3" />

        {/* Halfway line (vertical) */}
        <line x1="200" y1="6" x2="200" y2="294" />

        {/* Center circle */}
        <circle cx="200" cy="150" r="36" />
        <circle cx="200" cy="150" r="3" fill={dotFill} />

        {/* Left penalty area */}
        <rect x="6" y="70" width="60" height="160" />
        {/* Left goal area */}
        <rect x="6" y="105" width="25" height="90" />
        {/* Left penalty arc */}
        <path d="M 66 110 A 36 36 0 0 1 66 190" />
        {/* Left penalty spot */}
        <circle cx="40" cy="150" r="3" fill={dotFill} />

        {/* Right penalty area */}
        <rect x="334" y="70" width="60" height="160" />
        {/* Right goal area */}
        <rect x="369" y="105" width="25" height="90" />
        {/* Right penalty arc */}
        <path d="M 334 110 A 36 36 0 0 0 334 190" />
        {/* Right penalty spot */}
        <circle cx="360" cy="150" r="3" fill={dotFill} />

        {/* Corner arcs */}
        <path d="M 6 16 A 10 10 0 0 1 16 6" />
        <path d="M 384 6 A 10 10 0 0 1 394 16" />
        <path d="M 6 284 A 10 10 0 0 0 16 294" />
        <path d="M 384 294 A 10 10 0 0 0 394 284" />

        {/* Goals (dashed) */}
        <rect x="0" y="115" width="6" height="70" strokeDasharray="4 3" />
        <rect x="394" y="115" width="6" height="70" strokeDasharray="4 3" />
      </g>
    </svg>
  )
}
