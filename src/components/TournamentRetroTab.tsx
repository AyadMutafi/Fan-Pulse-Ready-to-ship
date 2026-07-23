'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Share2, Check, Lock, TrendingUp, TrendingDown, Award, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SharePulseButton } from '@/components/common/SharePulseButton'
import { TrendIcon } from '@/components/common/TrendIcon'
import FlagImage from '@/components/common/FlagImage'
import { findNationalTeam } from '@/lib/national-teams'
import { useFlagMode } from '@/lib/flag-mode'
import { getPulseFaceEmoji, type Trend } from '@/types'
import { toast } from 'sonner'

// ── Types (mirrors src/app/api/tournament-retro/route.ts verified response) ───

interface RetroPick {
  id: string
  name: string
  nationCode: string
  nationName?: string
  position: string
  tournamentScore: number
  pulseScore?: number
  sentiment?: number
  matchInfo: string | null
  trend: Trend
  isAwardWinner?: boolean
  awardName?: string
}
interface RetroSide {
  formation: string
  players: RetroPick[]
}
interface TournamentFacts {
  winner: string
  runnerUp: string
  finalScore: string
  finalScorer: string
  goldenBall: string
  goldenBoot: string
  goldenGlove: string
  silverBoot: string
  bestYoungPlayer: string
  sources: string[]
  verifiedAt: string
}
interface TournamentRetroResult {
  elite: RetroSide
  crisis: RetroSide
  tournamentFacts: TournamentFacts
  disclaimer: string
  generatedAt: string
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TournamentRetroModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Main modal ───────────────────────────────────────────────────────────────

export function TournamentRetroModal({ open, onOpenChange }: TournamentRetroModalProps) {
  const [data, setData] = useState<TournamentRetroResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode: flagMode } = useFlagMode()
  const [showSources, setShowSources] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tournament-retro')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as TournamentRetroResult
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !data && !loading) {
      fetchData()
    }
  }, [open, data, loading, fetchData])

  // Share text — branded, summarises the retro for the share sheet.
  const shareText = data
    ? `🏆 Team of the Tournament — 2026 FIFA World Cup\n${data.tournamentFacts.winner} won · ${data.tournamentFacts.finalScore}\n\nElite XI: ${data.elite.players
        .map(p => p.name + (p.isAwardWinner ? ' 🏆' : ''))
        .join(', ')}\n\nCrisis XI: ${data.crisis.players
        .map(p => p.name)
        .join(', ')}\n\nSee the full breakdown on Fan Pulse:`
    : '🏆 Team of the Tournament — 2026 FIFA World Cup on Fan Pulse'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto bg-white dark:bg-[#1A1A1A] border-[#E0E0E0] dark:border-white/10 p-0">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur border-b border-[#E0E0E0]/50 dark:border-white/10 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-[#1A1A1A] dark:text-white">
                <Trophy className="size-5 text-[#F59E0B]" />
                Team of the Tournament
                <span className="text-xs font-bold text-[#666] dark:text-[#CCCCCC]">2026 FIFA World Cup</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#666] dark:text-[#CCCCCC]">
                The heroes and villains, ranked by real fan sentiment across all 64 matches
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin size-8 rounded-full border-2 border-[#F59E0B]/30 border-t-[#F59E0B]" />
              <p className="mt-3 text-sm text-[#666] dark:text-[#CCCCCC]">Ranking all 64 matches…</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-4 text-center">
              <p className="text-sm font-bold text-[#EF4444]">Couldn&apos;t load the retro</p>
              <p className="mt-1 text-xs text-[#666] dark:text-[#CCCCCC]">{error}</p>
              <Button size="sm" className="mt-3" onClick={fetchData}>Retry</Button>
            </div>
          )}

          {data && !loading && !error && (
            <>
              {/* Tournament facts banner */}
              <TournamentFactsBanner facts={data.tournamentFacts} />

              <RetroFormationCard side={data.elite} variant="elite" flagMode={flagMode} />
              <RetroFormationCard side={data.crisis} variant="crisis" flagMode={flagMode} />

              {/* Share + disclaimer */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <SharePulseButton
                  className="flex-1 w-full"
                  text={shareText}
                  title="Fan Pulse — Team of the Tournament 2026"
                />
                <ShareAsImageButton text={shareText} />
              </div>

              {/* Disclaimer + sources */}
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/5 px-3 py-2">
                  <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-[#F59E0B]" />
                  <p className="text-[10px] leading-relaxed text-[#666] dark:text-[#CCCCCC]">
                    <span className="font-bold text-[#1A1A1A] dark:text-white">Verified lineup.</span>{' '}
                    {data.disclaimer}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSources(v => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-[#E0E0E0]/60 dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] px-3 py-2 text-left hover:bg-[#F0F1F2] dark:hover:bg-[#333] transition-colors"
                  aria-expanded={showSources}
                >
                  <span className="text-[10px] font-bold text-[#666] dark:text-[#CCCCCC] uppercase tracking-wide">
                    Sources ({data.tournamentFacts.sources.length}) · verified {data.tournamentFacts.verifiedAt}
                  </span>
                  {showSources
                    ? <ChevronUp className="size-3.5 text-[#666] dark:text-[#CCCCCC]" />
                    : <ChevronDown className="size-3.5 text-[#666] dark:text-[#CCCCCC]" />}
                </button>
                <AnimatePresence>
                  {showSources && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden rounded-lg border border-[#E0E0E0]/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] px-3 py-2 space-y-1"
                    >
                      {data.tournamentFacts.sources.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[10px] text-[#666] dark:text-[#CCCCCC]">
                          <span className="shrink-0 mt-0.5 size-1 rounded-full bg-[#F59E0B]" />
                          {s}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tournament facts banner ───────────────────────────────────────────────────

function TournamentFactsBanner({ facts }: { facts: TournamentFacts }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden border-2 border-[#F59E0B]/40 shadow-sm"
    >
      <div
        className="h-1 w-full"
        style={{ background: 'linear-gradient(to right, #F59E0B, #FBBF24, #F59E0B)' }}
      />
      <div className="px-4 py-3 bg-gradient-to-br from-[#F59E0B]/10 to-[#FBBF24]/5">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="size-4 text-[#F59E0B]" />
          <p className="text-sm font-black text-[#1A1A1A] dark:text-white">
            {facts.winner} won the 2026 World Cup
          </p>
          <Badge className="bg-[#F59E0B] text-white border-0 text-[9px] font-bold px-1.5 py-0">
            {facts.finalScore}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FactPill icon={<Award className="size-3" />} label="Golden Ball" value={facts.goldenBall} />
          <FactPill icon={<Award className="size-3" />} label="Golden Boot" value={facts.goldenBoot} />
          <FactPill icon={<Award className="size-3" />} label="Golden Glove" value={facts.goldenGlove} />
          <FactPill icon={<Award className="size-3" />} label="Best Young" value={facts.bestYoungPlayer} />
        </div>
      </div>
    </motion.div>
  )
}

function FactPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 dark:bg-white/5 border border-[#F59E0B]/20 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[#F59E0B]">
        {icon}
        <span className="text-[8px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-[#1A1A1A] dark:text-white leading-tight">
        {value}
      </p>
    </div>
  )
}

// ── Formation card (Elite gold / Crisis red) ─────────────────────────────────

function RetroFormationCard({
  side,
  variant,
  flagMode,
}: {
  side: RetroSide
  variant: 'elite' | 'crisis'
  flagMode: 'emoji' | 'flag'
}) {
  const isElite = variant === 'elite'
  const accent = isElite ? '#F59E0B' : '#EF4444' // gold for Elite, red for Crisis
  const accentSoft = isElite ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
  const badgeBg = isElite ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
  const label = isElite ? 'PULSE ELITE' : 'CRISIS RADAR'
  const emoji = isElite ? '🌟' : '⚠️'
  const subtitle = isElite
    ? 'The tournament heroes — top performers across all 64 matches'
    : 'The tournament villains — worst performers across all 64 matches'

  const realPlayers = side.players.filter(p => p.name !== 'N/A')
  const avgScore =
    realPlayers.length > 0
      ? Math.round(realPlayers.reduce((s, p) => s + p.tournamentScore, 0) / realPlayers.length)
      : 0

  // Organize into formation columns: GK | DEF | MID | FWD (landscape, like WC tab)
  const gk = side.players.filter(p => p.position === 'GK' || p.name === 'N/A' && side.players.indexOf(p) === 0)
  const def = side.players.filter(p => ['CB', 'LB', 'RB'].includes(p.position))
  const mid = side.players.filter(p => ['CM', 'CAM', 'CDM'].includes(p.position))
  const fwd = side.players.filter(p => ['LW', 'RW', 'ST', 'CF'].includes(p.position))
  // Fallback: if a player has an empty position (N/A slot), drop them into the
  // shortest column so the pitch still shows 11 slots.
  const nas = side.players.filter(p => p.name === 'N/A' && p.position === '')
  const columns = [gk, def, mid, fwd]
  for (const na of nas) {
    const shortest = columns.reduce((a, b) => (a.length <= b.length ? a : b))
    shortest.push(na)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl overflow-hidden border-2 shadow-sm"
      style={{ borderColor: accent, boxShadow: `0 4px 12px ${accentSoft}` }}
    >
      {/* Top accent bar */}
      <div
        className="h-1 w-full"
        style={{
          background: isElite
            ? 'linear-gradient(to right, #F59E0B, #FBBF24, #F59E0B)'
            : 'linear-gradient(to right, #EF4444, #DC2626, #EF4444)',
        }}
      />
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: accentSoft }}>
        <span className="text-lg">{emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black" style={{ color: accent }}>{label}</h3>
            <Badge
              className={`${badgeBg} text-white border-0 text-[9px] font-bold px-1.5 py-0 gap-1`}
            >
              <Lock className="size-2.5" />
              {side.formation}
            </Badge>
          </div>
          <p className="text-[10px] text-[#666] dark:text-[#CCCCCC] mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-[#666] dark:text-[#CCCCCC]">AVG</p>
          <p className="text-sm font-black" style={{ color: accent }}>{(avgScore / 10).toFixed(1)}</p>
        </div>
      </div>

      {/* Pitch */}
      <div className="px-3 py-3 bg-[#F8F9FA] dark:bg-[#2D2D2D]">
        <div className="mx-auto max-w-[520px]">
          <div className={`pitch-bg relative ${isElite ? '' : 'crisis-pitch'}`}>
            <RetroPitchMarkings crisis={!isElite} />
            <div className="relative z-10 px-1.5 py-1 flex justify-between items-center h-full">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col items-center gap-0.5">
                  {col.map((player) => (
                    <RetroPlayerChip key={player.id} player={player} accent={accent} flagMode={flagMode} isElite={isElite} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Match facts list (scrollable if long) */}
      <div className="px-4 py-3 bg-white dark:bg-[#1A1A1A] border-t border-[#E0E0E0]/50 dark:border-white/5">
        <p className="text-[10px] font-bold text-[#666] dark:text-[#CCCCCC] mb-2 uppercase tracking-wide">
          {isElite ? 'Tournament-defining moments' : 'Where it went wrong'}
        </p>
        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 retro-scroll">
          {realPlayers.map((p) => (
            <div key={p.id} className="flex items-start gap-2 text-xs">
              <span
                className="shrink-0 mt-0.5 size-1.5 rounded-full"
                style={{ background: accent }}
              />
              <span className="font-bold text-[#1A1A1A] dark:text-white min-w-[90px] shrink-0 flex items-center gap-1">
                {p.name}
                {p.isAwardWinner && (
                  <span
                    title={p.awardName ?? 'Award winner'}
                    className="inline-flex items-center gap-0.5 rounded-full bg-[#F59E0B] text-white px-1 py-0 text-[7px] font-black leading-none"
                  >
                    <Trophy className="size-2" />{p.awardName ?? 'AWARD'}
                  </span>
                )}
              </span>
              <span className="text-[#666] dark:text-[#CCCCCC] text-[11px]">{p.matchInfo ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Player chip on the pitch ─────────────────────────────────────────────────

function RetroPlayerChip({
  player,
  accent,
  flagMode,
  isElite,
}: {
  player: RetroPick
  accent: string
  flagMode: 'emoji' | 'flag'
  isElite: boolean
}) {
  const team = findNationalTeam(player.nationCode)
  const flagEmoji = team?.flag ?? '🏳️'
  const isNA = player.name === 'N/A'
  const faceEmoji = isNA ? '❓' : getPulseFaceEmoji(player.tournamentScore)
  const ratingValue = isNA ? '—' : (player.tournamentScore / 10).toFixed(1)
  const trendIcon = isNA ? null : (
    <TrendIcon trend={player.trend} />
  )
  const TrendArrow = player.trend === 'rising' ? TrendingUp : player.trend === 'falling' ? TrendingDown : null

  return (
    <motion.div
      whileHover={!isNA ? { scale: 1.08 } : undefined}
      className="flex flex-col items-center"
    >
      <div
        className={`
          relative flex size-7 sm:size-8 items-center justify-center rounded-full border-[1.5px] shadow-sm overflow-hidden
          border-white/70 bg-white/95 dark:bg-white/90 shadow-black/10
          ${isNA ? 'opacity-50' : ''}
        `}
        style={!isNA ? { boxShadow: `0 0 0 1px ${accent}40` } : undefined}
      >
        {flagMode === 'flag' && !isNA ? (
          <FlagImage nationCode={player.nationCode} size={18} fallbackEmoji={flagEmoji} />
        ) : (
          <span className="text-xs sm:text-sm leading-none select-none">{faceEmoji}</span>
        )}
        {TrendArrow && (
          <TrendArrow
            className="absolute -right-0.5 -top-0.5 size-2.5"
            style={{ color: accent }}
          />
        )}
        {/* Award winner crown badge */}
        {player.isAwardWinner && !isNA && (
          <span
            title={player.awardName ?? 'Award winner'}
            className="absolute -left-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-[#F59E0B] text-white shadow-sm border border-white"
          >
            <Trophy className="size-2" />
          </span>
        )}
      </div>
      <p className="mt-px max-w-[52px] truncate text-[7px] sm:text-[8px] font-bold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {player.name}
      </p>
      <div className="flex items-center gap-px">
        <Badge
          variant="outline"
          className="text-[5px] sm:text-[6px] font-bold px-0.5 py-0 bg-white/90 backdrop-blur-sm leading-tight"
          style={{
            borderColor: `${accent}4D`,
            color: accent,
          }}
        >
          {isNA ? '—' : player.position}
        </Badge>
        {trendIcon}
      </div>
      <div className="flex items-center gap-0.5">
        {flagMode === 'emoji' && !isNA && <span className="text-[10px] leading-none">{flagEmoji}</span>}
        <span className="text-[7px] sm:text-[8px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {ratingValue}
        </span>
      </div>
    </motion.div>
  )
}

// ── Pitch markings (landscape, matches the WC tab) ───────────────────────────

function RetroPitchMarkings({ crisis }: { crisis: boolean }) {
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
        <rect x="6" y="6" width="388" height="288" rx="3" />
        <line x1="200" y1="6" x2="200" y2="294" />
        <circle cx="200" cy="150" r="36" />
        <circle cx="200" cy="150" r="3" fill={dotFill} />
        <rect x="6" y="70" width="60" height="160" />
        <rect x="6" y="105" width="25" height="90" />
        <path d="M 66 110 A 36 36 0 0 1 66 190" />
        <circle cx="40" cy="150" r="3" fill={dotFill} />
        <rect x="334" y="70" width="60" height="160" />
        <rect x="369" y="105" width="25" height="90" />
        <path d="M 334 110 A 36 36 0 0 0 334 190" />
        <circle cx="360" cy="150" r="3" fill={dotFill} />
        <path d="M 6 16 A 10 10 0 0 1 16 6" />
        <path d="M 384 6 A 10 10 0 0 1 394 16" />
        <path d="M 6 284 A 10 10 0 0 0 16 294" />
        <path d="M 384 294 A 10 10 0 0 0 394 284" />
        <rect x="0" y="115" width="6" height="70" strokeDasharray="4 3" />
        <rect x="394" y="115" width="6" height="70" strokeDasharray="4 3" />
      </g>
    </svg>
  )
}

// ── Share-as-image button ────────────────────────────────────────────────────
// The Web Share API can share files (canvas screenshots) on supporting browsers.
// As a lightweight fallback we generate a text blob the user can save/screenshot.

function ShareAsImageButton({ text }: { text: string }) {
  const [shared, setShared] = useState(false)

  const handleShareImage = async () => {
    // Build a canvas "share card" with the retro summary.
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no ctx')

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080)
      grad.addColorStop(0, '#1A1A1A')
      grad.addColorStop(1, '#2D2D2D')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1080, 1080)

      // Gold border
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 8
      ctx.strokeRect(24, 24, 1032, 1032)

      // Title
      ctx.fillStyle = '#F59E0B'
      ctx.font = 'bold 56px sans-serif'
      ctx.fillText('🏆 Team of the Tournament', 60, 110)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 32px sans-serif'
      ctx.fillText('2026 FIFA World Cup', 60, 160)

      // Body text (wrapped)
      ctx.font = '28px sans-serif'
      ctx.fillStyle = '#FFFFFF'
      const lines = wrapText(ctx, text.replace(/^🏆.*$/m, '').trim(), 960)
      let y = 240
      for (const line of lines) {
        ctx.fillText(line, 60, y)
        y += 40
      }

      // Footer
      ctx.fillStyle = '#999999'
      ctx.font = '24px sans-serif'
      ctx.fillText('Fan Pulse — real fan sentiment', 60, 1020)

      // Try Web Share with the canvas as a file (mobile), else download.
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Could not generate share card')
          return
        }
        const file = new File([blob], 'team-of-tournament-2026.png', { type: 'image/png' })
        const nav = navigator as Navigator & {
          canShare?: (data: { files: File[] }) => boolean
          share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
        }
        if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
          try {
            await nav.share({ files: [file], title: 'Team of the Tournament 2026', text: text.slice(0, 200) })
            setShared(true)
            setTimeout(() => setShared(false), 2000)
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
              toast.error('Share cancelled')
            }
          }
        } else {
          // Download fallback
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'team-of-tournament-2026.png'
          a.click()
          URL.revokeObjectURL(url)
          toast.success('Share card saved — post it anywhere!')
          setShared(true)
          setTimeout(() => setShared(false), 2000)
        }
      }, 'image/png')
    } catch {
      toast.error('Could not generate share card')
    }
  }

  return (
    <Button
      size="sm"
      onClick={handleShareImage}
      variant="outline"
      className="gap-1.5 text-[11px] font-bold h-8 rounded-lg border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10"
    >
      {shared ? <Check className="size-3" /> : <Share2 className="size-3" />}
      {shared ? 'Shared' : 'Share Image'}
    </Button>
  )
}

// Canvas text wrapper helper
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    if (!para) { out.push(''); continue }
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) out.push(line)
  }
  return out
}
