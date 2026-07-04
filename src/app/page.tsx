'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, Minus, Play, Star, AlertTriangle,
  Lock, Clock, Zap, Shield, ShieldCheck, CircleDot,
  Sparkles, BarChart3, Users, Timer, Share2, Eye, Flame, Trophy, X, ChevronRight, Check, ArrowLeft
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FanCardButton } from '@/components/common/FanCardButton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import TopHeader from '@/components/TopHeader'
import Navigation, { type TabId } from '@/components/Navigation'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam, NATIONAL_TEAMS } from '@/lib/national-teams'
import { useFlagMode } from '@/lib/flag-mode'
import FlagImage from '@/components/common/FlagImage'
import { FanTalkPanel } from '@/components/FanTalkPanel'
import { getPulseScoreColor, getPulseScoreColorClass } from '@/types'

// ── World Cup stage label helper ─────────────────────────────
// Renders an accurate label for a WC match based on its `group` value.
// Group-stage matches use letters A-L; knockout rounds use R32/R16/QF/SF/Final.
// (Previously everything was labelled "WC Group {x}", which produced the
// nonsensical "WC Group R32" for knockout matches.)
function wcStageLabel(group: string | null | undefined): string {
  if (!group) return 'World Cup 2026'
  if (/^[A-L]$/.test(group)) return `WC Group ${group}`
  switch (group) {
    case 'R32': return 'WC Round of 32'
    case 'R16': return 'WC Round of 16'
    case 'QF': return 'WC Quarter Finals'
    case 'SF': return 'WC Semi Finals'
    case 'Final': return 'WC Final'
    default: return 'World Cup 2026'
  }
}

// ── Types ────────────────────────────────────────────────────

