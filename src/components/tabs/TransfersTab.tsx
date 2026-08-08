'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftRight, RefreshCw, ShieldCheck, Zap, TrendingUp } from 'lucide-react'
import TransferPulseCard, { type TransferSagaSummary } from '@/components/TransferPulseCard'
import TransferSagaDetail from '@/components/TransferSagaDetail'
import PlayerCard from '@/components/PlayerCard'
import { fromTransferSaga } from '@/lib/player-card-data'
import { useCardCollection } from '@/hooks/use-card-collection'

type StatusFilter = 'active' | 'completed' | 'debunked' | 'all'
type SortKey = 'buzz' | 'likelihood' | 'recent'

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'debunked', label: 'Debunked' },
  { id: 'all', label: 'All' },
]

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'buzz', label: 'Most Buzz' },
  { id: 'likelihood', label: 'Fan-Read' },
  { id: 'recent', label: 'Recent' },
]

export default function TransfersTab() {
  const [sagas, setSagas] = useState<TransferSagaSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [sortKey, setSortKey] = useState<SortKey>('buzz')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<TransferSagaSummary | null>(null)
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null)

  const load = useCallback(
    async (status: StatusFilter) => {
      setLoading(true)
      setError(null)
      try {
        // Always pass the status param explicitly. The API treats 'all' as
        // "return every saga regardless of status" — see /api/transfers/route.ts.
        const res = await fetch(`/api/transfers?status=${status}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setSagas(json.sagas || [])
      } catch (e) {
        setError(String(e).slice(0, 120))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Deep refresh — calls /api/transfers/refresh which triggers feed-scan
   * (scans Romano/Ornstein/DiMarzio/Plettenberg for recent posts via Z.ai
   * web_search) + discovery + ingest. Returns the freshly refreshed sagas.
   * Shows live progress text so the user knows it's working.
   */
  const deepRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    setRefreshProgress('Scanning Tier 1 journalists (Romano, Ornstein, Di Marzio, Plettenberg)…')
    try {
      const res = await fetch('/api/transfers/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) {
        if (res.status === 429) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.message || 'Rate limited — wait 30s between refreshes')
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      // The refresh endpoint returns active sagas directly — update state
      if (json.sagas && Array.isArray(json.sagas)) {
        setSagas(json.sagas)
      }
      setLastRefreshAt(new Date())
      // Show a short summary of what was refreshed
      const logLines: string[] = json.log || []
      if (logLines.length > 0) {
        setRefreshProgress(`Done in ${(json.durationMs / 1000).toFixed(1)}s — ${logLines.join(' · ')}`)
      } else {
        setRefreshProgress(`Done in ${(json.durationMs / 1000).toFixed(1)}s`)
      }
      // If the current filter isn't 'active', also re-fetch the filtered view
      if (statusFilter !== 'active') {
        await load(statusFilter)
      }
    } catch (e) {
      setError(String(e).slice(0, 160))
      setRefreshProgress('')
    } finally {
      setRefreshing(false)
      // Clear progress text after 6 seconds
      setTimeout(() => setRefreshProgress(''), 6000)
    }
  }, [statusFilter, load])

  useEffect(() => {
    load(statusFilter)
  }, [statusFilter, load])

  // Client-side sort (the API already returns by buzz, but the user can re-sort)
  const sorted = [...sagas].sort((a, b) => {
    if (sortKey === 'likelihood') return b.fanReadLikelihood - a.fanReadLikelihood
    if (sortKey === 'recent')
      return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
    return b.buzzVolume - a.buzzVolume
  })

  const totalBuzz = sagas.reduce((s, x) => s + x.buzzVolume, 0)
  const hotCount = sagas.filter((s) => s.buzzTrend === 'rising').length
  const { markSeen: markCardSeen } = useCardCollection()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-[#6C2BD9] shadow-md shadow-[#6C2BD9]/20">
              <ArrowLeftRight className="size-4 text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-[#1A1A1A] dark:text-white">
              Transfer Pulse
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#666] dark:text-gray-400">
            Fan sentiment around transfer rumors · pre-season bridge to EPL kickoff
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={deepRefresh}
            disabled={refreshing}
            title="Scan Tier 1 journalists for fresh transfer rumors"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6C2BD9] text-white shadow-md shadow-[#6C2BD9]/20 hover:bg-[#5A1FB8] focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Scanning…' : 'Refresh'}
          </button>
          {lastRefreshAt && !refreshing && !refreshProgress && (
            <span className="text-[10px] text-[#9CA3AF] dark:text-gray-500">
              Last refresh: {lastRefreshAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Refresh progress / result banner */}
      {refreshProgress && (
        <div className={`rounded-xl p-3 flex items-start gap-2.5 border ${
          refreshing
            ? 'bg-[#6C2BD9]/5 border-[#6C2BD9]/20'
            : 'bg-[#10B981]/5 border-[#10B981]/20'
        }`}>
          <RefreshCw className={`size-4 shrink-0 mt-0.5 ${
            refreshing ? 'animate-spin text-[#6C2BD9] dark:text-[#8B5CF6]' : 'text-[#10B981]'
          }`} />
          <p className="text-[11px] text-[#666] dark:text-gray-300 leading-relaxed">
            {refreshProgress}
          </p>
        </div>
      )}

      {/* Anti-hallucination disclaimer banner */}
      <div className="rounded-xl bg-[#FF6B35]/5 border border-[#FF6B35]/15 p-3 flex items-start gap-2.5">
        <ShieldCheck className="size-4 shrink-0 text-[#FF6B35] mt-0.5" />
        <p className="text-[11px] text-[#666] dark:text-gray-400 leading-relaxed">
          Every rumor here was reported by a <strong className="text-[#1A1A1A] dark:text-gray-200">Tier 1
          journalist</strong> (Fabrizio Romano, David Ornstein, Florian Plettenberg, and others).
          &ldquo;Fan-read&rdquo; likelihood reflects what fans <em>think</em> — not a prediction.
          Debunked rumors are archived, never deleted.
        </p>
      </div>

      {/* Quick stats */}
      {!loading && sagas.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat icon={<ArrowLeftRight className="size-3.5 text-[#6C2BD9] dark:text-[#8B5CF6]" />} label="Rumors" value={String(sagas.length)} />
          <MiniStat icon={<Zap className="size-3.5 text-[#FF6B35]" />} label="Fan posts" value={String(totalBuzz)} />
          <MiniStat icon={<TrendingUp className="size-3.5 text-[#10B981]" />} label="Trending up" value={String(hotCount)} />
        </div>
      )}

      {/* Filter pills + sort */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#F0F0F0] dark:bg-white/5">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setStatusFilter(p.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 ${
                statusFilter === p.id
                  ? 'bg-white dark:bg-[#2D2D2D] text-[#6C2BD9] dark:text-[#8B5CF6] shadow-sm'
                  : 'text-[#6B7280] dark:text-gray-400 hover:text-[#666] dark:hover:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#F0F0F0] dark:bg-white/5">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSortKey(s.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 ${
                sortKey === s.id
                  ? 'bg-white dark:bg-[#2D2D2D] text-[#6C2BD9] dark:text-[#8B5CF6] shadow-sm'
                  : 'text-[#6B7280] dark:text-gray-400 hover:text-[#666] dark:hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-[#F0F0F0] dark:bg-white/5 skeleton-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 p-4 text-sm text-[#EF4444]">
          Failed to load transfer sagas: {error}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState statusFilter={statusFilter} />
      ) : (
        <motion.div layout className="space-y-4">
          {/* Transfer target cards — horizontal scroll of collectible cards */}
          {sorted.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
              {sorted.map((saga) => (
                <div key={`card-${saga.id}`} className="shrink-0">
                  <PlayerCard data={fromTransferSaga(saga)} size="compact" onView={markCardSeen} />
                </div>
              ))}
            </div>
          )}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
          {sorted.map((saga) => (
            <TransferPulseCard key={saga.id} saga={saga} onClick={setSelected} />
          ))}
          </div>
        </motion.div>
      )}

      {/* Detail modal */}
      <TransferSagaDetail saga={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-white dark:bg-[#2D2D2D] border border-[#E0E0E0] dark:border-white/10 p-2.5 flex items-center gap-2">
      <div className="size-7 rounded-lg bg-[#6C2BD9]/10 dark:bg-[#8B5CF6]/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-sm font-extrabold text-[#1A1A1A] dark:text-white leading-none">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-[#6B7280] dark:text-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  const isDebunked = statusFilter === 'debunked'
  return (
    <div className="rounded-2xl border border-dashed border-[#E0E0E0] dark:border-white/10 p-8 text-center">
      <div className="mx-auto size-12 rounded-full bg-[#F0F0F0] dark:bg-white/5 flex items-center justify-center mb-3">
        <ShieldCheck className="size-6 text-[#6B7280] dark:text-gray-400" />
      </div>
      <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white">
        {isDebunked ? 'No debunked rumors archived yet' : 'No transfer rumors verified yet'}
      </h3>
      <p className="mt-1.5 text-xs text-[#666] dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
        Rumors only appear here when a Tier 1 journalist reports them. The
        discovery pipeline runs automatically once the live data feed is
        configured — we never show fabricated or templated rumors.
      </p>
    </div>
  )
}
