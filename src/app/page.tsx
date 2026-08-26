'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, Minus, Play, Star, AlertTriangle,
  Lock, Clock, Zap, Shield, ShieldCheck, CircleDot,
  Sparkles, BarChart3, Users, Timer, Share2, Eye, Flame, Trophy, X, ChevronRight, Check, ArrowLeft,
  MessageCircle, ExternalLink, BadgeCheck
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FanCardButton } from '@/components/common/FanCardButton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import TopHeader from '@/components/TopHeader'
import Navigation, { type TabId } from '@/components/Navigation'
import TransfersTab from '@/components/tabs/TransfersTab'
import TeamOfTheWeekTab from '@/components/TeamOfTheWeekTab'
import FPLTab from '@/components/FPLTab'
import StoryCircle from '@/components/Stories/StoryCircle'
import StoryViewer from '@/components/Stories/StoryViewer'
import { useStories, useViewedStories } from '@/hooks/queries/use-stories'
import { type PulseStory } from '@/lib/story-generator'
import { useLanguage } from '@/context/LanguageContext'
import { findNationalTeam, NATIONAL_TEAMS } from '@/lib/national-teams'
import { EPL_CLUBS, findEPLClub } from '@/lib/epl-clubs'
import { useFlagMode } from '@/lib/flag-mode'
import FlagImage from '@/components/common/FlagImage'
import ClubLogo from '@/components/common/ClubLogo'
import { FanTalkPanel } from '@/components/FanTalkPanel'
import { TournamentRetroModal } from '@/components/TournamentRetroTab'
import { CardCollectionModal } from '@/components/CardCollectionModal'
import { ShareNudge } from '@/components/ShareNudge'
import PlayerCard from '@/components/PlayerCard'
import { getCardTier } from '@/lib/player-card-tiers'
import { VERIFIED_YOUNG_BREAKOUT_NAMES } from '@/lib/player-card-tiers'
import type { PlayerCardData } from '@/lib/player-card-data'
import { fromSentimentPlayer } from '@/lib/player-card-data'
import { useCardCollection } from '@/hooks/use-card-collection'
import { getPulseScoreColor, getPulseScoreColorClass } from '@/types'
import { toast } from 'sonner'

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

// Mood emoji options for the vote modal — reused for EPL club voting.
// (Previously also used by the national-team Fan Mood carousel which has
// been removed; the World Cup is over and the app has pivoted to EPL.)
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

// ── Types for the new Home dashboard sections ────────────────────────────────
interface BallonDorContender {
  name: string
  nationCode: string
  position: string
  clubName: string
  clubCode: string
  ballonDorScore: number
  trend: 'rising' | 'stable' | 'falling'
  reason: string
  awardWon?: string
  verifiedMatchFact: string
}
interface BallonDorData {
  contenders: BallonDorContender[]
  movers: { biggestRiser: BallonDorContender | null; biggestFaller: BallonDorContender | null }
  framing: {
    title: string
    subtitle: string
    tagline: string
    disclaimer: string
    lastUpdated: string
    ceremonyDate: string
  }
}
interface TransferTweet {
  author: string
  authorHandle: string
  outlet: string
  content: string
  url: string
  postedAt: string | null
  sentimentScore: number
  sentimentLabel: 'positive' | 'neutral' | 'negative'
}

// ── Transfer Saga summary (from /api/transfers) ──────────────────────────────
// Used for the "Latest Transfer Tweets" section which now shows top transfer
// sagas (with fan breakdown: excitedPct / skepticalPct / dreadingPct) instead
// of raw tweets. Sagas are richer — they aggregate Tier 1 journalist posts +
// fan sentiment into a single "buzz" card with a curiosity-gap reveal.
interface TransferSagaSummary {
  id: string
  playerName: string
  playerNationCode: string
  fromClubCode: string
  fromClubName: string
  toClubCode: string
  toClubName: string
  status: string
  feeReported: string
  tier1Count: number
  fanReadLikelihood: number
  buzzVolume: number
  buzzTrend: string
  excitedPct: number
  skepticalPct: number
  dreadingPct: number
  avgSentiment: number
  firstReportedAt: string
  lastUpdatedAt: string
  topSources: {
    journalistName: string
    journalistHandle: string
    outlet: string
    url: string | null
    headline: string
    reportedAt: string
  }[]
}

// ── EPL Fixtures (upcoming EPL games, FotMob-style) ──────────────────────────
// Fetched from /api/epl/upcoming which proxies the FPL API (real fixtures
// only — see src/lib/epl-fixtures.ts for the anti-hallucination contract).
interface EPLFixture {
  id: string
  homeTeamCode: string
  homeTeamName: string
  homeTeamBadge: string
  awayTeamCode: string
  awayTeamName: string
  awayTeamBadge: string
  kickoffAt: string // ISO 8601
  kickoffLabel: string
  competition: string
  matchweek: number
  venue?: string
  status: 'upcoming' | 'live' | 'completed'
  homeScore?: number
  awayScore?: number
}

// ── EPL Club Mood (replaces the national-team Fan Mood section) ──────────────
// Aggregated from FanVote rows where teamCode is an EPL club code (ARS, CHE,
// LIV, etc.). The fan-vote API accepts any 3-letter code, so no API change
// was needed — we just use EPL codes in the frontend instead of national
// team codes.
interface EPLClubMood {
  teamCode: string
  teamName: string
  avgScore: number
  voteCount: number
  moodEmoji: string
}

