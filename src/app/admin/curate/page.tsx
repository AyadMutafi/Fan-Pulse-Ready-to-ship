'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Plus,
  Trash2,
  ExternalLink,
  Hash,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Clock,
  TrendingUp,
  Sparkles,
  LogOut,
} from 'lucide-react'

// ── Admin Curation Page ──────────────────────────────────────────────────────
// Founder-facing UI for the "70% manual curation" approach. The founder
// pastes real tweet/post URLs for a specific match; the AI reads + scores
// ONLY those URLs (never invents content).
//
// SECURITY: Cookie-based admin auth (same pattern as /admin/feed-monitor).
// The password is POSTed to /api/admin/login, which sets an HttpOnly +
// Secure + SameSite=Strict cookie. JS cannot read it → XSS-proof.

interface Match {
  id: string
  homeTeam: { code: string; name: string; flag: string }
  awayTeam: { code: string; name: string; flag: string }
  score: string
  status: string
  league: string
  group: string
  matchDate: string
}

interface CurationResult {
  url: string
  status: 'added' | 'skipped' | 'error'
  reason?: string
  linkId?: string
  author?: string
  sentimentScore?: number
  sentimentLabel?: string
}

interface CuratedLinkRow {
  id: string
  url: string
  platform: string
  author: string
  content: string
  sentimentScore: number
  sentimentLabel: string
  hashtags: string[]
  postedAt: string
  matchLabel: string
  curatedAt: string
}

const PLATFORM_LABELS: Record<string, { icon: string; color: string }> = {
  twitter: { icon: '𝕏', color: 'text-white' },
  reddit: { icon: '🤖', color: 'text-orange-400' },
  instagram: { icon: '📷', color: 'text-pink-400' },
  facebook: { icon: 'f', color: 'text-blue-400' },
  tiktok: { icon: '🎵', color: 'text-red-400' },
  web: { icon: '🌐', color: 'text-green-400' },
}

const SENTIMENT_COLORS: Record<string, string> = {
  excited: 'text-green-400 bg-green-400/10',
  neutral: 'text-slate-400 bg-slate-400/10',
  skeptical: 'text-yellow-400 bg-yellow-400/10',
  dreading: 'text-red-400 bg-red-400/10',
}

export default function CurateAdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState('')

  // On mount, check if a valid cookie session already exists.
  // /api/admin/session returns { authed: boolean } with HTTP 200 either way
  // (it doesn't leak whether the password is set). We check the body.
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
    return () => { cancelled = true }
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
        setAuthError('Network error — try again')
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C2BD9] to-[#10B981] flex items-center justify-center text-white font-black text-xl">
              F
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Fan Pulse Admin</h1>
              <p className="text-white/50 text-xs">Curation Studio</p>
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
          />
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

  return <CurationDashboard onLogout={handleLogout} />
}

// ── Curation Dashboard (shown when authed) ───────────────────────────────────

