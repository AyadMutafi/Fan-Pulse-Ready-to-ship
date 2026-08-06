'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, Info, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { getMatchMomentum, type MatchMomentum } from '@/lib/match-momentum-data'
import type { MatchEvent } from '@/lib/match-events-data'
import { useLanguage } from '@/context/LanguageContext'
import { SharePulseButton } from '@/components/common/SharePulseButton'

export interface MatchData {
  id: string
  homeTeam: { code: string; name: string; flag: string; sentiment: number }
  awayTeam: { code: string; name: string; flag: string; sentiment: number }
  homeScore: number
  awayScore: number
  score: string
  status: string       // 'live' | 'completed' | 'upcoming'
  league: string
  group: string
  minute: number | null
}

interface Props {
  match: MatchData | null
  isOpen: boolean
  onClose: () => void
}

// ── Color thresholds ────────────────────────────────────────
const getPulseColor = (v: number) =>
  v >= 80 ? '#10B981' : v >= 50 ? '#FF6B35' : '#EF4444'

// ── Chart geometry (viewBox 0 0 360 160) ─────────────────────
const CHART_W = 360
const CHART_H = 160
const PAD_L = 26
const PAD_R = 8
const PAD_T = 10
const PAD_B = 22
const X0 = PAD_L
const X1 = CHART_W - PAD_R
const Y0 = PAD_T
const Y1 = CHART_H - PAD_B
const W_INNER = X1 - X0
const H_INNER = Y1 - Y0

const xForMin = (m: number) => X0 + (m / 90) * W_INNER
const yForVal = (v: number) => Y1 - (Math.max(0, Math.min(100, v)) / 100) * H_INNER

