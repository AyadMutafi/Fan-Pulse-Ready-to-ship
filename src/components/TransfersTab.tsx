'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import TransferPulseCard from './TransferPulseCard'
import TransferSagaDetail from './TransferSagaDetail'

// ── Types ────────────────────────────────────────────────────

export interface SagaSummary {
  id: string
  playerName: string
  playerNationCode: string
  fromClubCode: string
  fromClubName: string
  toClubCode: string
  toClubName: string
  league: string
  status: string
  feeReported: string | null
  tier1Count: number
  fanReadLikelihood: string
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
}

// ── Filter + Sort config ─────────────────────────────────────

const LEAGUE_FILTERS = [
  { id: 'hot', label: '🔥 Hot now', apiLeague: 'all' },
  { id: 'epl', label: 'Premier League', apiLeague: 'epl' },
  { id: 'laliga', label: 'La Liga', apiLeague: 'laliga' },
  { id: 'seriea', label: 'Serie A', apiLeague: 'seriea' },
  { id: 'bundesliga', label: 'Bundesliga', apiLeague: 'bundesliga' },
  { id: 'all', label: 'All', apiLeague: 'all' },
] as const

type LeagueFilterId = (typeof LEAGUE_FILTERS)[number]['id']

const SORT_OPTIONS = [
  { id: 'buzz', label: 'by Buzz' },
  { id: 'excited', label: 'by Excited' },
  { id: 'dreading', label: 'by Dreading' },
  { id: 'likelihood', label: 'by Likelihood' },
] as const

type SortId = (typeof SORT_OPTIONS)[number]['id']

// ── Skeleton card ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
        <div className="mt-3 flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main tab ─────────────────────────────────────────────────

export default function TransfersTab() {
  const [filter, setFilter] = useState<LeagueFilterId>('hot')
  const [sort, setSort] = useState<SortId>('buzz')
  const [sagas, setSagas] = useState<SagaSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSagaId, setSelectedSagaId] = useState<string | null>(null)

  const fetchSagas = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const leagueParam = LEAGUE_FILTERS.find((f) => f.id === filter)?.apiLeague || 'all'
      const res = await fetch(`/api/transfers?status=active&league=${leagueParam}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setSagas(data.sagas || [])
    } catch (err) {
      console.error('Failed to fetch transfers:', err)
      setError('Failed to load transfer sagas. Please try again.')
      setSagas([])
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchSagas()
  }, [fetchSagas])

  // Sort sagas client-side
  const sortedSagas = useMemo(() => {
    const copy = [...sagas]
    if (sort === 'buzz') {
      copy.sort((a, b) => b.buzzVolume - a.buzzVolume || b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
    } else if (sort === 'excited') {
      copy.sort((a, b) => b.excitedPct - a.excitedPct)
    } else if (sort === 'dreading') {
      copy.sort((a, b) => b.dreadingPct - a.dreadingPct)
    } else if (sort === 'likelihood') {
      const rank = (l: string) => (l === 'high' ? 3 : l === 'medium' ? 2 : 1)
      copy.sort((a, b) => rank(b.fanReadLikelihood) - rank(a.fanReadLikelihood))
    }
    return copy
  }, [sagas, sort])

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          Transfer Pulse
        </h2>
        <p className="text-sm text-[#666] dark:text-[#CCCCCC]">
          How fans feel about every major rumor
        </p>
      </motion.div>

      {/* ── Disclaimer ──────────────────────────────────────── */}
      <div className="rounded-xl border border-[#FF6B35]/20 bg-[#FF6B35]/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 text-[#FF6B35] mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#1A1A1A] dark:text-white">
              RUMORS — not confirmations.
            </p>
            <p className="text-[11px] text-[#666] dark:text-[#CCCCCC] mt-0.5">
              Fan-read likelihood, not predictions. Sourced from Tier 1 journalists. Sentiment from real fan posts. Nothing fabricated. Click any card for sources + full sentiment timeline.
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter pills ────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {LEAGUE_FILTERS.map((f) => {
          const isActive = filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`
                shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200
                ${isActive
                  ? 'bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20'
                  : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] border border-[#E0E0E0] dark:border-white/10 hover:border-[#6C2BD9]/30'
                }
              `}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ── Sort dropdown + refresh ─────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#999] dark:text-gray-500">
            Sort
          </span>
          <div className="flex gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={`
                  rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all
                  ${sort === opt.id
                    ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-[#1A1A1A]'
                    : 'bg-[#F8F9FA] dark:bg-[#2D2D2D] text-[#666] dark:text-[#CCCCCC] hover:bg-[#E0E0E0] dark:hover:bg-[#3D3D3D]'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSagas}
          disabled={isLoading}
          className="h-7 gap-1 text-[10px] text-[#666] dark:text-[#CCCCCC]"
        >
          <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Error state ─────────────────────────────────────── */}
      {error && (
        <Card className="border-[#EF4444]/30 dark:border-[#EF4444]/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="mx-auto size-6 text-[#EF4444] mb-2" />
            <p className="text-sm text-[#EF4444]">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSagas} className="mt-3">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading skeleton grid ───────────────────────────── */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!isLoading && !error && sortedSagas.length === 0 && (
        <Card className="border-[#E0E0E0]/50 dark:border-white/5">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-[#666] dark:text-[#CCCCCC]">
              No active transfer sagas match this filter right now.
            </p>
            <p className="text-[11px] text-[#999] dark:text-gray-500 mt-1">
              Sagas only appear when a Tier 1 journalist has reported them. Check back later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Saga cards grid ─────────────────────────────────── */}
      {!isLoading && !error && sortedSagas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSagas.map((saga, idx) => (
            <TransferPulseCard
              key={saga.id}
              saga={saga}
              index={idx}
              onClick={() => setSelectedSagaId(saga.id)}
            />
          ))}
        </div>
      )}

      {/* ── Detail modal ────────────────────────────────────── */}
      {selectedSagaId && (
        <TransferSagaDetail
          sagaId={selectedSagaId}
          onClose={() => setSelectedSagaId(null)}
        />
      )}
    </div>
  )
}
