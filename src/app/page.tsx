'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, Minus, Play, Star, AlertTriangle,
  Lock, Clock, Zap, Shield, CircleDot,
  Sparkles, BarChart3, Users, Timer
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
  { id: 1, home: 'BRA', away: 'ARG', homeFlag: '🇧🇷', awayFlag: '🇦🇷', score: '2 - 1', sentiment: 78, live: true },
  { id: 2, home: 'FRA', away: 'ENG', homeFlag: '🇫🇷', awayFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', score: '1 - 1', sentiment: 65, live: true },
  { id: 3, home: 'ESP', away: 'GER', homeFlag: '🇪🇸', awayFlag: '🇩🇪', score: '3 - 0', sentiment: 88, live: false },
  { id: 4, home: 'POR', away: 'NED', homeFlag: '🇵🇹', awayFlag: '🇳🇱', score: '0 - 2', sentiment: 42, live: false },
]

const MOCK_SENTIMENTS = [
  { name: 'Kylian Mbappé', nationCode: 'FRA', score: 96 },
  { name: 'Vinícius Jr', nationCode: 'BRA', score: 94 },
  { name: 'Jude Bellingham', nationCode: 'ENG', score: 92 },
  { name: 'Lamine Yamal', nationCode: 'ESP', score: 91 },
  { name: 'Florian Wirtz', nationCode: 'GER', score: 67 },
  { name: 'Rodri', nationCode: 'ESP', score: 55 },
  { name: 'Richarlison', nationCode: 'BRA', score: 21 },
  { name: 'Harry Maguire', nationCode: 'ENG', score: 24 },
  { name: 'Andre Onana', nationCode: 'CMR', score: 15 },
  { name: 'Antoine Griezmann', nationCode: 'FRA', score: 18 },
  { name: 'Leon Goretzka', nationCode: 'GER', score: 29 },
  { name: 'Wout Weghorst', nationCode: 'NED', score: 22 },
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
  { id: 1, scorer: 'Mbappé', team: 'FRA', flag: '🇫🇷', minute: 23, match: 'FRA vs COL', type: 'Goal' },
  { id: 2, scorer: 'Vinícius Jr', team: 'BRA', flag: '🇧🇷', minute: 45, match: 'BRA vs PAR', type: 'Goal' },
  { id: 3, scorer: 'Bellingham', team: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', minute: 67, match: 'ENG vs JOR', type: 'Goal' },
  { id: 4, scorer: 'Yamal', team: 'ESP', flag: '🇪🇸', minute: 12, match: 'ESP vs IDN', type: 'Goal' },
  { id: 5, scorer: 'Wirtz', team: 'GER', flag: '🇩🇪', minute: 34, match: 'GER vs UZB', type: 'Goal' },
  { id: 6, scorer: 'Rodri', team: 'ESP', flag: '🇪🇸', minute: 56, match: 'ESP vs IDN', type: 'Goal' },
  { id: 7, scorer: 'Hakimi', team: 'MAR', flag: '🇲🇦', minute: 78, match: 'MAR vs IDN', type: 'Goal' },
  { id: 8, scorer: 'Dias', team: 'POR', flag: '🇵🇹', minute: 89, match: 'POR vs IDN', type: 'Goal' },
]

const MOCK_TOTW = [
  { name: 'Alisson', nationCode: 'BRA', position: 'GK', rating: 8.5, row: 0, col: 1 },
  { name: 'Hakimi', nationCode: 'MAR', position: 'RB', rating: 7.8, row: 1, col: 3 },
  { name: 'Van Dijk', nationCode: 'NED', position: 'CB', rating: 8.2, row: 1, col: 1 },
  { name: 'Dias', nationCode: 'POR', position: 'CB', rating: 8.0, row: 1, col: 0 },
  { name: 'Hernández', nationCode: 'FRA', position: 'LB', rating: 7.9, row: 1, col: 2 },
  { name: 'Rodri', nationCode: 'ESP', position: 'CM', rating: 8.1, row: 2, col: 2 },
  { name: 'Bellingham', nationCode: 'ENG', position: 'CM', rating: 8.8, row: 2, col: 1 },
  { name: 'Wirtz', nationCode: 'GER', position: 'CAM', rating: 8.3, row: 2, col: 0 },
  { name: 'Yamal', nationCode: 'ESP', position: 'RW', rating: 8.7, row: 3, col: 2 },
  { name: 'Mbappé', nationCode: 'FRA', position: 'LW', rating: 9.1, row: 3, col: 0 },
  { name: 'Vinícius Jr', nationCode: 'BRA', position: 'ST', rating: 8.9, row: 3, col: 1 },
]

// ── Helper ───────────────────────────────────────────────────

function getFlag(nationCode: string): string {
  const team = findNationalTeam(nationCode)
  return team?.flag ?? '🏳️'
}

function getTrendIcon(trend: string) {
  if (trend === 'rising') return <TrendingUp className="size-3.5 text-[#4CAF50]" />
  if (trend === 'falling') return <TrendingDown className="size-3.5 text-[#E74C3C]" />
  return <Minus className="size-3.5 text-[#F59E0B]" />
}

function getTrendColor(trend: string) {
  if (trend === 'rising') return 'text-[#4CAF50]'
  if (trend === 'falling') return 'text-[#E74C3C]'
  return 'text-[#F59E0B]'
}

function getSentimentColor(score: number) {
  if (score >= 80) return 'text-[#4CAF50]'
  if (score >= 50) return 'text-[#F59E0B]'
  return 'text-[#E74C3C]'
}

function getSentimentBg(score: number) {
  if (score >= 80) return 'bg-[#4CAF50]/8 border-[#4CAF50]/20'
  if (score >= 50) return 'bg-[#F59E0B]/8 border-[#F59E0B]/20'
  return 'bg-[#E74C3C]/8 border-[#E74C3C]/20'
}

function getProgressClass(score: number) {
  if (score >= 80) return 'progress-emerald'
  if (score >= 50) return 'progress-amber'
  return 'progress-red'
}

// ── Position Layout for 4-3-3 ────────────────────────────────

const FORMATION_ROWS = [
  [{ pos: 'GK', col: 1 }],
  [{ pos: 'RB', col: 3 }, { pos: 'CB', col: 1 }, { pos: 'CB', col: 2 }, { pos: 'LB', col: 0 }],
  [{ pos: 'CM', col: 2 }, { pos: 'CAM', col: 1 }, { pos: 'CM', col: 0 }],
  [{ pos: 'RW', col: 2 }, { pos: 'ST', col: 1 }, { pos: 'LW', col: 0 }],
]

// ── Sub-Components ───────────────────────────────────────────

function LiveBadge() {
  return (
    <Badge className="bg-[#E74C3C]/10 text-[#E74C3C] border-[#E74C3C]/30 gap-1 text-[10px] font-bold">
      <span className="live-dot" />
      LIVE
    </Badge>
  )
}

function TrendBadge({ trend }: { trend: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${getTrendColor(trend)}`}>
      {getTrendIcon(trend)}
    </span>
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
        className="relative overflow-hidden rounded-2xl border border-[#6C5CE7]/15 bg-gradient-to-br from-[#6C5CE7]/8 via-white dark:via-[#1A1A2E] to-[#F59E0B]/5 p-6"
      >
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-[#6C5CE7]/5 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-[#F59E0B]/5 blur-3xl" />
        <h2 className="relative text-2xl font-bold tracking-tight text-foreground">
          {t('home.your_pulse')} <span className="text-[#6C5CE7]">⚡</span>
        </h2>
        <p className="relative mt-2 text-sm text-muted-foreground">
          {t('home.mood_desc')}
        </p>
        <div className="relative mt-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-[#4CAF50]/10 px-3 py-1.5 text-xs font-semibold text-[#4CAF50]">
            <Zap className="size-3.5" />
            78% Positive
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#F59E0B]/10 px-3 py-1.5 text-xs font-semibold text-[#F59E0B]">
            <Activity className="size-3.5" />
            2 Live
          </div>
        </div>
      </motion.div>

      {/* Featured Matches */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Featured Matches
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_MATCHES.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="group border-border/50 shadow-sm transition-all duration-300 hover:border-[#6C5CE7]/20 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{match.homeFlag}</span>
                      <span className="text-sm font-bold">{match.home}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black tracking-wider">{match.score}</span>
                      {match.live && <LiveBadge />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{match.away}</span>
                      <span className="text-xl">{match.awayFlag}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{t('home.fan_mood')}</span>
                      <span className={getSentimentColor(match.sentiment)}>{match.sentiment}%</span>
                    </div>
                    <Progress
                      value={match.sentiment}
                      className={`h-1.5 ${getProgressClass(match.sentiment)}`}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Arena Intelligence */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Arena Intelligence
        </h3>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            {[
              { icon: Sparkles, text: 'Mbappé sentiment surged +12% after hat-trick vs Colombia', time: '2m ago', color: 'text-[#6C5CE7]' },
              { icon: BarChart3, text: 'Fan mood shifting: Brazil supporters growing anxious despite lead', time: '8m ago', color: 'text-[#F59E0B]' },
              { icon: Users, text: '1.2M fan votes tallied for Group Stage Elite XI', time: '15m ago', color: 'text-[#4CAF50]' },
              { icon: Timer, text: 'Maguire crisis index hits season-high after defensive errors', time: '22m ago', color: 'text-[#E74C3C]' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="flex items-start gap-3 rounded-lg bg-muted/40 p-3"
              >
                <item.icon className={`mt-0.5 size-4 shrink-0 ${item.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-foreground/80">{item.text}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{item.time}</p>
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

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight">{t('sentiments.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('sentiments.powered')}</p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_SENTIMENTS.map((player, i) => (
          <motion.div
            key={player.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className={`border-border/50 shadow-sm transition-all duration-300 hover:shadow-md ${getSentimentBg(player.score)}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getFlag(player.nationCode)}</span>
                    <div>
                      <p className="text-sm font-bold">{player.name}</p>
                      <p className="text-[10px] text-muted-foreground">{player.nationCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${getSentimentColor(player.score)}`}>
                      {player.score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">pulse</p>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress
                    value={player.score}
                    className={`h-1.5 ${getProgressClass(player.score)}`}
                  />
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-sm">
                    {player.score >= 80 ? '🔥' : player.score >= 50 ? '😤' : '😰'}
                  </span>
                  <span className={`text-[10px] font-semibold ${getSentimentColor(player.score)}`}>
                    {player.score >= 80 ? 'On Fire' : player.score >= 50 ? 'Under Pressure' : 'Crisis'}
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
        <h2 className="text-2xl font-bold tracking-tight">{t('ratings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('ratings.desc')}</p>
      </motion.div>

      <div className="space-y-3">
        {MOCK_RATINGS.map((player, i) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="border-border/50 shadow-sm transition-all duration-300 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getFlag(player.nationCode)}</span>
                    <div>
                      <p className="text-sm font-bold">{player.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0">
                          {player.position}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Avg: {player.avgRating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isSelected = (ratings[player.id] ?? 0) >= star
                      const isHovered = false
                      return (
                        <button
                          key={star}
                          onClick={() => handleRate(player.id, star)}
                          className="transition-transform duration-150 hover:scale-125"
                        >
                          <Star
                            className={`size-5 ${
                              isSelected
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-gray-300 dark:text-gray-600'
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
                    <span className="text-xs text-[#6C5CE7] font-medium">
                      Your rating: {ratings[player.id]}/5
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
        <h2 className="text-2xl font-bold tracking-tight">{t('goals.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('goals.desc')}</p>
      </motion.div>

      <div className="space-y-3">
        {MOCK_GOALS.map((goal, i) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <Card className="group border-border/50 shadow-sm transition-all duration-300 hover:border-[#6C5CE7]/20 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Video placeholder */}
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 transition-colors group-hover:bg-[#6C5CE7]/10">
                    <Play className="size-4 text-muted-foreground transition-colors group-hover:text-[#6C5CE7]" />
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.flag}</span>
                      <p className="truncate text-sm font-bold">{goal.scorer}</p>
                      <Badge variant="outline" className="shrink-0 text-[9px] font-bold">
                        {goal.type}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {goal.match}
                    </p>
                  </div>
                  {/* Minute */}
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-black text-[#6C5CE7]">{goal.minute}&apos;</p>
                    <p className="text-[10px] text-muted-foreground">minute</p>
                  </div>
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
        <h2 className="text-2xl font-bold tracking-tight">{t('totw.title')}</h2>
        <p className="text-sm text-muted-foreground">4-3-3 Formation</p>
      </motion.div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="pitch-bg rounded-xl p-3 sm:p-4 space-y-4">
            {FORMATION_ROWS.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-3 sm:gap-6">
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
                      <div className="flex size-12 sm:size-14 items-center justify-center rounded-full border-2 border-[#6C5CE7]/30 bg-white dark:bg-[#1A1A2E] text-lg shadow-md">
                        {player ? getFlag(player.nationCode) : '👤'}
                      </div>
                      <p className="mt-1 max-w-[60px] truncate text-[10px] font-bold text-foreground text-center">
                        {player?.name ?? slot.pos}
                      </p>
                      <Badge variant="outline" className="mt-0.5 text-[8px] font-bold px-1">
                        {slot.pos}
                      </Badge>
                      {player && (
                        <p className="mt-0.5 text-[10px] font-bold text-[#6C5CE7]">
                          {player.rating}
                        </p>
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

// ── Formation Player Card ────────────────────────────────────

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
            ? 'border-[#6C5CE7]/40 bg-white dark:bg-[#1A1A2E] shadow-[#6C5CE7]/10'
            : 'border-[#E74C3C]/40 bg-white dark:bg-[#1A1A2E] shadow-[#E74C3C]/10'
          }
          ${isLive ? 'animate-pulse-glow' : ''}
          transition-all duration-300 hover:scale-110
        `}
      >
        <span className="text-lg sm:text-xl">{flag}</span>
        {isLive && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#E74C3C] shadow-lg shadow-[#E74C3C]/50 animate-live-pulse" />
        )}
        {isCompleted && (
          <Lock className="absolute -right-0.5 -top-0.5 size-3 text-muted-foreground" />
        )}
      </div>
      <p className="mt-1 max-w-[70px] truncate text-[10px] sm:text-xs font-bold text-foreground text-center">
        {player.playerName}
      </p>
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className={`text-[7px] sm:text-[8px] font-bold px-1 py-0 ${
            isElite ? 'border-[#6C5CE7]/30 text-[#6C5CE7]' : 'border-[#E74C3C]/30 text-[#E74C3C]'
          }`}
        >
          {player.position}
        </Badge>
        {TrendBadge({ trend: player.trend })}
      </div>
      <div className="mt-1 w-16 sm:w-20">
        <Progress
          value={player.pulseScore}
          className={`h-1 ${isElite ? getProgressClass(player.pulseScore) : 'progress-red'}`}
        />
        <p className={`mt-0.5 text-center text-[9px] font-bold ${isElite ? getSentimentColor(player.pulseScore) : 'text-[#E74C3C]'}`}>
          {Math.round(player.pulseScore)}
        </p>
      </div>
      {player.matchInfo && (
        <p className="mt-0.5 text-[8px] text-muted-foreground truncate max-w-[80px] text-center">
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
        return <LiveBadge />
      case 'completed':
        return (
          <Badge className="bg-muted/50 text-muted-foreground border-border gap-1 text-[10px] font-bold">
            <Lock className="size-3" />
            {t('wc.completed')}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[#F59E0B] border-[#F59E0B]/30 gap-1 text-[10px] font-bold">
            <Clock className="size-3" />
            {t('wc.upcoming')}
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

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight">
          🏆 {t('wc.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wc.new_stage')}</p>
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
                  ? 'bg-[#6C5CE7]/15 text-[#6C5CE7] dark:text-[#8B7CF7] border border-[#6C5CE7]/30 shadow-sm shadow-[#6C5CE7]/10'
                  : 'bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80'
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
          className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-muted/20 py-16 text-center"
        >
          <Clock className="size-10 text-muted-foreground/50 mb-3" />
          <p className="text-lg font-bold text-muted-foreground">{t('wc.countdown')}</p>
          <p className="mt-1 text-sm text-muted-foreground/70">{t('wc.no_data')}</p>
        </motion.div>
      )}

      {/* Loading */}
      {loading && stageStatus !== 'upcoming' && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin size-8 rounded-full border-2 border-[#6C5CE7]/30 border-t-[#6C5CE7]" />
        </div>
      )}

      {/* Elite & Crisis Sections */}
      {!loading && stageStatus !== 'upcoming' && (
        <>
          {/* ── Elite XI ──────────────────────────────────── */}
          {eliteData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="purple-glow border-[#6C5CE7]/20 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[#6C5CE7] via-[#8B5CF6] to-[#F59E0B]" />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🌟</span>
                    <div>
                      <CardTitle className="text-xl font-bold text-[#6C5CE7] dark:text-[#8B7CF7]">
                        {t('wc.elite')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t('wc.elite_desc')}
                      </CardDescription>
                    </div>
                    {stageStatus === 'completed' && (
                      <Badge className="ml-auto bg-muted/50 text-muted-foreground border-border gap-1 text-[10px]">
                        <Lock className="size-3" /> {t('wc.locked')}
                      </Badge>
                    )}
                    {stageStatus === 'live' && (
                      <LiveBadge />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-6">
                  <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-6 sm:space-y-8">
                    {organizeFormation(eliteData.players).map((row, ri) => (
                      <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                        {row.map((player) => (
                          <FormationPlayerCard
                            key={player.id}
                            player={player}
                            type="elite"
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

          {/* ── Crisis XI ─────────────────────────────────── */}
          {crisisData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="red-glow border-[#E74C3C]/20 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[#E74C3C] via-[#C0392B] to-[#F59E0B]" />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <CardTitle className="text-xl font-bold text-[#E74C3C]">
                        {t('wc.crisis')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t('wc.crisis_desc')}
                      </CardDescription>
                    </div>
                    {stageStatus === 'completed' && (
                      <Badge className="ml-auto bg-muted/50 text-muted-foreground border-border gap-1 text-[10px]">
                        <Lock className="size-3" /> {t('wc.locked')}
                      </Badge>
                    )}
                    {stageStatus === 'live' && (
                      <LiveBadge />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-6">
                  <div
                    className="pitch-bg rounded-xl p-4 sm:p-6 space-y-6 sm:space-y-8"
                    style={{ '--pitch': 'rgba(231, 76, 60, 0.04)', '--pitch-line': 'rgba(231, 76, 60, 0.15)' } as React.CSSProperties}
                  >
                    {organizeFormation(crisisData.players).map((row, ri) => (
                      <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                        {row.map((player) => (
                          <FormationPlayerCard
                            key={player.id}
                            player={player}
                            type="crisis"
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
                { label: 'Elite Avg Pulse', value: Math.round(eliteData.players.reduce((a, p) => a + p.pulseScore, 0) / eliteData.players.length), icon: TrendingUp, color: 'text-[#6C5CE7]' },
                { label: 'Crisis Avg Pulse', value: Math.round(crisisData.players.reduce((a, p) => a + p.pulseScore, 0) / crisisData.players.length), icon: TrendingDown, color: 'text-[#E74C3C]' },
                { label: 'Live Players', value: [...eliteData.players, ...crisisData.players].filter(p => p.isLive).length, icon: Activity, color: 'text-[#F59E0B]' },
                { label: 'Total Votes', value: '1.2M', icon: Users, color: 'text-foreground' },
              ].map((stat, i) => (
                <Card key={i} className="border-border/50 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <stat.icon className={`mx-auto size-5 mb-2 ${stat.color}`} />
                    <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
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
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        await fetch('/api/world-cup/seed', { method: 'POST' })
        setSeeded(true)

        const res = await fetch('/api/world-cup/stages')
        if (res.ok) {
          const data = await res.json()
          setStages(data.stages || [])
        }
      } catch (err) {
        console.error('Init failed:', err)
        setSeeded(true)
      }
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#16162A]">
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
