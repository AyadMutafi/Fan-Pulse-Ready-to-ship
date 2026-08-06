'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ArrowRight, BadgeCheck, ExternalLink, CheckCircle2, XCircle,
  MessageCircle,
} from 'lucide-react'
import type { TransferSagaSummary } from '@/components/TransferPulseCard'

interface SagaDetail {
  saga: TransferSagaSummary
  sources: {
    id: string
    journalistName: string
    journalistHandle: string
    outlet: string
    // null when the stored URL failed snowflake validation (fabricated seed
    // data). Render non-clickable when null.
    url: string | null
    headline: string
    reportedAt: string
  }[]
  posts: {
    id: string
    platform: string
    author: string
    content: string
    // null when the stored URL failed snowflake validation (fabricated seed
    // data). Render as a non-clickable sentiment sample when null.
    url: string | null
    sentimentScore: number
    sentimentLabel: string
    postedAt: string
  }[]
  timeline: {
    date: string
    excitedPct: number
    skepticalPct: number
    dreadingPct: number
    avgSentiment: number
    postCount: number
  }[]
  resolutionUrl?: string | null
}

interface TransferSagaDetailProps {
  saga: TransferSagaSummary | null
  onClose: () => void
}

const SENTIMENT_COLOR: Record<string, string> = {
  excited: 'text-[#10B981] bg-[#10B981]/10',
  skeptical: 'text-[#F59E0B] bg-[#F59E0B]/10',
  dreading: 'text-[#EF4444] bg-[#EF4444]/10',
  neutral: 'text-[#6B7280] dark:text-gray-400 bg-[#999]/10',
}

// Sentiments are ALWAYS presented as emojis across the whole app.
const SENTIMENT_EMOJI: Record<string, string> = {
  excited: '🤩',
  skeptical: '🤔',
  dreading: '😰',
  neutral: '😐',
}

