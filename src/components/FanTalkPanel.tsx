'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, ChevronDown, RefreshCw, ExternalLink, Inbox } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface FanTalkPost {
  id: string
  platform: string // 'twitter' | 'reddit' | 'instagram' | 'youtube' | 'facebook' | 'tiktok' | 'web'
  author: string
  content: string
  topQuote: string | null
  sentimentScore: number
  sentimentLabel: 'positive' | 'neutral' | 'negative'
  postedAt: string
  timeLabel: string
  url: string
}

interface FanTalkData {
  posts: FanTalkPost[]
  sentimentSplit: { positive: number; neutral: number; negative: number }
  totalPosts: number
  monitorLabel: string | null
  lastUpdated: string | null
  freshnessLabel: string | null
  /** True if the API attempted a live SDK fetch for this request. */
  liveFetchAttempted?: boolean
  /** Human-readable error if the live fetch failed or returned nothing. */
  liveFetchError?: string | null
}

interface FanTalkPanelProps {
  teamCodes: string[]
  matchLabel?: string
  /** The Match.id this panel belongs to. When provided, the API scopes posts
   *  to THIS match only — preventing posts from a different match (that
   *  shares a team code) from bleeding in. */
  matchId?: string
}

// ── Platform icons ───────────────────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'reddit') {
    return (
      <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#FF4500] text-white text-[8px] font-bold shrink-0" title="Reddit">
        r
      </span>
    )
  }
  if (platform === 'twitter') {
    return (
      <span className="inline-flex items-center justify-center size-4 rounded-full bg-black text-white text-[8px] font-bold shrink-0" title="X (Twitter)">
        𝕏
      </span>
    )
  }
  if (platform === 'instagram') {
    return (
      <span className="inline-flex items-center justify-center size-4 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white text-[8px] font-bold shrink-0" title="Instagram">
        IG
      </span>
    )
  }
  if (platform === 'youtube') {
    return (
      <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#FF0000] text-white text-[8px] font-bold shrink-0" title="YouTube">
        YT
      </span>
    )
  }
  if (platform === 'facebook') {
    return (
      <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#1877F2] text-white text-[8px] font-bold shrink-0" title="Facebook">
        f
      </span>
    )
  }
  if (platform === 'tiktok') {
    return (
      <span className="inline-flex items-center justify-center size-4 rounded-full bg-black text-white text-[8px] font-bold shrink-0" title="TikTok">
        TT
      </span>
    )
  }
  // web (news sites)
  return (
    <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#6C2BD9] text-white text-[8px] font-bold shrink-0" title="News / Web">
      📰
    </span>
  )
}

