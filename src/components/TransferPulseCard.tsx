'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, TrendingUp, TrendingDown, Minus, BadgeCheck, Zap, ThumbsUp, ThumbsDown, Meh } from 'lucide-react'
import ClubLogo from '@/components/common/ClubLogo'

export interface TransferSagaSummary {
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
  resolvedAt: string | null
  resolutionUrl: string | null
  resolutionNotes?: string | null
  playerPhotoUrl?: string | null
  topSources: {
    journalistName: string
    journalistHandle: string
    outlet: string
    url: string | null
    headline: string
    reportedAt: string
  }[]
  // ── Fan vote aggregation (from /api/transfers) ──
  voteCounts?: {
    good: number
    mixed: number
    bad: number
    total: number
  }
  credibilityLabel?: string
}

interface TransferPulseCardProps {
  saga: TransferSagaSummary
  onClick: (saga: TransferSagaSummary) => void
}

const TREND_ICON: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  rising: { icon: TrendingUp, color: 'text-[#10B981]', label: 'Rising' },
  falling: { icon: TrendingDown, color: 'text-[#EF4444]', label: 'Falling' },
  stable: { icon: Minus, color: 'text-[#6B7280] dark:text-gray-400', label: 'Stable' },
}

function likelihoodColor(pct: number): { bg: string; text: string } {
  if (pct >= 70) return { bg: 'bg-[#10B981]/15', text: 'text-[#10B981]' }
  if (pct >= 45) return { bg: 'bg-[#F59E0B]/15', text: 'text-[#F59E0B]' }
  return { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]' }
}

function statusBadge(status: string): { label: string; cls: string } | null {
  if (status === 'completed') return { label: 'DONE', cls: 'bg-[#10B981]/15 text-[#10B981]' }
  if (status === 'debunked') return { label: 'DEBUNKED', cls: 'bg-[#EF4444]/15 text-[#EF4444] line-through' }
  return null
}

