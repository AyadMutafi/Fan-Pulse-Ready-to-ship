'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Clock, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { findEPLTeam } from '@/lib/epl-teams'

// ── Types ────────────────────────────────────────────────────

interface TOTWPlayerData {
  playerName: string
  teamCode: string
  position: string
  pulseScore: number
  sentiment: number
  matchInfo: string
  photoUrl: string | null
  order: number
}

interface TOTWData {
  formation: string
  matchweek: number
  type: 'totw' | 'flops'
  players: TOTWPlayerData[]
  publishedAt: string | null
}

// ── Formation Layout 4-3-3 ──────────────────────────────────

const FORMATION_ROWS: { pos: string }[][] = [
  [{ pos: 'GK' }],
  [{ pos: 'RB' }, { pos: 'CB' }, { pos: 'CB' }, { pos: 'LB' }],
  [{ pos: 'CM' }, { pos: 'CAM' }, { pos: 'CM' }],
  [{ pos: 'RW' }, { pos: 'ST' }, { pos: 'LW' }],
]

// ── Helpers ──────────────────────────────────────────────────

function scoreToMoodEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function findPlayerForPosition(players: TOTWPlayerData[], pos: string): TOTWPlayerData | undefined {
  return players.find((p) => p.position === pos)
}

function getTeamBadge(code: string): string {
  return findEPLTeam(code)?.badge ?? '⚽'
}

// ── Component ────────────────────────────────────────────────