interface WCSelectionPlayer {
  id: string
  name: string
  nationCode: string
  position: string
  pulseScore: number
  sentiment: number
  trend: string
  isLive: boolean
  matchInfo: string | null
  order: number
  // R32 ticker fields (populated only for the live R32 stage):
  previousPulseScore?: number
  scoreDelta?: number
  lastBuzzRefreshAt?: string | null
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
// Note: MOCK_MATCHES and MOCK_SENTIMENTS were removed — match data comes from
// /api/matches and sentiment data comes from /api/sentiments (both real).

const MOCK_RATINGS = [
  { id: 1, name: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', avgRating: 9.6 },
  { id: 2, name: 'Vinícius Jr', nationCode: 'BRA', position: 'LW', avgRating: 7.2 },
  { id: 3, name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', avgRating: 9.2 },
  { id: 4, name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', avgRating: 9.1 },
  { id: 5, name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', avgRating: 8.5 },
  { id: 6, name: 'Rodri', nationCode: 'ESP', position: 'CDM', avgRating: 8.8 },
  { id: 7, name: 'Richarlison', nationCode: 'BRA', position: 'ST', avgRating: 2.1 },
  { id: 8, name: 'Harry Maguire', nationCode: 'ENG', position: 'CB', avgRating: 2.4 },
  { id: 9, name: 'Alisson', nationCode: 'BRA', position: 'GK', avgRating: 8.2 },
  { id: 10, name: 'Hakimi', nationCode: 'MAR', position: 'RB', avgRating: 8.4 },
]

const MOCK_GOALS = [
  // ── Friendly Goals ──
  { id: 1, scorer: 'Doué', team: 'FRA', flag: '🇫🇷', minute: 23, match: 'COL 1-3 FRA', type: 'Goal', tags: ['BRACE', 'TOPSCORER'], source: 'Friendly' },
  { id: 2, scorer: 'Doué', team: 'FRA', flag: '🇫🇷', minute: 58, match: 'COL 1-3 FRA', type: 'Goal', tags: ['TOPSCORER'], source: 'Friendly' },
  { id: 3, scorer: 'Olise', team: 'FRA', flag: '🇫🇷', minute: 12, match: 'FRA 3-0 NIR', type: 'Goal', tags: ['HATTRICK'], source: 'Friendly' },
  { id: 4, scorer: 'Messi', team: 'ARG', flag: '🇦🇷', minute: 35, match: 'ARG 3-0 ISL', type: 'Goal', tags: ['TOPSCORER', 'RETURN'], source: 'Friendly' },
  { id: 5, scorer: 'Yamal', team: 'ESP', flag: '🇪🇸', minute: 22, match: 'ESP 3-1 PER', type: 'Goal', tags: ['TOPSCORER'], source: 'Friendly' },
  { id: 6, scorer: 'Kane', team: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', minute: 55, match: 'ENG 3-0 CRC', type: 'Goal', tags: ['HEADER'], source: 'Friendly' },
  // ── World Cup Group Stage Goals ──
  { id: 7, scorer: 'Quiñones', team: 'MEX', flag: '🇲🇽', minute: 14, match: 'MEX 2-0 RSA', type: 'Goal', tags: ['FIRSTGOAL', 'HISTORIC'], source: 'WC' },
  { id: 8, scorer: 'Reyna', team: 'USA', flag: '🇺🇸', minute: 31, match: 'USA 4-1 PAR', type: 'Goal', tags: ['TRIVELA', 'TOPSCORER'], source: 'WC' },
  { id: 9, scorer: 'Hakimi', team: 'MAR', flag: '🇲🇦', minute: 78, match: 'BRA 1-1 MAR', type: 'Goal', tags: ['TOPSCORER'], source: 'WC' },
  { id: 10, scorer: 'Bellingham', team: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', minute: 67, match: 'ENG 2-1 CRO', type: 'Goal', tags: ['HEADER'], source: 'WC' },
  { id: 11, scorer: 'Wirtz', team: 'GER', flag: '🇩🇪', minute: 34, match: 'GER 3-0 CUW', type: 'Goal', tags: ['TOPSCORER'], source: 'WC' },
  { id: 12, scorer: 'Messi', team: 'ARG', flag: '🇦🇷', minute: 42, match: 'ARG 3-0 ALG', type: 'Goal', tags: ['TOPSCORER', 'HEADER'], source: 'WC' },
  { id: 13, scorer: 'Mbappé', team: 'FRA', flag: '🇫🇷', minute: 55, match: 'FRA 2-0 SEN', type: 'Goal', tags: ['TOPSCORER'], source: 'WC' },
  { id: 14, scorer: 'Álvarez', team: 'ARG', flag: '🇦🇷', minute: 71, match: 'ARG 3-0 ALG', type: 'Goal', tags: ['HEADER'], source: 'WC' },
  { id: 15, scorer: 'Saka', team: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', minute: 15, match: 'ENG 2-1 CRO', type: 'Goal', tags: ['TOPSCORER'], source: 'WC' },
]

const MOCK_TOTW = [
  { name: 'Alisson', nationCode: 'BRA', position: 'GK', rating: 8.5 },
  { name: 'Hakimi', nationCode: 'MAR', position: 'RB', rating: 8.4 },
  { name: 'Van Dijk', nationCode: 'NED', position: 'CB', rating: 8.7 },
  { name: 'Dias', nationCode: 'POR', position: 'CB', rating: 8.6 },
  { name: 'Hernández', nationCode: 'FRA', position: 'LB', rating: 8.3 },
  { name: 'Rodri', nationCode: 'ESP', position: 'CM', rating: 8.8 },
  { name: 'Bellingham', nationCode: 'ENG', position: 'CM', rating: 9.2 },
  { name: 'Wirtz', nationCode: 'GER', position: 'CAM', rating: 8.5 },
  { name: 'Yamal', nationCode: 'ESP', position: 'RW', rating: 9.1 },
  { name: 'Mbappé', nationCode: 'FRA', position: 'LW', rating: 9.6 },
  { name: 'Messi', nationCode: 'ARG', position: 'ST', rating: 8.9 },
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

// Face emoji mapping for /10 rating system
function getPulseFaceEmoji(pulseScore: number): string {
  if (pulseScore >= 90) return '🤩'
  if (pulseScore >= 70) return '😊'
  if (pulseScore >= 50) return '😐'
  if (pulseScore >= 30) return '😟'
  return '😵'
}

// 5-level fan mood emoji for match cards (emojis only, no text/percentages)
function getFanMoodEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}

function getFanMoodEmojiSize(score: number): string {
  // Bigger emoji for more extreme sentiments
  if (score >= 80 || score < 25) return 'text-3xl'
  if (score >= 65 || score < 45) return 'text-2xl'
  return 'text-xl'
}

function getRatingColor(rating: number): string {
  if (rating >= 9) return '#10B981'
  if (rating >= 7) return '#6C2BD9'
  if (rating >= 5) return '#FF6B35'
  if (rating >= 3) return '#EF4444'
  return '#DC2626'
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

// ── HOME Tab ─────────────────────────────────────────────────

// Top 12 WC 2026 teams for the Fan Mood voting chips.
const FAN_MOOD_TEAM_CODES = ['BRA', 'ARG', 'FRA', 'ENG', 'ESP', 'GER', 'MEX', 'USA', 'POR', 'NED', 'JPN', 'MAR']

const MOOD_EMOJI_OPTIONS: { emoji: string; score: number; label: string; color: string }[] = [
  { emoji: '🤩', score: 95, label: 'On Fire', color: 'bg-[#10B981]' },
  { emoji: '😊', score: 75, label: 'Happy', color: 'bg-[#8B5CF6]' },
  { emoji: '😐', score: 50, label: 'Neutral', color: 'bg-[#FF6B35]' },
  { emoji: '😟', score: 25, label: 'Worried', color: 'bg-[#F59E0B]' },
  { emoji: '😡', score: 5, label: 'Angry', color: 'bg-[#EF4444]' },
]

interface FanVoteAgg {
  teamCode: string
  score: number
  count: number
}

function HomeTab() {
  const { t } = useLanguage()
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'WC'>('WC')
  const [apiMatches, setApiMatches] = useState<Array<{
    id: string; home: string; away: string; homeFlag: string; awayFlag: string
    score: string; homeSentiment: number; awaySentiment: number; live: boolean; league: string
    status: string; group: string; matchDate: string
  }>>([])

  // Fan vote state
  const [sessionId, setSessionId] = useState<string>('')
  const [fanVotes, setFanVotes] = useState<FanVoteAgg[]>([])
  const [myVotes, setMyVotes] = useState<Array<{ teamCode: string; score: number }>>([])
  const [votesLoading, setVotesLoading] = useState(true)
  const [selectedVoteTeam, setSelectedVoteTeam] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; emoji: string } | null>(null)
  const [fanCardOffer, setFanCardOffer] = useState<{ teamCode: string; score: number } | null>(null)

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch('/api/matches?league=WC')
        if (res.ok) {
          const data = await res.json()
          const mapped = (data.matches || []).map((m: any) => ({
            id: m.id,
            home: m.homeTeam.code,
            away: m.awayTeam.code,
            homeFlag: m.homeTeam.flag || '',
            awayFlag: m.awayTeam.flag || '',
            score: m.score,
            homeSentiment: Math.round(m.homeTeam.sentiment),
            awaySentiment: Math.round(m.awayTeam.sentiment),
            live: m.status === 'live',
            league: m.league === 'WC' ? wcStageLabel(m.group) : m.league,
            status: m.status || 'upcoming',
            group: m.group || '',
            matchDate: m.matchDate || '',
          }))
          setApiMatches(mapped)
        }
      } catch (err) {
        console.error('Failed to fetch matches:', err)
      }
    }
    fetchMatches()
  }, [])

  // SSR-safe: read/create sessionId inside useEffect, never during render.
  useEffect(() => {
    try {
      const existing = typeof window !== 'undefined' ? window.localStorage.getItem('fan_session_id') : null
      if (existing && existing.length > 0) {
        setSessionId(existing)
        return
      }
      const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('fan_session_id', newId)
      }
      setSessionId(newId)
    } catch {
      setSessionId(`anon-${Date.now()}`)
    }
  }, [])

  // Fetch fan votes whenever sessionId changes.
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    async function loadVotes() {
      setVotesLoading(true)
      try {
        const res = await fetch(`/api/fan-vote?session=${encodeURIComponent(sessionId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFanVotes(Array.isArray(data.votes) ? data.votes : [])
        setMyVotes(Array.isArray(data.myVotes) ? data.myVotes : [])
      } catch (err) {
        console.error('Failed to fetch fan votes:', err)
      } finally {
        if (!cancelled) setVotesLoading(false)
      }
    }
    loadVotes()
    return () => { cancelled = true }
  }, [sessionId])

  // Close voting modal on Escape key (accessibility — modal was only closable
  // via the explicit Close button or selecting a mood)
  useEffect(() => {
    if (!selectedVoteTeam) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setSelectedVoteTeam(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedVoteTeam, submitting])

  const totalVoteCount = fanVotes.reduce((sum, v) => sum + (v.count || 0), 0)

  const handleVote = async (teamCode: string, score: number) => {
    if (!sessionId || submitting) return
    setSubmitting(true)
    // Optimistic update: bump my vote immediately
    const prevMyVote = myVotes.find(v => v.teamCode === teamCode)?.score ?? null
    setMyVotes(prev => {
      const without = prev.filter(v => v.teamCode !== teamCode)
      return [...without, { teamCode, score }]
    })
    setFanVotes(prev => {
      const idx = prev.findIndex(v => v.teamCode === teamCode)
      if (idx === -1) {
        return [...prev, { teamCode, score, count: 1 }]
      }
      const next = [...prev]
      const wasMine = prevMyVote !== null
      // Adjust running average: if I had voted, swap my old score for the new.
      const current = next[idx]
      const totalScore = current.score * current.count
      const newScore = wasMine
        ? Math.round((totalScore - prevMyVote! + score) / current.count)
        : Math.round((totalScore + score) / (current.count + 1))
      const newCount = wasMine ? current.count : current.count + 1
      next[idx] = { teamCode, score: newScore, count: newCount }
      return next
    })
    setSelectedVoteTeam(null)
    const mood = MOOD_EMOJI_OPTIONS.find(o => o.score === score)
    setToast({ msg: `Vote recorded for ${teamCode}`, emoji: mood?.emoji ?? '✓' })
    setTimeout(() => setToast(null), 2500)
    // Show the Fan Card offer for 8 seconds — long enough to click "Get Fan Card"
    setFanCardOffer({ teamCode, score })
    const offerTimer = setTimeout(() => setFanCardOffer(null), 8000)
    try {
      await fetch('/api/fan-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode, score, sessionId }),
      })
    } catch (err) {
      console.error('Failed to submit vote:', err)
      // Revert on failure
      setMyVotes(prev => {
        const without = prev.filter(v => v.teamCode !== teamCode)
        if (prevMyVote !== null) return [...without, { teamCode, score: prevMyVote }]
        return without
      })
      setToast({ msg: 'Vote failed — please retry', emoji: '⚠️' })
      setFanCardOffer(null)
      clearTimeout(offerTimer)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMatches = (matchFilter === 'ALL'
    ? apiMatches
    : apiMatches.filter(m => m.league.startsWith('WC'))
  ).slice(0, 24) // Limit to 24 cards max for performance

  const fanVoteIntelText = totalVoteCount === 0
    ? 'Be the first to vote in the Fan Mood section below'
    : `${totalVoteCount.toLocaleString()} fan votes tallied for World Cup 2026 Group Stage`

  // ── Arena Intelligence: VERIFIED insights only ──────────────────────────
  // Every insight below is a historical fact sourced from VERIFIED_DATA.md
  // (the project's single source of truth, cross-checked against Wikipedia,
  // ESPN, Olympics.com, FIFA.com on 2026-07-02). We deliberately do NOT
  // auto-generate insights from apiMatches because that approach produced two
  // verifiable hallucinations in production:
  //   (1) "World Cup 2026 kicked off with ESP 0-0 AUT in the opener" — FALSE.
  //       The old code used parsed[0] (first array element) as "the opener",
  //       but the first row happened to be an UPCOMING R32 match (ESP vs AUT,
  //       scheduled Jul 3, not yet played). The real opener was MEX 2-0 RSA
  //       on Jun 11 (the earliest matchDate among completed matches).
  //   (2) "Shock in Group Stage: ESP 0-0 AUT" — FALSE. The old code used
  //       league.includes('WC') to label the stage as "Group Stage", but ALL
  //       WC matches (including R32) match that check. ESP vs AUT is an R32
  //       match, not a group-stage match. The real group-stage shock was
  //       ESP 0-0 CPV (Spain held scoreless by Cape Verde).
  //
  // Fix: hardcode the verified insight set with explicit VERIFIED_DATA.md
  // citations. Only the fan-vote count stays dynamic (it is live data).
  // This guarantees we never describe an upcoming match as played, never
  // mislabel a knockout match as a group-stage match, and never invent stats.
  const arenaIntel = useMemo<Array<{ icon: typeof Sparkles; text: string; color: string }>>(() => {
    const items: Array<{ icon: typeof Sparkles; text: string; color: string }> = []

    // 1. Tournament opener — VERIFIED_DATA.md Part 1, Group A, match 1
    //    "Mexico 2-0 South Africa — Jun 11, Mexico City. Scorers: Quiñones 9', Jiménez 67'."
    //    This is the earliest completed match in the DB (matchDate 2026-06-11).
    items.push({
      icon: Trophy,
      text: 'Mexico 2-0 South Africa opened the 2026 World Cup on Jun 11 (Quiñones 9\', Jiménez 67\')',
      color: 'text-[#FF6B35]',
    })

    // 2. Biggest win — VERIFIED_DATA.md Part 1, Group E, match 9
    //    "Germany 7-1 Curaçao — Jun 14, Houston." 6-goal margin = largest of Matchday 1.
    items.push({
      icon: Flame,
      text: "Germany's 7-1 win over Curaçao is the largest victory margin of Matchday 1",
      color: 'text-[#FF6B35]',
    })

    // 3. Hat-trick — VERIFIED_DATA.md Part 1, Group J, match 19
    //    "Argentina 3-0 Algeria — Jun 16. Scorer: Messi 17', 60', 76' (hat-trick)."
    items.push({
      icon: Sparkles,
      text: "Argentina's Messi scored a hat-trick vs Algeria (17', 60', 76')",
      color: 'text-[#6C2BD9]',
    })

    // 4. Highest-scoring group match — VERIFIED_DATA.md Part 1, Group L, match 23
    //    "England 4-2 Croatia — Jun 17." 6 goals = highest-scoring group match.
    items.push({
      icon: Activity,
      text: 'England beat Croatia 4-2 in the highest-scoring group-stage match',
      color: 'text-[#6C2BD9]',
    })

    // 5. Shock — VERIFIED_DATA.md Part 1, Group H, match 15
    //    "Spain 0-0 Cape Verde — Jun 15, Atlanta. No scorers."
    //    Spain (pre-tournament favorite) held scoreless by Cape Verde (debutants).
    items.push({
      icon: BarChart3,
      text: 'Spain were held 0-0 by Cape Verde — the shock of Matchday 1',
      color: 'text-[#EF4444]',
    })

    // 6. Mbappé brace — VERIFIED_DATA.md Part 1, Group I, match 17
    //    "France 3-1 Senegal — Jun 16. Scorers: Mbappé 66', 90+6', Barcola 82' | Mbaye 90+5'."
    items.push({
      icon: Zap,
      text: 'France beat Senegal 3-1 with a Mbappé brace (66\', 90+6\')',
      color: 'text-[#6C2BD9]',
    })

    // 7. Highest-scoring draw — VERIFIED_DATA.md Part 1, Group G, match 14 + Group F, match 11
    //    "Iran 2-2 New Zealand — Jun 16" and "Netherlands 2-2 Japan — Jun 14"
    //    Both 2-2 (4 goals) — tied for highest-scoring draw of Matchday 1.
    items.push({
      icon: Activity,
      text: 'Iran and New Zealand drew 2-2 — tied with NED 2-2 JPN as the highest-scoring draws of Matchday 1',
      color: 'text-[#6C2BD9]',
    })

    // 8. Fan vote count (DYNAMIC — the only non-hardcoded insight)
    //    Derived from the live /api/fan-vote response, not a verified fact.
    items.push({
      icon: Users,
      text: fanVoteIntelText,
      color: 'text-[#10B981]',
    })

    return items
  }, [fanVoteIntelText])

  const moodTeamEntries = FAN_MOOD_TEAM_CODES.map(code => {
    const team = NATIONAL_TEAMS.find(t => t.code === code)
    const vote = fanVotes.find(v => v.teamCode === code)
    const myVote = myVotes.find(v => v.teamCode === code)
    return {
      code,
      flag: team?.flag ?? '🏳️',
      name: team?.name ?? code,
      score: vote?.score ?? 50,
      count: vote?.count ?? 0,
      myVote: myVote?.score ?? null,
    }
  })

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
            {apiMatches.filter(m => m.live).length} {t('home.live')}
          </div>
        </div>
      </motion.div>

      {/* Featured Matches */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
            {t('home.featured')}
          </h3>
          <div className="flex gap-1.5">
            {(['WC', 'ALL'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setMatchFilter(filter)}
                className={`
                  rounded-full px-3 py-1 text-[10px] font-bold transition-all duration-200
                  ${matchFilter === filter
                    ? 'bg-[#6C2BD9] text-white shadow-sm'
                    : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10'
                  }
                `}
              >
                {filter === 'ALL' ? '⚽ All' : '🏆 World Cup'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredMatches.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlagImage nationCode={match.home} size={26} fallbackEmoji={match.homeFlag} />
                      <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{match.home}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black tracking-wider text-[#1A1A1A] dark:text-white">{match.score}</span>
                      {match.live && <LiveBadge />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{match.away}</span>
                      <FlagImage nationCode={match.away} size={26} fallbackEmoji={match.awayFlag} />
                    </div>
                  </div>
                  {/* League badge */}
                  <div className="mt-2">
                    <Badge variant="outline" className={`text-[8px] font-bold px-1.5 py-0 ${
                      match.league === 'Friendly'
                        ? 'border-[#FF6B35]/30 text-[#FF6B35]'
                        : 'border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]'
                    }`}>
                      {match.league}
                    </Badge>
                  </div>
                  {/* Fan Mood — Emoji Only with team flags */}
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] px-3 py-2.5">
                    <div className="flex items-center gap-1.5" title={`${match.home} fan mood`}>
                      <FlagImage nationCode={match.home} size={20} fallbackEmoji={match.homeFlag} />
                      <span className={`inline-block leading-none ${getFanMoodEmojiSize(match.homeSentiment)}`}>
                        {getFanMoodEmoji(match.homeSentiment)}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#999] dark:text-gray-500">
                      {t('home.fan_mood')}
                    </span>
                    <div className="flex items-center gap-1.5" title={`${match.away} fan mood`}>
                      <span className={`inline-block leading-none ${getFanMoodEmojiSize(match.awaySentiment)}`}>
                        {getFanMoodEmoji(match.awaySentiment)}
                      </span>
                      <FlagImage nationCode={match.away} size={20} fallbackEmoji={match.awayFlag} />
                    </div>
                  </div>
                  {/* What Fans Are Saying — collapsible real-time fan posts panel */}
                  <FanTalkPanel
                    teamCodes={[match.home, match.away]}
                    matchLabel={`${match.home} vs ${match.away}`}
                  />
                  <div className="mt-3 flex items-center">
                    <SharePulseButton className="flex-1" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fan Mood — interactive voting section (horizontal side-scrolling carousel) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
              {t('home.fan_mood')}
            </h3>
            {!votesLoading && (
              <Badge className="bg-[#6C2BD9]/10 text-[#6C2BD9] dark:text-[#8B5CF6] border-0 text-[9px] font-bold px-2 py-0.5">
                {totalVoteCount.toLocaleString()} {totalVoteCount === 1 ? 'vote' : 'votes'} cast
              </Badge>
            )}
          </div>
          <span className="text-[10px] font-semibold text-[#FF6B35]">Swipe teams to vote →</span>
        </div>
        <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none overflow-hidden">
          <CardContent className="p-4">
            {votesLoading ? (
              <div className="flex gap-2.5 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-28 h-36 rounded-2xl bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="relative">
                {/* Right-edge fade + animated scroll hint */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-3 z-10 w-10 bg-gradient-to-l from-white dark:from-[#1A1A1A] via-white/70 dark:via-[#1A1A1A]/70 to-transparent flex items-center justify-end pr-1.5">
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center justify-center size-5 rounded-full bg-[#6C2BD9]/10"
                  >
                    <ChevronRight className="size-3.5 text-[#6C2BD9]" />
                  </motion.span>
                </div>

                {/* Horizontal scroll carousel */}
                <div className="flex gap-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2 -mx-1 px-1">
                  {moodTeamEntries.map((entry, i) => {
                    const hasMyVote = entry.myVote !== null
                    return (
                      <motion.button
                        key={entry.code}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        onClick={() => setSelectedVoteTeam(entry.code)}
                        className={`
                          relative shrink-0 snap-start w-28 sm:w-32 rounded-2xl border p-3 flex flex-col items-center
                          transition-all duration-200
                          ${hasMyVote
                            ? 'border-[#10B981]/60 bg-[#10B981]/5 dark:bg-[#10B981]/10 shadow-md shadow-[#10B981]/15'
                            : 'border-[#E0E0E0]/60 dark:border-white/10 bg-white dark:bg-[#2D2D2D] hover:border-[#6C2BD9]/50 hover:bg-[#6C2BD9]/5 dark:hover:bg-[#6C2BD9]/10 hover:-translate-y-0.5'
                          }
                        `}
                      >
                        {/* Voted check badge */}
                        {hasMyVote && (
                          <span
                            aria-label="You voted"
                            className="absolute -top-1.5 -right-1.5 z-10 size-5 rounded-full bg-[#10B981] ring-2 ring-white dark:ring-[#1A1A1A] shadow-sm shadow-[#10B981]/50 flex items-center justify-center"
                          >
                            <Check className="size-3 text-white" strokeWidth={4} />
                          </span>
                        )}

                        {/* Big team flag (real PNG image — renders on all platforms) */}
                        <div className="flex items-center justify-center" style={{ minHeight: 32 }}>
                          <FlagImage nationCode={entry.code} size={48} fallbackEmoji={entry.flag} className="shadow-sm" />
                        </div>

                        {/* Big mood emoji */}
                        <span className="mt-1.5 text-3xl sm:text-4xl leading-none">
                          {getFanMoodEmoji(entry.score)}
                        </span>

                        {/* Team code */}
                        <span className="mt-2 text-[11px] font-black tracking-wider text-[#1A1A1A] dark:text-white">
                          {entry.code}
                        </span>

                        {/* Vote count */}
                        <span className="text-[8px] text-[#666] dark:text-[#CCCCCC]">
                          {entry.count} {entry.count === 1 ? 'vote' : 'votes'}
                        </span>

                        {/* Thin mood indicator bar */}
                        <div
                          className="mt-2 w-full rounded-full overflow-hidden"
                          style={{ height: 3, background: 'rgba(0,0,0,0.06)' }}
                        >
                          <div
                            className={`h-full rounded-full ${entry.score >= 80 ? 'sentiment-positive' : entry.score >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`}
                            style={{ width: `${entry.score}%`, transition: 'width 0.6s ease' }}
                          />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}
            <p className="mt-3 text-[10px] text-[#999] dark:text-gray-500 text-center">
              Your vote is anonymous — stored only in your browser session.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Arena Intelligence */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
          {t('home.arena_intel')}
        </h3>
        <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
          <CardContent className="p-4 space-y-3">
            {arenaIntel.map((item, i) => (
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
                  <p className="mt-0.5 text-[10px] text-[#666] dark:text-[#CCCCCC]">Matchday 1</p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Vote popup */}
      <AnimatePresence>
        {selectedVoteTeam && (
          <>
            <motion.div
              key="vote-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setSelectedVoteTeam(null)}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              key="vote-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
            >
              <Card className="pointer-events-auto w-full max-w-sm rounded-2xl border-[#E0E0E0]/50 dark:border-white/10 shadow-2xl bg-white dark:bg-[#1A1A1A]">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-[#1A1A1A] dark:text-white flex items-center gap-2">
                      <FlagImage
                        nationCode={selectedVoteTeam}
                        size={24}
                        fallbackEmoji={NATIONAL_TEAMS.find(t => t.code === selectedVoteTeam)?.flag ?? '🏳️'}
                      />
                      {selectedVoteTeam} Mood
                    </CardTitle>
                    <button
                      onClick={() => !submitting && setSelectedVoteTeam(null)}
                      aria-label="Close"
                      className="rounded-full size-7 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <CardDescription className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                    How are fans of {NATIONAL_TEAMS.find(t => t.code === selectedVoteTeam)?.name ?? selectedVoteTeam} feeling right now?
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-1">
                  <div className="grid grid-cols-5 gap-1.5">
                    {MOOD_EMOJI_OPTIONS.map((opt) => (
                      <motion.button
                        key={opt.score}
                        whileTap={{ scale: 0.9 }}
                        disabled={submitting}
                        onClick={() => handleVote(selectedVoteTeam, opt.score)}
                        className="flex flex-col items-center gap-1 rounded-xl border border-[#E0E0E0] dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-2 px-1 transition-all duration-200 hover:border-[#6C2BD9]/50 hover:bg-[#6C2BD9]/5 dark:hover:bg-[#6C2BD9]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <span className="text-2xl leading-none">{opt.emoji}</span>
                        <span className={`h-1 w-6 rounded-full ${opt.color}`} />
                        <span className="text-[8px] font-bold text-[#666] dark:text-[#CCCCCC]">{opt.score}</span>
                      </motion.button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-center text-[#666] dark:text-[#CCCCCC]">
                    Tap an emoji to cast your vote — you can change it anytime.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 30, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 30, x: '-50%' }}
            className="fixed bottom-20 md:bottom-6 left-1/2 z-[70] -translate-x-1/2 flex items-center gap-2 rounded-full bg-[#1A1A1A] dark:bg-white px-4 py-2 shadow-lg"
          >
            <span className="text-base">{toast.emoji}</span>
            <span className="text-xs font-bold text-white dark:text-[#1A1A1A]">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fan Card offer — appears after a successful vote */}
      <AnimatePresence>
        {fanCardOffer && (
          <motion.div
            key="fan-card-offer"
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 40, x: '-50%' }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 z-[71] -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-[#1A1A1A] dark:bg-white px-4 py-2.5 shadow-2xl border border-white/10 dark:border-[#1A1A1A]/10"
          >
            <span className="text-xl">{MOOD_EMOJI_OPTIONS.find(o => o.score === fanCardOffer.score)?.emoji ?? '✓'}</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white dark:text-[#1A1A1A]">
                Voted for {fanCardOffer.teamCode}!
              </span>
              <span className="text-[10px] text-white/60 dark:text-[#666]">
                Share your fan mood
              </span>
            </div>
            <FanCardButton
              teamCode={fanCardOffer.teamCode}
              score={fanCardOffer.score}
            />
            <button
              onClick={() => setFanCardOffer(null)}
              aria-label="Dismiss"
              className="ml-1 rounded-full size-6 flex items-center justify-center text-white/40 dark:text-[#1A1A1A]/40 hover:text-white/70 dark:hover:text-[#1A1A1A]/70 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── SENTIMENTS Tab ───────────────────────────────────────────

interface SentimentPlayer {
  id: string
  name: string
  nationCode: string
  pulseScore: number
  sentiment: number
  trend: string
  league: string
  label: 'on_fire' | 'under_pressure' | 'crisis'
}

type MoodFilter = 'ALL' | 'on_fire' | 'under_pressure' | 'crisis'

function SentimentsTab() {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<MoodFilter>('ALL')
  const [players, setPlayers] = useState<SentimentPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const moods: { id: MoodFilter; labelKey: string; emoji: string }[] = [
    { id: 'ALL', labelKey: 'sentiments.all', emoji: '🌐' },
    { id: 'on_fire', labelKey: 'sentiments.on_fire', emoji: '🔥' },
    { id: 'under_pressure', labelKey: 'sentiments.under_pressure', emoji: '😤' },
    { id: 'crisis', labelKey: 'sentiments.crisis', emoji: '😰' },
  ]

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/sentiments')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setPlayers(Array.isArray(data.players) ? data.players : [])
      } catch (err) {
        console.error('Failed to fetch sentiments:', err)
        if (!cancelled) setError('Failed to load player sentiments. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = filter === 'ALL' ? players : players.filter(p => p.label === filter)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
            {t('sentiments.title')}
          </h2>
          {!loading && !error && (
            <span className="text-xs font-semibold text-[#666] dark:text-[#CCCCCC]">
              {filtered.length} {filtered.length === 1 ? 'player' : 'players'}
            </span>
          )}
        </div>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('sentiments.powered')}</p>
      </motion.div>

      {/* Filter pills — mood filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {moods.map((mood) => {
          const isActive = filter === mood.id
          return (
            <button
              key={mood.id}
              onClick={() => setFilter(mood.id)}
              className={`
                shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200
                ${isActive
                  ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
                }
              `}
            >
              <span className="mr-1">{mood.emoji}</span>
              {t(mood.labelKey)}
            </button>
          )
        })}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                      <div className="h-2 w-12 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="h-6 w-10 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse ml-auto" />
                    <div className="h-2 w-8 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse ml-auto" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                <div className="mt-2 h-2 w-20 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/5 py-12 text-center">
          <AlertTriangle className="size-8 text-[#EF4444] mb-3" />
          <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">{error}</p>
          <Button
            onClick={() => setFilter('ALL')}
            className="mt-4 bg-[#6C2BD9] hover:bg-[#5A1FBF] text-white text-xs font-bold h-8 rounded-lg"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Player sentiment cards */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E0E0E0]/50 dark:border-white/5 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-12 text-center">
              <span className="text-3xl mb-2">🤷</span>
              <p className="text-sm font-semibold text-[#666] dark:text-[#CCCCCC]">No players match this filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((player, i) => {
                const score = player.pulseScore
                const labelKey = player.label === 'on_fire'
                  ? 'sentiments.on_fire'
                  : player.label === 'under_pressure'
                    ? 'sentiments.under_pressure'
                    : 'sentiments.crisis'
                const emoji = player.label === 'on_fire' ? '🔥' : player.label === 'under_pressure' ? '😤' : '😰'
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <Card className={`card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none ${getSentimentBg(score)}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">
                              <FlagImage nationCode={player.nationCode} size={28} fallbackEmoji={getFlag(player.nationCode)} />
                            </span>
                            <div>
                              <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">{player.name}</p>
                              <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">{player.nationCode}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-black ${getSentimentColor(score)}`}>
                              {score}
                            </p>
                            <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">pulse</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="sentiment-bar">
                            <div
                              className={`sentiment-bar-fill ${score >= 80 ? 'sentiment-positive' : score >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-sm">{emoji}</span>
                          <span className={`text-[10px] font-semibold ${getSentimentColor(score)}`}>
                            {t(labelKey)}
                          </span>
                          {player.trend && (
                            <span className="ml-auto">
                              {getTrendIcon(player.trend)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}
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
          <div className="pitch-bg rounded-xl relative p-4 sm:p-6">
            {/* Football Pitch Markings Overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><g stroke="rgba(255,255,255,0.4)" stroke-width="1.5" fill="none"><rect x="6" y="6" width="188" height="288" rx="2"/><line x1="6" y1="150" x2="194" y2="150"/><circle cx="100" cy="150" r="26"/><circle cx="100" cy="150" r="2.5" fill="rgba(255,255,255,0.4)"/><rect x="40" y="6" width="120" height="48"/><rect x="62" y="6" width="76" height="22"/><circle cx="100" cy="35" r="2.5" fill="rgba(255,255,255,0.4)"/><path d="M 74 54 A 26 26 0 0 0 126 54"/><rect x="40" y="246" width="120" height="48"/><rect x="62" y="272" width="76" height="22"/><circle cx="100" cy="265" r="2.5" fill="rgba(255,255,255,0.4)"/><path d="M 74 246 A 26 26 0 0 1 126 246"/><path d="M 6 14 A 8 8 0 0 1 14 6"/><path d="M 186 6 A 8 8 0 0 1 194 14"/><path d="M 6 286 A 8 8 0 0 0 14 294"/><path d="M 186 294 A 8 8 0 0 0 194 286"/><rect x="78" y="0" width="44" height="6" stroke-dasharray="4 4"/><rect x="78" y="294" width="44" height="6" stroke-dasharray="4 4"/></g></svg>')}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <div className="relative z-10 space-y-5 sm:space-y-6">
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
                      <div className="flex size-12 sm:size-14 items-center justify-center rounded-full border-2 border-white/60 bg-white/90 dark:bg-white/80 shadow-md shadow-black/20 overflow-hidden">
                        {player ? (
                          <FlagImage nationCode={player.nationCode} size={32} fallbackEmoji={getFlag(player.nationCode)} />
                        ) : (
                          <span className="text-lg">👤</span>
                        )}
                      </div>
                      <p className="mt-1 max-w-[60px] truncate text-[10px] font-bold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {player?.name ?? slot.pos}
                      </p>
                      <Badge variant="outline" className="mt-0.5 text-[8px] font-bold px-1 bg-white/90 backdrop-blur-sm border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
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
  onPlayerClick,
}: {
  player: WCSelectionPlayer
  type: 'elite' | 'crisis'
  stageStatus: string
  onPlayerClick?: (player: WCSelectionPlayer) => void
}) {
  const { mode: flagMode } = useFlagMode()
  const flagEmoji = getFlag(player.nationCode)
  const faceEmoji = getPulseFaceEmoji(player.pulseScore)
  const isElite = type === 'elite'
  const isLive = player.isLive && stageStatus === 'live'
  const isCompleted = stageStatus === 'completed'
  const accentColor = isElite ? '#6C2BD9' : '#EF4444'
  const rating = player.pulseScore / 10
  const ratingColor = getRatingColor(rating)
  const clickable = !!onPlayerClick

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={() => onPlayerClick?.(player)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlayerClick?.(player)
        }
      }}
      className={`flex flex-col items-center ${clickable ? 'cursor-pointer hover:scale-[1.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9]/60 rounded-md' : ''} transition-transform duration-200`}
      title={clickable ? `View ${player.name} pulse breakdown` : undefined}
    >
      {/* Player Circle - always shows face emoji */}
      <div
        className={`
          relative flex size-7 sm:size-8 items-center justify-center rounded-full border-[1.5px] shadow-sm overflow-hidden
          border-white/70 bg-white/95 dark:bg-white/90 shadow-black/10
          ${isLive ? 'animate-pulse-glow' : ''}
          transition-all duration-300
        `}
      >
        <span className="text-xs sm:text-sm leading-none select-none">{faceEmoji}</span>
        {isLive && (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[#EF4444] shadow-sm shadow-[#EF4444]/50 animate-live-pulse" />
        )}
        {isCompleted && (
          <Lock className="absolute -right-0.5 -top-0.5 size-2 text-[#666] dark:text-[#CCCCCC]" />
        )}
      </div>
      {/* Player Name */}
      <p className="mt-px max-w-[48px] truncate text-[7px] sm:text-[8px] font-bold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {player.name}
      </p>
      {/* Position + Trend */}
      <div className="flex items-center gap-px">
        <Badge
          variant="outline"
          className={`text-[5px] sm:text-[6px] font-bold px-0.5 py-0 bg-white/90 backdrop-blur-sm leading-tight ${
            isElite ? 'border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]' : 'border-[#EF4444]/30 text-[#EF4444] dark:border-[#F87171]/30 dark:text-[#F87171]'
          }`}
        >
          {player.position}
        </Badge>
        {getTrendIcon(player.trend)}
      </div>
      {/* Rating + Flag next to score */}
      <div className="flex items-center gap-0.5">
        {flagMode === 'flag' ? (
          <FlagImage nationCode={player.nationCode} size={12} fallbackEmoji={flagEmoji} />
        ) : (
          <span className="text-[10px] leading-none">{flagEmoji}</span>
        )}
        <span
          className="text-[7px] sm:text-[8px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
          style={{ color: ratingColor }}
        >
          {rating.toFixed(1)}
        </span>
      </div>
      {/* R32 movement chip — stock-ticker feel. Only for live R32 stage. */}
      {typeof player.scoreDelta === 'number' && Math.abs(player.scoreDelta) > 1 && (
        <motion.span
          layoutId={`delta-${player.id}`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-[6px] sm:text-[7px] font-black px-1 py-px rounded-full leading-tight ${
            player.scoreDelta > 0
              ? 'bg-[#10B981] text-white'
              : 'bg-[#EF4444] text-white'
          }`}
        >
          {player.scoreDelta > 0 ? '↑' : '↓'}{Math.abs(player.scoreDelta).toFixed(0)}
        </motion.span>
      )}
    </motion.div>
  )
}

// ── WORLD CUP Tab ────────────────────────────────────────────

function WorldCupTab({ stages }: { stages: WCStage[] }) {
  const { t, lang } = useLanguage()
  const { mode: flagMode, toggle: toggleFlag } = useFlagMode()
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [eliteData, setEliteData] = useState<WCSelection | null>(null)
  const [crisisData, setCrisisData] = useState<WCSelection | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<'elite' | 'crisis'>('elite')

  // R32 stock-ticker state (only the live R32 stage polls + shows movement).
  const [buzzSource, setBuzzSource] = useState<'baseline' | 'live'>('baseline')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [isPolling, setIsPolling] = useState(false)

  // Pulse breakdown modal state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [pulseBreakdown, setPulseBreakdown] = useState<{
    player: {
      id: string; name: string; nationCode: string; position: string
      pulseScore: number; sentiment: number; trend: string; isLive: boolean
      matchInfo: string | null; order: number
    }
    pulseScore: {
      overall: number
      matchPerformance: number
      fanSentiment: number
      aiNarrative: number
      momentumTrend: number
      matchPerformanceNote: string
      fanSentimentNote: string
      aiNarrativeNote: string
      momentumTrendNote: string
    }
    weights: { matchPerformance: number; fanSentiment: number; aiNarrative: number; momentumTrend: number }
    // Real fan sentiment metadata (null when no FeedMonitor data exists yet).
    // When present, the modal shows "Based on N real fan posts" + top quote + freshness.
    fanSentimentMeta?: {
      postCount: number
      positiveRatio: number
      topQuotes: Array<{ quote: string; score: number }>
      analyzedAt: string
      monitorId: string | null
      freshnessLabel: string
    } | null
  } | null>(null)
  const [pulseLoading, setPulseLoading] = useState(false)
  const [pulseError, setPulseError] = useState<string | null>(null)

  // Total fan votes (real count, replaces the old "1.2M" lie)
  const [totalVotes, setTotalVotes] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    async function loadVotes() {
      try {
        const res = await fetch('/api/fan-vote')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const votes: Array<{ count?: number }> = Array.isArray(data.votes) ? data.votes : []
        const sum = votes.reduce((s, v) => s + (typeof v.count === 'number' ? v.count : 0), 0)
        setTotalVotes(sum)
      } catch (err) {
        console.error('Failed to fetch total fan votes:', err)
      }
    }
    loadVotes()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      // Auto-select the first LIVE stage, fallback to first stage
      const liveStage = stages.find(s => s.status === 'live')
      setSelectedStageId((liveStage ?? stages[0]).id)
    }
  }, [stages, selectedStageId])