export default function TransferPulseCard({ saga, onClick }: TransferPulseCardProps) {
  const trend = TREND_ICON[saga.buzzTrend] ?? TREND_ICON.stable
  const TrendIcon = trend.icon
  const lik = likelihoodColor(saga.fanReadLikelihood)
  const sBadge = statusBadge(saga.status)
  const topSrc = saga.topSources[0]

  // ── Fan voting state ──
  const [userVote, setUserVote] = useState<string | null>(null)
  const [voteCounts, setVoteCounts] = useState(saga.voteCounts ?? { good: 0, mixed: 0, bad: 0, total: 0 })
  const [voting, setVoting] = useState(false)

  // Load user's previous vote from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`transfer_vote_${saga.id}`)
      if (stored) setUserVote(stored)
    } catch {}
  }, [saga.id])

  // Compute live percentages
  const total = voteCounts.total
  const goodPct = total > 0 ? Math.round((voteCounts.good / total) * 100) : 0
  const mixedPct = total > 0 ? Math.round((voteCounts.mixed / total) * 100) : 0
  const badPct = total > 0 ? Math.round((voteCounts.bad / total) * 100) : 0
  const pulseScore = total > 0
    ? Math.round(((voteCounts.good * 10 + voteCounts.mixed * 5 + voteCounts.bad * 0) / total) * 10) / 10
    : 0
  const approvalLabel = goodPct >= 70 ? '🔥 Excellent' : goodPct >= 50 ? '👍 Good' : goodPct >= 30 ? '😐 Mixed' : '👎 Poor'

  // Handle vote
  async function handleVote(vote: 'good' | 'mixed' | 'bad', e: React.MouseEvent) {
    e.stopPropagation() // Don't trigger card click
    if (voting || userVote === vote) return

    setVoting(true)
    setUserVote(vote)
    try {
      localStorage.setItem(`transfer_vote_${saga.id}`, vote)
    } catch {}

    // Get or create session ID
    let sessionId = ''
    try {
      sessionId = localStorage.getItem('fan_session_id') || ''
      if (!sessionId) {
        sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
        localStorage.setItem('fan_session_id', sessionId)
      }
    } catch {
      sessionId = `s_${Date.now()}`
    }

    try {
      const res = await fetch(`/api/transfers/${saga.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, sessionId }),
      })
      if (res.ok) {
        const data = await res.json()
        setVoteCounts({
          good: Math.round((data.good / 100) * (total + 1)),
          mixed: Math.round((data.mixed / 100) * (total + 1)),
          bad: Math.round((data.bad / 100) * (total + 1)),
          total: data.totalVotes,
        })
      }
    } catch (err) {
      console.error('Vote failed:', err)
    } finally {
      setVoting(false)
    }
  }

  // Stacked sentiment bar widths (excited / skeptical / dreading / neutral)
  const neutralPct = Math.max(0, 100 - saga.excitedPct - saga.skepticalPct - saga.dreadingPct)

  // ANTI-MISLEADING-DATA: when there are 0 fan posts, we must NOT render the
  // 0% / 0% / 0% sentiment bar — that presents empty data as zero-sentiment.
  const hasFanPosts = saga.buzzVolume > 0

  return (
    <div
      onClick={() => onClick(saga)}
      className="group relative w-full text-left rounded-2xl glass-card glass-hover glass-card-mobile-flat border border-[#E0E0E0] dark:border-white/10 p-4 hover:border-[#6C2BD9]/40 dark:hover:border-[#8B5CF6]/40 hover:shadow-lg hover:shadow-[#6C2BD9]/5 transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
    >
      {/* Credibility label — top right */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {sBadge && (
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${sBadge.cls}`}>
            {sBadge.label}
          </span>
        )}
        {/* Credibility label: ✅ Confirmed / 📰 Reported / 💬 Rumour */}
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border ${
          saga.credibilityLabel === 'Confirmed'
            ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
            : saga.credibilityLabel === 'Debunked'
            ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
            : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
        }`}>
          {saga.credibilityLabel === 'Confirmed' ? '✅' : saga.credibilityLabel === 'Debunked' ? '❌' : '📰'} {saga.credibilityLabel ?? 'Reported'}
        </span>
      </div>

      {/* Player + move header */}
      <div className="pr-24">
        <h3 className="text-[15px] font-bold text-[#1A1A1A] dark:text-white leading-tight">
          {saga.playerName}
        </h3>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#666] dark:text-gray-400">
          <ClubLogo code={saga.fromClubCode} name={saga.fromClubName} size={18} />
          <span className="font-medium">{saga.fromClubName || '—'}</span>
          <ArrowRight className="size-3 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          <ClubLogo code={saga.toClubCode} name={saga.toClubName} size={18} />
          <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">
            {saga.toClubName}
          </span>
        </div>
        {saga.feeReported && (
          <p className="mt-0.5 text-[10px] text-[#6B7280] dark:text-gray-400">
            Fee: <span className="font-semibold text-[#666] dark:text-gray-300">{saga.feeReported}</span>
          </p>
        )}
      </div>

      {/* Tier 1 corroboration */}
      <div className="mt-3 flex items-center gap-1.5">
        <BadgeCheck className="size-3.5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
        <span className="text-[10px] font-semibold text-[#6C2BD9] dark:text-[#8B5CF6]">
          <span className="brutalist-number">{saga.tier1Count}</span> Tier 1 {saga.tier1Count === 1 ? 'source' : 'sources'}
        </span>
        <span className="text-[10px] text-[#6B7280] dark:text-gray-400">
          · {timeAgo(saga.firstReportedAt)}
        </span>
      </div>

      {/* Sentiment stacked bar — OR honest empty placeholder when 0 posts */}
      {hasFanPosts ? (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-gray-400">
              Fan Sentiment
            </span>
            <span className="text-[11px] text-[#6B7280] dark:text-gray-400">
              <span className="brutalist-number">{saga.buzzVolume}</span> {saga.buzzVolume === 1 ? 'post' : 'posts'}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-[#F0F0F0] dark:bg-white/5">
            <div className="bg-[#10B981]" style={{ width: `${saga.excitedPct}%` }} title={`Excited ${saga.excitedPct}%`} />
            <div className="bg-[#F59E0B]" style={{ width: `${saga.skepticalPct}%` }} title={`Skeptical ${saga.skepticalPct}%`} />
            <div className="bg-[#EF4444]" style={{ width: `${saga.dreadingPct}%` }} title={`Dreading ${saga.dreadingPct}%`} />
            <div className="bg-[#999]/40" style={{ width: `${neutralPct}%` }} title={`Neutral ${neutralPct.toFixed(0)}%`} />
          </div>
          {/* ANTI-MISLEADING-DATA: when all 3 sentiment labels are 0%, the bar
              is 100% neutral. Show "Neutral X%" instead of "0% 0% 0%" which
              looks like empty data even though there are real posts. */}
          {saga.excitedPct === 0 && saga.skepticalPct === 0 && saga.dreadingPct === 0 ? (
            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
              <span className="flex items-center gap-1 text-[#6B7280] dark:text-gray-400">
                <span className="size-1.5 rounded-full bg-[#999]/60" />
                Neutral <span className="brutalist-number">{neutralPct.toFixed(0)}%</span>
              </span>
              <span className="text-[#6B7280] dark:text-gray-400 italic">
                · fans haven't taken a strong stance
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mt-1.5 text-[11px]">
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
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-[#E0E0E0] dark:border-white/10 bg-[#F8F9FA]/50 dark:bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-[#6B7280] dark:text-gray-400 leading-snug">
            No fan posts yet — sentiment will appear when fans react
          </p>
        </div>
      )}

      {/* Footer: buzz trend + fan-read likelihood */}
      <div className="mt-3 pt-3 border-t border-[#E0E0E0]/60 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Zap className={`size-3.5 ${trend.color}`} />
          <span className={`text-[10px] font-semibold ${trend.color}`}>{trend.label}</span>
          <TrendIcon className={`size-3 ${trend.color} ml-0.5`} />
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${lik.bg}`}>
          <span className={`brutalist-number text-[10px] font-bold ${lik.text}`}>{saga.fanReadLikelihood.toFixed(0)}%</span>
          <span className="text-[8px] uppercase tracking-wider text-[#6B7280] dark:text-gray-400">fan read</span>
        </div>
      </div>

      {/* Top Tier 1 source */}
      {topSrc && (
        <div className="mt-2.5 text-[10px] text-[#6B7280] dark:text-gray-400">
          <span className="font-semibold text-[#666] dark:text-gray-300">{topSrc.journalistName}</span>
          <span className="mx-1">·</span>
          <span>{topSrc.outlet}</span>
        </div>
      )}

      {/* ── FAN VOTING SECTION ──────────────────────────────────────────── */}
      {/* "Is this a good signing?" — the core of the transfer feedback loop */}
      <div className="mt-3 pt-3 border-t border-[#E0E0E0]/60 dark:border-white/5">
        <p className="text-[11px] font-bold text-[#1A1A1A] dark:text-white text-center mb-2">
          Is this a good signing?
        </p>

        {/* Voting buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={(e) => handleVote('good', e)}
            disabled={voting}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              userVote === 'good'
                ? 'bg-[#10B981] text-white'
                : 'bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20'
            } disabled:opacity-50`}
          >
            <ThumbsUp className="size-3" />
            Good
          </button>
          <button
            onClick={(e) => handleVote('mixed', e)}
            disabled={voting}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              userVote === 'mixed'
                ? 'bg-[#F59E0B] text-white'
                : 'bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20'
            } disabled:opacity-50`}
          >
            <Meh className="size-3" />
            Mixed
          </button>
          <button
            onClick={(e) => handleVote('bad', e)}
            disabled={voting}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              userVote === 'bad'
                ? 'bg-[#EF4444] text-white'
                : 'bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20'
            } disabled:opacity-50`}
          >
            <ThumbsDown className="size-3" />
            Bad
          </button>
        </div>

        {/* Live results */}
        {total > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {/* Approval bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#10B981]">{goodPct}%</span>
              <div className="flex-1 h-2 rounded-full bg-[#E0E0E0] dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-[#10B981] transition-all duration-500" style={{ width: `${goodPct}%` }} />
              </div>
              <span className="text-[10px] font-bold text-[#EF4444]">{badPct}%</span>
            </div>

            {/* Fan Pulse score + vote count */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#1A1A1A] dark:text-white">
                {approvalLabel}
              </span>
              <span className="text-[#6B7280] dark:text-gray-400">
                Fan Pulse: <span className="font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">{pulseScore}/10</span>
              </span>
              <span className="text-[#6B7280] dark:text-gray-400">
                {total} {total === 1 ? 'vote' : 'votes'}
              </span>
            </div>
          </div>
        )}

        {/* Call to vote (before voting) */}
        {total === 0 && (
          <p className="text-[10px] text-center text-[#6B7280] dark:text-gray-400 mt-1.5">
            Be the first to vote
          </p>
        )}
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