export default function TeamOfTheWeekTab() {
  const [type, setType] = useState<'totw' | 'flops'>('totw')
  const [matchweek, setMatchweek] = useState(1)
  const [data, setData] = useState<TOTWData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasMatchData, setHasMatchData] = useState(true)

  const fetchTOTW = useCallback(async (mw: number, t: 'totw' | 'flops') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/epl/totw?matchweek=${mw}&type=${t}`)
      if (!res.ok) throw new Error('Failed to fetch TOTW')
      const json = await res.json()
      setHasMatchData(json.hasMatchData ?? false)
      setData(json.totw ?? null)
    } catch (err) {
      console.error('[TOTWTab] fetch error:', err)
      setData(null)
      setHasMatchData(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTOTW(matchweek, type)
  }, [matchweek, type, fetchTOTW])

  const players = data?.players ?? []
  const isFlops = type === 'flops'

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          {isFlops ? 'Flops of the Week' : 'Team of the Week'}
          {data && ` — Matchweek ${matchweek}`}
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">
          {isFlops
            ? 'The worst-performing XI from this matchweek, based on fan sentiment'
            : 'The best-performing XI from this matchweek, based on verified EPL data + real fan sentiment'}
        </p>
      </motion.div>

      {/* Toggle: TOTW / Flops */}
      <div className="flex items-center gap-2">
        <Button
          variant={type === 'totw' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setType('totw')}
          className={`flex items-center gap-1.5 ${
            type === 'totw'
              ? 'bg-[#6C2BD9] text-white hover:bg-[#5A1BB8]'
              : 'border-[#E0E0E0] dark:border-white/10'
          }`}
        >
          <Trophy className="size-3.5" />
          Team of the Week
        </Button>
        <Button
          variant={type === 'flops' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setType('flops')}
          className={`flex items-center gap-1.5 ${
            type === 'flops'
              ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
              : 'border-[#E0E0E0] dark:border-white/10'
          }`}
        >
          <span className="text-sm">💀</span>
          Flops of the Week
        </Button>
      </div>

      {/* Matchweek selector */}
      <div className="flex items-center justify-between glass-card border-[#E0E0E0]/50 dark:border-white/5 rounded-xl p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMatchweek((mw) => Math.max(1, mw - 1))}
          disabled={matchweek <= 1}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A] dark:text-white">
          <Calendar className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          Matchweek {matchweek}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMatchweek((mw) => Math.min(38, mw + 1))}
          disabled={matchweek >= 38}
          className="flex items-center gap-1"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="p-4">
            <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
              {FORMATION_ROWS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                  {row.map((slot, ci) => (
                    <div key={`${ri}-${ci}`} className="flex flex-col items-center gap-1">
                      <Skeleton className="size-12 sm:size-14 rounded-full" />
                      <Skeleton className="h-3 w-10 rounded" />
                      <Skeleton className="h-3 w-8 rounded" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Honest empty state — no match data yet */}
      {!loading && !hasMatchData && (
        <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto size-10 text-[#6C2BD9]/30 dark:text-[#8B5CF6]/30 mb-3" />
            <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-1">
              EPL kicks off August 21
            </h3>
            <p className="text-sm text-[#666] dark:text-[#CCCCCC] max-w-md mx-auto">
              The Team of the Week will appear here after Matchweek 1 is complete.
              Until then, vote on club moods in the EPL Fan Mood section on the Home tab.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Formation card */}
      {!loading && hasMatchData && players.length > 0 && (
        <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="p-4">
            <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
              {FORMATION_ROWS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-4 sm:gap-8">
                  {row.map((slot, ci) => {
                    const player = findPlayerForPosition(players, slot.pos)
                    return (
                      <motion.div
                        key={`${ri}-${ci}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: ri * 0.1 + ci * 0.05 }}
                        className="flex flex-col items-center"
                        title={
                          player
                            ? `${player.playerName} · ${player.teamCode} · ${player.position} · ${player.matchInfo}`
                            : slot.pos
                        }
                      >
                        <div className="relative">
                          <div className="flex size-12 sm:size-14 items-center justify-center rounded-full border-2 border-[#6C2BD9]/30 dark:border-[#8B5CF6]/30 bg-white dark:bg-[#2D2D2D] shadow-md overflow-hidden">
                            {player?.photoUrl ? (
                              <img
                                src={player.photoUrl}
                                alt={player.playerName}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : player ? (
                              <span className="text-sm font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">
                                {getInitials(player.playerName)}
                              </span>
                            ) : (
                              <span className="text-lg">👤</span>
                            )}
                          </div>
                          {/* Mood emoji badge — bottom right of the player circle */}
                          {player && (
                            <span className="absolute -bottom-1 -right-1 text-base bg-white dark:bg-[#2D2D2D] rounded-full size-5 flex items-center justify-center shadow-sm border border-[#E0E0E0] dark:border-white/10">
                              {scoreToMoodEmoji(player.sentiment)}
                            </span>
                          )}
                          {/* Team badge — top left */}
                          {player && (
                            <span className="absolute -top-1 -left-1 text-xs bg-white dark:bg-[#2D2D2D] rounded-full size-5 flex items-center justify-center shadow-sm border border-[#E0E0E0] dark:border-white/10">
                              {getTeamBadge(player.teamCode)}
                            </span>
                          )}
                        </div>
                        {/* Player name */}
                        <p
                          className="mt-1.5 max-w-[72px] sm:max-w-[88px] text-[11px] font-bold text-[#1A1A1A] dark:text-white text-center leading-tight"
                          style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                        >
                          {player?.playerName ?? slot.pos}
                        </p>
                        {/* Position badge + pulse score */}
                        {player && (
                          <div className="mt-0.5 flex flex-col items-center gap-0.5">
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded border border-[#6C2BD9]/30 text-[#6C2BD9] dark:border-[#8B5CF6]/30 dark:text-[#8B5CF6]">
                              {slot.pos}
                            </span>
                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#6C2BD9] dark:bg-[#8B5CF6]">
                              <span className="text-[11px] font-black text-white leading-none">
                                {player.pulseScore.toFixed(0)}
                              </span>
                              <span className="text-[6px] font-semibold text-white/70 uppercase tracking-wide leading-none">
                                pulse
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match info list — what each player did */}
      {!loading && hasMatchData && players.length > 0 && (
        <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
              {isFlops ? 'Worst Performances' : 'Top Performances'}
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {players.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-white/5"
                >
                  <span className="text-lg shrink-0">{getTeamBadge(p.teamCode)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white truncate">
                      {p.playerName}
                    </p>
                    <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] truncate">
                      {p.matchInfo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base">{scoreToMoodEmoji(p.sentiment)}</span>
                    <span className="text-xs font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">
                      {p.pulseScore.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] text-center">
        Based on verified EPL match data + real fan sentiment. Player photos: Wikipedia/CC-BY-SA.
      </p>
    </div>
  )
}
