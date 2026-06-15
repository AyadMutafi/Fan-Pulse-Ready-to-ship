'use client'

import { motion } from 'framer-motion'
import {
  Play, Star, Eye, Flame, Trophy
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam } from '@/lib/national-teams'
import { useGoals } from '@/hooks/queries/use-goals'
import { SharePulseButton } from '@/components/common/SharePulseButton'

// ── Helpers ──────────────────────────────────────────────────

function getFlag(teamCode: string): string {
  const team = findNationalTeam(teamCode)
  return team?.flag ?? '🏳️'
}

// ── Skeleton Goal Card ───────────────────────────────────────

function SkeletonGoalCard() {
  return (
    <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10 rounded" />
            </div>
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-1.5">
              <Skeleton className="h-4 w-14 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
          </div>
          <div className="space-y-1">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-2.5 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Goals Tab ────────────────────────────────────────────────

export default function GoalsTab() {
  const { t } = useLanguage()
  const { data: goalsData, isLoading, error } = useGoals()

  const goals = goalsData?.goals ?? []
  const stats = goalsData?.stats ?? { totalGoals: 0, totalLeagues: 0, totalSources: 0, topScorers: 0 }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          {t('goals.title')}
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('goals.desc')}</p>
      </motion.div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('goals.stats_goals'), value: stats.totalGoals, icon: Flame, color: 'text-[#FF6B35]' },
          { label: t('goals.stats_leagues'), value: stats.totalLeagues, icon: Trophy, color: 'text-[#6C2BD9]' },
          { label: t('goals.stats_sources'), value: stats.totalSources, icon: Eye, color: 'text-[#10B981]' },
          { label: t('goals.stats_top'), value: stats.topScorers, icon: Star, color: 'text-[#FF6B35]' },
        ].map((stat, i) => (
          <Card key={i} className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
            <CardContent className="p-3 text-center">
              <stat.icon className={`mx-auto size-4 mb-1 ${stat.color}`} />
              <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] text-[#666] dark:text-[#CCCCCC]">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-[#EF4444]/30 dark:border-[#EF4444]/20">
          <CardContent className="p-4 text-center">
            <Flame className="mx-auto size-6 text-[#EF4444] mb-2" />
            <p className="text-sm text-[#EF4444]">Failed to load goals. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <SkeletonGoalCard />
            </motion.div>
          ))}
        </div>
      )}

      {/* Goal cards */}
      {goals.length > 0 && (
        <div className="space-y-3">
          {goals.map((goal, i) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Video placeholder */}
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FA] dark:bg-[#2D2D2D] transition-colors">
                      <Play className="size-4 text-[#666] dark:text-[#CCCCCC]" />
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{goal.teamFlag || getFlag(goal.teamCode)}</span>
                        <p className="truncate text-sm font-bold text-[#1A1A1A] dark:text-white">{goal.scorer}</p>
                        <Badge variant="outline" className="shrink-0 text-[9px] font-bold border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                          {goal.type}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[#666] dark:text-[#CCCCCC]">
                        {goal.match}
                      </p>
                      {/* Tags */}
                      {goal.tags.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {goal.tags.map(tag => (
                            <span key={tag} className="rounded bg-[#6C2BD9]/8 dark:bg-[#8B5CF6]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Minute */}
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black text-[#6C2BD9] dark:text-[#8B5CF6]">{goal.minute}&apos;</p>
                      <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">minute</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <SharePulseButton className="flex-1" />
                    <Badge variant="outline" className="text-[9px] font-bold border-[#E0E0E0] dark:border-white/10 text-[#666] dark:text-[#CCCCCC]">
                      {goal.source}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && !isLoading && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="py-12 text-center">
            <Flame className="mx-auto size-8 text-[#666]/30 dark:text-[#CCCCCC]/30 mb-3" />
            <p className="text-sm text-[#666] dark:text-[#CCCCCC]">No goals recorded yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