// ── Smooth path (Catmull-Rom → Bezier) ──────────────────────
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function buildAreaPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  const line = buildSmoothPath(pts)
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${line} L ${last.x.toFixed(2)} ${Y1.toFixed(2)} L ${first.x.toFixed(2)} ${Y1.toFixed(2)} Z`
}

// Interpolated value at a target minute (linear between samples)
function valueAtMinute(minutes: number[], values: number[], target: number): number {
  if (values.length === 0) return 0
  if (target <= minutes[0]) return values[0]
  if (target >= minutes[minutes.length - 1]) return values[values.length - 1]
  for (let i = 0; i < minutes.length - 1; i++) {
    if (target >= minutes[i] && target <= minutes[i + 1]) {
      const span = minutes[i + 1] - minutes[i] || 1
      const t = (target - minutes[i]) / span
      return values[i] + (values[i + 1] - values[i]) * t
    }
  }
  return values[values.length - 1]
}

const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

const TYPE_ICON: Record<string, string> = {
  goal: '⚽',
  card: '🟨',
  var: '📺',
  substitution: '🔄',
}

function TrendArrow({ trend, className = '' }: { trend: 'up' | 'down' | 'flat'; className?: string }) {
  if (trend === 'up') return <TrendingUp className={`size-3 ${className}`} />
  if (trend === 'down') return <TrendingDown className={`size-3 ${className}`} />
  return <Minus className={`size-3 ${className}`} />
}

export function MatchMomentumModal({ match, isOpen, onClose }: Props) {
  const { t } = useLanguage()
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const momentum: MatchMomentum | null = useMemo(() => {
    if (!match) return null
    return getMatchMomentum({
      matchId: `${match.homeTeam.code.toLowerCase()}-${match.awayTeam.code.toLowerCase()}`,
      homeCode: match.homeTeam.code,
      awayCode: match.awayTeam.code,
      homeName: match.homeTeam.name,
      awayName: match.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeBaselineSentiment: match.homeTeam.sentiment,
      awayBaselineSentiment: match.awayTeam.sentiment,
    })
  }, [match])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setHoveredEventId(null)
      onClose()
    }
  }, [onClose])

  // Click an event in the timeline → highlight dot + scroll chart into view
  const handleTimelineClick = useCallback((evt: MatchEvent) => {
    setHoveredEventId(evt.id)
    if (chartRef.current) {
      chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // Empty placeholder while closed (keeps Dialog mounted for animation)
  if (!match || !momentum) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl" showCloseButton={false} />
      </Dialog>
    )
  }

  const overallFinal = momentum.overall[momentum.overall.length - 1] ?? 0
  const overallColor = getPulseColor(overallFinal)

  // ── Gauge geometry ────────────────────────────────────────
  const GAUGE_SIZE = 140
  const GAUGE_R = 58
  const GAUGE_CX = GAUGE_SIZE / 2
  const GAUGE_CY = GAUGE_SIZE / 2
  const GAUGE_CIRC = 2 * Math.PI * GAUGE_R
  const gaugeOffset = GAUGE_CIRC * (1 - overallFinal / 100)

  // ── Chart points ──────────────────────────────────────────
  const homePts = momentum.minutes.map((m, i) => ({ x: xForMin(m), y: yForVal(momentum.homeSentiment[i]) }))
  const awayPts = momentum.minutes.map((m, i) => ({ x: xForMin(m), y: yForVal(momentum.awaySentiment[i]) }))
  const overallPts = momentum.minutes.map((m, i) => ({ x: xForMin(m), y: yForVal(momentum.overall[i]) }))
  const homeLinePath = buildSmoothPath(homePts)
  const awayLinePath = buildSmoothPath(awayPts)
  const homeAreaPath = buildAreaPath(homePts)
  const awayAreaPath = buildAreaPath(awayPts)
  const overallLinePath = buildSmoothPath(overallPts)

  const hoveredEvent = hoveredEventId
    ? momentum.events.find(e => e.id === hoveredEventId) ?? null
    : null

  // ── Event dots ────────────────────────────────────────────
  const eventDots = momentum.events.map((e) => {
    const isHome = e.teamCode === match.homeTeam.code
    const series = isHome ? momentum.homeSentiment : momentum.awaySentiment
    const val = valueAtMinute(momentum.minutes, series, e.minute)
    return {
      event: e,
      x: xForMin(e.minute),
      y: yForVal(val),
      isHome,
      positive: e.sentimentDelta > 0,
      isBiggest: momentum.biggestSpike?.id === e.id,
    }
  })

  // ── Status badge text ─────────────────────────────────────
  const statusLabel = match.status === 'live'
    ? `${t('match_momentum.live_now')} ${match.minute ?? 0}'`
    : match.status === 'upcoming'
      ? 'UPCOMING'
      : t('match_momentum.final')

  // ── Share text ────────────────────────────────────────────
  const spikeText = momentum.biggestSpike
    ? ` ⚡ Biggest spike: ${momentum.biggestSpike.playerName} ${momentum.biggestSpike.sentimentDelta > 0 ? '+' : ''}${momentum.biggestSpike.sentimentDelta}% at ${momentum.biggestSpike.minute}'.`
    : ''
  const shareText = `${match.homeTeam.name} ${match.score} ${match.awayTeam.name}.${spikeText} Track live fan sentiment at FANPULSE.`

  // Gridlines
  const xGrid = [15, 30, 45, 60, 75, 90]
  const yGrid = [25, 50, 75]

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl sm:max-w-3xl w-[calc(100%-1rem)] sm:w-full max-h-[90vh] overflow-y-auto modal-scroll p-0 gap-0 rounded-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {match.homeTeam.name} vs {match.awayTeam.name} — {t('match_momentum.title')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {momentum.storySoFar}
        </DialogDescription>

        {/* ── Header row ─────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-[#1A1A1A] border-b border-[#E0E0E0]/50 dark:border-white/10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xl shrink-0">{match.homeTeam.flag}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1A1A1A] dark:text-white truncate">{match.homeTeam.name}</p>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">{match.league} · Group {match.group}</p>
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span className="text-xl font-black tracking-wider text-[#1A1A1A] dark:text-white">{match.score}</span>
            <span className={`text-[11px] font-bold px-1.5 py-px rounded-full ${
              match.status === 'live'
                ? 'bg-[#EF4444]/10 text-[#EF4444]'
                : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC]'
            }`}>
              {match.status === 'live' && (
                <span className="inline-block size-1.5 rounded-full bg-[#EF4444] mr-1 animate-pulse" />
              )}
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-xs font-bold text-[#1A1A1A] dark:text-white truncate">{match.awayTeam.name}</p>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">&nbsp;</p>
            </div>
            <span className="text-2xl shrink-0">{match.awayTeam.flag}</span>
          </div>
          <button
            onClick={() => handleOpenChange(false)}
            aria-label="Close"
            className="shrink-0 rounded-full size-8 flex items-center justify-center text-[#666] dark:text-[#CCCCCC] hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* ── Pulse Gauge ─────────────────────────────────── */}
          <div className="flex flex-col items-center">
            <motion.svg
              width={GAUGE_SIZE}
              height={GAUGE_SIZE}
              viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
              initial="hidden"
              animate="visible"
              aria-label={`Fan pulse ${overallFinal}%`}
            >
              <defs>
                <radialGradient id="gaugeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={overallColor} stopOpacity="0.18" />
                  <stop offset="70%" stopColor={overallColor} stopOpacity="0.04" />
                  <stop offset="100%" stopColor={overallColor} stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* Glow */}
              <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R + 10} fill="url(#gaugeGlow)" />
              {/* Track */}
              <circle
                cx={GAUGE_CX}
                cy={GAUGE_CY}
                r={GAUGE_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-[#E0E0E0] dark:text-white/10"
              />
              {/* Progress */}
              <motion.circle
                cx={GAUGE_CX}
                cy={GAUGE_CY}
                r={GAUGE_R}
                fill="none"
                stroke={overallColor}
                strokeWidth="8"
                strokeLinecap="round"
                transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
                strokeDasharray={GAUGE_CIRC}
                initial={{ strokeDashoffset: GAUGE_CIRC }}
                animate={{ strokeDashoffset: gaugeOffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 6px ${overallColor}66)` }}
              />
            </motion.svg>
            <div className="-mt-[88px] flex flex-col items-center pointer-events-none">
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="text-3xl font-black"
                style={{ color: overallColor }}
              >
                {overallFinal}%
              </motion.span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mt-0.5">
                {t('match_momentum.fan_pulse')}
              </span>
            </div>
            <div className="h-3" />
          </div>

          {/* ── Momentum Curve ──────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mb-2">
              {t('match_momentum.title')}
            </p>
            <div ref={chartRef} className="relative rounded-xl border border-[#E0E0E0]/50 dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] p-2">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-auto"
                role="img"
                aria-label="Match sentiment momentum chart"
              >
                <defs>
                  <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="awayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Y gridlines */}
                {yGrid.map((v) => (
                  <g key={`y${v}`}>
                    <line x1={X0} y1={yForVal(v)} x2={X1} y2={yForVal(v)} stroke="currentColor" strokeWidth="0.5" className="text-[#1A1A1A]/10 dark:text-white/10" />
                    <text x={X0 - 4} y={yForVal(v) + 3} textAnchor="end" className="fill-[#999] dark:fill-gray-500" fontSize="7">{v}</text>
                  </g>
                ))}
                {/* X gridlines */}
                {xGrid.map((m) => (
                  <g key={`x${m}`}>
                    <line x1={xForMin(m)} y1={Y0} x2={xForMin(m)} y2={Y1} stroke="currentColor" strokeWidth="0.5" className="text-[#1A1A1A]/10 dark:text-white/10" />
                    <text x={xForMin(m)} y={Y1 + 12} textAnchor="middle" className="fill-[#999] dark:fill-gray-500" fontSize="7">{m}</text>
                  </g>
                ))}
                {/* Areas + lines */}
                <path d={homeAreaPath} fill="url(#homeGrad)" />
                <path d={awayAreaPath} fill="url(#awayGrad)" />
                <path d={homeLinePath} fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={awayLinePath} fill="none" stroke="#FF6B35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={overallLinePath} fill="none" stroke="#8B5CF6" strokeWidth="1.2" strokeDasharray="3 3" strokeLinecap="round" />

                {/* Event dots */}
                {eventDots.map(({ event, x, y, positive, isBiggest }) => {
                  const isHovered = hoveredEventId === event.id
                  const color = positive ? '#10B981' : '#EF4444'
                  return (
                    <g key={event.id}>
                      {isBiggest && (
                        <circle
                          cx={x}
                          cy={y}
                          r={9}
                          fill="none"
                          stroke={color}
                          strokeWidth="1"
                          opacity="0.6"
                          className="ring-flash"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 5.5 : isBiggest ? 4.5 : 3.5}
                        fill={color}
                        stroke="white"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all"
                      />
                      {isBiggest && (
                        <text x={x} y={y - 9} textAnchor="middle" fontSize="9">⚡</text>
                      )}
                      {/* Invisible larger hit target */}
                      <circle
                        cx={x}
                        cy={y}
                        r={11}
                        fill="transparent"
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`${event.playerName} ${event.minute} minute ${event.sentimentDelta > 0 ? '+' : ''}${event.sentimentDelta}%`}
                        onMouseEnter={() => setHoveredEventId(event.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                        onClick={() => setHoveredEventId(event.id)}
                        onFocus={() => setHoveredEventId(event.id)}
                        onBlur={() => setHoveredEventId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setHoveredEventId(event.id)
                          }
                        }}
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Tooltip */}
              {hoveredEvent && (
                <div
                  className="absolute z-30 pointer-events-none max-w-[200px] rounded-lg bg-[#1A1A1A] dark:bg-white text-white dark:text-[#1A1A1A] px-2.5 py-2 shadow-xl text-[11px] leading-tight"
                  style={{
                    left: `${(xForMin(hoveredEvent.minute) / CHART_W) * 100}%`,
                    top: `${(yForVal(valueAtMinute(
                      momentum.minutes,
                      hoveredEvent.teamCode === match.homeTeam.code ? momentum.homeSentiment : momentum.awaySentiment,
                      hoveredEvent.minute
                    )) / CHART_H) * 100}%`,
                    transform: 'translate(-50%, -120%)',
                  }}
                >
                  <div className="flex items-center gap-1 font-bold">
                    <span>{hoveredEvent.teamFlag}</span>
                    <span>{hoveredEvent.minute}'</span>
                    <span className={`ml-auto ${hoveredEvent.sentimentDelta > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {hoveredEvent.sentimentDelta > 0 ? '+' : ''}{hoveredEvent.sentimentDelta}%
                    </span>
                  </div>
                  <p className="font-semibold mt-0.5">{hoveredEvent.playerName}</p>
                  <p className="opacity-80 mt-0.5">{hoveredEvent.description}</p>
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-[11px] text-[#666] dark:text-[#CCCCCC]">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-full bg-[#10B981]" />
                  {match.homeTeam.code}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-full bg-[#FF6B35]" />
                  {match.awayTeam.code}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 border-t border-dashed border-[#8B5CF6]" />
                  Overall pulse
                </span>
              </div>
            </div>
          </div>

          {/* ── Team Momentum Bars ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { team: match.homeTeam, mom: momentum.homeMomentum, trend: momentum.homeTrend, color: '#10B981' },
              { team: match.awayTeam, mom: momentum.awayMomentum, trend: momentum.awayTrend, color: '#FF6B35' },
            ].map((s) => (
              <div key={s.team.code} className="rounded-xl border border-[#E0E0E0]/50 dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-base">{s.team.flag}</span>
                  <span className="text-[11px] font-bold text-[#1A1A1A] dark:text-white truncate">{s.team.code}</span>
                  <TrendArrow trend={s.trend} className={`ml-auto ${s.trend === 'up' ? 'text-[#10B981]' : s.trend === 'down' ? 'text-[#EF4444]' : 'text-[#FF6B35]'}`} />
                </div>
                <div className="h-2 rounded-full bg-[#E0E0E0] dark:bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.mom}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-[#666] dark:text-[#CCCCCC]">momentum</span>
                  <span className="text-xs font-black" style={{ color: s.color }}>{s.mom}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Biggest Spike ────────────────────────────────── */}
          {momentum.biggestSpike && (
            <div className={`rounded-xl border p-3 ${
              momentum.biggestSpike.sentimentDelta > 0
                ? 'border-[#10B981]/30 bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 dark:from-[#10B981]/15 dark:to-[#10B981]/5'
                : 'border-[#EF4444]/30 bg-gradient-to-br from-[#EF4444]/10 to-[#EF4444]/5 dark:from-[#EF4444]/15 dark:to-[#EF4444]/5'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className={`size-3.5 ${momentum.biggestSpike.sentimentDelta > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC]">
                  {t('match_momentum.biggest_spike')}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{momentum.biggestSpike.teamFlag}</span>
                <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{momentum.biggestSpike.playerName}</span>
                <span className="text-[10px] text-[#666] dark:text-[#CCCCCC]">{momentum.biggestSpike.minute}'</span>
                <span className={`ml-auto text-sm font-black ${momentum.biggestSpike.sentimentDelta > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {momentum.biggestSpike.sentimentDelta > 0 ? '+' : ''}{momentum.biggestSpike.sentimentDelta}%
                </span>
              </div>
              <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] mt-1.5 leading-relaxed">
                {momentum.biggestSpike.description}
              </p>
            </div>
          )}

          {/* ── Story So Far ─────────────────────────────────── */}
          <div className="rounded-xl border border-[#6C2BD9]/20 dark:border-[#8B5CF6]/20 bg-[#6C2BD9]/5 dark:bg-[#6C2BD9]/10 p-3 flex gap-2">
            <Info className="size-4 shrink-0 text-[#6C2BD9] dark:text-[#8B5CF6] mt-0.5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6C2BD9] dark:text-[#8B5CF6] mb-1">
                {t('match_momentum.story_so_far')}
              </p>
              <p className="text-[11px] italic text-[#1A1A1A]/80 dark:text-white/80 leading-relaxed">
                {momentum.storySoFar}
              </p>
            </div>
          </div>

          {/* ── Event Timeline ───────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] dark:text-[#CCCCCC] mb-3">
              {t('match_momentum.timeline')}
            </p>
            {momentum.events.length === 0 ? (
              <div className="rounded-xl border border-[#E0E0E0]/50 dark:border-white/10 bg-[#F8F9FA] dark:bg-[#2D2D2D] py-8 text-center">
                <p className="text-xs text-[#666] dark:text-[#CCCCCC]">{t('match_momentum.no_events')}</p>
              </div>
            ) : (
              <div className="timeline-line space-y-2">
                {momentum.events.map((e) => {
                  const positive = e.sentimentDelta > 0
                  const isHovered = hoveredEventId === e.id
                  return (
                    <button
                      key={e.id}
                      onClick={() => handleTimelineClick(e)}
                      onMouseEnter={() => setHoveredEventId(e.id)}
                      onMouseLeave={() => setHoveredEventId(null)}
                      className={`relative z-10 w-full text-left flex items-start gap-3 rounded-lg p-2 pl-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 ${
                        isHovered
                          ? 'bg-[#6C2BD9]/10 dark:bg-[#6C2BD9]/20 ring-1 ring-[#6C2BD9]/30'
                          : 'hover:bg-[#F8F9FA] dark:hover:bg-[#2D2D2D]'
                      }`}
                    >
                      <div className="relative shrink-0 flex flex-col items-center" style={{ width: 38 }}>
                        <span className="relative z-10 flex items-center justify-center size-9 rounded-full bg-white dark:bg-[#1A1A1A] border-2 border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 text-[10px] font-black text-[#6C2BD9] dark:text-[#8B5CF6]">
                          {e.minute}'
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs">{TYPE_ICON[e.type] ?? '•'}</span>
                          <span className="text-sm">{e.teamFlag}</span>
                          <span className="text-xs font-bold text-[#1A1A1A] dark:text-white truncate">{e.playerName}</span>
                          <span className={`ml-auto text-[10px] font-bold px-1.5 py-px rounded-full ${
                            positive
                              ? 'bg-[#10B981]/15 text-[#10B981]'
                              : 'bg-[#EF4444]/15 text-[#EF4444]'
                          } ${isHovered ? (positive ? 'pulse-surge' : 'pulse-drop') : ''}`}>
                            {positive ? '+' : ''}{e.sentimentDelta}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] mt-1 leading-relaxed">{e.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div className="pt-2 border-t border-[#E0E0E0]/50 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <SharePulseButton
              shareText={shareText}
              shareTitle={`${match.homeTeam.name} ${match.score} ${match.awayTeam.name} — FANPULSE`}
              className="w-full sm:w-auto"
            />
            <p className="text-[11px] text-[#6B7280] dark:text-gray-400 leading-tight">
              Data: X + fan votes · {formatK(momentum.totalVolume)} {t('match_momentum.mentions')} · For fan engagement purposes only.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MatchMomentumModal