  const fetchEliteCrisis = useCallback(async (stageId: string, silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setIsPolling(true)
    try {
      const res = await fetch(`/api/world-cup/elite-crisis?stageId=${stageId}`)
      if (res.ok) {
        const data = await res.json()
        setEliteData(data.elite || null)
        setCrisisData(data.crisis || null)
        if (data.buzzSource) setBuzzSource(data.buzzSource)
        if (data.lastUpdated) {
          setLastUpdated(data.lastUpdated)
          setSecondsAgo(0)
        }
      }
    } catch (err) {
      console.error('Failed to fetch elite-crisis:', err)
    } finally {
      if (!silent) setLoading(false)
      if (silent) setIsPolling(false)
    }
  }, [])

  useEffect(() => {
    if (selectedStageId) {
      setBuzzSource('baseline')
      setLastUpdated(null)
      setSecondsAgo(0)
      fetchEliteCrisis(selectedStageId)
    }
  }, [selectedStageId, fetchEliteCrisis])

  // Derive the selected stage + status here (BEFORE the effects below that
  // reference isR32Live — avoids a temporal-dead-zone ReferenceError).
  const selectedStage = stages.find(s => s.id === selectedStageId)
  const stageStatus = selectedStage?.status ?? 'upcoming'
  // R32 live stage drives the stock-ticker polling + movement chips.
  const isR32Live = stageStatus === 'live' && selectedStage?.name === 'Round of 32'

