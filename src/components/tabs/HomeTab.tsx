'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Zap, Sparkles, BarChart3, Users, Timer, Star, ImageIcon, Smile
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/context/LanguageContext'
import { useMatches } from '@/hooks/queries/use-matches'
import { useSentiments } from '@/hooks/queries/use-sentiments'
import { SharePulseButton } from '@/components/common/SharePulseButton'
import { LiveBadge } from '@/components/common/LiveBadge'
import { TeamLogo } from '@/components/common/TeamLogo'
import { useFlagMode } from '@/lib/flag-mode'
import type { Trend } from '@/types'

// ── Helpers ──────────────────────────────────────────────────

function getSentimentEmoji(score: number): string {
  if (score >= 80) return '😊'
  if (score >= 60) return '🙂'
  if (score >= 40) return '😐'
  if (score >= 20) return '😟'
  return '😰'
}

function getSentimentEmojiSize(score: number): string {
  // Bigger emoji for more extreme sentiments
  if (score >= 80 || score < 20) return 'text-3xl'
  if (score >= 60 || score < 40) return 'text-2xl'
  return 'text-xl'
}

// ── AI Insights (hardcoded until real feed) ──────────────────

const AI_INSIGHTS = [
  { icon: Sparkles, text: 'Mbappé sentiment surged +12% after hat-trick vs Colombia', time: '2m ago', color: 'text-[#6C2BD9]' },
  { icon: BarChart3, text: 'Fan mood shifting: Brazil supporters growing anxious despite lead', time: '8m ago', color: 'text-[#FF6B35]' },
  { icon: Users, text: '1.2M fan votes tallied for Group Stage Elite XI', time: '15m ago', color: 'text-[#10B981]' },
  { icon: Timer, text: 'Maguire crisis index hits season-high after defensive errors', time: '22m ago', color: 'text-[#EF4444]' },
]

// ── Home Tab ─────────────────────────────────────────────────

export default function HomeTab() {
  const { t } = useLanguage()
  const { mode: flagMode, toggle: toggleFlag } = useFlagMode()
  const { data: matches, isLoading: matchesLoading, error: matchesError } = useMatches()
  const { data: sentiments, isLoading: sentimentsLoading } = useSentiments()

  // Compute hero stats from data
  const heroStats = useMemo(() => {
    if (!sentiments || sentiments.length === 0) {
      return { positivePercent: 78, liveCount: 0 }
    }
    const positive = sentiments.filter(p => p.sentiment >= 70).length
    const positivePercent = Math.round((positive / sentiments.length) * 100)
    const liveMatches = matches?.filter(m => m.status === 'live').length ?? 0
    return { positivePercent, liveCount: liveMatches }
  }, [sentiments, matches])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6C2BD9]/8 via-white dark:via-[#1A1A1A] to-[#FF6B35]/5 p-6 border border-[#6C2BD9]/10 dark:border-[#6C2BD9]/20"
      >
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-[#6C2BD9]/5 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-[#FF6B35]/5 blur-3xl" />
        <h2 className="relative text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          {t('home.your_pulse')} <span className="text-[#6C2BD9]">⚡</span>
        </h2>
        <p className="relative mt-2 text-sm text-[#666] dark:text-[#CCCCCC]">
          {t('home.mood_desc')}
        </p>
        <div className="relative mt-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-3 py-1.5 text-xs font-semibold text-[#10B981]">
            <Zap className="size-3.5" />
            {heroStats.positivePercent}% {t('home.positive')}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#EF4444]/10 px-3 py-1.5 text-xs font-semibold text-[#EF4444]">
            <Activity className="size-3.5" />
            {heroStats.liveCount} {t('home.live')}
          </div>
          {/* Flag/Emoji Toggle */}
          <button
            onClick={toggleFlag}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-white/50 dark:bg-white/5 border border-[#E0E0E0]/50 dark:border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#666] dark:text-[#CCCCCC] hover:border-[#6C2BD9]/30 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
          >
            {flagMode === 'flag' ? (
              <>
                <ImageIcon className="size-3" />
                <span>Flags</span>
              </>
            ) : (
              <>
                <Smile className="size-3" />
                <span>Emoji</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Loading state for matches */}
      {(matchesLoading || sentimentsLoading) && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin size-8 rounded-full border-2 border-[#6C2BD9]/30 border-t-[#6C2BD9]" />
        </div>
      )}

      {/* Error state */}
      {matchesError && (
        <Card className="border-[#EF4444]/30 dark:border-[#EF4444]/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-[#EF4444]">Failed to load matches. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Featured Matches */}
      {matches && matches.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
            {t('home.featured')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                  <CardContent className="p-4">
                    {/* Match header with team logos */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <TeamLogo code={match.homeTeam.code} size={28} />
                        <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{match.homeTeam.code}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black tracking-wider text-[#1A1A1A] dark:text-white">
                          {match.homeScore} - {match.awayScore}
                        </span>
                        {match.status === 'live' && <LiveBadge />}
                        {match.minute && match.status === 'live' && (
                          <span className="text-[10px] text-[#EF4444] font-bold mt-0.5">{match.minute}&apos;</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{match.awayTeam.code}</span>
                        <TeamLogo code={match.awayTeam.code} size={28} />
                      </div>
                    </div>

                    {/* Fan Mood — Emoji Only */}
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TeamLogo code={match.homeTeam.code} size={16} />
                        <span className={`inline-block ${getSentimentEmojiSize(match.homeTeam.sentiment)}`}>
                          {getSentimentEmoji(match.homeTeam.sentiment)}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-gray-400">
                        {t('home.fan_mood')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block ${getSentimentEmojiSize(match.awayTeam.sentiment)}`}>
                          {getSentimentEmoji(match.awayTeam.sentiment)}
                        </span>
                        <TeamLogo code={match.awayTeam.code} size={16} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center">
                      <SharePulseButton className="flex-1" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for matches */}
      {matches && matches.length === 0 && !matchesLoading && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="py-12 text-center">
            <Star className="mx-auto size-8 text-[#666]/30 dark:text-[#CCCCCC]/30 mb-3" />
            <p className="text-sm text-[#666] dark:text-[#CCCCCC]">No matches available right now</p>
          </CardContent>
        </Card>
      )}

      {/* Arena Intelligence */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
          {t('home.arena_intel')}
        </h3>
        <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
          <CardContent className="p-4 space-y-3">
            {AI_INSIGHTS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="flex items-start gap-3 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] p-3"
              >
                <item.icon className={`mt-0.5 size-4 shrink-0 ${item.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-[#1A1A1A]/80 dark:text-white/80">{item.text}</p>
                  <p className="mt-0.5 text-[10px] text-[#666] dark:text-[#CCCCCC]">{item.time}</p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
