'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2, Twitter, MessageSquare, Globe, Star, Sparkles,
  ExternalLink, ShieldCheck, TrendingUp, TrendingDown, Minus, X,
} from 'lucide-react'
import FlagImage from '@/components/common/FlagImage'
import { getPulseScoreColor, getPulseScoreColorClass } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvidencePost {
  id: string
  text: string
  author: string
  sourceUrl: string | null
  platform: string
  sentimentLabel: string
  sentimentScore: number
  matchRating: number | null
  createdAt: string
}

interface EvidenceRating {
  overall: number
  socialScore: number
  matchScore: number
  narrativeScore: number
  momentumScore: number
  confidence: number
  evidenceCount: number
  reasoning: string
  matchRatingAvg: number | null
}

interface EvidenceResponse {
  ok: boolean
  rating: EvidenceRating | null
  posts: EvidencePost[]
  count: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const platformIcon = (p: string) => {
  if (p === 'twitter') return Twitter
  if (p === 'reddit') return MessageSquare
  return Globe
}

const sentimentBadge = (label: string, score: number) => {
  const cls =
    label === 'POSITIVE'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : label === 'NEGATIVE'
        ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
        : label === 'MIXED'
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
          : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-semibold ${cls}`}>
      {label} {Math.round(score)}%
    </Badge>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EvidenceModalProps {
  playerId: string | null
  playerName?: string
  nationCode?: string
  onClose: () => void
}

export function EvidenceModal({ playerId, playerName, nationCode, onClose }: EvidenceModalProps) {
  const [data, setData] = useState<EvidenceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!playerId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai-rate-player?playerId=${encodeURIComponent(playerId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as EvidenceResponse
      setData(json)
    } catch (err) {
      console.error('evidence fetch failed', err)
      setError('Failed to load evidence')
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => {
    if (playerId) {
      setData(null)
      load()
    }
  }, [playerId, load])

  const open = playerId !== null
  const rating = data?.rating
  const posts = data?.posts ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/50 space-y-2">
          <div className="flex items-center gap-3">
            {nationCode && (
              <div className="w-9 h-7 overflow-hidden rounded flex-shrink-0">
                <FlagImage nationCode={nationCode} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                {playerName || 'Player'} — AI Rating Evidence
              </DialogTitle>
              <DialogDescription className="text-xs">
                Semi-auto rating · AI suggests, admin curates · social-first evidence
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
              <p className="text-sm">Loading evidence…</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500 text-sm">{error}</div>
          )}

          {!loading && !error && (
            <>
              {/* AI Rating summary card */}
              {rating ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-950/10 to-background p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center w-14 h-14 rounded-xl text-white text-2xl font-black shadow-md"
                        style={{ backgroundColor: getPulseScoreColor(rating.overall) }}
                      >
                        {Math.round(rating.overall)}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-purple-500 font-semibold">AI Overall</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                            {Math.round(rating.confidence * 100)}% confidence
                          </Badge>
                          <span className="text-xs text-muted-foreground">{rating.evidenceCount} posts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Component split */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Social', value: rating.socialScore, primary: true },
                      { label: 'Match', value: rating.matchScore },
                      { label: 'Narrative', value: rating.narrativeScore },
                      { label: 'Momentum', value: rating.momentumScore },
                    ].map((c) => (
                      <div key={c.label} className="text-center">
                        <div className={`text-lg font-bold ${c.primary ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                          {Math.round(c.value)}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {c.label}{c.primary ? ' ★' : ''}
                        </div>
                      </div>
                    ))}
                  </div>

                  {rating.matchRatingAvg !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Star className="w-3 h-3 text-amber-500" />
                      Admin match rating avg: <strong className="text-foreground">{rating.matchRatingAvg.toFixed(1)}/10</strong>
                    </div>
                  )}

                  {rating.reasoning && (
                    <div className="rounded-lg bg-background/60 border border-border/40 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-purple-500 font-semibold mb-1">AI Reasoning</div>
                      <p className="text-sm leading-relaxed text-foreground/90">{rating.reasoning}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No AI rating generated yet for this player. An admin needs to curate posts and click <strong className="text-foreground">Generate AI Rating</strong> in the admin panel.
                </div>
              )}

              {/* Evidence posts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Twitter className="w-3.5 h-3.5 text-purple-500" />
                    Curated Social Evidence
                  </h4>
                  <span className="text-xs text-muted-foreground">{posts.length} post(s)</span>
                </div>

                {posts.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                    No curated posts yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto modal-scroll pr-1">
                    {posts.map((post) => {
                      const PIcon = platformIcon(post.platform)
                      return (
                        <div
                          key={post.id}
                          className="rounded-lg border border-border/50 bg-background/60 p-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                              <PIcon className="w-3.5 h-3.5 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-xs font-medium">@{post.author}</span>
                                {sentimentBadge(post.sentimentLabel, post.sentimentScore)}
                                {post.matchRating !== null && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                    <Star className="w-2.5 h-2.5 mr-0.5" /> {post.matchRating}/10
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed">{post.text}</p>
                              {post.sourceUrl && (
                                <a
                                  href={post.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-purple-500 hover:underline mt-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" /> view source
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Evidence badge (for inline display on cards) ──────────────────────────────

interface EvidenceBadgeProps {
  evidenceCount: number
  hasAIRating: boolean
  confidence?: number
  onClick?: () => void
  className?: string
}

export function EvidenceBadge({ evidenceCount, hasAIRating, confidence, onClick, className }: EvidenceBadgeProps) {
  if (evidenceCount === 0 && !hasAIRating) return null

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 ${
        hasAIRating
          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25'
          : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 hover:bg-slate-500/25'
      } ${className ?? ''}`}
      title={hasAIRating ? `AI-rated from ${evidenceCount} posts` : `${evidenceCount} curated post(s), not yet AI-rated`}
    >
      {hasAIRating ? (
        <>
          <Sparkles className="w-2.5 h-2.5" />
          AI · {evidenceCount}
          {confidence !== undefined && (
            <span className="opacity-70">· {Math.round(confidence * 100)}%</span>
          )}
        </>
      ) : (
        <>
          <Twitter className="w-2.5 h-2.5" />
          {evidenceCount} post{evidenceCount !== 1 ? 's' : ''}
        </>
      )}
    </button>
  )
}
