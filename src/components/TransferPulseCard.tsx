'use client'

import { ArrowRight, TrendingUp, TrendingDown, Minus, BadgeCheck, Zap } from 'lucide-react'

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
  topSources: {
    journalistName: string
    journalistHandle: string
    outlet: string
    url: string
    headline: string
    reportedAt: string
  }[]
}

interface TransferPulseCardProps {
  saga: TransferSagaSummary
  onClick: (saga: TransferSagaSummary) => void
}

const TREND_ICON: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  rising: { icon: TrendingUp, color: 'text-[#10B981]', label: 'Rising' },
  falling: { icon: TrendingDown, color: 'text-[#EF4444]', label: 'Falling' },
  stable: { icon: Minus, color: 'text-[#999]', label: 'Stable' },
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

  // Stacked sentiment bar widths (excited / skeptical / dreading / neutral)
  const neutralPct = Math.max(0, 100 - saga.excitedPct - saga.skepticalPct - saga.dreadingPct)

  return (
    <button
      onClick={() => onClick(saga)}
      className="group relative w-full text-left rounded-2xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10 p-4 hover:border-[#6C2BD9]/40 dark:hover:border-[#8B5CF6]/40 hover:shadow-lg hover:shadow-[#6C2BD9]/5 transition-all duration-200"
    >
      {/* RUMOR label — anti-hallucination, always visible */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {sBadge && (
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${sBadge.cls}`}>
            {sBadge.label}
          </span>
        )}
        <span className="px-1.5 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35] text-[8px] font-extrabold tracking-wider border border-[#FF6B35]/20">
          RUMOR
        </span>
      </div>

      {/* Player + move header */}
      <div className="pr-16">
        <h3 className="text-[15px] font-bold text-[#1A1A1A] dark:text-white leading-tight">
          {saga.playerName}
        </h3>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#666] dark:text-gray-400">
          <span className="font-medium">{saga.fromClubName || '—'}</span>
          <ArrowRight className="size-3 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">
            {saga.toClubName}
          </span>
        </div>
        {saga.feeReported && (
          <p className="mt-0.5 text-[10px] text-[#999] dark:text-gray-500">
            Fee: <span className="font-semibold text-[#666] dark:text-gray-300">{saga.feeReported}</span>
          </p>
        )}
      </div>

      {/* Tier 1 corroboration */}
      <div className="mt-3 flex items-center gap-1.5">
        <BadgeCheck className="size-3.5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
        <span className="text-[10px] font-semibold text-[#6C2BD9] dark:text-[#8B5CF6]">
          {saga.tier1Count} Tier 1 {saga.tier1Count === 1 ? 'source' : 'sources'}
        </span>
        <span className="text-[10px] text-[#999] dark:text-gray-500">
          · {timeAgo(saga.firstReportedAt)}
        </span>
      </div>

      {/* Sentiment stacked bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[#999] dark:text-gray-500">
            Fan Sentiment
          </span>
          <span className="text-[9px] text-[#999] dark:text-gray-500">
            {saga.buzzVolume} {saga.buzzVolume === 1 ? 'post' : 'posts'}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex bg-[#F0F0F0] dark:bg-white/5">
          <div className="bg-[#10B981]" style={{ width: `${saga.excitedPct}%` }} title={`Excited ${saga.excitedPct}%`} />
          <div className="bg-[#F59E0B]" style={{ width: `${saga.skepticalPct}%` }} title={`Skeptical ${saga.skepticalPct}%`} />
          <div className="bg-[#EF4444]" style={{ width: `${saga.dreadingPct}%` }} title={`Dreading ${saga.dreadingPct}%`} />
          <div className="bg-[#999]/40" style={{ width: `${neutralPct}%` }} title={`Neutral ${neutralPct.toFixed(0)}%`} />
        </div>
        <div className="flex items-center gap-2.5 mt-1.5 text-[9px]">
          <span className="flex items-center gap-1 text-[#10B981]">
            <span className="size-1.5 rounded-full bg-[#10B981]" />
            {saga.excitedPct.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1 text-[#F59E0B]">
            <span className="size-1.5 rounded-full bg-[#F59E0B]" />
            {saga.skepticalPct.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1 text-[#EF4444]">
            <span className="size-1.5 rounded-full bg-[#EF4444]" />
            {saga.dreadingPct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Footer: buzz trend + fan-read likelihood */}
      <div className="mt-3 pt-3 border-t border-[#E0E0E0]/60 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Zap className={`size-3.5 ${trend.color}`} />
          <span className={`text-[10px] font-semibold ${trend.color}`}>{trend.label}</span>
          <TrendIcon className={`size-3 ${trend.color} ml-0.5`} />
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${lik.bg}`}>
          <span className={`text-[10px] font-bold ${lik.text}`}>{saga.fanReadLikelihood.toFixed(0)}%</span>
          <span className="text-[8px] uppercase tracking-wider text-[#999] dark:text-gray-500">fan read</span>
        </div>
      </div>

      {/* Top Tier 1 source */}
      {topSrc && (
        <div className="mt-2.5 text-[10px] text-[#999] dark:text-gray-500">
          <span className="font-semibold text-[#666] dark:text-gray-300">{topSrc.journalistName}</span>
          <span className="mx-1">·</span>
          <span>{topSrc.outlet}</span>
        </div>
      )}
    </button>
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
