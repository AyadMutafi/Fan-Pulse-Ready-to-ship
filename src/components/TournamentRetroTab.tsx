'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Share2, Check, Lock, TrendingUp, TrendingDown } from 'lucide-react'
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

// ── Types (mirrors src/lib/tournament-retro.ts) ──────────────────────────────

interface RetroPick {
  id: string
  name: string
  nationCode: string
  position: string
  tournamentScore: number
  matchInfo: string | null
  trend: Trend
}
interface RetroSide {
  formation: string
  players: RetroPick[]
}
interface TournamentRetroResult {
  elite: RetroSide
  crisis: RetroSide
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
    ? `🏆 Team of the Tournament — 2026 FIFA World Cup\n\nElite XI: ${data.elite.players
        .filter(p => p.name !== 'N/A')
        .map(p => p.name)
        .join(', ')}\n\nCrisis XI: ${data.crisis.players
        .filter(p => p.name !== 'N/A')
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
              <p className="text-center text-[10px] text-[#999] dark:text-[#666] pt-1">
                Based on verified match data + real fan sentiment. See VERIFIED_DATA.md for sources.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
              <span className="font-bold text-[#1A1A1A] dark:text-white min-w-[90px] shrink-0">{p.name}</span>
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
