'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  LogOut,
  Trophy,
  RefreshCw,
  Link as LinkIcon,
  BarChart3,
  Newspaper,
  MessageCircle,
  User,
  Globe,
} from 'lucide-react'

// ── Ballon d'Or Admin Page ──────────────────────────────────────────────────
// Founder-facing UI for feeding source URLs (stats pages, journalist articles,
// fan tweets) for Ballon d'Or contenders. The AI reads each URL, extracts
// stats/sentiment, then computes a composite score (0–100) per player.
//
// SECURITY: Cookie-based admin auth (same pattern as /admin/curate).
// The password is POSTed to /api/admin/login, which sets an HttpOnly +
// Secure + SameSite=Strict cookie. JS cannot read it → XSS-proof.

// ── Types ────────────────────────────────────────────────────────────────────

type SourceType = 'stats' | 'article' | 'social'

interface Contender {
  id: string
  name: string
  nationCode: string
  position: string
  clubName: string
  clubCode: string
  ballonDorScore: number
  previousScore: number
  trend: string // 'rising' | 'stable' | 'falling'
  reason: string
  awardWon?: string | null
  verifiedMatchFact: string
  photoUrl?: string | null
  statsScore: number
  articleScore: number
  socialScore: number
  statsSourceCount: number
  articleSourceCount: number
  socialSourceCount: number
  lastRecomputedAt: string
  createdAt: string
  updatedAt: string
  isActive: boolean
  totalSources: number
}

interface Source {
  id: string
  playerName: string
  sourceType: SourceType
  url: string
  platform: string
  author: string
  content: string
  postedAt: string
  extractedData: string
  componentScore: number
  componentLabel: string
  topQuote: string | null
  analysisError: string | null
  curatedAt: string
  curatedBy: string
  isActive: boolean
}

interface RecomputeResult {
  playerName: string
  ok: boolean
  oldScore?: number
  newScore?: number
  delta?: number
  error?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_TYPES: Record<
  SourceType,
  { label: string; icon: typeof BarChart3; help: string; accent: string }
> = {
  stats: {
    label: '📊 Stats',
    icon: BarChart3,
    help: 'Stats pages — FBref, SofaScore, FotMob, Transfermarkt, WhoScored. Match stats, ratings, goals, assists, xG.',
    accent: 'text-emerald-400',
  },
  article: {
    label: '📰 Article',
    icon: Newspaper,
    help: 'Journalist analysis — BBC, ESPN, Sky Sports, The Athletic, Guardian, Goal, Reuters, L\u2019\u00c9quipe, Marca.',
    accent: 'text-sky-400',
  },
  social: {
    label: '💬 Social',
    icon: MessageCircle,
    help: 'Fan sentiment — X/Twitter, Reddit, Instagram, Facebook, TikTok, YouTube comments.',
    accent: 'text-amber-400',
  },
}

const PLATFORM_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  twitter: { icon: '\u{1D54F}', color: 'text-white', label: 'X' },
  reddit: { icon: '\u{1F916}', color: 'text-orange-400', label: 'Reddit' },
  instagram: { icon: '\u{1F4F7}', color: 'text-pink-400', label: 'Instagram' },
  facebook: { icon: 'f', color: 'text-blue-400', label: 'Facebook' },
  tiktok: { icon: '\u{1F3B5}', color: 'text-red-400', label: 'TikTok' },
  youtube: { icon: '\u{1F534}', color: 'text-red-500', label: 'YouTube' },
  web: { icon: '\u{1F310}', color: 'text-emerald-400', label: 'Web' },
}

