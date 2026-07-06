'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Heart, MessageCircle, Share2, ChevronDown, ChevronUp,
  Radio, TrendingUp, Globe2, BarChart3, Hash, ExternalLink,
  MessageSquare, Loader2, AlertCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/context/LanguageContext'
import FlagImage from '@/components/common/FlagImage'
import { findNationalTeam } from '@/lib/national-teams'

// ── Types ────────────────────────────────────────────────────

interface SocialPost {
  id: string
  platform: 'twitter' | 'reddit'
  postId: string
  author: string
  content: string
  language: string
  sentiment: number
  likes: number
  replies: number
  shares: number
  teamTag: string
  matchTag: string
  searchQuery: string
  postedAt: string | null
  fetchedAt: string
}

interface SentimentSummary {
  id: string
  teamCode: string
  language: string
  avgSentiment: number
  postCount: number
  positiveRatio: number
  topTopics: string
  platform: string
  period: string
  updatedAt: string
}

// ── Language Config ───────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English', nameAr: 'الإنجليزية', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', nameAr: 'العربية', flag: '🇸🇦' },
  { code: 'es', name: 'Español', nameAr: 'الإسبانية', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', nameAr: 'الفرنسية', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', nameAr: 'البرتغالية', flag: '🇧🇷' },
  { code: 'de', name: 'Deutsch', nameAr: 'الألمانية', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', nameAr: 'اليابانية', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', nameAr: 'الكورية', flag: '🇰🇷' },
  { code: 'tr', name: 'Türkçe', nameAr: 'التركية', flag: '🇹🇷' },
  { code: 'id', name: 'Bahasa', nameAr: 'الإندونيسية', flag: '🇮🇩' },
  { code: 'ur', name: 'اردو', nameAr: 'الأردية', flag: '🇵🇰' },
  { code: 'fa', name: 'فارسی', nameAr: 'الفارسية', flag: '🇮🇷' },
  { code: 'zh', name: '中文', nameAr: 'الصينية', flag: '🇨🇳' },
]

type PlatformFilter = 'all' | 'twitter' | 'reddit'
type LanguageFilter = 'all' | string

// ── Helpers ──────────────────────────────────────────────────

function getSentimentColor(score: number): string {
  if (score > 60) return '#10B981'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}

function getSentimentTextClass(score: number): string {
  if (score > 60) return 'text-[#10B981]'
  if (score >= 40) return 'text-[#F59E0B]'
  return 'text-[#EF4444]'
}

function getSentimentBgClass(score: number): string {
  if (score > 60) return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
  if (score >= 40) return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
  return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
}

function getSentimentLabel(score: number, isAr: boolean): string {
  if (score > 60) return isAr ? 'إيجابي' : 'Positive'
  if (score >= 40) return isAr ? 'محايد' : 'Neutral'
  return isAr ? 'سلبي' : 'Negative'
}

