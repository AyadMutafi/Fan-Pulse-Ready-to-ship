'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, Minus, Play, Star, AlertTriangle,
  Lock, Clock, Zap, Shield, CircleDot,
  Sparkles, BarChart3, Users, Timer, Share2, Eye, Flame, Trophy, Globe
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import TopHeader from '@/components/TopHeader'
import Navigation, { type TabId } from '@/components/Navigation'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam } from '@/lib/national-teams'

// ── Types ────────────────────────────────────────────────────

interface WCSelectionPlayer {
  id: string
  playerName: string
  nationCode: string
  position: string
  pulseScore: number
  sentiment: number
  trend: string
  isLive: boolean
  matchInfo: string | null
  order: number
}

interface WCSelection {
  id: string
  type: string
  stageId: string
  formation: string
  locked: boolean
  players: WCSelectionPlayer[]
}

interface WCStage {
  id: string
  name: string
  nameAr: string
  order: number
  status: string
  selections: WCSelection[]
}

// ── Mock Data ────────────────────────────────────────────────

const MOCK_MATCHES = [
  { id: 1, home: 'BRA', away: 'ARG', homeFlag: '🇧🇷', awayFlag: '🇦🇷', score: '2 - 1', homeSentiment: 82, awaySentiment: 58, live: true, league: 'UCL' },
  { id: 2, home: 'FRA', away: 'ENG', homeFlag: '🇫🇷', awayFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', score: '1 - 1', homeSentiment: 65, awaySentiment: 70, live: true, league: 'PL' },
  { id: 3, home: 'ESP', away: 'GER', homeFlag: '🇪🇸', awayFlag: '🇩🇪', score: '3 - 0', homeSentiment: 88, awaySentiment: 28, live: false, league: 'UCL' },
  { id: 4, home: 'POR', away: 'NED', homeFlag: '🇵🇹', awayFlag: '🇳🇱', score: '0 - 2', homeSentiment: 35, awaySentiment: 78, live: false, league: 'PL' },
]

const MOCK_SENTIMENTS = [
  { name: 'Kylian Mbappé', nationCode: 'FRA', score: 96, league: 'UCL' },
  { name: 'Vinícius Jr', nationCode: 'BRA', score: 94, league: 'UCL' },
  { name: 'Jude Bellingham', nationCode: 'ENG', score: 92, league: 'PL' },
  { name: 'Lamine Yamal', nationCode: 'ESP', score: 91, league: 'LL' },
  { name: 'Florian Wirtz', nationCode: 'GER', score: 67, league: 'UCL' },
  { name: 'Rodri', nationCode: 'ESP', score: 55, league: 'LL' },
  { name: 'Richarlison', nationCode: 'BRA', score: 21, league: 'PL' },
  { name: 'Harry Maguire', nationCode: 'ENG', score: 24, league: 'PL' },
  { name: 'Andre Onana', nationCode: 'CMR', score: 15, league: 'UCL' },
  { name: 'Antoine Griezmann', nationCode: 'FRA', score: 18, league: 'LL' },
  { name: 'Leon Goretzka', nationCode: 'GER', score: 29, league: 'UCL' },
  { name: 'Wout Weghorst', nationCode: 'NED', score: 22, league: 'PL' },
]

const MOCK_RATINGS = [
  { id: 1, name: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', avgRating: 4.7 },
  { id: 2, name: 'Vinícius Jr', nationCode: 'BRA', position: 'LW', avgRating: 4.5 },
  { id: 3, name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', avgRating: 4.6 },
  { id: 4, name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', avgRating: 4.4 },
  { id: 5, name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', avgRating: 3.8 },
  { id: 6, name: 'Rodri', nationCode: 'ESP', position: 'CDM', avgRating: 3.5 },
  { id: 7, name: 'Richarlison', nationCode: 'BRA', position: 'ST', avgRating: 2.1 },
  { id: 8, name: 'Harry Maguire', nationCode: 'ENG', position: 'CB', avgRating: 1.8 },
  { id: 9, name: 'Alisson', nationCode: 'BRA', position: 'GK', avgRating: 4.2 },
  { id: 10, name: 'Hakimi', nationCode: 'MAR', position: 'RB', avgRating: 3.9 },
]

const MOCK_GOALS = [
  { id: 1, scorer: 'Mbappé', team: 'FRA', flag: '🇫🇷', minute: 23, match: 'FRA vs COL', type: 'Goal', tags: ['HEADER', 'TOPSCORER'], source: 'FIFA' },
  { id: 2, scorer: 'Vinícius Jr', team: 'BRA', flag: '🇧🇷', minute: 45, match: 'BRA vs PAR', type: 'Goal', tags: ['TOPSCORER'], source: 'FIFA' },
  { id: 3, scorer: 'Bellingham', team: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', minute: 67, match: 'ENG vs JOR', type: 'Goal', tags: ['HEADER'], source: 'PL' },
  { id: 4, scorer: 'Yamal', team: 'ESP', flag: '🇪🇸', minute: 12, match: 'ESP vs IDN', type: 'Goal', tags: ['TOPSCORER'], source: 'LL' },
  { id: 5, scorer: 'Wirtz', team: 'GER', flag: '🇩🇪', minute: 34, match: 'GER vs UZB', type: 'Goal', tags: ['HEADER'], source: 'UCL' },
  { id: 6, scorer: 'Rodri', team: 'ESP', flag: '🇪🇸', minute: 56, match: 'ESP vs IDN', type: 'Goal', tags: [], source: 'LL' },
  { id: 7, scorer: 'Hakimi', team: 'MAR', flag: '🇲🇦', minute: 78, match: 'MAR vs IDN', type: 'Goal', tags: ['TOPSCORER'], source: 'UCL' },
  { id: 8, scorer: 'Dias', team: 'POR', flag: '🇵🇹', minute: 89, match: 'POR vs IDN', type: 'Goal', tags: ['HEADER'], source: 'PL' },
]

const MOCK_TOTW = [
  { name: 'Alisson', nationCode: 'BRA', position: 'GK', rating: 8.5 },
  { name: 'Hakimi', nationCode: 'MAR', position: 'RB', rating: 7.8 },
  { name: 'Van Dijk', nationCode: 'NED', position: 'CB', rating: 8.2 },
  { name: 'Dias', nationCode: 'POR', position: 'CB', rating: 8.0 },
  { name: 'Hernández', nationCode: 'FRA', position: 'LB', rating: 7.9 },
  { name: 'Rodri', nationCode: 'ESP', position: 'CM', rating: 8.1 },
  { name: 'Bellingham', nationCode: 'ENG', position: 'CM', rating: 8.8 },
  { name: 'Wirtz', nationCode: 'GER', position: 'CAM', rating: 8.3 },
  { name: 'Yamal', nationCode: 'ESP', position: 'RW', rating: 8.7 },
  { name: 'Mbappé', nationCode: 'FRA', position: 'LW', rating: 9.1 },
  { name: 'Vinícius Jr', nationCode: 'BRA', position: 'ST', rating: 8.9 },
]

// ── Helpers ──────────────────────────────────────────────────

function getFlag(nationCode: string): string {
  const team = findNationalTeam(nationCode)
  return team?.flag ?? '🏳️'
}

function getTrendIcon(trend: string) {
  if (trend === 'rising') return <TrendingUp className="size-3 text-[#10B981]" />
  if (trend === 'falling') return <TrendingDown className="size-3 text-[#EF4444]" />
  return <Minus className="size-3 text-[#FF6B35]" />
}

function getSentimentColor(score: number) {
  if (score >= 80) return 'text-[#10B981]'
  if (score >= 50) return 'text-[#FF6B35]'
  return 'text-[#EF4444]'
}

function getSentimentBg(score: number) {
  if (score >= 80) return 'bg-[#10B981]/5 border-[#10B981]/15'
  if (score >= 50) return 'bg-[#FF6B35]/5 border-[#10B981]/15'
  return 'bg-[#EF4444]/5 border-[#EF4444]/15'
}

function getProgressClass(score: number) {
  if (score >= 80) return 'progress-emerald'
  if (score >= 50) return 'progress-amber'
  return 'progress-red'
}

// ── Formation Layout 4-3-3 ──────────────────────────────────

const FORMATION_ROWS = [
  [{ pos: 'GK', col: 1 }],
  [{ pos: 'RB', col: 3 }, { pos: 'CB', col: 1 }, { pos: 'CB', col: 2 }, { pos: 'LB', col: 0 }],
  [{ pos: 'CM', col: 2 }, { pos: 'CAM', col: 1 }, { pos: 'CM', col: 0 }],
  [{ pos: 'RW', col: 2 }, { pos: 'ST', col: 1 }, { pos: 'LW', col: 0 }],
]

// ── Shared Sub-Components ────────────────────────────────────

function LiveBadge() {
  return (
    <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30 gap-1 text-[10px] font-bold">
      <span className="live-dot" style={{ width: 6, height: 6 }} />
      LIVE
    </Badge>
  )
}

function SharePulseButton({ className = '' }: { className?: string }) {
  return (
    <Button
      size="sm"
      className={`bg-[#6C2BD9] hover:bg-[#5A1FBF] text-white gap-1.5 text-[11px] font-bold h-8 rounded-lg ${className}`}
    >
      <Share2 className="size-3" />
      Share Pulse
    </Button>
  )
}

function PsycheButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-[#E0E0E0] dark:border-white/10 text-[#666] dark:text-gray-400 gap-1.5 text-[11px] font-bold h-8 rounded-lg hover:text-[#1A1A1A] dark:hover:text-white"
    >
      🧠 PSYCHE
    </Button>
  )
}

// ── HOME Tab ─────────────────────────────────────────────────

function HomeTab() {
  const { t } = useLanguage()

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
            78% {t('home.positive')}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#EF4444]/10 px-3 py-1.5 text-xs font-semibold text-[#EF4444]">
            <Activity className="size-3.5" />
            2 {t('home.live')}
          </div>
        </div>
      </motion.div>

      {/* Featured Matches */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
          {t('home.featured')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_MATCHES.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{match.homeFlag}</span>
                      <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{match.home}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black tracking-wider text-[#1A1A1A] dark:text-white">{match.score}</span>
                      {match.live && <LiveBadge />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{match.away}</span>
                      <span className="text-xl">{match.awayFlag}</span>
                    </div>
                  </div>
                  {/* Sentiment bars */}
                  <div className="mt-3 space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[#666] dark:text-[#CCCCCC]">{match.home} {t('home.fan_mood')}</span>
                        <span className={getSentimentColor(match.homeSentiment)}>{match.homeSentiment}% {match.homeSentiment >= 80 ? '😊' : match.homeSentiment >= 50 ? '😐' : '😰'}</span>
                      </div>
                      <div className="sentiment-bar">
                        <div className={`sentiment-bar-fill ${match.homeSentiment >= 80 ? 'sentiment-positive' : match.homeSentiment >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`} style={{ width: `${match.homeSentiment}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[#666] dark:text-[#CCCCCC]">{match.away} {t('home.fan_mood')}</span>
                        <span className={getSentimentColor(match.awaySentiment)}>{match.awaySentiment}% {match.awaySentiment >= 80 ? '😊' : match.awaySentiment >= 50 ? '😐' : '😰'}</span>
                      </div>
                      <div className="sentiment-bar">
                        <div className={`sentiment-bar-fill ${match.awaySentiment >= 80 ? 'sentiment-positive' : match.awaySentiment >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`} style={{ width: `${match.awaySentiment}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <SharePulseButton className="flex-1" />
                    <PsycheButton />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Arena Intelligence */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
          {t('home.arena_intel')}
        </h3>
        <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
          <CardContent className="p-4 space-y-3">
            {[
              { icon: Sparkles, text: 'Mbappé sentiment surged +12% after hat-trick vs Colombia', time: '2m ago', color: 'text-[#6C2BD9]' },
              { icon: BarChart3, text: 'Fan mood shifting: Brazil supporters growing anxious despite lead', time: '8m ago', color: 'text-[#FF6B35]' },
              { icon: Users, text: '1.2M fan votes tallied for Group Stage Elite XI', time: '15m ago', color: 'text-[#10B981]' },
              { icon: Timer, text: 'Maguire crisis index hits season-high after defensive errors', time: '22m ago', color: 'text-[#EF4444]' },
            ].map((item, i) => (
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

// ── SENTIMENTS Tab ───────────────────────────────────────────

function SentimentsTab() {
  const { t } = useLanguage()
  const [filter, setFilter] = useState('ALL')
  const leagues = ['ALL', 'PREMIER LEAGUE', 'LA LIGA', 'UCL']
  const leagueKeys: Record<string, string> = {
    'ALL': 'sentiments.all',
    'PREMIER LEAGUE': 'sentiments.pl',
    'LA LIGA': 'sentiments.laliga',
    'UCL': 'sentiments.ucl',
  }
  const leagueMap: Record<string, string> = { 'ALL': '', 'PREMIER LEAGUE': 'PL', 'LA LIGA': 'LL', 'UCL': 'UCL' }

  const filtered = filter === 'ALL' ? MOCK_SENTIMENTS : MOCK_SENTIMENTS.filter(p => p.league === leagueMap[filter])

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
        {leagues.map((league) => {
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
              {t(leagueKeys[league])}
            </button>
          )
        })}
      </div>

      {/* Player sentiment cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((player, i) => (
          <motion.div
            key={player.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className={`card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none ${getSentimentBg(player.score)}`}>
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
                    <p className={`text-2xl font-black ${getSentimentColor(player.score)}`}>
                      {player.score}
                    </p>
                    <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">pulse</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="sentiment-bar">
                    <div
                      className={`sentiment-bar-fill ${player.score >= 80 ? 'sentiment-positive' : player.score >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`}
                      style={{ width: `${player.score}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-sm">
                    {player.score >= 80 ? '🔥' : player.score >= 50 ? '😤' : '😰'}
                  </span>
                  <span className={`text-[10px] font-semibold ${getSentimentColor(player.score)}`}>
                    {player.score >= 80 ? t('sentiments.on_fire') : player.score >= 50 ? t('sentiments.under_pressure') : t('sentiments.crisis')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── RATE Tab ─────────────────────────────────────────────────

function RateTab() {
  const { t } = useLanguage()
  const [ratings, setRatings] = useState<Record<number, number>>({})

  const handleRate = (playerId: number, rating: number) => {
    setRatings(prev => ({ ...prev, [playerId]: rating }))
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

      <div className="space-y-3">
        {MOCK_RATINGS.map((player, i) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getFlag(player.nationCode)}</span>
                    <div>
                      <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">{player.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                          {player.position}
                        </Badge>
                        <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                          {t('ratings.avg')}: {player.avgRating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isSelected = (ratings[player.id] ?? 0) >= star
                      return (
                        <button
                          key={star}
                          onClick={() => handleRate(player.id, star)}
                          className="transition-transform duration-150 hover:scale-125"
                        >
                          <Star
                            className={`size-5 ${
                              isSelected
                                ? 'fill-[#6C2BD9] text-[#6C2BD9]'
                                : 'text-[#E0E0E0] dark:text-gray-600'
                            }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {ratings[player.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 flex items-center justify-between"
                  >
                    <span className="text-xs text-[#6C2BD9] dark:text-[#8B5CF6] font-medium">
                      {t('ratings.your_rating')}: {ratings[player.id]}/5
                    </span>
                    <Progress
                      value={(ratings[player.id] / 5) * 100}
                      className="h-1 w-20 progress-purple"
                    />
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── GOALS Tab ────────────────────────────────────────────────

function GoalsTab() {
  const { t } = useLanguage()

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
          { label: t('goals.stats_goals'), value: '8', icon: Flame, color: 'text-[#FF6B35]' },
          { label: t('goals.stats_leagues'), value: '3', icon: Trophy, color: 'text-[#6C2BD9]' },
          { label: t('goals.stats_sources'), value: '4', icon: Eye, color: 'text-[#10B981]' },
          { label: t('goals.stats_top'), value: '5', icon: Star, color: 'text-[#FF6B35]' },
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

      <div className="space-y-3">
        {MOCK_GOALS.map((goal, i) => (
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
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FA] dark:bg-[#2D2D2D] transition-colors group-hover:bg-[#6C2BD9]/10">
                    <Play className="size-4 text-[#666] dark:text-[#CCCCCC]" />
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.flag}</span>
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
    </div>
  )
}

// ── TOTW Tab ─────────────────────────────────────────────────

function TOTWTab() {
  const { t } = useLanguage()

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

      <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
        <CardContent className="p-4">
          <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
            {FORMATION_ROWS.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                {row.map((slot, ci) => {
                  const player = MOCK_TOTW.find(p => p.position === slot.pos)
                  return (
                    <motion.div
                      key={`${ri}-${ci}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: ri * 0.1 + ci * 0.05 }}
                      className="flex flex-col items-center"
                    >
                      <div className="flex size-12 sm:size-14 items-center justify-center rounded-full border-2 border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 bg-white dark:bg-[#2D2D2D] text-lg shadow-md">
                        {player ? getFlag(player.nationCode) : '👤'}
                      </div>
                      <p className="mt-1 max-w-[60px] truncate text-[10px] font-bold text-[#1A1A1A] dark:text-white text-center">
                        {player?.name ?? slot.pos}
                      </p>
                      <Badge variant="outline" className="mt-0.5 text-[8px] font-bold px-1 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                        {slot.pos}
                      </Badge>
                      {player && (
                        <Badge className="mt-0.5 bg-[#6C2BD9] dark:bg-[#8B5CF6] text-white text-[9px] font-bold px-1.5 py-0 h-4">
                          {player.rating}
                        </Badge>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Formation Player Card (World Cup) ────────────────────────

function FormationPlayerCard({
  player,
  type,
  stageStatus,
}: {
  player: WCSelectionPlayer
  type: 'elite' | 'crisis'
  stageStatus: string
}) {
  const flag = getFlag(player.nationCode)
  const isElite = type === 'elite'
  const isLive = player.isLive && stageStatus === 'live'
  const isCompleted = stageStatus === 'completed'
  const accentColor = isElite ? '#6C2BD9' : '#EF4444'
  const accentColorDark = isElite ? '#8B5CF6' : '#F87171'

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
        style={isLive ? { color: accentColor } : undefined}
      >
        <span className="text-lg sm:text-xl">{flag}</span>
        {isLive && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#EF4444] shadow-lg shadow-[#EF4444]/50 animate-live-pulse" />
        )}
        {isCompleted && (
          <Lock className="absolute -right-0.5 -top-0.5 size-3 text-[#666] dark:text-[#CCCCCC]" />
        )}
      </div>
      <p className="mt-1 max-w-[70px] truncate text-[10px] sm:text-xs font-bold text-[#1A1A1A] dark:text-white text-center">
        {player.playerName}
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
        {getTrendIcon(player.trend)}
      </div>
      <Badge
        className={`mt-1 text-[8px] font-bold px-1.5 py-0 h-4 ${
          isElite ? 'bg-[#6C2BD9] dark:bg-[#8B5CF6]' : 'bg-[#EF4444] dark:bg-[#F87171]'
        } text-white`}
      >
        {Math.round(player.pulseScore)}
      </Badge>
      {player.matchInfo && (
        <p className="mt-0.5 text-[8px] text-[#666] dark:text-[#CCCCCC] truncate max-w-[80px] text-center">
          {player.matchInfo}
        </p>
      )}
    </motion.div>
  )
}

// ── WORLD CUP Tab ────────────────────────────────────────────

function WorldCupTab({ stages }: { stages: WCStage[] }) {
  const { t, lang } = useLanguage()
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [eliteData, setEliteData] = useState<WCSelection | null>(null)
  const [crisisData, setCrisisData] = useState<WCSelection | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<'elite' | 'crisis'>('elite')

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id)
    }
  }, [stages, selectedStageId])

  const fetchEliteCrisis = useCallback(async (stageId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/world-cup/elite-crisis?stageId=${stageId}`)
      if (res.ok) {
        const data = await res.json()
        setEliteData(data.elite || null)
        setCrisisData(data.crisis || null)
      }
    } catch (err) {
      console.error('Failed to fetch elite-crisis:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedStageId) {
      fetchEliteCrisis(selectedStageId)
    }
  }, [selectedStageId, fetchEliteCrisis])

  const selectedStage = stages.find(s => s.id === selectedStageId)
  const stageStatus = selectedStage?.status ?? 'upcoming'

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30 gap-1 text-[9px] font-bold px-1.5 py-0">
            <span className="live-dot" style={{ width: 5, height: 5 }} />
            LIVE
          </Badge>
        )
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

  const organizeFormation = (players: WCSelectionPlayer[]) => {
    const gk = players.filter(p => p.position === 'GK')
    const def = players.filter(p => ['CB', 'LB', 'RB'].includes(p.position))
    const mid = players.filter(p => ['CM', 'CAM', 'CDM'].includes(p.position))
    const fwd = players.filter(p => ['LW', 'RW', 'ST', 'CF'].includes(p.position))
    return [gk, def, mid, fwd]
  }

  const currentData = activeView === 'elite' ? eliteData : crisisData

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
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('wc.new_stage')}</p>
      </motion.div>

      {/* Stage Selector */}
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
      {loading && stageStatus !== 'upcoming' && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin size-8 rounded-full border-2 border-[#6C2BD9]/30 border-t-[#6C2BD9]" />
        </div>
      )}

      {/* Elite/Crisis Toggle & Content */}
      {!loading && stageStatus !== 'upcoming' && (
        <>
          {/* Toggle Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('elite')}
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
              onClick={() => setActiveView('crisis')}
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
                    <div className="ml-auto flex items-center gap-2">
                      {stageStatus === 'completed' && (
                        <Badge className="bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border-[#E0E0E0] dark:border-white/10 gap-1 text-[10px]">
                          <Lock className="size-3" /> 🔒 {t('wc.locked')}
                        </Badge>
                      )}
                      {stageStatus === 'live' && <LiveBadge />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6">
                  <div
                    className="pitch-bg rounded-xl p-4 sm:p-6 space-y-6 sm:space-y-8"
                    style={activeView === 'crisis' ? { '--pitch': 'rgba(239, 68, 68, 0.04)', '--pitch-line': 'rgba(239, 68, 68, 0.15)' } as React.CSSProperties : undefined}
                  >
                    {organizeFormation(currentData.players).map((row, ri) => (
                      <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                        {row.map((player) => (
                          <FormationPlayerCard
                            key={player.id}
                            player={player}
                            type={activeView}
                            stageStatus={stageStatus}
                          />
                        ))}
                      </div>
                    ))}
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
                { label: t('wc.elite_avg'), value: Math.round(eliteData.players.reduce((a, p) => a + p.pulseScore, 0) / eliteData.players.length), icon: TrendingUp, color: 'text-[#6C2BD9]' },
                { label: t('wc.crisis_avg'), value: Math.round(crisisData.players.reduce((a, p) => a + p.pulseScore, 0) / crisisData.players.length), icon: TrendingDown, color: 'text-[#EF4444]' },
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

// ── Main Page ────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [stages, setStages] = useState<WCStage[]>([])

  useEffect(() => {
    async function init() {
      try {
        await fetch('/api/world-cup/seed', { method: 'POST' })

        const res = await fetch('/api/world-cup/stages')
        if (res.ok) {
          const data = await res.json()
          setStages(data.stages || [])
        }
      } catch (err) {
        console.error('Init failed:', err)
      }
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#1A1A1A]">
      <div className="flex">
        {/* Sidebar */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main content area */}
        <div className="flex-1 md:ml-60">
          <TopHeader activeTab={activeTab} />

          <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {activeTab === 'home' && <HomeTab />}
                {activeTab === 'sentiments' && <SentimentsTab />}
                {activeTab === 'rate' && <RateTab />}
                {activeTab === 'goals' && <GoalsTab />}
                {activeTab === 'totw' && <TOTWTab />}
                {activeTab === 'worldcup' && <WorldCupTab stages={stages} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  )
}