  // R32 stock-ticker: poll every 30s when the selected stage is LIVE.
  // Group Stage is locked/historical — no polling, no movement chips.

  useEffect(() => {
    if (!isR32Live || !selectedStageId) return
    const interval = setInterval(() => {
      fetchEliteCrisis(selectedStageId, true)
    }, 30000)
    return () => clearInterval(interval)
  }, [isR32Live, selectedStageId, fetchEliteCrisis])

  // "Updated Xs ago" counter — ticks every second.
  useEffect(() => {
    if (!lastUpdated) return
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  // NOTE: The client-side cron trigger that previously lived here was removed
  // for security — it hardcoded the admin password in the JS bundle, leaking
  // it to anyone viewing page source. The live-buzz refresh (r16-cron /
  // r32-cron) MUST now be triggered by an external server-side scheduler
  // (fly cron, systemd timer, cron-job.org, etc.) hitting the cron endpoint
  // with the X-Cron-Secret header. The 30s elite-crisis polling below still
  // picks up any refreshes the external scheduler performs.

  // Fetch pulse breakdown whenever a player is selected
  useEffect(() => {
    if (!selectedPlayerId) {
      setPulseBreakdown(null)
      setPulseError(null)
      return
    }
    let cancelled = false
    setPulseLoading(true)
    setPulseError(null)
    async function loadBreakdown() {
      try {
        const res = await fetch(`/api/pulse-score?playerId=${encodeURIComponent(selectedPlayerId!)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setPulseBreakdown(data)
      } catch (err) {
        console.error('Failed to fetch pulse breakdown:', err)
        if (!cancelled) setPulseError('Failed to load pulse breakdown. Please try again.')
      } finally {
        if (!cancelled) setPulseLoading(false)
      }
    }
    loadBreakdown()
    return () => { cancelled = true }
  }, [selectedPlayerId])

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

  const organizeFormationLandscape = (players: WCSelectionPlayer[]) => {
    const gk = players.filter(p => p.position === 'GK')
    const def = players.filter(p => ['CB', 'LB', 'RB'].includes(p.position))
    const mid = players.filter(p => ['CM', 'CAM', 'CDM'].includes(p.position))
    const fwd = players.filter(p => ['LW', 'RW', 'ST', 'CF'].includes(p.position))
    return [gk, def, mid, fwd]  // Landscape: GK on left, FWD on right
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('wc.new_stage')}</p>
        </div>
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

          {/* Empty state — stage is live/completed but no selections seeded yet */}
          {!currentData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-[#E0E0E0]/50 dark:border-white/5 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-12 px-4 text-center"
            >
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#6C2BD9]/10 dark:bg-[#6C2BD9]/20">
                <ShieldCheck className="size-6 text-[#6C2BD9] dark:text-[#8B5CF6]" />
              </div>
              <p className="text-base font-bold text-[#1A1A1A] dark:text-white">
                {t('wc.lineups_pending_title')}
              </p>
              <p className="mt-2 max-w-md text-sm text-[#666] dark:text-[#CCCCCC]">
                {t('wc.lineups_pending_desc')}
              </p>
              {stages.find(s => s.order === 1) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const gs = stages.find(s => s.order === 1)
                    if (gs) setSelectedStageId(gs.id)
                  }}
                  className="mt-4 gap-1.5 border-[#6C2BD9]/30 text-[#6C2BD9] dark:text-[#8B5CF6] hover:bg-[#6C2BD9]/5"
                >
                  <ArrowLeft className="size-3.5" />
                  {t('wc.lineups_pending_btn')}
                </Button>
              )}
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
                <div className={`h-0.5 w-full ${activeView === 'elite' ? 'bg-gradient-to-r from-[#6C2BD9] via-[#8B5CF6] to-[#FF6B35]' : 'bg-gradient-to-r from-[#EF4444] via-[#DC2626] to-[#FF6B35]'}`} />
                <CardHeader className="py-2 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{activeView === 'elite' ? '🌟' : '⚠️'}</span>
                    <CardTitle className={`text-sm font-bold ${activeView === 'elite' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#EF4444] dark:text-[#F87171]'}`}>
                      {activeView === 'elite' ? t('wc.pulse_elite') : t('wc.crisis_radar')}
                    </CardTitle>
                    <div className="ml-auto flex items-center gap-2">
                      {/* R32 buzz badge — VERIFIED BUZZ (baseline) or LIVE BUZZ (live) */}
                      {isR32Live && (
                        <Badge
                          className={`gap-1 text-[9px] px-1.5 py-0 border-0 ${
                            buzzSource === 'live'
                              ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                              : 'bg-[#6C2BD9]/15 text-[#6C2BD9] dark:text-[#8B5CF6]'
                          }`}
                          title={
                            buzzSource === 'live'
                              ? 'LIVE BUZZ — refreshed from real web_search'
                              : 'VERIFIED BUZZ — baseline captured 2026-07-02, refreshing live'
                          }
                        >
                          {buzzSource === 'live' ? (
                            <>
                              <Zap className="size-2.5" />
                              <span className="relative flex size-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B35] opacity-75" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-[#FF6B35]" />
                              </span>
                              LIVE BUZZ
                              {isPolling && <span className="opacity-70">…</span>}
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="size-2.5" />
                              VERIFIED BUZZ
                            </>
                          )}
                        </Badge>
                      )}
                      {/* Flag/Emoji Toggle Switch */}
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold transition-colors ${flagMode === 'emoji' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#999] dark:text-[#666]'}`}>Emoji</span>
                        <Switch
                          checked={flagMode === 'flag'}
                          onCheckedChange={() => toggleFlag()}
                          className="data-[state=checked]:bg-[#6C2BD9] data-[state=unchecked]:bg-[#6C2BD9]/40 scale-75"
                        />
                        <span className={`text-[10px] font-bold transition-colors ${flagMode === 'flag' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#999] dark:text-[#666]'}`}>Flag</span>
                      </div>
                      {stageStatus === 'completed' && (
                        <Badge className="bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border-[#E0E0E0] dark:border-white/10 gap-1 text-[9px] px-1.5 py-0">
                          <Lock className="size-2.5" /> 🔒
                        </Badge>
                      )}
                      {stageStatus === 'live' && <LiveBadge />}
                    </div>
                  </div>
                  {/* R32 subtitle — ranked-by-real-web-buzz freshness line */}
                  {isR32Live && (
                    <p className="mt-0.5 text-[10px] text-[#666] dark:text-[#CCCCCC]">
                      Ranked by real web buzz —{' '}
                      {buzzSource === 'live'
                        ? `updated ${secondsAgo}s ago`
                        : 'captured 2026-07-02, refreshing live'}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pb-3 pt-0 px-4">
                  <div className="mx-auto max-w-[520px]">
                    {/* R32 LIVE TICKER — horizontally scrolling biggest movers. */}
                    {isR32Live && buzzSource === 'live' && currentData && (() => {
                      const movers = currentData.players
                        .filter((p) => typeof p.scoreDelta === 'number' && Math.abs(p.scoreDelta!) > 1)
                        .sort((a, b) => Math.abs(b.scoreDelta!) - Math.abs(a.scoreDelta!))
                        .slice(0, 5)
                      if (movers.length === 0) return null
                      const items = movers.map((p) =>
                        `${p.name} ${p.scoreDelta! > 0 ? '↑' : '↓'}${Math.abs(p.scoreDelta!).toFixed(0)}`
                      ).join(' · ')
                      return (
                        <div
                          className="mb-2 overflow-hidden rounded-md bg-[#1A1A1A] dark:bg-black/60 py-1"
                          title="Live ticker — biggest buzz movers in the last refresh"
                        >
                          <div className="ticker-scroll whitespace-nowrap text-[9px] font-bold text-[#FF6B35]">
                            <span className="mx-2">📊 LIVE TICKER</span>
                            <span className="mx-2 text-white/90">{items}</span>
                            <span className="mx-2 text-white/90">{items}</span>
                          </div>
                        </div>
                      )
                    })()}
                    {/* Formation Pitch - compact landscape */}
                    <div className={`pitch-bg relative ${activeView === 'crisis' ? 'crisis-pitch' : ''}`}>
                      {/* Football Pitch Markings - SVG overlay */}
                      <PitchMarkings crisis={activeView === 'crisis'} />

                      {/* Player Formation Columns - landscape layout GK→DEF→MID→FWD */}
                      <div className="relative z-10 px-1.5 py-1 flex justify-between items-center h-full">
                        {organizeFormationLandscape(currentData.players).map((col, ci) => (
                          <div key={ci} className="flex flex-col items-center gap-0.5">
                            {col.map((player) => (
                              <FormationPlayerCard
                                key={player.id}
                                player={player}
                                type={activeView}
                                stageStatus={stageStatus}
                                onPlayerClick={(p) => setSelectedPlayerId(p.id)}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
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
                { label: t('wc.elite_avg'), value: (eliteData.players.reduce((a, p) => a + p.pulseScore, 0) / eliteData.players.length / 10).toFixed(1), icon: TrendingUp, color: 'text-[#6C2BD9]', emoji: '🤩' },
                { label: t('wc.crisis_avg'), value: (crisisData.players.reduce((a, p) => a + p.pulseScore, 0) / crisisData.players.length / 10).toFixed(1), icon: TrendingDown, color: 'text-[#EF4444]', emoji: '😟' },
                { label: t('wc.live_players'), value: [...eliteData.players, ...crisisData.players].filter(p => p.isLive).length, icon: Activity, color: 'text-[#FF6B35]', emoji: '' },
                { label: t('wc.total_votes'), value: totalVotes.toLocaleString(), icon: Users, color: 'text-[#1A1A1A] dark:text-white', emoji: '' },
              ].map((stat, i) => (
                <Card key={i} className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                  <CardContent className="p-3 text-center">
                    <stat.icon className={`mx-auto size-4 mb-1.5 ${stat.color}`} />
                    <p className={`text-lg font-black ${stat.color}`}>{stat.emoji} {stat.value}</p>
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC]">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Pulse Score breakdown modal — opens on player click */}
      <AnimatePresence>
        {selectedPlayerId && (
          <>
            <motion.div
              key="pulse-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayerId(null)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="pulse-modal"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
            >
              <Card className="pointer-events-auto w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border-[#E0E0E0]/50 dark:border-white/10 shadow-2xl bg-white dark:bg-[#1A1A1A]">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 bg-white dark:bg-[#1A1A1A] border-b border-[#E0E0E0]/50 dark:border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {pulseBreakdown ? (
                      <>
                        <span className="text-2xl shrink-0">
                          <FlagImage nationCode={pulseBreakdown.player.nationCode} size={32} fallbackEmoji={getFlag(pulseBreakdown.player.nationCode)} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
                            {pulseBreakdown.player.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                              {pulseBreakdown.player.position}
                            </Badge>
                            <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                              {pulseBreakdown.player.nationCode}
                            </span>
                            {pulseBreakdown.player.isLive && <LiveBadge />}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-24 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                          <div className="h-2 w-16 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedPlayerId(null)}
                    aria-label="Close"
                    className="shrink-0 rounded-full size-7 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Body */}
                <CardContent className="p-4">
                  {pulseLoading && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin size-8 rounded-full border-2 border-[#6C2BD9]/30 border-t-[#6C2BD9]" />
                      </div>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="h-3 w-32 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                          <div className="h-2 w-full rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                          <div className="h-2 w-48 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}

                  {pulseError && !pulseLoading && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <AlertTriangle className="size-8 text-[#EF4444] mb-2" />
                      <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">{pulseError}</p>
                      <Button
                        onClick={() => setSelectedPlayerId(prev => (prev ? null : prev))}
                        className="mt-3 bg-[#6C2BD9] hover:bg-[#5A1FBF] text-white text-xs font-bold h-8 rounded-lg"
                      >
                        Close
                      </Button>
                    </div>
                  )}

                  {pulseBreakdown && !pulseLoading && !pulseError && (
                    <div className="space-y-4">
                      {/* Overall score — big and colored */}
                      <div className="flex items-center justify-between rounded-xl bg-[#F8F9FA] dark:bg-[#2D2D2D] p-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
                            Overall Pulse Score
                          </p>
                          <p className="text-[10px] text-[#999] dark:text-gray-500">
                            Weighted blend of 4 components
                          </p>
                        </div>
                        <div
                          className={`flex items-center justify-center size-14 rounded-xl text-2xl font-black text-white shadow-md ${getPulseScoreColorClass(pulseBreakdown.pulseScore.overall)}`}
                          style={{ backgroundColor: getPulseScoreColor(pulseBreakdown.pulseScore.overall) }}
                        >
                          {Math.round(pulseBreakdown.pulseScore.overall)}
                        </div>
                      </div>

                      {/* 4 weighted components */}
                      {[
                        {
                          label: 'Match Performance',
                          weight: pulseBreakdown.weights.matchPerformance,
                          value: pulseBreakdown.pulseScore.matchPerformance,
                          note: pulseBreakdown.pulseScore.matchPerformanceNote,
                          emoji: '⚽',
                        },
                        {
                          label: 'Fan Sentiment',
                          weight: pulseBreakdown.weights.fanSentiment,
                          value: pulseBreakdown.pulseScore.fanSentiment,
                          note: pulseBreakdown.pulseScore.fanSentimentNote,
                          emoji: '💬',
                          meta: pulseBreakdown.fanSentimentMeta,
                        },
                        {
                          label: 'AI Narrative',
                          weight: pulseBreakdown.weights.aiNarrative,
                          value: pulseBreakdown.pulseScore.aiNarrative,
                          note: pulseBreakdown.pulseScore.aiNarrativeNote,
                          emoji: '🤖',
                        },
                        {
                          label: 'Momentum Trend',
                          weight: pulseBreakdown.weights.momentumTrend,
                          value: pulseBreakdown.pulseScore.momentumTrend,
                          note: pulseBreakdown.pulseScore.momentumTrendNote,
                          emoji: '📈',
                        },
                      ].map((c) => (
                        <div key={c.label} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{c.emoji}</span>
                              <span className="text-xs font-bold text-[#1A1A1A] dark:text-white">
                                {c.label}
                              </span>
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                                {Math.round(c.weight * 100)}%
                              </Badge>
                            </div>
                            <span className="text-sm font-black text-[#1A1A1A] dark:text-white">
                              {Math.round(c.value)}
                            </span>
                          </div>
                          <Progress
                            value={c.value}
                            className="h-2 progress-purple"
                          />
                          <p className="text-[10px] leading-relaxed text-[#666] dark:text-[#CCCCCC]">
                            {c.note}
                          </p>
                          {/* Real fan sentiment metadata — only shown when FeedMonitor data exists */}
                          {c.meta && c.meta.postCount > 0 && (
                            <div className="mt-1.5 rounded-md bg-[#10B981]/5 border border-[#10B981]/20 p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#10B981] uppercase tracking-wider">
                                <span className="inline-block size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                Based on {c.meta.postCount} real fan post{c.meta.postCount === 1 ? '' : 's'} · {c.meta.freshnessLabel}
                              </div>
                              {c.meta.topQuotes && c.meta.topQuotes.length > 0 && (
                                <div className="space-y-1">
                                  {c.meta.topQuotes.slice(0, 2).map((q, i) => (
                                    <div key={i} className="text-[10px] italic text-[#1A1A1A] dark:text-white/80 leading-relaxed pl-2 border-l-2 border-[#10B981]/40">
                                      &ldquo;{q.quote}&rdquo;
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Weights footnote */}
                      <div className="rounded-lg bg-[#6C2BD9]/5 dark:bg-[#6C2BD9]/10 border border-[#6C2BD9]/20 p-2.5">
                        <p className="text-[9px] font-mono text-center text-[#6C2BD9] dark:text-[#8B5CF6]">
                          Overall = 0.40×Match + 0.25×Fan + 0.20×AI + 0.15×Momentum
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Paused Tab Overlay ──────────────────────────────────────

function PausedTabOverlay({ tabName }: { tabName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex items-center justify-center size-20 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10 mb-6">
        <Lock className="size-8 text-[#FF6B35]" />
      </div>
      <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white mb-2">{tabName}</h3>
      <p className="text-sm text-[#666] dark:text-[#CCCCCC] mb-4 max-w-xs">This feature is coming soon. We&apos;re working hard to bring you the best experience.</p>
      <Badge className="bg-[#FF6B35]/15 text-[#FF6B35] border-0 gap-1.5 px-3 py-1.5 text-xs font-bold">
        <Clock className="size-3.5" />
        COMING SOON
      </Badge>
    </div>
  )
}

// ── Pitch Markings SVG Overlay ──────────────────────────────

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
        <rect x="6" y="105" width="25" height="90" />
        <path d="M 66 110 A 36 36 0 0 1 66 190" />
        <circle cx="40" cy="150" r="3" fill={dotFill} />
        {/* Right penalty area */}
        <rect x="334" y="70" width="60" height="160" />
        <rect x="369" y="105" width="25" height="90" />
        <path d="M 334 110 A 36 36 0 0 0 334 190" />
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

// ── Main Page ────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [stages, setStages] = useState<WCStage[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadStages() {
      try {
        // NOTE: the seed endpoint is no longer called on every page load.
        // It was causing a DB count() query per visitor and is also an
        // admin-gated destructive route now. Seeding happens once at deploy
        // time (see docker-entrypoint.sh + DEPLOY.md).
        const res = await fetch('/api/world-cup/stages')
        if (res.ok && !cancelled) {
          const data = await res.json()
          setStages(data.stages || [])
        }
      } catch (err) {
        console.error('Failed to load stages:', err)
      }
    }
    loadStages()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#1A1A1A]">
      <div className="flex">
        {/* Sidebar */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main content area */}
        <div className="flex-1 md:ml-60 min-w-0 min-h-screen flex flex-col">
          <TopHeader activeTab={activeTab} />

          <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-6">
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
                {activeTab === 'rate' && <PausedTabOverlay tabName="Rate" />}
                {activeTab === 'goals' && <PausedTabOverlay tabName="Goals" />}
                {activeTab === 'totw' && <PausedTabOverlay tabName="Team of the Week" />}
                {activeTab === 'worldcup' && <WorldCupTab stages={stages} />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Desktop footer — sticky to bottom via mt-auto in the flex-col.
              Hidden on mobile where the fixed bottom nav serves as the footer. */}
          <footer className="hidden md:block mt-auto border-t border-[#E0E0E0] dark:border-white/10 px-4 py-3 text-center text-[11px] text-[#666] dark:text-[#999]">
            Fan Pulse © 2026 · World Cup 2026 Real-Time Fan Sentiment Dashboard
          </footer>
        </div>
      </div>
    </div>
  )
}