function timeAgo(dateStr: string | null, isAr: boolean): string {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (isAr) {
    if (diffMin < 1) return 'الآن'
    if (diffMin < 60) return `منذ ${diffMin} د`
    if (diffHr < 24) return `منذ ${diffHr} س`
    return `منذ ${diffDay} ي`
  }
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDay}d ago`
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function getLanguageFlag(code: string): string {
  const lang = LANGUAGES.find(l => l.code === code)
  return lang?.flag ?? '🌐'
}

function getLanguageName(code: string, isAr: boolean): string {
  const lang = LANGUAGES.find(l => l.code === code)
  if (!lang) return code.toUpperCase()
  return isAr ? lang.nameAr : lang.name
}

// Language-specific colors for sentiment bar segments
const LANG_COLORS: Record<string, string> = {
  en: '#6C2BD9',
  ar: '#8B5CF6',
  es: '#FF6B35',
  fr: '#3B82F6',
  pt: '#10B981',
  de: '#EF4444',
  ja: '#EC4899',
  ko: '#F59E0B',
  tr: '#F97316',
  id: '#14B8A6',
  ur: '#06B6D4',
  fa: '#8B5CF6',
  zh: '#DC2626',
}

// ── Circular Gauge Component ─────────────────────────────────

function CircularGauge({ value, size = 100 }: { value: number; size?: number }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (value / 100) * circumference
  const color = getSentimentColor(value)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-[#E0E0E0] dark:text-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-black"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {Math.round(value)}
        </motion.span>
        <span className="text-[9px] font-medium text-[#666] dark:text-[#CCCCCC]">/ 100</span>
      </div>
    </div>
  )
}

// ── Skeleton Components ──────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
          <CardContent className="p-4">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-10 w-16 mb-2" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PostSkeleton() {
  return (
    <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-12 ml-auto" />
        </div>
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-3/4 mb-3" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Component ───────────────────────────────────────────

export default function FanPulseTab() {
  const { lang, t } = useLanguage()
  const isAr = lang === 'AR'

  // ── State ──
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [summaries, setSummaries] = useState<SentimentSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [visiblePosts, setVisiblePosts] = useState(10)

  // ── Fetch Data ──
  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      params.set('platform', platformFilter)
      params.set('period', '24h')
      if (languageFilter !== 'all') params.set('lang', languageFilter)

      const res = await fetch(`/api/social-sentiment?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch data')
      const data = await res.json()

      setPosts(data.posts || [])
      setSummaries(data.summaries || [])
    } catch (err) {
      console.error('Failed to fetch sentiment data:', err)
      setError(isAr ? 'فشل تحميل البيانات' : 'Failed to load data')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [platformFilter, languageFilter, isAr])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Refresh Handler ──
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/social-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamCode: '',
          language: languageFilter === 'all' ? '' : languageFilter,
        }),
      })
      await fetchData()
    } catch (err) {
      console.error('Refresh failed:', err)
      setIsRefreshing(false)
    }
  }, [languageFilter, fetchData])

  // ── Computed Data ──
  const filteredPosts = useMemo(() => {
    let result = posts
    if (platformFilter !== 'all') {
      result = result.filter(p => p.platform === platformFilter)
    }
    if (languageFilter !== 'all') {
      result = result.filter(p => p.language === languageFilter)
    }
    // Sort by recency
    result = [...result].sort((a, b) => {
      const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0
      const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0
      return dateB - dateA
    })
    return result
  }, [posts, platformFilter, languageFilter])

  const globalAvgSentiment = useMemo(() => {
    if (summaries.length === 0) return 0
    const total = summaries.reduce((sum, s) => sum + s.avgSentiment * s.postCount, 0)
    const count = summaries.reduce((sum, s) => sum + s.postCount, 0)
    return count > 0 ? total / count : 0
  }, [summaries])

  const topTopics = useMemo(() => {
    const topicMap = new Map<string, number>()
    summaries.forEach(s => {
      try {
        const topics: string[] = JSON.parse(s.topTopics || '[]')
        topics.forEach(t => topicMap.set(t, (topicMap.get(t) || 0) + s.postCount))
      } catch { /* ignore */ }
    })
    return [...topicMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic)
  }, [summaries])

  const mostActiveLanguage = useMemo(() => {
    if (summaries.length === 0) return null
    const langCounts = new Map<string, number>()
    summaries.forEach(s => {
      langCounts.set(s.language, (langCounts.get(s.language) || 0) + s.postCount)
    })
    let maxLang = ''
    let maxCount = 0
    langCounts.forEach((count, lang) => {
      if (count > maxCount) {
        maxCount = count
        maxLang = lang
      }
    })
    return { code: maxLang, count: maxCount }
  }, [summaries])

  const sentimentSplit = useMemo(() => {
    if (filteredPosts.length === 0) return { positive: 33, neutral: 34, negative: 33 }
    const positive = filteredPosts.filter(p => p.sentiment > 60).length
    const neutral = filteredPosts.filter(p => p.sentiment >= 40 && p.sentiment <= 60).length
    const negative = filteredPosts.filter(p => p.sentiment < 40).length
    const total = filteredPosts.length
    return {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100),
    }
  }, [filteredPosts])

  // Team sentiment data grouped by team
  const teamSentiments = useMemo(() => {
    const teamMap = new Map<string, {
      teamCode: string
      langSentiments: Map<string, { avg: number; count: number }>
      totalPosts: number
      overallSentiment: number
    }>()

    summaries.forEach(s => {
      if (!teamMap.has(s.teamCode)) {
        teamMap.set(s.teamCode, {
          teamCode: s.teamCode,
          langSentiments: new Map(),
          totalPosts: 0,
          overallSentiment: 0,
        })
      }
      const team = teamMap.get(s.teamCode)!
      team.langSentiments.set(s.language, { avg: s.avgSentiment, count: s.postCount })
      team.totalPosts += s.postCount
      team.overallSentiment = (
        (team.overallSentiment * (team.totalPosts - s.postCount) + s.avgSentiment * s.postCount) /
        team.totalPosts
      )
    })

    return [...teamMap.values()]
      .sort((a, b) => b.totalPosts - a.totalPosts)
      .slice(0, 10)
  }, [summaries])

  const toggleTeam = (teamCode: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev)
      if (next.has(teamCode)) next.delete(teamCode)
      else next.add(teamCode)
      return next
    })
  }

  const togglePost = (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  const loadMore = () => {
    setVisiblePosts(prev => prev + 10)
  }

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ── 1. Header ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
              {isAr ? 'نبض المشجعين' : 'FAN PULSE'}
            </h2>
            <span className="relative flex size-2.5">
              <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[#10B981] shadow-lg shadow-[#10B981]/50" />
            </span>
          </div>
          <p className="text-xs text-[#666] dark:text-[#CCCCCC]">
            {isAr
              ? 'مشاعر وسائل التواصل الاجتماعي في الوقت الحقيقي عبر 13 لغة'
              : 'Real-time social media sentiment across 13 languages'
            }
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="shrink-0 gap-1.5 border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30 dark:hover:border-[#8B5CF6]/30"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-xs">{isAr ? 'تحديث' : 'Refresh'}</span>
        </Button>
      </motion.div>

      {/* ── 2. Language Filter Bar ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* ALL button */}
          <button
            onClick={() => setLanguageFilter('all')}
            className={`
              shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200
              ${languageFilter === 'all'
                ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
              }
            `}
          >
            {isAr ? 'الكل' : 'ALL'}
          </button>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLanguageFilter(languageFilter === l.code ? 'all' : l.code)}
              className={`
                shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 flex items-center gap-1.5
                ${languageFilter === l.code
                  ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
                }
              `}
            >
              <span className="text-sm">{l.flag}</span>
              <span>{isAr ? l.nameAr : l.name}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── 3. Platform Toggle ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex gap-2"
      >
        {([
          { key: 'all' as PlatformFilter, label: isAr ? 'الكل' : 'All', icon: Globe2 },
          { key: 'twitter' as PlatformFilter, label: 'X.com', icon: MessageSquare },
          { key: 'reddit' as PlatformFilter, label: 'Reddit', icon: Hash },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPlatformFilter(key)}
            className={`
              flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all duration-200
              ${platformFilter === key
                ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
              }
            `}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </motion.div>

      {/* ── Error State ────────────────────────────────────── */}
      {error && !isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-[#EF4444]/30 dark:border-[#EF4444]/20 rounded-xl">
            <CardContent className="p-4 text-center">
              <AlertCircle className="mx-auto size-6 text-[#EF4444] mb-2" />
              <p className="text-sm text-[#EF4444] mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
                <RefreshCw className="size-3.5" />
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── 4. Sentiment Overview Cards ─────────────────────── */}
      {isLoading ? (
        <OverviewSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {/* Global Pulse */}
          <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
            <CardContent className="p-4 flex flex-col items-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mb-2">
                {isAr ? 'النبض العام' : 'Global Pulse'}
              </p>
              <CircularGauge value={globalAvgSentiment} size={90} />
              <p className="mt-1 text-[10px] text-[#666] dark:text-[#CCCCCC]">
                {filteredPosts.length} {isAr ? 'منشور' : 'posts'}
              </p>
            </CardContent>
          </Card>

          {/* Hot Topics */}
          <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mb-2.5">
                {isAr ? 'المواضيع الرائجة' : 'Hot Topics'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topTopics.length > 0 ? topTopics.map(topic => (
                  <Badge
                    key={topic}
                    variant="outline"
                    className="text-[10px] bg-[#6C2BD9]/5 border-[#6C2BD9]/20 text-[#6C2BD9] dark:text-[#8B5CF6] dark:bg-[#8B5CF6]/10 dark:border-[#8B5CF6]/20"
                  >
                    <Hash className="size-2.5 mr-0.5" />
                    {topic}
                  </Badge>
                )) : (
                  <span className="text-[10px] text-[#999] dark:text-gray-500">—</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Most Active Language */}
          <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mb-2.5">
                {isAr ? 'الأكثر نشاطاً' : 'Most Active'}
              </p>
              {mostActiveLanguage ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getLanguageFlag(mostActiveLanguage.code)}</span>
                  <div>
                    <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                      {getLanguageName(mostActiveLanguage.code, isAr)}
                    </p>
                    <p className="text-[10px] text-[#666] dark:text-[#CCCCCC]">
                      {formatNumber(mostActiveLanguage.count)} {isAr ? 'منشور' : 'posts'}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-[#999] dark:text-gray-500">—</span>
              )}
            </CardContent>
          </Card>

          {/* Sentiment Split */}
          <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mb-2.5">
                {isAr ? 'توزيع المشاعر' : 'Sentiment Split'}
              </p>
              <div className="space-y-2">
                {/* Stacked bar */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#E0E0E0]/30 dark:bg-white/10">
                  <motion.div
                    className="bg-[#10B981]"
                    initial={{ width: 0 }}
                    animate={{ width: `${sentimentSplit.positive}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                  <motion.div
                    className="bg-[#F59E0B]"
                    initial={{ width: 0 }}
                    animate={{ width: `${sentimentSplit.neutral}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  />
                  <motion.div
                    className="bg-[#EF4444]"
                    initial={{ width: 0 }}
                    animate={{ width: `${sentimentSplit.negative}%` }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                  />
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-[#10B981] font-semibold">
                    {isAr ? 'إيجابي' : 'Pos'} {sentimentSplit.positive}%
                  </span>
                  <span className="text-[#F59E0B] font-semibold">
                    {isAr ? 'محايد' : 'Neu'} {sentimentSplit.neutral}%
                  </span>
                  <span className="text-[#EF4444] font-semibold">
                    {isAr ? 'سلبي' : 'Neg'} {sentimentSplit.negative}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── 5. Team Sentiment Bars ──────────────────────────── */}
      {!isLoading && teamSentiments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
                <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                  {isAr ? 'مشاعر الفرق' : 'Team Sentiment'}
                </h3>
              </div>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {teamSentiments.map(team => {
                  const teamInfo = findNationalTeam(team.teamCode)
                  const isExpanded = expandedTeams.has(team.teamCode)
                  const langEntries = [...team.langSentiments.entries()]
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 6)

                  return (
                    <div key={team.teamCode}>
                      <button
                        onClick={() => toggleTeam(team.teamCode)}
                        className="w-full flex items-center gap-2.5 py-1.5 group"
                      >
                        <FlagImage nationCode={team.teamCode} size={22} />
                        <span className="text-xs font-semibold text-[#1A1A1A] dark:text-white min-w-[60px] text-left">
                          {teamInfo?.name ?? team.teamCode}
                        </span>
                        {/* Multi-language sentiment bar */}
                        <div className="flex-1 flex h-2.5 overflow-hidden rounded-full bg-[#E0E0E0]/30 dark:bg-white/10">
                          {langEntries.map(([langCode, data]) => {
                            const width = (data.count / team.totalPosts) * 100
                            return (
                              <motion.div
                                key={langCode}
                                className="first:rounded-l-full last:rounded-r-full"
                                style={{ backgroundColor: LANG_COLORS[langCode] || '#6C2BD9' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${width}%` }}
                                transition={{ duration: 0.6 }}
                                title={`${getLanguageName(langCode, isAr)}: ${Math.round(data.avg)} (${data.count} posts)`}
                              />
                            )
                          })}
                        </div>
                        <span className={`text-xs font-bold min-w-[28px] text-right ${getSentimentTextClass(team.overallSentiment)}`}>
                          {Math.round(team.overallSentiment)}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="size-3.5 text-[#666] dark:text-[#CCCCCC]" />
                          : <ChevronDown className="size-3.5 text-[#666] dark:text-[#CCCCCC]" />
                        }
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-8 mb-2 space-y-1.5">
                              {langEntries.map(([langCode, data]) => (
                                <div key={langCode} className="flex items-center gap-2 text-[10px]">
                                  <span>{getLanguageFlag(langCode)}</span>
                                  <span className="text-[#666] dark:text-[#CCCCCC] min-w-[50px]">
                                    {getLanguageName(langCode, isAr)}
                                  </span>
                                  <div className="flex-1 h-1.5 rounded-full bg-[#E0E0E0]/30 dark:bg-white/10 overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: LANG_COLORS[langCode] || '#6C2BD9' }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${data.avg}%` }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>
                                  <span className={`font-bold ${getSentimentTextClass(data.avg)}`}>
                                    {Math.round(data.avg)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              {/* Language legend */}
              <div className="mt-3 pt-2 border-t border-[#E0E0E0] dark:border-white/10 flex flex-wrap gap-x-3 gap-y-1">
                {teamSentiments.length > 0 && [...teamSentiments[0].langSentiments.keys()].slice(0, 8).map(code => (
                  <div key={code} className="flex items-center gap-1 text-[9px] text-[#666] dark:text-[#CCCCCC]">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: LANG_COLORS[code] || '#6C2BD9' }}
                    />
                    {getLanguageName(code, isAr)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── 6. Social Posts Feed ────────────────────────────── */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Radio className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
            <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white">
              {isAr ? 'آخر المنشورات' : 'Live Feed'}
            </h3>
            {filteredPosts.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-[#6C2BD9]/5 border-[#6C2BD9]/20 text-[#6C2BD9] dark:text-[#8B5CF6]">
                {filteredPosts.length}
              </Badge>
            )}
          </div>

          {filteredPosts.length === 0 ? (
            /* ── 7. Empty State ──────────────────────────────── */
            <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10">
              <CardContent className="py-12 text-center">
                <div className="mx-auto size-12 rounded-full bg-[#F3EEFF] dark:bg-[#8B5CF6]/10 flex items-center justify-center mb-3">
                  <TrendingUp className="size-5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
                </div>
                <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white mb-1">
                  {isAr ? 'لا توجد منشورات بعد' : 'No social posts yet'}
                </p>
                <p className="text-xs text-[#666] dark:text-[#CCCCCC] mb-4">
                  {isAr ? 'اجمع بيانات المشاعر من وسائل التواصل الاجتماعي' : 'Fetch sentiment data from social media'}
                </p>
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="bg-[#6C2BD9] hover:bg-[#5B1FBF] text-white gap-1.5"
                  size="sm"
                >
                  {isRefreshing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="size-3.5" />
                  )}
                  {isAr ? 'جلب الآن' : 'Fetch Now'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
              <AnimatePresence>
                {filteredPosts.slice(0, visiblePosts).map((post, i) => {
                  const isExpanded = expandedPosts.has(post.id)
                  const teamInfo = findNationalTeam(post.teamTag)

                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          {/* Top row: platform + author + time */}
                          <div className="flex items-center gap-2 mb-2">
                            {/* Platform badge */}
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold px-1.5 py-0 h-5 ${
                                post.platform === 'twitter'
                                  ? 'bg-[#1DA1F2]/15 text-[#1DA1F2] border-[#1DA1F2]/20'
                                  : 'bg-[#FF4500]/15 text-[#FF4500] border-[#FF4500]/20'
                              }`}
                            >
                              {post.platform === 'twitter' ? 'X.com' : 'Reddit'}
                            </Badge>

                            {/* Author avatar + name */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className={`shrink-0 size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                post.platform === 'twitter' ? 'bg-[#1DA1F2]' : 'bg-[#FF4500]'
                              }`}>
                                {post.author.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-[#1A1A1A] dark:text-white truncate">
                                @{post.author}
                              </span>
                            </div>

                            {/* Language flag */}
                            <span className="text-xs shrink-0" title={getLanguageName(post.language, isAr)}>
                              {getLanguageFlag(post.language)}
                            </span>

                            {/* Sentiment badge */}
                            <Badge
                              variant="outline"
                              className={`ml-auto text-[9px] font-bold px-1.5 py-0 h-5 ${getSentimentBgClass(post.sentiment)}`}
                            >
                              {Math.round(post.sentiment)}
                            </Badge>

                            {/* Time */}
                            <span className="text-[9px] text-[#999] dark:text-gray-500 shrink-0">
                              {timeAgo(post.postedAt, isAr)}
                            </span>
                          </div>

                          {/* Team tag */}
                          {post.teamTag && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <FlagImage nationCode={post.teamTag} size={14} />
                              <span className="text-[10px] font-medium text-[#6C2BD9] dark:text-[#8B5CF6]">
                                {teamInfo?.name ?? post.teamTag}
                              </span>
                            </div>
                          )}

                          {/* Content */}
                          <p className={`text-xs text-[#1A1A1A] dark:text-[#CCCCCC] leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                            {post.content}
                          </p>
                          {post.content.length > 150 && (
                            <button
                              onClick={() => togglePost(post.id)}
                              className="text-[10px] text-[#6C2BD9] dark:text-[#8B5CF6] font-semibold mt-0.5 hover:underline"
                            >
                              {isExpanded
                                ? (isAr ? 'عرض أقل' : 'Show less')
                                : (isAr ? 'عرض المزيد' : 'Read more')
                              }
                            </button>
                          )}

                          {/* Engagement stats */}
                          <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-[#E0E0E0]/50 dark:border-white/5">
                            <span className="flex items-center gap-1 text-[10px] text-[#666] dark:text-[#CCCCCC]">
                              <Heart className="size-3" />
                              {formatNumber(post.likes)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-[#666] dark:text-[#CCCCCC]">
                              <MessageCircle className="size-3" />
                              {formatNumber(post.replies)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-[#666] dark:text-[#CCCCCC]">
                              <Share2 className="size-3" />
                              {formatNumber(post.shares)}
                            </span>
                            <span className={`ml-auto text-[9px] font-semibold ${getSentimentTextClass(post.sentiment)}`}>
                              {getSentimentLabel(post.sentiment, isAr)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Load More */}
              {visiblePosts < filteredPosts.length && (
                <div className="py-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    className="gap-1.5 border-[#E0E0E0] dark:border-white/10"
                  >
                    {isAr ? 'تحميل المزيد' : 'Load More'}
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Loading state for posts ── */}
      {isLoading && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <PostSkeleton />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
