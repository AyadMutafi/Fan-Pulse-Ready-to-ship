'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, TrendingUp, Star, PoundSterling, Users, Activity, Search, AlertCircle, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { findEPLTeam } from '@/lib/epl-teams'

// ── Types ────────────────────────────────────────────────────

interface CaptainCandidate {
  fplId: number
  webName: string
  fullName: string
  teamCode: string
  position: string
  price: number
  ownershipPct: number
  form: number
  totalPoints: number
  pointsPerGame: number
  fanSentiment: number
  captainPulseScore: number
  recommendation: string
  reason: string
}

interface DifferentialCandidate {
  fplId: number
  webName: string
  fullName: string
  teamCode: string
  position: string
  price: number
  ownershipPct: number
  form: number
  totalPoints: number
  fanSentiment: number
  differentialScore: number
  differentialType: 'differential' | 'risk'
  reason: string
}

// ── Helpers ──────────────────────────────────────────────────

function sentimentToEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}

function getTeamBadge(code: string): string {
  return findEPLTeam(code)?.badge ?? '⚽'
}

function recommendationColor(rec: string): string {
  if (rec.includes('Strong')) return 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20'
  if (rec.includes('Good')) return 'text-[#6C2BD9] bg-[#6C2BD9]/10 border-[#6C2BD9]/20 dark:text-[#8B5CF6]'
  if (rec.includes('Worth')) return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20'
  return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20'
}

// ── Captain Pulse Section ────────────────────────────────────

