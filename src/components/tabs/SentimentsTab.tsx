'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam } from '@/lib/national-teams'
import { useSentiments } from '@/hooks/queries/use-sentiments'

// ── Helpers ──────────────────────────────────────────────────

function getFlag(nationCode: string): string {
  const team = findNationalTeam(nationCode)
  return team?.flag ?? '🏳️'
}

function getSentimentColor(score: number) {
  if (score >= 80) return 'text-[#10B981]'
  if (score >= 50) return 'text-[#FF6B35]'
  return 'text-[#EF4444]'
}

function getSentimentBg(score: number) {
  if (score >= 80) return 'bg-[#10B981]/5 border-[#10B981]/15'
  if (score >= 50) return 'bg-[#FF6B35]/5 border-[#FF6B35]/15'
  return 'bg-[#EF4444]/5 border-[#EF4444]/15'
}

function getSentimentBarClass(score: number) {
  if (score >= 80) return 'sentiment-positive'
  if (score >= 50) return 'sentiment-neutral'
  return 'sentiment-negative'
}

function getSentimentEmoji(score: number) {
  if (score >= 80) return '🔥'
  if (score >= 50) return '😤'
  return '😰'
}

function getLabelKey(score: number) {
  if (score >= 80) return 'sentiments.on_fire'
  if (score >= 50) return 'sentiments.under_pressure'
  return 'sentiments.crisis'
}

// ── Filter Config ────────────────────────────────────────────

const LEAGUES = ['ALL', 'PREMIER LEAGUE', 'LA LIGA', 'UCL'] as const
type LeagueFilter = typeof LEAGUES[number]

const LEAGUE_KEYS: Record<LeagueFilter, string> = {
  'ALL': 'sentiments.all',
  'PREMIER LEAGUE': 'sentiments.pl',
  'LA LIGA': 'sentiments.laliga',
  'UCL': 'sentiments.ucl',
}

const LEAGUE_API_MAP: Record<LeagueFilter, string> = {
  'ALL': '',
  'PREMIER LEAGUE': 'PL',
  'LA LIGA': 'LL',
  'UCL': 'UCL',
}

// ── Skeleton Card ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-7 w-8 ml-auto" />
            <Skeleton className="h-2.5 w-8 ml-auto" />
          </div>
        </div>
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
        <div className="mt-2 flex items-center gap-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Sentiments Tab ───────────────────────────────────────────

export default function SentimentsTab() {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<LeagueFilter>('ALL')
  const apiLeague = LEAGUE_API_MAP[filter]
  const { data: players, isLoading, error } = useSentiments(apiLeague || undefined)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          {t('sentiments.title')}
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('sentiments.powered')}</p>
      </motion.div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {LEAGUES.map((league) => {
          const isActive = filter === league
          return (
            <button
              key={league}
              onClick={() => setFilter(league)}
              className={`
                shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200
                ${isActive
                  ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
                }
              `}
            >
              {t(LEAGUE_KEYS[league])}
            </button>
          )
        })}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-[#EF4444]/30 dark:border-[#EF4444]/20">
          <CardContent className="p-4 text-center">
            <Activity className="mx-auto size-6 text-[#EF4444] mb-2" />
            <p className="text-sm text-[#EF4444]">Failed to load sentiment data. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton grid */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <SkeletonCard />
            </motion.div>
          ))}
        </div>
      )}

      {/* Player sentiment cards */}
      {players && players.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className={`card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none ${getSentimentBg(player.sentiment)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{getFlag(player.nationCode)}</span>
                      <div>
                        <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">{player.name}</p>
                        <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">{player.nationCode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-black ${getSentimentColor(player.sentiment)}`}>
                        {player.sentiment}
                      </p>
                      <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">pulse</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="sentiment-bar">
                      <div
                        className={`sentiment-bar-fill ${getSentimentBarClass(player.sentiment)}`}
                        style={{ width: `${player.sentiment}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-sm">
                      {getSentimentEmoji(player.sentiment)}
                    </span>
                    <span className={`text-[10px] font-semibold ${getSentimentColor(player.sentiment)}`}>
                      {t(getLabelKey(player.sentiment))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {players && players.length === 0 && !isLoading && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto size-8 text-[#666]/30 dark:text-[#CCCCCC]/30 mb-3" />
            <p className="text-sm text-[#666] dark:text-[#CCCCCC]">No sentiment data available for this league</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