function SentimentBadge({ label, score }: { label: string; score: number }) {
  const config = {
    positive: { emoji: '😊', bg: 'bg-[#10B981]/10', text: 'text-[#10B981]' },
    neutral: { emoji: '😐', bg: 'bg-[#FF6B35]/10', text: 'text-[#FF6B35]' },
    negative: { emoji: '😡', bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]' },
  }[label] || { emoji: '😐', bg: 'bg-[#FF6B35]/10', text: 'text-[#FF6B35]' }

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${config.bg} ${config.text}`}>
      {config.emoji} {score}
    </span>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function FanTalkPanel({ teamCodes, matchLabel, matchId }: FanTalkPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'popular' | 'latest'>('popular')
  const [data, setData] = useState<FanTalkData | null>(null)
  const [loading, setLoading] = useState(false)

  const teamCodesParam = teamCodes.join(',')

  const fetchFanTalk = useCallback(async () => {
    setLoading(true)
    try {
      // matchId is passed so the API can scope posts to THIS match only.
      // Without it, matches sharing a team code (e.g. ESP vs ARG and ESP vs
      // FRA) would show the same ESP-related posts — the per-match bleed bug.
      const matchIdParam = matchId ? `&matchId=${encodeURIComponent(matchId)}` : ''
      const res = await fetch(
        `/api/fan-talk?teamCodes=${encodeURIComponent(teamCodesParam)}&tab=${tab}${matchIdParam}`,
      )
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to fetch fan talk:', err)
    } finally {
      setLoading(false)
    }
  }, [teamCodesParam, tab, matchId])

  // Fetch when expanded or tab changes
  useEffect(() => {
    if (expanded) {
      fetchFanTalk()
    }
  }, [expanded, tab, fetchFanTalk])

  const hasData = data && data.posts.length > 0
  const totalPosts = data?.totalPosts ?? 0
  const split = data?.sentimentSplit ?? { positive: 0, neutral: 0, negative: 0 }

  return (
    <div className="mt-2.5">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#E0E0E0]/50 dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] px-3 py-2 transition-colors hover:bg-[#F0F1F2] dark:hover:bg-[#333] group"
      >
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-3.5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#666] dark:text-[#CCCCCC]">
            What Fans Are Saying
          </span>
          {hasData && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#10B981]">
              <span className="size-1 rounded-full bg-[#10B981] animate-pulse" />
              {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 text-[#999] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-[#E0E0E0]/50 dark:border-white/10 bg-white dark:bg-[#1F1F1F] p-3">
              {/* Tabs + refresh */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex gap-1">
                  {(['popular', 'latest'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold transition-all ${
                        tab === t
                          ? 'bg-[#6C2BD9] text-white'
                          : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC]'
                      }`}
                    >
                      {t === 'popular' ? '🔥 Popular' : '⏱ Latest'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={fetchFanTalk}
                  disabled={loading}
                  className="text-[#999] hover:text-[#6C2BD9] dark:hover:text-[#8B5CF6] transition-colors disabled:opacity-40"
                  title="Refresh"
                >
                  <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Loading state */}
              {loading && !data && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 rounded-md bg-[#F8F9FA] dark:bg-[#2D2D2D] animate-pulse"
                    />
                  ))}
                </div>
              )}

              {/* Empty state — honest, NO fabricated content */}
              {!loading && !hasData && (
                <div className="text-center py-6 px-3">
                  <div className="inline-flex items-center justify-center size-9 rounded-full bg-[#F8F9FA] dark:bg-[#2D2D2D] mb-2">
                    <Inbox className="size-4 text-[#999] dark:text-gray-500" />
                  </div>
                  <p className="text-[10px] font-semibold text-[#666] dark:text-[#CCCCCC]">
                    Fan posts are loading / unavailable for this match right now.
                  </p>
                  <p className="text-[9px] text-[#999] dark:text-gray-500 mt-1.5 leading-relaxed">
                    {data?.liveFetchAttempted
                      ? data?.liveFetchError
                        ? `Live fetch attempted: ${data.liveFetchError}. Real posts will appear once the source is reachable.`
                        : 'Live fetch attempted but no real posts were found. Try refreshing in a few minutes.'
                      : 'Real fan posts will appear here once we can reach live social/news sources for this match.'}
                  </p>
                  <p className="text-[8px] text-[#BBB] dark:text-gray-600 mt-2 italic">
                    We never show fabricated or templated posts.
                  </p>
                </div>
              )}

              {/* Posts list */}
              {hasData && (
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                  {data!.posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-md border border-[#E0E0E0]/40 dark:border-white/5 bg-[#FAFAFA] dark:bg-[#262626] p-2"
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <PlatformIcon platform={post.platform} />
                          <span className="text-[9px] font-semibold text-[#666] dark:text-[#CCCCCC] truncate">
                            {post.author}
                          </span>
                          <span className="text-[8px] text-[#999] dark:text-gray-500 shrink-0">
                            · {post.timeLabel}
                          </span>
                        </div>
                        <SentimentBadge label={post.sentimentLabel} score={post.sentimentScore} />
                      </div>
                      <p className="text-[10px] leading-relaxed text-[#444] dark:text-[#DDD] line-clamp-3">
                        {post.topQuote || post.content}
                      </p>
                      {post.url && post.url !== '#' && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 mt-1 text-[8px] font-semibold text-[#6C2BD9] dark:text-[#8B5CF6] hover:underline"
                        >
                          <ExternalLink className="size-2.5" /> Source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sentiment distribution bar */}
              {hasData && totalPosts > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-[#E0E0E0]/40 dark:border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-wide text-[#999] dark:text-gray-500">
                      Fan Sentiment Split
                    </span>
                    <span className="text-[8px] text-[#999] dark:text-gray-500">
                      {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                    <div
                      className="bg-[#10B981]"
                      style={{ width: `${split.positive}%` }}
                      title={`${split.positive}% positive`}
                    />
                    <div
                      className="bg-[#FF6B35]"
                      style={{ width: `${split.neutral}%` }}
                      title={`${split.neutral}% neutral`}
                    />
                    <div
                      className="bg-[#EF4444]"
                      style={{ width: `${split.negative}%` }}
                      title={`${split.negative}% negative`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[8px] font-semibold">
                    <span className="text-[#10B981]">😊 {split.positive}%</span>
                    <span className="text-[#FF6B35]">😐 {split.neutral}%</span>
                    <span className="text-[#EF4444]">😡 {split.negative}%</span>
                  </div>
                </div>
              )}

              {/* Freshness footer */}
              {hasData && data?.freshnessLabel && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <span className="size-1 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[8px] text-[#999] dark:text-gray-500">
                    Updated {data.freshnessLabel}
                    {data.monitorLabel ? ` · ${data.monitorLabel}` : ''}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