function CaptainPulseSection() {
  const [candidates, setCandidates] = useState<CaptainCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    fetch('/api/fpl/captain-pulse?limit=10')
      .then((res) => res.json())
      .then((data) => {
        setCandidates(data.candidates ?? [])
        setAvailable(data.available ?? false)
      })
      .catch((err) => console.error('[FPLTab] captain-pulse error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!available) {
    return (
      <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto size-8 text-[#F59E0B]/50 mb-2" />
          <p className="text-sm text-[#666] dark:text-[#CCCCCC]">
            FPL data not synced yet. An admin needs to run the FPL sync to populate captain candidates.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {candidates.map((c, i) => (
        <motion.div
          key={c.fplId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5 hover:border-[#6C2BD9]/30 dark:hover:border-[#8B5CF6]/30 transition-colors">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className="flex size-8 items-center justify-center rounded-full bg-[#6C2BD9]/10 dark:bg-[#8B5CF6]/10 text-sm font-black text-[#6C2BD9] dark:text-[#8B5CF6] shrink-0">
                  {i + 1}
                </div>
                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base shrink-0">{getTeamBadge(c.teamCode)}</span>
                    <p className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
                      {c.webName}
                    </p>
                    <span className="text-[10px] font-semibold text-[#666] dark:text-[#CCCCCC] shrink-0">
                      {c.position}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] truncate mt-0.5">
                    {c.reason}
                  </p>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC] uppercase">Form</p>
                    <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">{c.form.toFixed(1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC] uppercase">Own%</p>
                    <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">{c.ownershipPct.toFixed(0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC] uppercase">Fans</p>
                    <p className="text-base">{sentimentToEmoji(c.fanSentiment)}</p>
                  </div>
                </div>
                {/* Captain Pulse Score */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex items-center gap-0.5 px-2 py-1 rounded bg-[#6C2BD9] dark:bg-[#8B5CF6]">
                    <span className="text-sm font-black text-white leading-none">
                      {c.captainPulseScore.toFixed(0)}
                    </span>
                  </div>
                  <span className={`text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded border ${recommendationColor(c.recommendation)}`}>
                    {c.recommendation}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ── Differentials Section ────────────────────────────────────

function DifferentialsSection() {
  const [candidates, setCandidates] = useState<DifferentialCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/fpl/differentials?limit=10')
      .then((res) => res.json())
      .then((data) => {
        setCandidates(data.candidates ?? [])
        setAvailable(data.available ?? false)
        setReason(data.reason ?? null)
      })
      .catch((err) => console.error('[FPLTab] differentials error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!available) {
    return (
      <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto size-8 text-[#F59E0B]/50 mb-2" />
          <p className="text-sm text-[#666] dark:text-[#CCCCCC]">
            {reason ?? 'No differentials available yet. Vote on club moods to unlock sentiment divergences.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {candidates.map((c, i) => (
        <motion.div
          key={c.fplId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className={`glass-card border-[#E0E0E0]/50 dark:border-white/5 ${
            c.differentialType === 'differential'
              ? 'hover:border-[#10B981]/30'
              : 'hover:border-[#EF4444]/30'
          } transition-colors`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Type badge */}
                <div className={`flex size-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  c.differentialType === 'differential'
                    ? 'bg-[#10B981]/10 text-[#10B981]'
                    : 'bg-[#EF4444]/10 text-[#EF4444]'
                }`}>
                  {c.differentialType === 'differential' ? '↑' : '↓'}
                </div>
                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base shrink-0">{getTeamBadge(c.teamCode)}</span>
                    <p className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
                      {c.webName}
                    </p>
                    <span className="text-[10px] font-semibold text-[#666] dark:text-[#CCCCCC] shrink-0">
                      {c.position} · £{c.price.toFixed(1)}m
                    </span>
                  </div>
                  <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] truncate mt-0.5">
                    {c.reason}
                  </p>
                </div>
                {/* Divergence metrics */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC] uppercase">Fans</p>
                    <p className="text-base">{sentimentToEmoji(c.fanSentiment)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-[#666] dark:text-[#CCCCCC] uppercase">Own%</p>
                    <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">{c.ownershipPct.toFixed(0)}</p>
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`flex items-center px-2 py-1 rounded ${
                      c.differentialType === 'differential'
                        ? 'bg-[#10B981]'
                        : 'bg-[#EF4444]'
                    }`}>
                      <span className="text-sm font-black text-white leading-none">
                        {c.differentialScore.toFixed(0)}
                      </span>
                    </div>
                    <span className="text-[8px] font-bold mt-1 text-[#666] dark:text-[#CCCCCC] uppercase">
                      gap
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ── Your FPL Team Section ────────────────────────────────────

interface FPLPicksData {
  entry: {
    name: string
    playerFirstName: string
    playerLastName: string
    overallRank: number
    totalPoints: number
  }
  picks: Array<{
    element: number
    webName: string
    teamCode: string
    position: string
    isCaptain: boolean
    isViceCaptain: boolean
    fanSentiment: number
    price: number
  }>
  gameweek: number
}

function YourFPLTeamSection() {
  const [teamId, setTeamId] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FPLPicksData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = useCallback(async () => {
    const id = parseInt(teamId.trim(), 10)
    if (!id || id < 1) {
      setError('Please enter a valid FPL team ID')
      return
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      // This endpoint is client-side only — it fetches the FPL entry + picks
      // via the backend to avoid CORS. The backend proxies to FPL.
      // For now, we use a simple fetch to /api/fpl/team?teamId=X
      // (not yet implemented — shows honest empty state)
      const res = await fetch(`/api/fpl/players?team=${id}&limit=1`)
      if (!res.ok) throw new Error('Failed to fetch team')
      const json = await res.json()
      // Honest empty state — the full team-import endpoint is a future feature
      setData(null)
      setError('Team import is a preview feature — full squad import coming soon')
      void json
    } catch (err) {
      console.error('[FPLTab] team fetch error:', err)
      setError('Could not fetch FPL team — check your team ID')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  return (
    <div className="space-y-3">
      <Card className="glass-card border-[#E0E0E0]/50 dark:border-white/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="size-4 text-[#6C2BD9] dark:text-[#8B5CF6]" />
            <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white">
              Import Your FPL Squad
            </h3>
          </div>
          <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] mb-3">
            Enter your FPL team ID (found in your FPL dashboard URL) to import your squad
            and overlay fan sentiment on your picks.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="e.g. 1234567"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              className="flex-1"
            />
            <Button
              onClick={handleFetch}
              disabled={loading || !teamId.trim()}
              className="bg-[#6C2BD9] text-white hover:bg-[#5A1BB8]"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Import'}
            </Button>
          </div>
          {error && (
            <p className="text-[11px] text-[#F59E0B] mt-2 flex items-center gap-1">
              <AlertCircle className="size-3" />
              {error}
            </p>
          )}
          {data && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A] dark:text-white">
                    {data.entry.name}
                  </p>
                  <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                    {data.entry.playerFirstName} {data.entry.playerLastName} · GW{data.gameweek}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">
                    {data.entry.totalPoints} pts
                  </p>
                  <p className="text-[11px] text-[#666] dark:text-[#CCCCCC]">
                    Rank {data.entry.overallRank.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.picks.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded bg-white/50 dark:bg-white/5"
                  >
                    <span className="text-sm">{getTeamBadge(p.teamCode)}</span>
                    <span className="text-sm font-semibold text-[#1A1A1A] dark:text-white flex-1 truncate">
                      {p.webName}
                      {p.isCaptain && (
                        <span className="ml-1 text-[9px] font-bold text-[#6C2BD9] dark:text-[#8B5CF6]">(C)</span>
                      )}
                      {p.isViceCaptain && (
                        <span className="ml-1 text-[9px] font-bold text-[#666] dark:text-[#CCCCCC]">(VC)</span>
                      )}
                    </span>
                    <span className="text-base">{sentimentToEmoji(p.fanSentiment)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main FPL Tab ─────────────────────────────────────────────

export default function FPLTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white flex items-center gap-2">
          <Zap className="size-6 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          FPL Pulse
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">
          Captain picks, sentiment differentials, and squad import — powered by real FPL data + fan sentiment
        </p>
      </motion.div>

      {/* Section 1: Captain Pulse */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
          <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white">
            Captain Pulse
          </h3>
        </div>
        <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] -mt-1">
          Top 10 captain candidates ranked by a blend of form, ownership, fan sentiment, and total points
        </p>
        <CaptainPulseSection />
      </section>

      {/* Section 2: Sentiment Differentials */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-[#10B981]" />
          <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white">
            Sentiment Differentials
          </h3>
        </div>
        <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] -mt-1">
          Players where fan sentiment diverges from FPL ownership — potential differentials (↑) or risks (↓)
        </p>
        <DifferentialsSection />
      </section>

      {/* Section 3: Your FPL Team */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[#FF6B35]" />
          <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white">
            Your FPL Team
          </h3>
        </div>
        <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] -mt-1">
          Import your FPL squad and overlay fan sentiment on your picks
        </p>
        <YourFPLTeamSection />
      </section>

      {/* Disclaimer */}
      <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] text-center">
        FPL data from fantasy.premierleague.com. Fan sentiment from Fan Pulse community votes.
        An admin must run /api/fpl/sync to populate player data.
      </p>
    </div>
  )
}