function HomeTab({ stories, viewedIds, onOpenStories, onOpenCardCollection }: {
  stories: PulseStory[]
  viewedIds: Set<string>
  onOpenStories: (startIndex: number) => void
  onOpenCardCollection: () => void
}) {
  // ── Card data converters (verified data → PlayerCardData) ──────────────────
  // These map the API responses to the unified PlayerCardData shape using the
  // verified tier logic from player-card-tiers.ts. NO scores are invented.
  const ballonDorToCardData = (c: BallonDorContender): PlayerCardData => {
    const isAwardWinner = !!c.awardWon
    const isYoungBreakout = VERIFIED_YOUNG_BREAKOUT_NAMES.has(c.name)
    return {
      id: `ballon-dor:${c.name}`,
      name: c.name,
      nationCode: c.nationCode,
      position: c.position,
      pulseScore: c.ballonDorScore,
      scoreLabel: "Ballon d'Or",
      trend: c.trend,
      clubName: c.clubName,
      clubCode: c.clubCode,
      isAwardWinner,
      awardName: c.awardWon,
      isYoungBreakout,
      tier: getCardTier(c.ballonDorScore, c.trend, isAwardWinner, isYoungBreakout),
      verifiedNote: c.verifiedMatchFact,
      source: "Ballon d'Or Race",
    }
  }

  const transferToCardData = (s: TransferSagaSummary): PlayerCardData => {
    const score = Math.round(s.avgSentiment)
    const trend = (s.buzzTrend === 'rising' || s.buzzTrend === 'falling' ? s.buzzTrend : 'stable') as 'rising' | 'stable' | 'falling'
    const isYoungBreakout = VERIFIED_YOUNG_BREAKOUT_NAMES.has(s.playerName)
    const topSrc = s.topSources[0]
    return {
      id: `transfer:${s.id}`,
      name: s.playerName,
      nationCode: s.playerNationCode,
      position: '—',
      pulseScore: score,
      scoreLabel: 'Fan Sentiment',
      trend,
      clubName: s.toClubName || s.fromClubName,
      clubCode: s.toClubCode || s.fromClubCode,
      isAwardWinner: false,
      isYoungBreakout,
      tier: getCardTier(score, trend, false, isYoungBreakout),
      verifiedNote: topSrc ? `${topSrc.journalistName} (${topSrc.outlet})` : `Fan-read ${s.fanReadLikelihood}%`,
      source: 'Transfer Pulse',
      // Wikipedia/CC-BY-SA photo URL for the transfer target player.
      // NULL when no photo → PlayerCard shows initials-on-purple fallback.
      photoUrl: s.playerPhotoUrl ?? null,
    }
  }
  const { t } = useLanguage()
  const { markSeen: markCardSeen } = useCardCollection()
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'EPL' | 'WC'>('EPL')
  const [apiMatches, setApiMatches] = useState<Array<{
    id: string; home: string; away: string; homeFlag: string; awayFlag: string
    score: string; homeSentiment: number; awaySentiment: number; live: boolean; league: string
    status: string; group: string; matchDate: string
  }>>([])

  // ── NEW: Ballon d'Or + Transfer Tweets state ──
  const [ballonDor, setBallonDor] = useState<BallonDorData | null>(null)
  const [ballonDorLoading, setBallonDorLoading] = useState(true)
  const [showAllBallonDor, setShowAllBallonDor] = useState(false)
  const [transferTweets, setTransferTweets] = useState<TransferTweet[]>([])
  const [tweetsLoading, setTweetsLoading] = useState(true)

  // ── Transfer Sagas state (for the curiosity-gap transfer cards) ──
  const [transferSagas, setTransferSagas] = useState<TransferSagaSummary[]>([])
  const [sagasLoading, setSagasLoading] = useState(true)
  // Track which saga cards have their fan breakdown revealed (curiosity gap).
  // Stored as a Set of saga IDs — click "See Fan Reaction" to add the ID.
  const [revealedSagas, setRevealedSagas] = useState<Set<string>>(new Set())

  // Fan vote state
  const [sessionId, setSessionId] = useState<string>('')
  const [fanVotes, setFanVotes] = useState<FanVoteAgg[]>([])
  const [myVotes, setMyVotes] = useState<Array<{ teamCode: string; score: number }>>([])
  const [selectedVoteTeam, setSelectedVoteTeam] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; emoji: string } | null>(null)
  const [fanCardOffer, setFanCardOffer] = useState<{ teamCode: string; score: number } | null>(null)

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch('/api/recent-matches?limit=12')
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
      try {
        const res = await fetch(`/api/fan-vote?session=${encodeURIComponent(sessionId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFanVotes(Array.isArray(data.votes) ? data.votes : [])
        setMyVotes(Array.isArray(data.myVotes) ? data.myVotes : [])
      } catch (err) {
        console.error('Failed to fetch fan votes:', err)
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

  // ── NEW: Fetch Ballon d'Or data (cached 1h server-side) ──
  useEffect(() => {
    let cancelled = false
    async function loadBallonDor() {
      setBallonDorLoading(true)
      try {
        const res = await fetch('/api/ballon-dor')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data && Array.isArray(data.contenders)) {
          setBallonDor(data as BallonDorData)
        }
      } catch (err) {
        console.error('Failed to fetch Ballon d\'Or:', err)
      } finally {
        if (!cancelled) setBallonDorLoading(false)
      }
    }
    loadBallonDor()
    return () => { cancelled = true }
  }, [])

  // ── NEW: Fetch Latest Transfer Tweets (cached 10min server-side) ──
  useEffect(() => {
    let cancelled = false
    async function loadTweets() {
      setTweetsLoading(true)
      try {
        const res = await fetch('/api/transfer-tweets?limit=6')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data && Array.isArray(data.tweets)) {
          setTransferTweets(data.tweets as TransferTweet[])
        }
      } catch (err) {
        console.error('Failed to fetch transfer tweets:', err)
      } finally {
        if (!cancelled) setTweetsLoading(false)
      }
    }
    loadTweets()
    return () => { cancelled = true }
  }, [])

  // ── Fetch top transfer sagas (for the curiosity-gap transfer cards) ──
  // Sorted by buzzVolume desc server-side. We show the top 6 active sagas.
  useEffect(() => {
    let cancelled = false
    async function loadSagas() {
      setSagasLoading(true)
      try {
        const res = await fetch('/api/transfers?limit=6&status=active')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data && Array.isArray(data.sagas)) {
          setTransferSagas(data.sagas as TransferSagaSummary[])
        }
      } catch (err) {
        console.error('Failed to fetch transfer sagas:', err)
      } finally {
        if (!cancelled) setSagasLoading(false)
      }
    }
    loadSagas()
    return () => { cancelled = true }
  }, [])

  // ── EPL fixtures (FotMob-style upcoming games, top of Home tab) ──
  // Real fixtures from FPL API via /api/epl/upcoming. Honest empty state
  // when no fixtures available (off-season or API down). NEVER fabricated.
  const [eplFixtures, setEplFixtures] = useState<EPLFixture[]>([])
  const [eplFixturesLoading, setEplFixturesLoading] = useState(true)
  const [eplFixturesAvailable, setEplFixturesAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadEplFixtures() {
      setEplFixturesLoading(true)
      try {
        const res = await fetch('/api/epl/upcoming?limit=8')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setEplFixtures(Array.isArray(data.fixtures) ? data.fixtures : [])
        setEplFixturesAvailable(!!data.available)
      } catch (err) {
        console.error('Failed to fetch EPL fixtures:', err)
      } finally {
        if (!cancelled) setEplFixturesLoading(false)
      }
    }
    loadEplFixtures()
    return () => { cancelled = true }
  }, [])

  // ── EPL club mood (replaces national-team Fan Mood carousel) ──
  // Aggregated FanVote rows for EPL clubs. Honest empty state when no
  // votes exist yet ("Be the first to vote" CTA).
  const [eplClubMoods, setEplClubMoods] = useState<EPLClubMood[]>([])
  const [eplMoodsLoading, setEplMoodsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadEplMoods() {
      setEplMoodsLoading(true)
      try {
        const res = await fetch('/api/epl/fan-mood')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setEplClubMoods(Array.isArray(data.moods) ? data.moods : [])
      } catch (err) {
        console.error('Failed to fetch EPL club mood:', err)
      } finally {
        if (!cancelled) setEplMoodsLoading(false)
      }
    }
    loadEplMoods()
    return () => { cancelled = true }
  }, [])

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
    : matchFilter === 'EPL'
    ? apiMatches.filter(m => m.league === 'EPL' || m.status === 'upcoming')
    : apiMatches.filter(m => m.league.startsWith('WC') || m.league.startsWith('Round') || m.league.startsWith('Final') || m.league.startsWith('Semi') || m.league.startsWith('Quarter'))
  ).slice(0, 24) // Limit to 24 cards max for performance

  // ── Ballon d'Or: derived display values ──
  const ballonDorVisible = ballonDor
    ? showAllBallonDor
      ? ballonDor.contenders
      : ballonDor.contenders.slice(0, 8)
    : []
  const ballonDorHiddenCount = ballonDor
    ? Math.max(0, ballonDor.contenders.length - 8)
    : 0

  // ── Curiosity gap: toggle fan-breakdown reveal on a saga card ──
  function toggleSagaReveal(sagaId: string) {
    setRevealedSagas(prev => {
      const next = new Set(prev)
      if (next.has(sagaId)) {
        next.delete(sagaId)
      } else {
        next.add(sagaId)
      }
      return next
    })
  }

  // ── Transfer Tweets: relative-time formatter ──
  function formatRelativeTime(iso: string | null): string {
    if (!iso) return 'recently'
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return 'recently'
    const diffMs = Date.now() - then
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    const weeks = Math.floor(days / 7)
    return `${weeks}w ago`
  }

  function sentimentEmoji(label: 'positive' | 'neutral' | 'negative'): string {
    if (label === 'positive') return '🟢'
    if (label === 'negative') return '🔴'
    return '🟡'
  }

  function sentimentBorder(label: 'positive' | 'neutral' | 'negative'): string {
    if (label === 'positive') return 'border-l-[#10B981]'
    if (label === 'negative') return 'border-l-[#EF4444]'
    return 'border-l-[#F59E0B]'
  }

  // ── EPL club mood entries (replaces national-team moodTeamEntries) ──
  // Combines the server-side aggregated moods (from /api/epl/fan-mood, which
  // reads real FanVote rows) with the local fanVotes state so the carousel
  // updates optimistically when the user votes (handleVote updates fanVotes
  // + myVotes immediately, then POSTs to the API). Falls back to the static
  // EPL_CLUBS list when no votes exist yet — the UI shows the "Be the first
  // to vote" empty state in that case.
  const eplMoodEntries = useMemo(() => {
    // Merge server-side moods with local optimistic fanVotes. fanVotes wins
    // for clubs the user just voted on (optimistic update).
    const mergeFromList = (clubs: { code: string; name: string; badge: string }[]) => {
      return clubs.map((club) => {
        const server = eplClubMoods.find((m) => m.teamCode === club.code)
        const localVote = fanVotes.find((v) => v.teamCode === club.code)
        const myVote = myVotes.find((v) => v.teamCode === club.code)?.score ?? null
        const baseScore = server?.avgScore ?? localVote?.score ?? 50
        const baseCount = server?.voteCount ?? localVote?.count ?? 0
        const hasVotes = baseCount > 0
        return {
          code: club.code,
          badge: club.badge,
          name: club.name,
          score: baseScore,
          count: baseCount,
          myVote,
          moodEmoji: hasVotes
            ? (server?.moodEmoji ?? getFanMoodEmoji(baseScore))
            : '😐' as const,
        }
      })
    }

    // If we have server-side moods, use those clubs as the base (preserves the
    // vote-count sort order). Otherwise fall back to the static EPL_CLUBS list.
    if (eplClubMoods.length > 0) {
      const clubsFromServer = eplClubMoods.map((m) => ({
        code: m.teamCode,
        name: m.teamName,
        badge: findEPLClub(m.teamCode)?.badge ?? '⚽',
      }))
      return mergeFromList(clubsFromServer)
    }
    return mergeFromList(EPL_CLUBS)
  }, [eplClubMoods, fanVotes, myVotes])

  return (
    <div className="space-y-8">
      {/* ════════════════════════════════════════════════════════════════════
          POSITION 0 — PULSE STORIES (Story Mode)
          Horizontal row of circular story thumbnails. Tap to open the
          full-screen vertical story viewer (Instagram/Snapchat-style).
          This is the retention feature — the first thing Gen Z users see.
          Positioned ABOVE the hero narrative and Match Sentiments.
          ════════════════════════════════════════════════════════════════════ */}
      {stories.length > 0 && (
        <StoryCircle
          stories={stories}
          viewedIds={viewedIds}
          onOpen={onOpenStories}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          POSITION 1 — UPCOMING EPL GAMES (FotMob-style, top of page)
          Featured match hero card + compact fixture rows. Real fixtures from
          the FPL API via /api/epl/upcoming. Honest empty state when no
          fixtures are available (off-season). NEVER fabricated.
          ════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#6C2BD9]/10 dark:bg-[#8B5CF6]/15">
              <CircleDot className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
                Premier League
                {eplFixturesAvailable && eplFixtures[0]?.matchweek ? (
                  <span className="text-[10px] font-semibold text-[#666] dark:text-[#CCCCCC] ml-1">
                    · Matchweek {eplFixtures[0].matchweek}
                  </span>
                ) : null}
              </h2>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                Upcoming EPL games — fixtures &amp; fan mood
              </p>
            </div>
          </div>
          {eplFixtures.length > 0 && (
            <span className="hidden sm:inline-flex text-[11px] font-semibold text-[#6C2BD9] dark:text-[#8B5CF6] gap-0.5 items-center">
              View all <ChevronRight className="size-3" />
            </span>
          )}
        </div>

        {eplFixturesLoading ? (
          <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
            <CardContent className="p-4 space-y-2">
              <div className="h-32 rounded-xl bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
              ))}
            </CardContent>
          </Card>
        ) : eplFixtures.length === 0 ? (
          // ── HONEST EMPTY STATE — never fabricate fixtures ──
          <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
            <CardContent className="py-10 text-center">
              <Clock className="mx-auto size-7 text-[#666]/30 dark:text-[#CCCCCC]/30 mb-2" />
              <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">
                EPL fixtures loading
              </p>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] mt-1">
                Season kicks off soon — check back for the fixture list.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── FEATURED MATCH — hero glass-card (the next kickoff) ── */}
            {(() => {
              const featured = eplFixtures[0]
              const homeMood = fanVotes.find((v) => v.teamCode === featured.homeTeamCode)
              const awayMood = fanVotes.find((v) => v.teamCode === featured.awayTeamCode)
              const homeScore = homeMood?.score ?? 50
              const awayScore = awayMood?.score ?? 50
              const isLive = featured.status === 'live'
              return (
                <Card className="glass-card glass-hover border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 overflow-hidden mb-3">
                  <CardContent className="p-4 sm:p-5">
                    {/* Top row: competition + matchweek + status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] font-bold border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                          {featured.competition}
                        </Badge>
                        {featured.matchweek > 0 && (
                          <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                            · GW {featured.matchweek}
                          </span>
                        )}
                      </div>
                      {isLive ? (
                        <LiveBadge />
                      ) : featured.status === 'completed' ? (
                        <Badge variant="outline" className="text-[9px] font-bold border-[#999]/30 text-[#666] dark:text-[#999]">
                          FT
                        </Badge>
                      ) : (
                        <span className="text-[10px] font-bold text-[#FF6B35]">{featured.kickoffLabel}</span>
                      )}
                    </div>

                    {/* Teams row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      {/* Home team */}
                      <div className="flex flex-col items-center text-center">
                        <span className="mb-1"><ClubLogo code={featured.homeTeamCode} name={featured.homeTeamName} size={44} /></span>
                        <span className="text-xs sm:text-sm font-black tracking-tight text-[#1A1A1A] dark:text-white truncate w-full">
                          {featured.homeTeamName}
                        </span>
                        <span className="text-[9px] text-[#666] dark:text-[#CCCCCC]">{featured.homeTeamCode}</span>
                      </div>

                      {/* Score / kickoff center */}
                      <div className="flex flex-col items-center">
                        {featured.status === 'completed' || isLive ? (
                          <span className="text-2xl sm:text-3xl font-black tracking-wider text-[#1A1A1A] dark:text-white">
                            {featured.homeScore ?? 0} - {featured.awayScore ?? 0}
                          </span>
                        ) : (
                          <span className="text-base sm:text-lg font-black text-[#1A1A1A] dark:text-white">
                            {featured.kickoffLabel}
                          </span>
                        )}
                        {featured.venue && (
                          <span className="mt-0.5 text-[9px] text-[#666] dark:text-[#CCCCCC] truncate max-w-[120px]">
                            {featured.venue}
                          </span>
                        )}
                      </div>

                      {/* Away team */}
                      <div className="flex flex-col items-center text-center">
                        <span className="mb-1"><ClubLogo code={featured.awayTeamCode} name={featured.awayTeamName} size={44} /></span>
                        <span className="text-xs sm:text-sm font-black tracking-tight text-[#1A1A1A] dark:text-white truncate w-full">
                          {featured.awayTeamName}
                        </span>
                        <span className="text-[9px] text-[#666] dark:text-[#CCCCCC]">{featured.awayTeamCode}</span>
                      </div>
                    </div>

                    {/* Fan mood emojis row — small, beside team names */}
                    <div className="mt-3 grid grid-cols-3 items-center gap-2 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] px-3 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[9px] font-bold text-[#666] dark:text-[#CCCCCC]">{featured.homeTeamCode}</span>
                        <span className="text-xl leading-none">{getFanMoodEmoji(homeScore)}</span>
                      </div>
                      <span className="text-center text-[9px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-gray-400">
                        {t('home.fan_mood')}
                      </span>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xl leading-none">{getFanMoodEmoji(awayScore)}</span>
                        <span className="text-[9px] font-bold text-[#666] dark:text-[#CCCCCC]">{featured.awayTeamCode}</span>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 border-[#6C2BD9]/30 text-[#6C2BD9] dark:text-[#8B5CF6] dark:border-[#8B5CF6]/30 hover:bg-[#6C2BD9]/5 dark:hover:bg-[#8B5CF6]/10 text-[11px] h-8 rounded-lg font-bold"
                      >
                        <MessageCircle className="size-3" />
                        What Fans Are Saying
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-[#E0E0E0]/50 dark:border-white/10 text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] text-[11px] h-8 rounded-lg font-bold"
                      >
                        <Clock className="size-3" />
                        Set reminder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

            {/* ── COMPACT FIXTURE ROWS (the rest of the upcoming fixtures) ── */}
            {eplFixtures.length > 1 && (
              <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5 overflow-hidden">
                <CardContent className="p-2 sm:p-3">
                  <div className="divide-y divide-[#E0E0E0]/50 dark:divide-white/5">
                    {eplFixtures.slice(1).map((f, i) => {
                      const homeMood = fanVotes.find((v) => v.teamCode === f.homeTeamCode)
                      const awayMood = fanVotes.find((v) => v.teamCode === f.awayTeamCode)
                      const homeScore = homeMood?.score ?? 50
                      const awayScore = awayMood?.score ?? 50
                      const isLive = f.status === 'live'
                      return (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.04 }}
                          className="flex items-center gap-2 py-2 px-1 sm:px-2 hover:bg-[#F8F9FA] dark:hover:bg-white/[0.03] rounded-md transition-colors cursor-pointer"
                        >
                          {/* Kickoff time (left) */}
                          <div className="shrink-0 w-14 sm:w-16 text-left">
                            {isLive ? (
                              <LiveBadge />
                            ) : (
                              <span className="text-[10px] sm:text-[11px] font-bold text-[#1A1A1A] dark:text-white">
                                {f.kickoffLabel}
                              </span>
                            )}
                          </div>

                          {/* Home team + emoji */}
                          <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                            <span className="text-[11px] sm:text-xs font-bold text-[#1A1A1A] dark:text-white truncate text-right">
                              {f.homeTeamName}
                            </span>
                            <span className="text-base sm:text-lg leading-none shrink-0">{getFanMoodEmoji(homeScore)}</span>
                            <span className="shrink-0"><ClubLogo code={f.homeTeamCode} name={f.homeTeamName} size={24} /></span>
                          </div>

                          {/* Center: score or "vs" */}
                          <div className="shrink-0 w-10 text-center">
                            {f.status === 'completed' || isLive ? (
                              <span className="text-xs font-black text-[#1A1A1A] dark:text-white">
                                {f.homeScore ?? 0}-{f.awayScore ?? 0}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-[#999] dark:text-[#777]">vs</span>
                            )}
                          </div>

                          {/* Away team + emoji */}
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="shrink-0"><ClubLogo code={f.awayTeamCode} name={f.awayTeamName} size={24} /></span>
                            <span className="text-base sm:text-lg leading-none shrink-0">{getFanMoodEmoji(awayScore)}</span>
                            <span className="text-[11px] sm:text-xs font-bold text-[#1A1A1A] dark:text-white truncate">
                              {f.awayTeamName}
                            </span>
                          </div>

                          {/* Right: chevron */}
                          <ChevronRight className="size-3 text-[#999] dark:text-[#777] shrink-0" />
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          POSITION 2 — EPL FAN MOOD (replaces national-team Fan Mood)
          Horizontal carousel of EPL club cards. Tap to vote — reuses the
          existing Fan Vote API with EPL club codes (ARS, CHE, LIV, etc.).
          Honest empty state when no EPL votes exist yet.
          ════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
              EPL Fan Mood
            </h3>
            {!eplMoodsLoading && eplClubMoods.length > 0 && (
              <Badge className="bg-[#6C2BD9]/10 text-[#6C2BD9] dark:text-[#8B5CF6] border-0 text-[11px] font-bold px-2 py-0.5">
                {totalVoteCount.toLocaleString()} <span className="brutalist-number">{totalVoteCount === 1 ? 'vote' : 'votes'}</span> cast
              </Badge>
            )}
          </div>
          <span className="text-[11px] font-semibold text-[#FF6B35]">Swipe clubs to vote →</span>
        </div>
        <Card className="glass-card glass-hover border-[#E0E0E0]/50 dark:border-white/5 overflow-hidden">
          <CardContent className="p-4">
            {eplMoodsLoading ? (
              <div className="flex gap-2.5 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-28 h-36 rounded-2xl bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
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
                  {eplMoodEntries.map((entry, i) => {
                    const hasMyVote = entry.myVote !== null
                    const hasVotes = entry.count > 0
                    return (
                      <motion.button
                        key={entry.code}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        onClick={() => setSelectedVoteTeam(entry.code)}
                        className={`
                          relative shrink-0 snap-start w-28 sm:w-32 rounded-2xl border p-3 flex flex-col items-center focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
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

                        {/* Club badge (SVG crest) */}
                        <span className="leading-none"><ClubLogo code={entry.code} name={findEPLClub(entry.code)?.name} size={36} /></span>

                        {/* Mood emoji — only meaningful when hasVotes */}
                        <span className="mt-1.5 text-3xl sm:text-4xl leading-none">
                          {hasVotes ? entry.moodEmoji : '🗳️'}
                        </span>

                        {/* Club code */}
                        <span className="mt-2 text-[11px] font-black tracking-wider text-[#1A1A1A] dark:text-white">
                          {entry.code}
                        </span>

                        {/* Vote count (or empty-state CTA) */}
                        <span className="text-[8px] text-[#666] dark:text-[#CCCCCC]">
                          {hasVotes ? (
                            <><span className="brutalist-number">{entry.count}</span> {entry.count === 1 ? 'vote' : 'votes'}</>
                          ) : (
                            <>Tap to vote</>
                          )}
                        </span>

                        {/* Thin mood indicator bar */}
                        <div
                          className="mt-2 w-full rounded-full overflow-hidden"
                          style={{ height: 3, background: 'rgba(0,0,0,0.06)' }}
                        >
                          <div
                            className={`h-full rounded-full ${entry.score >= 80 ? 'sentiment-positive' : entry.score >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`}
                            style={{ width: `${hasVotes ? entry.score : 0}%`, transition: 'width 0.6s ease' }}
                          />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] text-[#6B7280] dark:text-gray-400 text-center">
              {eplClubMoods.length === 0 && !eplMoodsLoading
                ? 'Be the first to vote — tap a club to set the mood.'
                : 'Your vote is anonymous — stored only in your browser session.'}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          POSITION 3 — RECENT MATCH SENTIMENTS
          Horizontal scrollable row of match cards (mobile) / grid (desktop).
          Default filter is now "All" — the World Cup is over and is now an
          archive filter. Friendly matches still appear here while the EPL
          season ramps up.
          ════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#6C2BD9]/10 dark:bg-[#8B5CF6]/15">
              <Activity className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
                Recent Match Sentiments
                {/* Live Pulse indicator — green pulsing dot */}
                <span
                  aria-label="Live"
                  className="inline-block size-2 rounded-full bg-[#10B981] animate-live-pulse shadow-[0_0_6px_#10B981]"
                />
              </h2>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                Fan reactions from recent matches · EPL live · WC archived
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {(['EPL', 'WC', 'ALL'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setMatchFilter(filter)}
                className={`
                  rounded-full px-3 py-1.5 text-[10px] font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
                  ${matchFilter === filter
                    ? 'bg-[#6C2BD9] text-white shadow-sm'
                    : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10'
                  }
                `}
              >
                {filter === 'ALL' ? '⚽ All' : filter === 'EPL' ? '⚽ EPL' : '🏆 World Cup'}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal scroll on mobile, grid on desktop. Cards ~280px wide. */}
        {filteredMatches.length === 0 ? (
          <Card className="border-[#E0E0E0]/50 dark:border-white/5">
            <CardContent className="py-10 text-center">
              <Clock className="mx-auto size-7 text-[#666]/30 dark:text-[#CCCCCC]/30 mb-2" />
              <p className="text-sm text-[#666] dark:text-[#CCCCCC]">Syncing live EPL fixtures from Fantasy Premier League. Pulse tracking begins as soon as match data is available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2 -mx-1 px-1 md:grid md:grid-cols-2 md:overflow-visible md:snap-none lg:grid-cols-3">
            {filteredMatches.slice(0, 9).map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="shrink-0 snap-start w-[280px] md:w-auto"
              >
                <Card className="glass-card glass-hover glass-card-mobile-flat h-full border-[#E0E0E0]/50 dark:border-white/5">
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
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-gray-400">
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
                      matchId={match.id}
                    />
                    <div className="mt-3 flex items-center">
                      <SharePulseButton className="flex-1" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          POSITION 4 — LATEST TRANSFER TWEETS (with curiosity gap)
          Shows top transfer sagas (by buzzVolume) as compact cards. Each card
          displays the headline (player → club) + overall sentiment, but the
          specific fan breakdown (excitedPct / dreadingPct) is BLURRED by
          default. A "See Fan Reaction" button reveals the breakdown on click,
          forcing user engagement to get the full story.
          Includes a red/orange pulsing "Live Pulse" dot next to the header.
          ════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#FF6B35]/15">
            <MessageCircle className="size-4 text-[#FF6B35]" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#1A1A1A] dark:text-white flex items-center gap-1.5">
              Latest Transfer Tweets
              {/* Live Pulse indicator — red/orange pulsing dot for hot transfers */}
              <span
                aria-label="Hot transfers"
                className="inline-block size-2 rounded-full bg-[#FF6B35] animate-live-pulse shadow-[0_0_6px_#FF6B35]"
              />
            </h2>
            <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
              Real-time from Tier 1 journalists
            </p>
          </div>
        </div>

        <Card className="glass-card glass-hover glass-card-mobile-flat border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="p-4">
            {sagasLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                ))}
              </div>
            ) : transferSagas.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#666] dark:text-[#CCCCCC]">
                Transfer sagas are loading — we curate rumors from Tier 1 journalists to ensure accuracy.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Transfer target cards — horizontal scroll of collectible cards */}
                {transferSagas.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                    {transferSagas.map((saga) => (
                      <div key={`card-${saga.id}`} className="shrink-0">
                        <PlayerCard data={transferToCardData(saga)} size="compact" onView={markCardSeen} />
                      </div>
                    ))}
                  </div>
                )}
                {transferSagas.map((saga, i) => {
                  const revealed = revealedSagas.has(saga.id)
                  const hasFanPosts = saga.buzzVolume > 0
                  const neutralPct = Math.max(0, 100 - saga.excitedPct - saga.skepticalPct - saga.dreadingPct)
                  return (
                    <motion.div
                      key={saga.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      className="rounded-lg border-l-4 border-l-[#FF6B35] bg-[#F8F9FA] dark:bg-[#2D2D2D] p-3"
                    >
                      {/* Headline row: player → club + buzz volume */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
                              {saga.playerName}
                            </h3>
                            <ArrowLeft className="size-3 text-[#6C2BD9] dark:text-[#8B5CF6] shrink-0" />
                            <span className="text-xs font-semibold text-[#1A1A1A] dark:text-gray-200 truncate">
                              {saga.toClubName}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <BadgeCheck className="size-3 text-[#6C2BD9] dark:text-[#8B5CF6]" />
                            <span className="text-[10px] font-semibold text-[#6C2BD9] dark:text-[#8B5CF6]">
                              <span className="brutalist-number">{saga.tier1Count}</span> Tier 1
                            </span>
                            <span className="text-[10px] text-[#6B7280] dark:text-gray-400">
                              · <span className="brutalist-number">{saga.buzzVolume}</span> {saga.buzzVolume === 1 ? 'post' : 'posts'}
                            </span>
                          </div>
                        </div>
                        {/* Overall sentiment trend arrow */}
                        <div className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          saga.excitedPct >= saga.dreadingPct
                            ? 'bg-[#10B981]/10 text-[#10B981] glass-glow-green'
                            : 'bg-[#EF4444]/10 text-[#EF4444] glass-glow-red'
                        }`}>
                          {saga.buzzTrend === 'rising' && <TrendingUp className="size-3" />}
                          {saga.buzzTrend === 'falling' && <TrendingDown className="size-3" />}
                          {saga.buzzTrend === 'stable' && <Minus className="size-3" />}
                          {saga.excitedPct >= saga.dreadingPct ? 'Bullish' : 'Bearish'}
                        </div>
                      </div>

                      {/* Fan breakdown — BLURRED by default (curiosity gap) */}
                      {hasFanPosts ? (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-gray-400">
                              Fan Sentiment
                            </span>
                            <span className="text-[10px] text-[#6B7280] dark:text-gray-400">
                              {revealed ? <><span className="brutalist-number">{saga.buzzVolume}</span> posts</> : '???'}
                            </span>
                          </div>

                          {/* Stacked sentiment bar — blurred until revealed */}
                          <div className={`relative h-2 rounded-full overflow-hidden flex bg-[#F0F0F0] dark:bg-white/5 transition-all duration-300 ${!revealed ? 'blur-sm select-none' : ''}`}>
                            <div className="bg-[#10B981]" style={{ width: `${saga.excitedPct}%` }} title={`Excited ${saga.excitedPct}%`} />
                            <div className="bg-[#F59E0B]" style={{ width: `${saga.skepticalPct}%` }} title={`Skeptical ${saga.skepticalPct}%`} />
                            <div className="bg-[#EF4444]" style={{ width: `${saga.dreadingPct}%` }} title={`Dreading ${saga.dreadingPct}%`} />
                            <div className="bg-[#999]/40" style={{ width: `${neutralPct}%` }} title={`Neutral ${neutralPct.toFixed(0)}%`} />
                          </div>

                          {/* Percentage labels — blurred/hidden until revealed */}
                          <div className={`mt-1.5 flex items-center gap-2.5 text-[11px] transition-all duration-300 ${!revealed ? 'blur-sm select-none' : ''}`}>
                            <span className="flex items-center gap-1 text-[#10B981]">
                              <span className="size-1.5 rounded-full bg-[#10B981]" />
                              <span className="brutalist-number">{saga.excitedPct.toFixed(0)}%</span>
                            </span>
                            <span className="flex items-center gap-1 text-[#F59E0B]">
                              <span className="size-1.5 rounded-full bg-[#F59E0B]" />
                              <span className="brutalist-number">{saga.skepticalPct.toFixed(0)}%</span>
                            </span>
                            <span className="flex items-center gap-1 text-[#EF4444]">
                              <span className="size-1.5 rounded-full bg-[#EF4444]" />
                              <span className="brutalist-number">{saga.dreadingPct.toFixed(0)}%</span>
                            </span>
                          </div>

                          {/* "See Fan Reaction" reveal button — the curiosity gap CTA */}
                          {!revealed && (
                            <button
                              onClick={() => toggleSagaReveal(saga.id)}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 bg-[#6C2BD9]/5 dark:bg-[#8B5CF6]/10 py-1.5 text-[10px] font-bold text-[#6C2BD9] dark:text-[#8B5CF6] hover:bg-[#6C2BD9]/10 dark:hover:bg-[#8B5CF6]/20 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                            >
                              <Eye className="size-3.5" />
                              See Fan Reaction
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2.5 rounded-lg border border-dashed border-[#E0E0E0] dark:border-white/10 bg-[#F8F9FA]/50 dark:bg-white/[0.02] px-3 py-2">
                          <p className="text-[11px] text-[#6B7280] dark:text-gray-400 leading-snug">
                            No fan posts yet — sentiment will appear when fans react
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 border-t border-[#E0E0E0]/50 dark:border-white/5 pt-3">
              <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                Powered by Tier 1 journalists — Romano, Ornstein, Plettenberg, Moretto, and others. No fabricated tweets.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          POSITION 5 — BALLON D'OR RACE (full width)
          Moved to the bottom + made full-width (was previously side-by-side
          with the transfer tweets in a lg:grid-cols-2).
          ════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#F59E0B]/15">
            <Trophy className="size-4 text-[#F59E0B]" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#1A1A1A] dark:text-white">
              {ballonDor?.framing.title ?? "Ballon d'Or Race"}
            </h2>
            <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
              {ballonDor?.framing.subtitle ?? 'Who fans think should win — not a forecast of the actual award'}
            </p>
          </div>
          {/* Card Collection button — opens the gamification modal */}
          <Button
            onClick={onOpenCardCollection}
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5 border-[#6C2BD9]/20 text-[#6C2BD9] dark:text-[#8B5CF6] dark:border-[#8B5CF6]/20 hover:bg-[#6C2BD9]/5 dark:hover:bg-[#8B5CF6]/10 text-[11px] h-7"
          >
            <Sparkles className="size-3.5" />
            Cards
          </Button>
        </div>

        <Card className="glass-card glass-hover border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="p-4">
            {/* Movement highlights */}
            {ballonDor && (ballonDor.movers.biggestRiser || ballonDor.movers.biggestFaller) && (
              <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                {ballonDor.movers.biggestRiser && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/10 px-2 py-1 text-[#10B981]">
                    📈 Biggest riser: {ballonDor.movers.biggestRiser.name} ↑
                  </span>
                )}
                {ballonDor.movers.biggestFaller && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/10 px-2 py-1 text-[#EF4444]">
                    📉 Biggest faller: {ballonDor.movers.biggestFaller.name} ↓
                  </span>
                )}
              </div>
            )}

            {/* Ranked cards — #1 hero + compact cards grid */}
            {ballonDorLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                ))}
              </div>
            ) : ballonDorVisible.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#666] dark:text-[#CCCCCC]">
                Ballon d'Or Race loading — 12 contenders with verified Pulse Scores.
              </p>
            ) : (
              <div className="space-y-3">
                {/* #1 hero card — displayed prominently */}
                {ballonDorVisible[0] && (
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <PlayerCard data={ballonDorToCardData(ballonDorVisible[0])} size="full" onView={markCardSeen} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="brutalist-number text-2xl font-black text-[#F59E0B]">#{1}</span>
                        <span className="text-xs font-bold text-[#666] dark:text-[#CCCCCC]">contender</span>
                      </div>
                      <p className="text-xs text-[#666] dark:text-[#CCCCCC] leading-relaxed line-clamp-3">
                        {ballonDorVisible[0].reason}
                      </p>
                      <p className="text-[10px] italic text-[#6B7280] dark:text-gray-400 line-clamp-2">
                        {ballonDorVisible[0].verifiedMatchFact}
                      </p>
                    </div>
                  </div>
                )}

                {/* #2-N compact cards grid */}
                {ballonDorVisible.length > 1 && (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 place-items-center pt-2 border-t border-[#E0E0E0]/50 dark:border-white/5">
                    {ballonDorVisible.slice(1).map((c, i) => (
                      <motion.div
                        key={c.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <span className="text-[10px] font-black text-[#F59E0B]">#{i + 2}</span>
                        <PlayerCard data={ballonDorToCardData(c)} size="compact" onView={markCardSeen} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* See full rankings toggle */}
                {ballonDorHiddenCount > 0 && (
                  <button
                    onClick={() => setShowAllBallonDor(!showAllBallonDor)}
                    className="w-full rounded-lg border border-[#E0E0E0]/50 dark:border-white/10 py-1.5 text-[10px] font-bold text-[#6C2BD9] dark:text-[#8B5CF6] hover:bg-[#6C2BD9]/5 dark:hover:bg-[#8B5CF6]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                  >
                    {showAllBallonDor ? '▲ Show top 8' : `▼ See full rankings (+${ballonDorHiddenCount} more)`}
                  </button>
                )}
              </div>
            )}

            {/* Tagline footer */}
            {ballonDor && (
              <div className="mt-3 border-t border-[#E0E0E0]/50 dark:border-white/5 pt-3">
                <p className="text-[11px] italic text-[#666] dark:text-[#CCCCCC]">
                  {ballonDor.framing.tagline}
                </p>
                <p className="mt-1 text-[11px] text-[#6B7280] dark:text-gray-400">
                  Updated {ballonDor.framing.lastUpdated} · Ceremony in {ballonDor.framing.ceremonyDate}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

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
                      <span className="leading-none">
                        <ClubLogo code={selectedVoteTeam} name={findEPLClub(selectedVoteTeam)?.name} size={26} />
                      </span>
                      {findEPLClub(selectedVoteTeam)?.name ?? selectedVoteTeam} Mood
                    </CardTitle>
                    <button
                      onClick={() => !submitting && setSelectedVoteTeam(null)}
                      aria-label="Close"
                      className="rounded-full size-7 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <CardDescription className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                    How are fans of {findEPLClub(selectedVoteTeam)?.name ?? selectedVoteTeam} feeling right now?
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
                        className="flex flex-col items-center gap-1 rounded-xl border border-[#E0E0E0] dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-2 px-1 transition-all duration-200 hover:border-[#6C2BD9]/50 hover:bg-[#6C2BD9]/5 dark:hover:bg-[#6C2BD9]/10 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                      >
                        <span className="text-2xl leading-none">{opt.emoji}</span>
                        <span className={`h-1 w-6 rounded-full ${opt.color}`} />
                        <span className="text-[8px] font-bold text-[#666] dark:text-[#CCCCCC]">{opt.score}</span>
                      </motion.button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-center text-[#666] dark:text-[#CCCCCC]">
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
              <span className="text-[11px] text-white/60 dark:text-[#666]">
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
              className="ml-1 rounded-full size-6 flex items-center justify-center text-white/40 dark:text-[#1A1A1A]/40 hover:text-white/70 dark:hover:text-[#1A1A1A]/70 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
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
  const { markSeen: markCardSeen } = useCardCollection()

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
      <div className="glass-card rounded-2xl p-2 flex gap-2 overflow-x-auto scrollbar-none">
        {moods.map((mood) => {
          const isActive = filter === mood.id
          return (
            <button
              key={mood.id}
              onClick={() => setFilter(mood.id)}
              className={`
                shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
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
            <Card key={i} className="glass-card border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                      <div className="h-2 w-12 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="h-6 w-10 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer ml-auto" />
                    <div className="h-2 w-8 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer ml-auto" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                <div className="mt-2 h-2 w-20 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
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

      {/* Player sentiment cards — FUT-style emoji cards */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E0E0E0]/50 dark:border-white/5 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-12 text-center">
              <span className="text-3xl mb-2">🤷</span>
              <p className="text-sm font-semibold text-[#666] dark:text-[#CCCCCC]">Players are loading — check back in a moment.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 place-items-center">
              {filtered.map((player, i) => {
                const cardData = fromSentimentPlayer(player)
                const labelKey = player.label === 'on_fire'
                  ? 'sentiments.on_fire'
                  : player.label === 'under_pressure'
                    ? 'sentiments.under_pressure'
                    : 'sentiments.crisis'
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <PlayerCard data={cardData} size="compact" onView={markCardSeen} />
                    <div className="flex items-center gap-1.5">
                      <div className="sentiment-bar w-20">
                        <div
                          className={`sentiment-bar-fill ${player.pulseScore >= 80 ? 'sentiment-positive' : player.pulseScore >= 50 ? 'sentiment-neutral' : 'sentiment-negative'}`}
                          style={{ width: `${player.sentiment}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${getSentimentColor(player.pulseScore)}`}>
                        {t(labelKey)}
                      </span>
                    </div>
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
  const [players, setPlayers] = useState<Array<{
    id: string
    playerName: string
    nationCode: string
    position: string
    avgRating: number
    totalRatings: number
  }>>([])
  const [myRatings, setMyRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // ── Load real players from the DB + this session's ratings ──
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/ratings')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const list = Array.isArray(data.ratings) ? data.ratings : []
        setPlayers(list)
      } catch {
        /* ignore — toast shown on submit failure */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Per-browser session ID (crypto.randomUUID, persisted in localStorage) ──
  // Required by the API — the old 'anonymous' default is rejected. A real
  // session ID makes the (sessionId, playerId) unique constraint meaningful,
  // enforcing one rating per session per player.
  const [sessionId, setSessionId] = useState<string>('')
  useEffect(() => {
    try {
      const existing = window.localStorage.getItem('fp_session_id')
      if (existing && existing.length >= 8) {
        setSessionId(existing)
        return
      }
      const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `fp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
      window.localStorage.setItem('fp_session_id', newId)
      setSessionId(newId)
    } catch {
      setSessionId(`fp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`)
    }
  }, [])

  const handleRate = async (playerId: string, rating: number) => {
    if (!sessionId || submittingId === playerId) return
    setSubmittingId(playerId)
    // Optimistically update local state so the stars fill instantly.
    setMyRatings(prev => ({ ...prev, [playerId]: rating }))
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, rating, sessionId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // Revert on failure.
        setMyRatings(prev => {
          const next = { ...prev }
          delete next[playerId]
          return next
        })
        if (res.status === 429) {
          toast.error('Too many ratings — please slow down.')
        } else {
          toast.error(data?.error || 'Failed to submit rating')
        }
        return
      }
      toast.success(data?.updated ? 'Rating updated!' : 'Rating submitted!', {
        description: `${rating}/10`,
      })
      // Refresh aggregates so the avg display updates.
      const fresh = await fetch('/api/ratings')
      if (fresh.ok) {
        const fd = await fresh.json().catch(() => null)
        if (Array.isArray(fd?.ratings)) setPlayers(fd.ratings)
      }
    } catch {
      setMyRatings(prev => {
        const next = { ...prev }
        delete next[playerId]
        return next
      })
      toast.error('Network error — please try again')
    } finally {
      setSubmittingId(null)
    }
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
        {loading ? (
          <Card className="border-[#E0E0E0]/50 dark:border-white/5">
            <CardContent className="p-6 text-center text-sm text-[#666] dark:text-[#CCCCCC]">
              Loading players…
            </CardContent>
          </Card>
        ) : players.length === 0 ? (
          <Card className="border-[#E0E0E0]/50 dark:border-white/5">
            <CardContent className="p-6 text-center text-sm text-[#666] dark:text-[#CCCCCC]">
              No rateable players found.
            </CardContent>
          </Card>
        ) : (
          players.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{getFlag(player.nationCode)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">{player.playerName}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[11px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                            {player.position}
                          </Badge>
                          <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                            {t('ratings.avg')}: {player.avgRating.toFixed(1)} ({player.totalRatings})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Star Rating 1-10 */}
                    <div className="flex items-center gap-0.5 flex-wrap justify-end max-w-[55%]">
                      {Array.from({ length: 10 }, (_, idx) => idx + 1).map((star) => {
                        const isSelected = (myRatings[player.id] ?? 0) >= star
                        return (
                          <button
                            key={star}
                            onClick={() => handleRate(player.id, star)}
                            disabled={submittingId === player.id}
                            aria-label={`Rate ${star} out of 10`}
                            className="transition-transform duration-150 hover:scale-125 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                          >
                            <Star
                              className={`size-3.5 ${
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

                  {myRatings[player.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 flex items-center justify-between"
                    >
                      <span className="text-xs text-[#6C2BD9] dark:text-[#8B5CF6] font-medium">
                        {t('ratings.your_rating')}: {myRatings[player.id]}/10
                      </span>
                      <Progress
                        value={(myRatings[player.id] / 10) * 100}
                        className="h-1 w-20 progress-purple"
                      />
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
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
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">{stat.label}</p>
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
                      <Badge variant="outline" className="shrink-0 text-[11px] font-bold border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
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
                          <span key={tag} className="rounded bg-[#6C2BD9]/8 dark:bg-[#8B5CF6]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">
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
                  <Badge variant="outline" className="text-[11px] font-bold border-[#E0E0E0] dark:border-white/10 text-[#666] dark:text-[#CCCCCC]">
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
                      title={player ? `${player.name} · ${player.nationCode} · ${slot.pos} · Rating ${player.rating}` : slot.pos}
                    >
                      <div className="flex size-12 sm:size-14 items-center justify-center rounded-full border-2 border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 bg-white dark:bg-[#2D2D2D] shadow-md overflow-hidden">
                        {player ? (
                          <FlagImage nationCode={player.nationCode} size={32} fallbackEmoji={getFlag(player.nationCode)} />
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
                      {/* Position pill — clearly labelled jersey slot, visually distinct from rating */}
                      <div className="mt-0.5">
                        <Badge variant="outline" className="text-[8px] font-bold px-1 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                          {slot.pos}
                        </Badge>
                      </div>
                      {/* Match Rating — labelled chip, visually separated from position */}
                      {player && (
                        <div className="mt-0.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#6C2BD9] dark:bg-[#8B5CF6]">
                          <span className="text-[11px] font-black text-white leading-none">
                            {player.rating}
                          </span>
                          <span className="text-[6px] font-semibold text-white/70 uppercase tracking-wide leading-none">rtg</span>
                        </div>
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
  const rating = player.pulseScore / 10
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
      {/* Player Circle - always shows face emoji, with a fan-sentiment emoji badge beside it */}
      <div className="relative">
        <div
          className={`
            glass-card relative flex size-7 sm:size-8 items-center justify-center rounded-full border-[1.5px] shadow-sm overflow-hidden
            ${isElite ? 'border-white/70' : 'border-red-500/20'}
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
        {/* Fan-sentiment emoji badge — sits beside the player circle (bottom-right) */}
        <span
          className="absolute -bottom-1 -right-1 text-[10px] sm:text-xs leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
          title={`Fan sentiment ${Math.round(player.sentiment)}/100`}
        >
          {getFanMoodEmoji(player.sentiment)}
        </span>
      </div>
      {/* Player Name — full name (no truncation); word-break keeps long names visible on the pitch */}
      <p
        className="mt-px max-w-[52px] sm:max-w-[64px] text-[7px] sm:text-[8px] font-bold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] leading-tight"
        style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
      >
        {player.name}
      </p>
      {/* Position pill — clearly labelled jersey slot, visually distinct from rating */}
      <div className="mt-0.5">
        <Badge
          variant="outline"
          className={`text-[6px] sm:text-[7px] font-bold px-1 py-0 bg-white/95 backdrop-blur-sm leading-tight ${
            isElite ? 'border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]' : 'border-[#EF4444]/30 text-[#EF4444] dark:border-[#F87171]/30 dark:text-[#F87171]'
          }`}
        >
          {player.position}
        </Badge>
      </div>
      {/* Match Rating — labelled chip, visually separated from position */}
      <div className="mt-0.5 flex items-center gap-0.5 px-1 py-px rounded bg-black/45 backdrop-blur-sm">
        {flagMode === 'flag' ? (
          <FlagImage nationCode={player.nationCode} size={12} fallbackEmoji={flagEmoji} />
        ) : (
          <span className="text-[8px] leading-none">{flagEmoji}</span>
        )}
        <span
          className="brutalist-number text-[7px] sm:text-[8px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        >
          {rating.toFixed(1)}
        </span>
        <span className="text-[5px] sm:text-[6px] font-semibold text-white/70 uppercase tracking-wide leading-none">rtg</span>
      </div>
      {/* Trend indicator — separate row so it never collides with rating */}
      {getTrendIcon(player.trend) && (
        <div className="mt-0.5">{getTrendIcon(player.trend)}</div>
      )}
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

  // Team of the Tournament retro modal (closure content).
  const [showRetro, setShowRetro] = useState(false)

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
      // Auto-select: prefer LIVE stage, then prefer last COMPLETED stage (so TOTW/Final shows first)
      const liveStage = stages.find(s => s.status === "live")
      // If no live stage, prefer the last completed stage (Final > SF > QF > R32 > Group)
      const completedStages = stages.filter(s => s.status === "completed")
      const lastCompleted = completedStages.length > 0 ? completedStages[completedStages.length - 1] : null
      const fallbackStage = lastCompleted ?? stages[0]
      setSelectedStageId((liveStage ?? fallbackStage).id)
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
          <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30 gap-1 text-[11px] font-bold px-1.5 py-0">
            <span className="live-dot" style={{ width: 5, height: 5 }} />
            LIVE
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border-[#E0E0E0] dark:border-white/10 gap-1 text-[11px] font-bold px-1.5 py-0">
            <Lock className="size-2.5" />
            COMPLETED
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[#FF6B35] border-[#FF6B35]/30 gap-1 text-[11px] font-bold px-1.5 py-0">
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[#666] dark:text-[#CCCCCC]">{t('wc.new_stage')}</p>
          <Button
            size="sm"
            onClick={() => setShowRetro(true)}
            className="shrink-0 gap-1.5 text-[11px] font-bold h-8 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white shadow-sm"
          >
            <Trophy className="size-3" />
            Team of the Tournament
          </Button>
        </div>
      </motion.div>

      {/* Team of the Tournament retro modal */}
      <TournamentRetroModal open={showRetro} onOpenChange={setShowRetro} />

      {/* Stage Selector */}
      <div className="glass-card rounded-2xl p-2 flex gap-2 overflow-x-auto scrollbar-none">
        {stages.map((stage) => {
          const isActive = selectedStageId === stage.id
          return (
            <motion.button
              key={stage.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedStageId(stage.id)}
              className={`
                relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
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
          <div className="glass-card rounded-2xl p-1.5 flex gap-2 w-fit">
            <button
              onClick={() => setActiveView('elite')}
              className={`
                rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
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
                rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
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
              <Card className={`glass-card overflow-hidden border-[#E0E0E0]/50 dark:border-white/5 ${activeView === 'elite' ? 'glass-glow-purple' : 'glass-glow-red'}`}>
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
                          className={`gap-1 text-[11px] px-1.5 py-0 border-0 ${
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
                        <span className={`text-[10px] font-bold transition-colors ${flagMode === 'emoji' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#6B7280] dark:text-[#666]'}`}>Emoji</span>
                        <Switch
                          checked={flagMode === 'flag'}
                          onCheckedChange={() => toggleFlag()}
                          className="data-[state=checked]:bg-[#6C2BD9] data-[state=unchecked]:bg-[#6C2BD9]/40 scale-75"
                        />
                        <span className={`text-[10px] font-bold transition-colors ${flagMode === 'flag' ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#6B7280] dark:text-[#666]'}`}>Flag</span>
                      </div>
                      {stageStatus === 'completed' && (
                        <Badge className="bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border-[#E0E0E0] dark:border-white/10 gap-1 text-[11px] px-1.5 py-0">
                          <Lock className="size-2.5" /> 🔒
                        </Badge>
                      )}
                      {stageStatus === 'live' && <LiveBadge />}
                    </div>
                  </div>
                  {/* R32 subtitle — ranked-by-real-web-buzz freshness line */}
                  {isR32Live && (
                    <p className="mt-0.5 text-[11px] text-[#666] dark:text-[#CCCCCC]">
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
                          <div className="ticker-scroll whitespace-nowrap text-[11px] font-bold text-[#FF6B35]">
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
                { label: t('wc.elite_avg'), value: (eliteData.players.reduce((a, p) => a + p.pulseScore, 0) / eliteData.players.length / 10).toFixed(1), icon: TrendingUp, color: 'text-[#6C2BD9]', emoji: '🤩', glow: 'glass-glow-purple' },
                { label: t('wc.crisis_avg'), value: (crisisData.players.reduce((a, p) => a + p.pulseScore, 0) / crisisData.players.length / 10).toFixed(1), icon: TrendingDown, color: 'text-[#EF4444]', emoji: '😟', glow: 'glass-glow-red' },
                { label: t('wc.live_players'), value: [...eliteData.players, ...crisisData.players].filter(p => p.isLive).length, icon: Activity, color: 'text-[#FF6B35]', emoji: '', glow: '' },
                { label: t('wc.total_votes'), value: totalVotes.toLocaleString(), icon: Users, color: 'text-[#1A1A1A] dark:text-white', emoji: '', glow: '' },
              ].map((stat, i) => (
                <Card key={i} className={`glass-card glass-hover ${stat.glow} border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none`}>
                  <CardContent className="p-3 text-center">
                    <stat.icon className={`mx-auto size-4 mb-1.5 ${stat.color}`} />
                    <p className={`brutalist-number text-lg font-black ${stat.color}`}>{stat.emoji} {stat.value}</p>
                    <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">{stat.label}</p>
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
                            <Badge variant="outline" className="text-[11px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
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
                        <div className="size-8 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-24 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                          <div className="h-2 w-16 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedPlayerId(null)}
                    aria-label="Close"
                    className="shrink-0 rounded-full size-7 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
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
                          <div className="h-3 w-32 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                          <div className="h-2 w-full rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
                          <div className="h-2 w-48 rounded bg-[#F8F9FA] dark:bg-[#2D2D2D] skeleton-shimmer" />
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
                          <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                            Weighted blend of 4 components
                          </p>
                        </div>
                        <div
                          className={`flex items-center justify-center size-14 rounded-xl brutalist-number text-2xl font-black text-white shadow-md ${getPulseScoreColorClass(pulseBreakdown.pulseScore.overall)}`}
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
                              <Badge variant="outline" className="brutalist-number text-[11px] font-bold px-1.5 py-0 border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                                {Math.round(c.weight * 100)}%
                              </Badge>
                            </div>
                            <span className="brutalist-number text-sm font-black text-[#1A1A1A] dark:text-white">
                              {Math.round(c.value)}
                            </span>
                          </div>
                          <Progress
                            value={c.value}
                            className="h-2 progress-purple"
                          />
                          <p className="text-[11px] leading-relaxed text-[#666] dark:text-[#CCCCCC]">
                            {c.note}
                          </p>
                          {/* Real fan sentiment metadata — only shown when FeedMonitor data exists */}
                          {c.meta && c.meta.postCount > 0 && (
                            <div className="mt-1.5 rounded-md bg-[#10B981]/5 border border-[#10B981]/20 p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#10B981] uppercase tracking-wider">
                                <span className="inline-block size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                Based on {c.meta.postCount} real fan post{c.meta.postCount === 1 ? '' : 's'} · {c.meta.freshnessLabel}
                              </div>
                              {c.meta.topQuotes && c.meta.topQuotes.length > 0 && (
                                <div className="space-y-1">
                                  {c.meta.topQuotes.slice(0, 2).map((q, i) => (
                                    <div key={i} className="text-[11px] italic text-[#1A1A1A] dark:text-white/80 leading-relaxed pl-2 border-l-2 border-[#10B981]/40">
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
                        <p className="text-[11px] font-mono text-center text-[#6C2BD9] dark:text-[#8B5CF6]">
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

  // ── Story Mode state ───────────────────────────────────────────────────────
  // storiesOpen controls the full-screen StoryViewer overlay; storyStartIndex
  // is the index the viewer should start at (set when a user taps a specific
  // story circle). Stories are fetched via direct fetch + 10-min refetch so
  // a new UTC day's stories appear without a manual reload.
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [storyStartIndex, setStoryStartIndex] = useState(0)
  // Card Collection modal state (gamification — tracks flipped cards via localStorage).
  const [showCardCollection, setShowCardCollection] = useState(false)
  const { data: stories = [], dayKey } = useStories()
  const { viewedIds, markViewed } = useViewedStories(dayKey)

  const openStories = useCallback((startIndex: number = 0) => {
    setStoryStartIndex(startIndex)
    setStoriesOpen(true)
  }, [])

  const closeStories = useCallback(() => setStoriesOpen(false), [])

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
    <div className="min-h-screen glass-bg-gradient">
      <div className="flex">
        {/* Sidebar */}
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenStories={() => openStories(0)}
        />

        {/* Main content area */}
        <div className="flex-1 md:ml-60 min-w-0 min-h-screen flex flex-col">
          <TopHeader activeTab={activeTab} />

          <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                // `main-content-wrapper` class provides a CSS-only fadeInUp
                // fallback so content is visible even if Framer Motion / JS is
                // delayed. The keyframe animation in globals.css runs on mount
                // and sets opacity:1 + transform:none after 0.5s. Framer Motion
                // then takes over and may re-animate — both paths land visible.
                className="main-content-wrapper"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {activeTab === 'home' && (
                  <HomeTab
                    stories={stories}
                    viewedIds={viewedIds}
                    onOpenStories={openStories}
                    onOpenCardCollection={() => setShowCardCollection(true)}
                  />
                )}
                {activeTab === 'sentiments' && <SentimentsTab />}
                {activeTab === 'worldcup' && <WorldCupTab stages={stages} />}
                {activeTab === 'totw' && <TeamOfTheWeekTab />}
                {activeTab === 'fpl' && <FPLTab />}
                {activeTab === 'transfers' && <TransfersTab />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile-only Wikipedia attribution — the desktop footer below
              has the full attribution, but on mobile the footer is hidden
              (the fixed bottom nav replaces it). This tiny line sits at the
              bottom of the scrollable content so the CC-BY-SA legal notice
              is still visible when a mobile user scrolls to the end. */}
          <div className="md:hidden px-4 py-2 text-center text-[10px] text-[#999] dark:text-[#777] border-t border-[#E0E0E0] dark:border-white/10" title="Player photos sourced from Wikipedia/Wikimedia Commons under Creative Commons CC-BY-SA license">
            Player photos: Wikipedia/CC-BY-SA
          </div>

          {/* Desktop footer — sticky to bottom via mt-auto in the flex-col.
              Hidden on mobile where the fixed bottom nav serves as the footer.
              Includes text links for About · Privacy · GitHub (placeholder # for now). */}
          <footer className="hidden md:flex mt-auto border-t border-[#E0E0E0] dark:border-white/10 px-4 py-3 items-center justify-between text-[11px] text-[#666] dark:text-[#999]">
            <span>Fan Pulse © 2026 · World Cup 2026 Real-Time Fan Sentiment Dashboard</span>
            <nav aria-label="Footer" className="flex items-center gap-1">
              {/* Legal attribution — required for Creative Commons images.
                  All player photos are from Wikipedia/Wikimedia Commons under
                  CC-BY-SA. See src/lib/wikipedia-photo.ts for the source contract. */}
              <span className="px-2 py-0.5 text-[10px] text-[#999] dark:text-[#777]" title="Player photos sourced from Wikipedia/Wikimedia Commons under Creative Commons CC-BY-SA license">
                Photos: Wikipedia/CC-BY-SA
              </span>
              <span aria-hidden="true" className="text-[#E0E0E0] dark:text-white/20">·</span>
              <a
                href="#"
                className="px-2 py-0.5 rounded hover:text-[#6C2BD9] dark:hover:text-[#8B5CF6] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
              >
                About
              </a>
              <span aria-hidden="true" className="text-[#E0E0E0] dark:text-white/20">·</span>
              <a
                href="#"
                className="px-2 py-0.5 rounded hover:text-[#6C2BD9] dark:hover:text-[#8B5CF6] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
              >
                Privacy
              </a>
              <span aria-hidden="true" className="text-[#E0E0E0] dark:text-white/20">·</span>
              <a
                href="#"
                className="px-2 py-0.5 rounded hover:text-[#6C2BD9] dark:hover:text-[#8B5CF6] transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
              >
                GitHub
              </a>
            </nav>
          </footer>
        </div>
      </div>

      {/* ── Story Mode full-screen overlay ─────────────────────────────────── */}
      {storiesOpen && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          startIndex={storyStartIndex}
          onClose={closeStories}
          onViewed={markViewed}
          onNavigate={(tabId) => setActiveTab(tabId as TabId)}
        />
      )}

      {/* ── Card Collection modal (gamification) ──────────────────────────── */}
      <CardCollectionModal open={showCardCollection} onOpenChange={setShowCardCollection} />

      {/* ── Share nudge (appears after viewing 5 cards) ──────────────────── */}
      <ShareNudge />
    </div>
  )
}