const TREND_BADGE: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  rising: {
    color: 'text-emerald-300 bg-emerald-400/10 border border-emerald-400/30',
    icon: TrendingUp,
    label: 'Rising',
  },
  falling: {
    color: 'text-red-300 bg-red-400/10 border border-red-400/30',
    icon: TrendingDown,
    label: 'Falling',
  },
  stable: {
    color: 'text-slate-300 bg-slate-400/10 border border-slate-400/30',
    icon: Minus,
    label: 'Stable',
  },
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function BallonDorAdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState('')

  // On mount, check if a valid cookie session already exists.
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setAuthed(!!data?.authed)
      })
      .catch(() => {
        if (!cancelled) setAuthed(false)
      })
      .finally(() => {
        if (!cancelled) setCheckingAuth(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAuth = () => {
    if (!password.trim()) {
      setAuthError('Password is required')
      return
    }
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((res) => {
        if (res.ok) {
          setAuthed(true)
          setAuthError('')
          setPassword('')
        } else {
          setAuthError('Invalid password')
          setAuthed(false)
        }
      })
      .catch(() => {
        setAuthError('Network error \u2014 try again')
      })
  }

  const handleLogout = () => {
    fetch('/api/admin/logout', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        setAuthed(false)
        setPassword('')
      })
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-white/10 border-t-[#6C2BD9]" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C2BD9] to-[#F59E0B] flex items-center justify-center text-white">
              <Trophy className="size-5" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Fan Pulse Admin</h1>
              <p className="text-white/50 text-xs">Ballon d’Or Source Studio</p>
            </div>
          </div>
          <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wider">
            Admin Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Enter admin password"
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30 transition-all"
            autoFocus
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
          />
          <p className="mt-2 text-xs text-white/40">
            Password changed? Clear your browser&rsquo;s saved password for this
            site and re-type it manually.
          </p>
          {authError && (
            <p className="mt-2 text-xs text-[#EF4444] flex items-center gap-1.5">
              <AlertCircle className="size-3.5" /> {authError}
            </p>
          )}
          <button
            onClick={handleAuth}
            className="mt-4 w-full bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
          >
            <Lock className="size-4" /> Unlock Admin
          </button>
          <p className="mt-4 text-xs text-white/40 text-center">
            Admin password required. Set ADMIN_PASSWORD in your environment.
          </p>
        </motion.div>
      </div>
    )
  }

  return <BallonDorDashboard onLogout={handleLogout} />
}

// ── Dashboard (shown when authed) ───────────────────────────────────────────

function BallonDorDashboard({ onLogout }: { onLogout: () => void }) {
  // ── Section A: Add Source form ─────────────────────────────────────────
  const [playerName, setPlayerName] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('stats')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    ok: boolean
    message: string
    warning?: string
  } | null>(null)

  // ── Section B: Ranking table ──────────────────────────────────────────
  const [contenders, setContenders] = useState<Contender[]>([])
  const [loadingContenders, setLoadingContenders] = useState(true)
  const [recomputing, setRecomputing] = useState(false)

  // ── Section C: Recent sources ────────────────────────────────────────
  const [sources, setSources] = useState<Source[]>([])
  const [loadingSources, setLoadingSources] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<'all' | SourceType>('all')

  // ── Toast ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{
    msg: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Existing player names for autocomplete in Section A
  const existingPlayerNames = useMemo(
    () => contenders.map((c) => c.name).sort(),
    [contenders],
  )

  // ── Data fetchers ─────────────────────────────────────────────────────
  const fetchContenders = useCallback(async () => {
    setLoadingContenders(true)
    try {
      const res = await fetch('/api/admin/ballon-dor/contenders')
      if (res.ok) {
        const data = await res.json()
        setContenders(data.contenders || [])
      } else {
        setContenders([])
      }
    } catch (err) {
      console.error('Failed to fetch contenders:', err)
      setContenders([])
    } finally {
      setLoadingContenders(false)
    }
  }, [])

  const fetchSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const res = await fetch('/api/admin/ballon-dor/sources?limit=20')
      if (res.ok) {
        const data = await res.json()
        setSources(data.sources || [])
      } else {
        setSources([])
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err)
      setSources([])
    } finally {
      setLoadingSources(false)
    }
  }, [])

  useEffect(() => {
    fetchContenders()
    fetchSources()
  }, [fetchContenders, fetchSources])

  const refreshAll = useCallback(() => {
    fetchContenders()
    fetchSources()
  }, [fetchContenders, fetchSources])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleAddSource = async () => {
    // Reset
    setSubmitResult(null)

    const trimmedName = playerName.trim()
    const trimmedUrl = url.trim()

    if (trimmedName.length < 2) {
      setSubmitResult({ ok: false, message: 'Player name must be at least 2 characters' })
      showToast('Player name is required', 'error')
      return
    }

    if (!trimmedUrl.startsWith('https://')) {
      setSubmitResult({ ok: false, message: 'URL must start with https://' })
      showToast('URL must start with https://', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/ballon-dor/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: trimmedName,
          sourceType,
          url: trimmedUrl,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Success — could be partial (page_reader failed) but still stored
        if (data.warning) {
          setSubmitResult({
            ok: true,
            message: `Source stored for ${trimmedName} — score ${data.source?.componentScore ?? '?'}/100`,
            warning: data.warning,
          })
          showToast('Stored with warning \u2014 see details', 'error')
        } else {
          const recompute = data.recompute as RecomputeResult | null
          const deltaStr =
            recompute && typeof recompute.delta === 'number'
              ? ` \u2014 score ${recompute.newScore} (${recompute.delta >= 0 ? '+' : ''}${recompute.delta})`
              : ''
          setSubmitResult({
            ok: true,
            message: `Added ${sourceType} source for ${trimmedName}${deltaStr}`,
          })
          showToast(`Analyzed + added for ${trimmedName}`, 'success')
        }
        // Clear URL field on success
        setUrl('')
        // Refresh both ranking + recent sources
        refreshAll()
      } else if (res.status === 429) {
        const retryAfter = data.retryAfter ?? 60
        setSubmitResult({
          ok: false,
          message: `Rate limited \u2014 wait ${retryAfter}s`,
        })
        showToast(`Rate limited \u2014 wait ${retryAfter}s`, 'error')
      } else {
        const message = data.error || 'Failed to add source'
        setSubmitResult({ ok: false, message })
        showToast(message, 'error')
      }
    } catch (err) {
      console.error('Failed to add source:', err)
      setSubmitResult({ ok: false, message: 'Network error \u2014 try again' })
      showToast('Network error \u2014 try again', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecomputeAll = async () => {
    setRecomputing(true)
    try {
      const res = await fetch('/api/admin/ballon-dor/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`Recomputed ${data.count} contenders`, 'success')
        fetchContenders()
      } else if (res.status === 429) {
        showToast('Rate limited \u2014 wait a minute', 'error')
      } else {
        showToast(data.error || 'Recompute failed', 'error')
      }
    } catch (err) {
      console.error('Recompute failed:', err)
      showToast('Network error during recompute', 'error')
    } finally {
      setRecomputing(false)
    }
  }

  const handleDelete = async (source: Source) => {
    if (!confirm(`Remove this ${source.sourceType} source for ${source.playerName}?`)) {
      return
    }
    try {
      const res = await fetch(
        `/api/admin/ballon-dor/sources/${encodeURIComponent(source.id)}`,
        { method: 'DELETE' },
      )
      if (res.ok) {
        showToast('Source removed', 'success')
        // Refresh both ranking + recent sources
        refreshAll()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Failed to remove source', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  // ── Filtered sources for Section C ────────────────────────────────────
  const filteredSources = useMemo(() => {
    if (sourceFilter === 'all') return sources
    return sources.filter((s) => s.sourceType === sourceFilter)
  }, [sources, sourceFilter])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C2BD9] to-[#F59E0B] flex items-center justify-center text-white">
              <Trophy className="size-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base">
                Ballon d’Or Source Studio
              </h1>
              <p className="text-white/40 text-xs">
                Paste URLs → AI extracts stats + sentiment → composite score
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <LogOut className="size-3.5" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* ── Section A: Add Source ───────────────────────────────────── */}
        <section className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-5 text-[#8B5CF6]" />
            <h2 className="font-bold text-base">Add Source</h2>
            <span className="text-xs text-white/40 ml-auto">
              AI reads each URL + extracts structured data
            </span>
          </div>

          {/* Player name (with autocomplete from existing contenders) */}
          <div className="space-y-2 mb-4">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <User className="size-3.5" /> Player name
            </label>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              placeholder="e.g. Ousmane Dembélé"
              list="bd-player-names"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30 transition-all"
              autoComplete="off"
            />
            <datalist id="bd-player-names">
              {existingPlayerNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-xs text-white/40">
              {existingPlayerNames.length > 0
                ? `${existingPlayerNames.length} existing contenders loaded for autocomplete. Type a new name to add a new contender.`
                : 'New player? Just type the full name \u2014 a contender row will be auto-created.'}
            </p>
          </div>

          {/* Source type dropdown */}
          <div className="space-y-2 mb-4">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">
              Source type
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30"
            >
              <option value="stats">{SOURCE_TYPES.stats.label}</option>
              <option value="article">{SOURCE_TYPES.article.label}</option>
              <option value="social">{SOURCE_TYPES.social.label}</option>
            </select>
            <p className="text-xs text-white/40">
              {SOURCE_TYPES[sourceType].help}
            </p>
          </div>

          {/* URL input */}
          <div className="space-y-2 mb-5">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="size-3.5" /> URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              placeholder="https://fbref.com/en/players/..."
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30 transition-all"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-white/40">
              Must start with <code className="text-white/60">https://</code>.
              Allowed domains: x.com, reddit.com, instagram.com, fbref.com,
              sofascore.com, transfermarkt.com, espn.com, bbc.com, theathletic.com,
              theguardian.com, goal.com, uefa.com, fifa.com, si.com …
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleAddSource}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Analyze &amp; Add
              </>
            )}
          </button>

          {/* Submit result */}
          <AnimatePresence>
            {submitResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-3 overflow-hidden rounded-lg border p-3 text-xs ${
                  submitResult.ok
                    ? 'bg-emerald-400/5 border-emerald-400/20 text-emerald-200'
                    : 'bg-red-400/5 border-red-400/20 text-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {submitResult.ok ? (
                    <CheckCircle2 className="size-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-bold">{submitResult.message}</p>
                    {submitResult.warning && (
                      <p className="text-yellow-300/80">
                        ⚠️ {submitResult.warning}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSubmitResult(null)}
                    className="text-white/40 hover:text-white flex-shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Section B: Current Ranking ──────────────────────────────── */}
        <section className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Trophy className="size-5 text-[#F59E0B]" />
              Current Ranking
            </h2>
            <button
              onClick={handleRecomputeAll}
              disabled={recomputing}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recomputing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {recomputing ? 'Recomputing\u2026' : 'Recompute All'}
            </button>
          </div>

          {loadingContenders ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-white/40" />
            </div>
          ) : contenders.length === 0 ? (
            <div className="text-center py-10 text-white/40 text-sm">
              No contenders yet. Add a source above to seed the ranking.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-white/40 border-b border-white/10">
                    <th className="py-2 px-2 font-bold">#</th>
                    <th className="py-2 px-2 font-bold">Player</th>
                    <th className="py-2 px-2 font-bold">Club</th>
                    <th className="py-2 px-2 font-bold text-right">Score</th>
                    <th className="py-2 px-2 font-bold text-center">Trend</th>
                    <th className="py-2 px-2 font-bold text-center" title="Stats sources">
                      📊
                    </th>
                    <th className="py-2 px-2 font-bold text-center" title="Article sources">
                      📰
                    </th>
                    <th className="py-2 px-2 font-bold text-center" title="Social sources">
                      💬
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contenders.map((c, idx) => {
                    const rank = idx + 1
                    const delta = Math.round(c.ballonDorScore - c.previousScore)
                    const trend = TREND_BADGE[c.trend] ?? TREND_BADGE.stable
                    const TrendIcon = trend.icon
                    const medalColor =
                      rank === 1
                        ? 'text-yellow-400'
                        : rank === 2
                          ? 'text-slate-300'
                          : rank === 3
                            ? 'text-amber-600'
                            : 'text-white/40'

                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-2.5 px-2">
                          <span className={`font-black ${medalColor}`}>
                            {rank}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-white">{c.name}</div>
                          <div className="text-[10px] text-white/40">
                            {c.position} · {c.nationCode}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-white/70">{c.clubName}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="font-black text-white tabular-nums">
                            {Math.round(c.ballonDorScore)}
                          </div>
                          {delta !== 0 && (
                            <div
                              className={`text-[10px] font-bold tabular-nums ${
                                delta > 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {delta > 0 ? '\u2191' : '\u2193'} {delta > 0 ? '+' : ''}
                              {delta}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${trend.color}`}
                          >
                            <TrendIcon className="size-3" />
                            {trend.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-flex items-center gap-0.5 text-xs">
                            <span className="font-bold text-emerald-400">
                              {c.statsSourceCount}
                            </span>
                            {c.statsSourceCount > 0 && (
                              <span className="text-[10px] text-white/30 tabular-nums">
                                {Math.round(c.statsScore)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-flex items-center gap-0.5 text-xs">
                            <span className="font-bold text-sky-400">
                              {c.articleSourceCount}
                            </span>
                            {c.articleSourceCount > 0 && (
                              <span className="text-[10px] text-white/30 tabular-nums">
                                {Math.round(c.articleScore)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-flex items-center gap-0.5 text-xs">
                            <span className="font-bold text-amber-400">
                              {c.socialSourceCount}
                            </span>
                            {c.socialSourceCount > 0 && (
                              <span className="text-[10px] text-white/30 tabular-nums">
                                {Math.round(c.socialScore)}
                              </span>
                            )}
                          </span>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-white/40">
                Showing {contenders.length} contenders. Numbers next to source
                counts are component sub-scores (0–100). Delta arrow shows
                change from previous score after last recompute.
              </p>
            </div>
          )}
        </section>

        {/* ── Section C: Recent Sources ──────────────────────────────── */}
        <section className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Clock className="size-5 text-white/60" />
              Recent Sources
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={sourceFilter}
                onChange={(e) =>
                  setSourceFilter(e.target.value as 'all' | SourceType)
                }
                className="bg-[#0A0A0A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#6C2BD9]"
              >
                <option value="all">All</option>
                <option value="stats">{SOURCE_TYPES.stats.label}</option>
                <option value="article">{SOURCE_TYPES.article.label}</option>
                <option value="social">{SOURCE_TYPES.social.label}</option>
              </select>
              <button
                onClick={fetchSources}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-2 py-1.5 rounded hover:bg-white/5"
              >
                <RefreshCw className="size-3.5" /> Refresh
              </button>
            </div>
          </div>

          {loadingSources ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-white/40" />
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              {sources.length === 0
                ? 'No sources yet. Paste a URL above to feed the Ballon d\u2019Or engine.'
                : `No ${sourceFilter} sources. Try a different filter.`}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredSources.map((src) => {
                const plat =
                  PLATFORM_META[src.platform] ?? PLATFORM_META.web
                const SourceIcon = SOURCE_TYPES[src.sourceType]?.icon ?? Globe
                const sourceAccent =
                  SOURCE_TYPES[src.sourceType]?.accent ?? 'text-white/60'
                return (
                  <motion.div
                    key={src.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-start gap-3 p-3 bg-[#0A0A0A] rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                  >
                    {/* Platform icon */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-base">
                      {plat.icon}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-white">
                          {src.playerName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 ${sourceAccent}`}
                        >
                          <SourceIcon className="size-2.5" />
                          {src.sourceType}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/60">
                          {Math.round(src.componentScore)}/100
                        </span>
                        {src.analysisError && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-400/10 text-yellow-300"
                            title={src.analysisError}
                          >
                            ⚠ partial
                          </span>
                        )}
                      </div>

                      {src.topQuote && (
                        <p className="text-xs text-white/70 line-clamp-2 mb-1.5 italic">
                          &ldquo;{src.topQuote}&rdquo;
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-white/40">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {formatRelative(src.postedAt)}
                        </span>
                        {src.author && (
                          <span className="inline-flex items-center gap-1">
                            <User className="size-2.5" />
                            {src.author}
                          </span>
                        )}
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#8B5CF6] hover:text-[#a78bfa] truncate max-w-[200px]"
                        >
                          <ExternalLink className="size-2.5" />
                          {shortenUrl(src.url)}
                        </a>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(src)}
                      className="flex-shrink-0 text-white/30 hover:text-red-400 p-1 transition-colors"
                      title="Remove source"
                      aria-label={`Remove ${src.sourceType} source for ${src.playerName}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Anti-hallucination notice ──────────────────────────────── */}
        <section className="bg-[#6C2BD9]/5 border border-[#6C2BD9]/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-white/60 space-y-1">
              <p className="font-bold text-white/80">
                Anti-hallucination contract
              </p>
              <p>
                The AI only analyzes the specific URL you paste. It never
                invents stats, articles, or sentiment. URLs that fail page_reader
                (login walls, bot challenges) are stored with a
                <code className="text-white/70 mx-1">partial</code> flag, not
                fabricated. Removing a source triggers a recompute for that
                player.
              </p>
              <p>
                Composite score = weighted blend of stats (40%) + article (35%)
                + social (25%) sub-scores.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-2xl ${
              toast.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  try {
    const date = new Date(iso)
    const diffMs = Date.now() - date.getTime()
    const sec = Math.floor(diffMs / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'unknown'
  }
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace('www.', '')
    const path = parsed.pathname.length > 24
      ? parsed.pathname.slice(0, 24) + '\u2026'
      : parsed.pathname
    return `${host}${path}`
  } catch {
    return url.length > 40 ? url.slice(0, 40) + '\u2026' : url
  }
}