function CurationDashboard({ onLogout }: { onLogout: () => void }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [useManualMatch, setUseManualMatch] = useState(false)
  const [manualHome, setManualHome] = useState('')
  const [manualAway, setManualAway] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualLabel, setManualLabel] = useState('')
  const [urls, setUrls] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    added: number
    skipped: number
    total: number
    results: CurationResult[]
    errors: string[]
  } | null>(null)
  const [recentLinks, setRecentLinks] = useState<CuratedLinkRow[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Fetch recent matches for the dropdown
  useEffect(() => {
    fetch('/api/matches?limit=20')
      .then((res) => res.json())
      .then((data) => {
        if (data.matches) setMatches(data.matches)
      })
      .catch((err) => console.error('Failed to fetch matches:', err))
  }, [])

  const fetchRecentLinks = useCallback(async () => {
    setLoadingRecent(true)
    try {
      // Fetch all recent curated links (admin view — no matchId filter)
      const res = await fetch('/api/curate/recent?limit=20')
      if (res.ok) {
        const data = await res.json()
        setRecentLinks(data.links || [])
      } else {
        setRecentLinks([])
      }
    } catch (err) {
      console.error('Failed to fetch recent curated links:', err)
      setRecentLinks([])
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    fetchRecentLinks()
  }, [fetchRecentLinks])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSubmit = async () => {
    // Validate inputs
    const urlList = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)

    if (urlList.length === 0) {
      showToast('Paste at least one URL', 'error')
      return
    }

    let matchId: string | null = null
    let matchLabel: string

    if (useManualMatch) {
      if (!manualHome.trim() || !manualAway.trim()) {
        showToast('Enter both team names for manual match', 'error')
        return
      }
      matchLabel = manualLabel.trim() ||
        `${manualHome.trim()} vs ${manualAway.trim()}${manualDate ? ` — ${manualDate}` : ''}`
    } else {
      if (!selectedMatchId) {
        showToast('Select a match or switch to manual entry', 'error')
        return
      }
      const m = matches.find((x) => x.id === selectedMatchId)
      if (!m) {
        showToast('Selected match not found', 'error')
        return
      }
      matchId = m.id
      const dateStr = m.matchDate ? new Date(m.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      matchLabel = `${m.homeTeam.name} vs ${m.awayTeam.name}${dateStr ? ` — ${dateStr}` : ''} (${m.league}${m.group ? ` ${m.group}` : ''})`
    }

    const hashtagList = hashtags
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)

    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          matchLabel,
          urls: urlList,
          hashtags: hashtagList,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
        showToast(`Curated ${data.added} links, skipped ${data.skipped}`, 'success')
        // Clear the URL field on success
        if (data.added > 0) {
          setUrls('')
          fetchRecentLinks()
        }
      } else if (res.status === 429) {
        showToast(`Rate limited — wait ${data.retryAfter || 60}s`, 'error')
      } else {
        showToast(data.error || 'Curation failed', 'error')
      }
    } catch (err) {
      showToast('Network error — try again', 'error')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this curated link? It will be hidden from Fan Talk.')) return
    try {
      const res = await fetch(`/api/curate/recent?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setRecentLinks((prev) => prev.filter((l) => l.id !== id))
        showToast('Link removed', 'success')
      } else {
        showToast('Failed to remove link', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C2BD9] to-[#10B981] flex items-center justify-center text-white font-black text-lg">
              F
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base">Curation Studio</h1>
              <p className="text-white/40 text-xs">Paste real URLs → AI scores them</p>
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
        {/* ── Curation Form ── */}
        <section className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-5 text-[#8B5CF6]" />
            <h2 className="font-bold text-base">Curate & Analyze</h2>
          </div>

          {/* Match selector */}
          <div className="space-y-3 mb-4">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">
              Match
            </label>
            {!useManualMatch ? (
              <div className="flex gap-2">
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30"
                >
                  <option value="">Select a recent match…</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.homeTeam.name} vs {m.awayTeam.name} — {m.score} ({m.league}
                      {m.group ? ` ${m.group}` : ''})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setUseManualMatch(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-bold whitespace-nowrap"
                >
                  <Plus className="size-3.5" /> New
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-[#0A0A0A] border border-white/10 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Home team</label>
                    <input
                      value={manualHome}
                      onChange={(e) => setManualHome(e.target.value)}
                      placeholder="Arsenal"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#6C2BD9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Away team</label>
                    <input
                      value={manualAway}
                      onChange={(e) => setManualAway(e.target.value)}
                      placeholder="Chelsea"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#6C2BD9]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Date (optional)</label>
                    <input
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      placeholder="Jul 28"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#6C2BD9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Label (optional)</label>
                    <input
                      value={manualLabel}
                      onChange={(e) => setManualLabel(e.target.value)}
                      placeholder="Arsenal vs Chelsea — Friendly"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#6C2BD9]"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setUseManualMatch(false)}
                  className="text-xs text-[#8B5CF6] hover:text-[#a78bfa] font-bold"
                >
                  ← Use existing match instead
                </button>
              </div>
            )}
          </div>

          {/* URL paste area */}
          <div className="space-y-2 mb-4">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="size-3.5" /> URLs (one per line)
            </label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={'https://x.com/FabrizioRomano/status/...\nhttps://www.reddit.com/r/soccer/comments/...\nhttps://www.bbc.com/sport/football/...'}
              rows={6}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30 resize-y"
            />
            <p className="text-xs text-white/40">
              Accepted: x.com, twitter.com, reddit.com, instagram.com, facebook.com, tiktok.com, ESPN, BBC, Sky Sports, The Athletic, Guardian, Goal, Al Jazeera, Reuters
            </p>
          </div>

          {/* Hashtags */}
          <div className="space-y-2 mb-5">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="size-3.5" /> Hashtags (comma-separated, optional)
            </label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#Arsenal, #COYG, #Saka"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Curate & Analyze
              </>
            )}
          </button>
        </section>

        {/* ── Results ── */}
        <AnimatePresence>
          {result && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 sm:p-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-green-400" />
                  Results
                </h2>
                <button
                  onClick={() => setResult(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-green-400">{result.added}</div>
                  <div className="text-xs text-white/50">Added</div>
                </div>
                <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-yellow-400">{result.skipped}</div>
                  <div className="text-xs text-white/50">Skipped</div>
                </div>
                <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-white/60">{result.total}</div>
                  <div className="text-xs text-white/50">Total</div>
                </div>
              </div>

              {/* Per-URL results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                      r.status === 'added'
                        ? 'bg-green-400/5 border border-green-400/20'
                        : 'bg-yellow-400/5 border border-yellow-400/20'
                    }`}
                  >
                    {r.status === 'added' ? (
                      <CheckCircle2 className="size-4 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-white/80 truncate">{r.url}</span>
                        {r.author && (
                          <span className="text-white/50 text-[10px]">{r.author}</span>
                        )}
                        {r.sentimentScore !== undefined && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SENTIMENT_COLORS[r.sentimentLabel || 'neutral'] || SENTIMENT_COLORS.neutral}`}>
                            {r.sentimentScore} · {r.sentimentLabel}
                          </span>
                        )}
                      </div>
                      {r.reason && (
                        <p className="text-white/40 mt-0.5">{r.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-white/50 cursor-pointer hover:text-white/70">
                    {result.errors.length} error details
                  </summary>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-400/70 font-mono">{e}</p>
                    ))}
                  </div>
                </details>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Recent Curated Links ── */}
        <section className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Clock className="size-5 text-white/60" />
              Recently Curated
            </h2>
            <button
              onClick={fetchRecentLinks}
              className="text-xs text-white/50 hover:text-white px-2 py-1 rounded hover:bg-white/5"
            >
              Refresh
            </button>
          </div>

          {loadingRecent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-white/40" />
            </div>
          ) : recentLinks.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              No curated links yet. Paste URLs above to get started.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentLinks.map((link) => {
                const plat = PLATFORM_LABELS[link.platform] || PLATFORM_LABELS.web
                return (
                  <div
                    key={link.id}
                    className="flex items-start gap-3 p-3 bg-[#0A0A0A] rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm">
                      {plat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-xs text-white">{link.author}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SENTIMENT_COLORS[link.sentimentLabel] || SENTIMENT_COLORS.neutral}`}>
                          {link.sentimentScore} · {link.sentimentLabel}
                        </span>
                        <span className="text-[10px] text-white/40">{link.matchLabel}</span>
                      </div>
                      <p className="text-xs text-white/60 line-clamp-2 mb-1">{link.content}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa]"
                        >
                          <ExternalLink className="size-2.5" /> Source
                        </a>
                        {link.hashtags.length > 0 && (
                          <span className="text-[10px] text-white/30">
                            {link.hashtags.join(' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="flex-shrink-0 text-white/30 hover:text-red-400 p-1"
                      title="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Anti-hallucination notice ── */}
        <section className="bg-[#6C2BD9]/5 border border-[#6C2BD9]/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-white/60 space-y-1">
              <p className="font-bold text-white/80">Anti-hallucination contract</p>
              <p>The AI only analyzes the specific URLs you paste. It never invents content, authors, or sentiment. URLs that fail page_reader (login walls, bot challenges) are skipped — not fabricated.</p>
              <p>Curated links take priority in Fan Talk: if &gt; 3 exist for a match, the AI web_search is skipped entirely (70% manual path).</p>
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
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
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