export default function TransferSagaDetail({ saga, onClose }: TransferSagaDetailProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!saga) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [saga])

  // Esc to close
  useEffect(() => {
    if (!saga) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saga, onClose])

  return (
    <AnimatePresence>
      {saga && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full md:max-w-2xl max-h-[92vh] md:max-h-[88vh] overflow-hidden rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-white/10 flex flex-col"
          >
            {/* key={saga.id} remounts the inner on each new saga → fresh state */}
            <TransferSagaDetailContent key={saga.id} saga={saga} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Inner content (keyed, fresh state per saga) ──────────────────────────────

function TransferSagaDetailContent({
  saga,
  onClose,
}: {
  saga: TransferSagaSummary
  onClose: () => void
}) {
  const [detail, setDetail] = useState<SagaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/transfers/${saga.id}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (!cancelled) setDetail({ saga, ...json })
      })
      .catch((e) => {
        if (!cancelled) setError(String(e).slice(0, 120))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [saga])

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-3 border-b border-[#E0E0E0]/60 dark:border-white/5">
        <div className="pr-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35] text-[11px] font-extrabold tracking-wider border border-[#FF6B35]/20">
              RUMOR
            </span>
            {saga.status === 'completed' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] text-[11px] font-bold">
                <CheckCircle2 className="size-3" /> DONE
              </span>
            )}
            {saga.status === 'debunked' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#EF4444]/15 text-[#EF4444] text-[11px] font-bold line-through">
                <XCircle className="size-3" /> DEBUNKED
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white leading-tight">
            {saga.playerName}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <span className="font-medium text-[#666] dark:text-gray-400">
              {saga.fromClubName || '—'}
            </span>
            <ArrowRight className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
            <span className="font-bold text-[#1A1A1A] dark:text-gray-100">
              {saga.toClubName}
            </span>
          </div>
          {saga.feeReported && (
            <p className="mt-1 text-xs text-[#6B7280] dark:text-gray-400">
              Reported fee: <span className="font-semibold text-[#666] dark:text-gray-300">{saga.feeReported}</span>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 size-8 rounded-full flex items-center justify-center text-[#6B7280] dark:text-gray-400 hover:bg-[#F0F0F0] dark:hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Resolution banner */}
      {saga.status === 'debunked' && (
        <div className="mx-5 mt-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 p-3 text-[11px] text-[#EF4444] flex items-start gap-2">
          <XCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>
              This rumor was <strong>debunked</strong> and archived. The Tier 1
              reports and fan posts below are preserved as an audit trail —
              nothing is deleted.
            </span>
            {detail?.saga?.resolutionUrl && (
              <a
                href={detail.saga.resolutionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold underline hover:no-underline focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
              >
                <ExternalLink className="size-3" />
                View debunk source
              </a>
            )}
          </div>
        </div>
      )}
      {saga.status === 'completed' && (
        <div className="mx-5 mt-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 p-3 text-[11px] text-[#10B981] flex items-start gap-2">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>
              This transfer was <strong>confirmed</strong> by a Tier 1
              journalist. The saga is now archived.
            </span>
            {detail?.saga?.resolutionUrl && (
              <a
                href={detail.saga.resolutionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold underline hover:no-underline focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
              >
                <ExternalLink className="size-3" />
                View official confirmation
              </a>
            )}
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 transfers-scroll">
        {loading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-[#F0F0F0] dark:bg-white/5 skeleton-shimmer" />
            ))}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-[#EF4444]/10 p-3 text-xs text-[#EF4444]">
            Failed to load detail: {error}
          </div>
        )}

        {detail && (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Tier 1 sources"
                value={String(detail.saga.tier1Count)}
                icon={<BadgeCheck className="size-3.5 text-[#6C2BD9] dark:text-[#8B5CF6]" />}
              />
              <Stat
                label="Fan posts"
                value={String(detail.saga.buzzVolume)}
                icon={<MessageCircle className="size-3.5 text-[#6C2BD9] dark:text-[#8B5CF6]" />}
              />
              <Stat
                label="Fan-read"
                value={`${detail.saga.fanReadLikelihood.toFixed(0)}%`}
                icon={<TrendIcon trend={detail.saga.buzzTrend} />}
              />
            </div>

            {/* Timeline */}
            {detail.timeline.length > 0 && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-gray-400 mb-2">
                  Sentiment Timeline
                </h3>
                <TimelineChart timeline={detail.timeline} />
              </section>
            )}

            {/* Tier 1 sources */}
            {detail.sources.length > 0 && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-gray-400 mb-2">
                  Tier 1 Reports ({detail.sources.length})
                </h3>
                <div className="space-y-2">
                  {detail.sources.map((s) => {
                    // Anti-hallucination: only render a clickable link when
                    // the URL passed snowflake validation. Fabricated seed
                    // URLs are null'd by the API and rendered as a plain card.
                    const Wrapper = s.url ? 'a' : 'div'
                    const wrapperProps = s.url
                      ? { href: s.url, target: '_blank', rel: 'noopener noreferrer' }
                      : {}
                    return (
                      <Wrapper
                        key={s.id}
                        {...wrapperProps}
                        className="block rounded-xl border border-[#E0E0E0] dark:border-white/10 p-3 hover:border-[#6C2BD9]/40 dark:hover:border-[#8B5CF6]/40 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <BadgeCheck className="size-3.5 shrink-0 text-[#6C2BD9] dark:text-[#8B5CF6]" />
                            <span className="text-xs font-semibold text-[#1A1A1A] dark:text-white truncate">
                              {s.journalistName}
                            </span>
                            <span className="text-[10px] text-[#6B7280] dark:text-gray-400 shrink-0">
                              @{s.journalistHandle} · {s.outlet}
                            </span>
                          </div>
                          {s.url ? (
                            <ExternalLink className="size-3 shrink-0 text-[#6B7280] dark:text-gray-400" />
                          ) : (
                            <span className="text-[8px] text-[#6B7280] dark:text-gray-400 shrink-0 italic">report archived</span>
                          )}
                        </div>
                        {s.headline && (
                          <p className="mt-1 text-[11px] text-[#666] dark:text-gray-300 line-clamp-2">
                            {s.headline}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-[#6B7280] dark:text-gray-400">
                          {new Date(s.reportedAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </Wrapper>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Fan posts */}
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-gray-400 mb-2">
                What Fans Are Saying ({detail.posts.length})
              </h3>
              {detail.posts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E0E0E0] dark:border-white/10 p-4 text-center text-[11px] text-[#6B7280] dark:text-gray-400">
                  No fan posts yet — sentiment will appear when fans react.
                  Ingestion runs on the cron, or on-demand from the admin
                  dashboard. We never show fabricated posts.
                </div>
              ) : (
                <div className="space-y-2">
                  {detail.posts.map((p) => {
                    // Anti-hallucination: fan posts are sentiment samples.
                    // Only render a clickable link when the URL passed
                    // snowflake validation; otherwise render a non-clickable
                    // quote card (the post text + sentiment is still useful
                    // as an aggregated reaction sample).
                    const Wrapper = p.url ? 'a' : 'div'
                    const wrapperProps = p.url
                      ? { href: p.url, target: '_blank', rel: 'noopener noreferrer' }
                      : {}
                    return (
                      <Wrapper
                        key={p.id}
                        {...wrapperProps}
                        className="block rounded-xl border border-[#E0E0E0] dark:border-white/10 p-3 hover:border-[#6C2BD9]/40 dark:hover:border-[#8B5CF6]/40 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <PlatformBadge platform={p.platform} />
                            <span className="text-[11px] font-semibold text-[#1A1A1A] dark:text-gray-200 truncate">
                              @{p.author}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-bold capitalize ${
                              SENTIMENT_COLOR[p.sentimentLabel] ?? SENTIMENT_COLOR.neutral
                            }`}
                            title={`${p.sentimentLabel} · ${p.sentimentScore.toFixed(0)}`}
                          >
                            {SENTIMENT_EMOJI[p.sentimentLabel] ?? '😐'} {p.sentimentScore.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#666] dark:text-gray-300 line-clamp-3">
                          {p.content}
                        </p>
                      </Wrapper>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Anti-hallucination disclaimer */}
            <div className="rounded-xl bg-[#FF6B35]/5 border border-[#FF6B35]/15 p-3 text-[11px] text-[#666] dark:text-gray-400">
              <strong className="text-[#FF6B35]">RUMOR.</strong> This saga
              exists only because a Tier 1 journalist reported it. The
              &ldquo;fan-read&rdquo; likelihood reflects what fans THINK —
              it is not a prediction of whether the transfer will happen.
              Source links point to real posts where verifiable; entries
              marked &ldquo;report archived&rdquo; are preserved without a
              link when the original URL could not be verified.
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#E0E0E0] dark:border-white/10 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className="text-base font-extrabold text-[#1A1A1A] dark:text-white">{value}</span>
      </div>
      <span className="text-[11px] uppercase tracking-wider text-[#6B7280] dark:text-gray-400">
        {label}
      </span>
    </div>
  )
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising') return <span className="text-sm leading-none" title="Rising">📈</span>
  if (trend === 'falling') return <span className="text-sm leading-none" title="Falling">📉</span>
  return <span className="text-sm leading-none" title="Stable">➡️</span>
}

function TimelineChart({
  timeline,
}: {
  timeline: SagaDetail['timeline']
}) {
  const maxPosts = Math.max(1, ...timeline.map((t) => t.postCount))
  return (
    <div className="rounded-xl border border-[#E0E0E0] dark:border-white/10 p-3">
      <div className="flex items-end justify-between gap-1.5 h-24">
        {timeline.map((t) => {
          const neutral = Math.max(0, 100 - t.excitedPct - t.skepticalPct - t.dreadingPct)
          const heightPct = Math.max(8, (t.postCount / maxPosts) * 100)
          return (
            <div key={t.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full rounded-md overflow-hidden flex flex-col-reverse"
                style={{ height: `${heightPct}%` }}
                title={`${t.date}: ${t.postCount} posts · excited ${t.excitedPct}% · skeptical ${t.skepticalPct}% · dreading ${t.dreadingPct}%`}
              >
                <div style={{ height: `${t.excitedPct}%` }} className="bg-[#10B981]" />
                <div style={{ height: `${t.skepticalPct}%` }} className="bg-[#F59E0B]" />
                <div style={{ height: `${t.dreadingPct}%` }} className="bg-[#EF4444]" />
                <div style={{ height: `${neutral}%` }} className="bg-[#999]/40" />
              </div>
              <span className="text-[8px] text-[#6B7280] dark:text-gray-400">
                {t.date.slice(5)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px]">
        <span className="flex items-center gap-1 text-[#10B981]"><span className="size-1.5 rounded-full bg-[#10B981]" />🤩 Excited</span>
        <span className="flex items-center gap-1 text-[#F59E0B]"><span className="size-1.5 rounded-full bg-[#F59E0B]" />🤔 Skeptical</span>
        <span className="flex items-center gap-1 text-[#EF4444]"><span className="size-1.5 rounded-full bg-[#EF4444]" />😰 Dreading</span>
      </div>
    </div>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    twitter: { label: '𝕏', cls: 'bg-black text-white dark:bg-white dark:text-black' },
    reddit: { label: 'r/', cls: 'bg-[#FF4500] text-white' },
    web: { label: '🌐', cls: 'bg-[#999] text-white' },
    instagram: { label: 'IG', cls: 'bg-[#E1306C] text-white' },
    youtube: { label: 'YT', cls: 'bg-[#FF0000] text-white' },
    facebook: { label: 'f', cls: 'bg-[#1877F2] text-white' },
    tiktok: { label: 'TT', cls: 'bg-black text-white' },
  }
  const p = map[platform] ?? map.web
  return (
    <span className={`shrink-0 size-4 rounded flex items-center justify-center text-[8px] font-bold ${p.cls}`}>
      {p.label}
    </span>
  )
}
