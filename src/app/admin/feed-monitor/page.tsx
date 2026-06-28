'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Plus, RefreshCw, Play, Pause, Square, Trash2, ExternalLink, Eye, ChevronDown, ChevronRight, Activity, MessageCircle, Clock, Hash, Link as LinkIcon, AlertCircle, CheckCircle2, X } from 'lucide-react'

// ── Admin Feed Monitor Page ──────────────────────────────────────────────────
// Password-protected UI for creating and managing FeedMonitors.
// The admin enters the same password as ADMIN_PASSWORD env var.
// Once authed, the session is held in localStorage for convenience.

interface Monitor {
  id: string
  matchLabel: string
  stageId: string | null
  teamCodes: string[]
  playerIds: string[]
  hashtags: string[]
  seedUrls: string[]
  status: 'active' | 'paused' | 'ended'
  refreshInterval: number
  lastRefreshedAt: string | null
  endsAt: string
  createdAt: string
  postCount: number
  playerSentimentCount: number
}

interface Post {
  id: string
  platform: string
  url: string
  author: string
  content: string
  language: string
  sentimentScore: number
  positiveRatio: number
  mentionedPlayers: string[]
  topQuote: string | null
  postedAt: string
  analyzedAt: string
}

export default function FeedMonitorAdminPage() {
  // Persist auth in localStorage so refresh doesn't lose session.
  // Use lazy initial state to avoid the setState-in-effect anti-pattern.
  const [password, setPassword] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('fp_admin_pw') || ''
  })
  const [authed, setAuthed] = useState(() => {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('fp_admin_pw')
  })
  const [authError, setAuthError] = useState('')

  const handleAuth = () => {
    if (!password.trim()) {
      setAuthError('Password is required')
      return
    }
    // Test the password by hitting the GET endpoint
    fetch('/api/admin/feed-monitor', {
      headers: { 'x-admin-password': password },
    })
      .then((res) => {
        if (res.ok) {
          setAuthed(true)
          setAuthError('')
          if (typeof window !== 'undefined') {
            localStorage.setItem('fp_admin_pw', password)
          }
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
    setAuthed(false)
    setPassword('')
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fp_admin_pw')
    }
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
              <p className="text-white/50 text-xs">Feed Monitor Pipeline</p>
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
            className="mt-4 w-full bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Lock className="size-4" /> Unlock Admin
          </button>
          <p className="mt-4 text-xs text-white/40 text-center">
            Tip: the dev password is <code className="text-white/60 bg-white/5 px-1.5 py-0.5 rounded">Ayad1241987</code>
          </p>
        </motion.div>
      </div>
    )
  }

  return <MonitorDashboard password={password} onLogout={handleLogout} />
}

// ── Monitor Dashboard (shown when authed) ────────────────────────────────────

function MonitorDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedMonitorId, setExpandedMonitorId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/feed-monitor', {
        headers: { 'x-admin-password': password },
      })
      if (res.ok) {
        const data = await res.json()
        setMonitors(data.monitors || [])
      }
    } catch (err) {
      console.error('Failed to fetch monitors:', err)
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => {
    fetchMonitors()
    // Auto-refresh the monitor list every 30s so admins see live updates
    const interval = setInterval(fetchMonitors, 30000)
    return () => clearInterval(interval)
  }, [fetchMonitors])

  const handleRefresh = async (id: string) => {
    setRefreshing(id)
    try {
      const res = await fetch(`/api/admin/feed-monitor/${id}/refresh`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      if (res.ok) {
        const r = data.refresh
        setToast({
          msg: `Refreshed: ${r.newPosts} new posts, ${r.playersUpdated} players updated in ${Math.round(r.durationMs / 1000)}s`,
          type: 'success',
        })
        fetchMonitors()
      } else {
        setToast({ msg: data.error || 'Refresh failed', type: 'error' })
      }
    } catch (err) {
      setToast({ msg: 'Network error', type: 'error' })
    } finally {
      setRefreshing(null)
      setTimeout(() => setToast(null), 5000)
    }
  }

  const handleStatusChange = async (id: string, status: 'active' | 'paused' | 'ended') => {
    try {
      const res = await fetch(`/api/admin/feed-monitor/${id}`, {
        method: 'PATCH',
        headers: {
          'x-admin-password': password,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        fetchMonitors()
        setToast({ msg: `Monitor ${status}`, type: 'success' })
        setTimeout(() => setToast(null), 3000)
      }
    } catch (err) {
      setToast({ msg: 'Status update failed', type: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this monitor and all its scraped posts? Player sentiment aggregates will be preserved.')) {
      return
    }
    try {
      const res = await fetch(`/api/admin/feed-monitor/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      })
      if (res.ok) {
        fetchMonitors()
        setToast({ msg: 'Monitor deleted', type: 'success' })
        setTimeout(() => setToast(null), 3000)
      }
    } catch (err) {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#1A1A1A] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6C2BD9] to-[#10B981] flex items-center justify-center font-black">
              F
            </div>
            <div>
              <h1 className="font-bold text-sm">Feed Monitor Pipeline</h1>
              <p className="text-white/50 text-xs">Admin · Fan Sentiment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Plus className="size-3.5" /> New Monitor
            </button>
            <button
              onClick={onLogout}
              className="text-white/60 hover:text-white text-xs font-bold px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Active Monitors" value={monitors.filter((m) => m.status === 'active').length} icon={<Activity className="size-4 text-[#10B981]" />} />
          <StatCard label="Total Posts Scraped" value={monitors.reduce((s, m) => s + m.postCount, 0)} icon={<MessageCircle className="size-4 text-[#8B5CF6]" />} />
          <StatCard label="Players Tracked" value={monitors.reduce((s, m) => s + m.playerSentimentCount, 0)} icon={<Hash className="size-4 text-[#FF6B35]" />} />
          <StatCard label="Ended Monitors" value={monitors.filter((m) => m.status === 'ended').length} icon={<Clock className="size-4 text-white/50" />} />
        </div>

        {/* Monitor list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 rounded-full border-2 border-white/10 border-t-[#6C2BD9]" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <MessageCircle className="size-8 text-white/30" />
            </div>
            <h2 className="text-lg font-bold mb-1">No monitors yet</h2>
            <p className="text-white/50 text-sm mb-4">Create a feed monitor to start scraping real fan sentiment.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              <Plus className="size-4" /> Create First Monitor
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => (
              <MonitorCard
                key={m.id}
                monitor={m}
                password={password}
                expanded={expandedMonitorId === m.id}
                onToggle={() => setExpandedMonitorId(expandedMonitorId === m.id ? null : m.id)}
                onRefresh={() => handleRefresh(m.id)}
                onStatusChange={(s) => handleStatusChange(m.id, s)}
                onDelete={() => handleDelete(m.id)}
                refreshing={refreshing === m.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create form modal */}
      <AnimatePresence>
        {showCreateForm && (
          <CreateMonitorModal
            password={password}
            onClose={() => setShowCreateForm(false)}
            onCreated={() => {
              setShowCreateForm(false)
              fetchMonitors()
              setToast({ msg: 'Monitor created! Initial refresh running in background — check back in 30-60s.', type: 'success' })
              setTimeout(() => setToast(null), 6000)
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-black">{value.toLocaleString()}</div>
    </div>
  )
}

function MonitorCard({
  monitor,
  password,
  expanded,
  onToggle,
  onRefresh,
  onStatusChange,
  onDelete,
  refreshing,
}: {
  monitor: Monitor
  password: string
  expanded: boolean
  onToggle: () => void
  onRefresh: () => void
  onStatusChange: (status: 'active' | 'paused' | 'ended') => void
  onDelete: () => void
  refreshing: boolean
}) {
  const statusColors = {
    active: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30',
    paused: 'bg-[#FF6B35]/10 text-[#FF6B35] border-[#FF6B35]/30',
    ended: 'bg-white/5 text-white/50 border-white/10',
  }

  const lastRefreshed = monitor.lastRefreshedAt
    ? new Date(monitor.lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'never'

  const endsAt = new Date(monitor.endsAt)
  const timeLeft = endsAt.getTime() - Date.now()
  const timeLeftLabel = timeLeft > 0 ? `${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}m left` : 'ended'

  return (
    <div className="bg-[#1A1A1A] border border-white/10 rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <button onClick={onToggle} className="text-white/40 hover:text-white transition-colors">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-sm truncate">{monitor.matchLabel}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColors[monitor.status]}`}>
              {monitor.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
            <span className="flex items-center gap-1">
              <Hash className="size-3" /> {monitor.hashtags.length} tags
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3" /> {monitor.postCount} posts
            </span>
            <span className="flex items-center gap-1">
              <Activity className="size-3" /> {monitor.playerSentimentCount} players
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> refreshed {lastRefreshed}
            </span>
            <span className="text-white/40">· {timeLeftLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={refreshing || monitor.status === 'ended'}
            title="Manual refresh"
            className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {monitor.status === 'active' ? (
            <button
              onClick={() => onStatusChange('paused')}
              title="Pause"
              className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <Pause className="size-4" />
            </button>
          ) : monitor.status === 'paused' ? (
            <button
              onClick={() => onStatusChange('active')}
              title="Resume"
              className="p-2 rounded-lg hover:bg-white/5 text-[#10B981] transition-colors"
            >
              <Play className="size-4" />
            </button>
          ) : null}
          <button
            onClick={() => onStatusChange('ended')}
            disabled={monitor.status === 'ended'}
            title="End monitor"
            className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <Square className="size-4" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-2 rounded-lg hover:bg-[#EF4444]/10 text-white/60 hover:text-[#EF4444] transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10"
          >
            <MonitorDetail monitor={monitor} password={password} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MonitorDetail({ monitor, password }: { monitor: Monitor; password: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [postsOffset, setPostsOffset] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Use a ref-free cancelled flag instead of setState-in-effect.
    // The loading state is set when the fetch starts (in .then() below),
    // not synchronously at the top of the effect body.
    fetch(`/api/admin/feed-monitor/${monitor.id}/posts?limit=20&offset=${postsOffset}`, {
      headers: { 'x-admin-password': password },
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setPosts(data.posts || [])
        setLoadingPosts(false)
      })
      .catch(() => {
        if (!cancelled) setLoadingPosts(false)
      })
    return () => { cancelled = true }
  }, [monitor.id, password, postsOffset])

  return (
    <div className="p-4 space-y-4 bg-[#0F0F0F]">
      {/* Hashtags + Seed URLs */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Hash className="size-3" /> Hashtags ({monitor.hashtags.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {monitor.hashtags.map((tag, i) => (
              <span key={i} className="text-xs font-medium bg-[#6C2BD9]/10 text-[#8B5CF6] border border-[#6C2BD9]/30 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <LinkIcon className="size-3" /> Seed URLs ({monitor.seedUrls.length})
          </h4>
          {monitor.seedUrls.length === 0 ? (
            <p className="text-xs text-white/40 italic">No seed URLs provided</p>
          ) : (
            <div className="space-y-1">
              {monitor.seedUrls.slice(0, 3).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8B5CF6] hover:underline flex items-center gap-1 truncate"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
              {monitor.seedUrls.length > 3 && (
                <p className="text-xs text-white/40">+ {monitor.seedUrls.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      <div>
        <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <MessageCircle className="size-3" /> Recent Posts ({monitor.postCount} total)
        </h4>
        {loadingPosts ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-[#6C2BD9]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-6 text-xs text-white/40">
            No posts scraped yet. Refresh running in background.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {posts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PostRow({ post }: { post: Post }) {
  const [expanded, setExpanded] = useState(false)

  const platformColors = {
    twitter: 'bg-[#1DA1F2]/10 text-[#1DA1F2] border-[#1DA1F2]/30',
    reddit: 'bg-[#FF4500]/10 text-[#FF4500] border-[#FF4500]/30',
    web: 'bg-white/5 text-white/60 border-white/10',
  }

  const sentimentColor =
    post.sentimentScore >= 70
      ? 'text-[#10B981]'
      : post.sentimentScore >= 45
        ? 'text-[#FF6B35]'
        : 'text-[#EF4444]'

  return (
    <div className="bg-[#1A1A1A] border border-white/5 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${platformColors[post.platform as keyof typeof platformColors] || platformColors.web}`}>
            {post.platform}
          </span>
          <span className="text-xs font-bold text-white/80">{post.author || 'unknown'}</span>
          <span className="text-xs text-white/40">{new Date(post.postedAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-black ${sentimentColor}`}>{Math.round(post.sentimentScore)}</span>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white transition-colors"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
      <p className={`text-xs text-white/70 ${expanded ? '' : 'line-clamp-2'}`}>
        {post.content}
      </p>
      {post.content.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[#8B5CF6] hover:underline mt-1"
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      )}
      {post.topQuote && (
        <div className="mt-2 px-3 py-2 bg-[#6C2BD9]/5 border-l-2 border-[#6C2BD9] rounded-r">
          <p className="text-xs italic text-white/80">&ldquo;{post.topQuote}&rdquo;</p>
        </div>
      )}
      {post.mentionedPlayers.length > 0 && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-white/40">mentions:</span>
          {post.mentionedPlayers.slice(0, 3).map((id, i) => (
            <span key={i} className="text-[10px] text-[#FF6B35] font-mono">
              {id.slice(-6)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create Monitor Modal ─────────────────────────────────────────────────────

function CreateMonitorModal({
  password,
  onClose,
  onCreated,
}: {
  password: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    matchLabel: '',
    teamCodes: '',
    hashtags: '',
    seedUrls: '',
    playerIds: '',
    refreshInterval: '5',
    durationHours: '6',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!form.matchLabel.trim()) {
      setError('Match label is required (e.g. "ESP vs KSA — Matchday 2")')
      return
    }
    const teamCodes = form.teamCodes
      .split(/[,\n\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    const hashtags = form.hashtags
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (teamCodes.length === 0) {
      setError('Add at least one team code (e.g. ESP, KSA)')
      return
    }
    if (hashtags.length === 0) {
      setError('Add at least one hashtag (e.g. #LaRoja, #LamineYamal)')
      return
    }

    const seedUrls = form.seedUrls
      .split(/[,\n\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'))
    const playerIds = form.playerIds
      .split(/[,\n\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/feed-monitor', {
        method: 'POST',
        headers: {
          'x-admin-password': password,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchLabel: form.matchLabel.trim(),
          teamCodes,
          hashtags,
          seedUrls,
          playerIds,
          refreshInterval: Number(form.refreshInterval),
          durationHours: Number(form.durationHours),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onCreated()
      } else {
        setError(data.error || 'Failed to create monitor')
      }
    } catch (err) {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1A1A1A] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Create Feed Monitor</h2>
            <p className="text-xs text-white/50">Scrape real fan sentiment for a match</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-white/60">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <Field
            label="Match Label"
            placeholder="e.g. ESP vs KSA — Matchday 2"
            value={form.matchLabel}
            onChange={(v) => setForm({ ...form, matchLabel: v })}
            hint="Human-readable label shown in the monitor list"
          />
          <Field
            label="Team Codes"
            placeholder="ESP, KSA"
            value={form.teamCodes}
            onChange={(v) => setForm({ ...form, teamCodes: v })}
            hint="Comma-separated FIFA team codes (ESP, KSA, BRA, etc.)"
          />
          <Field
            label="Hashtags"
            placeholder={"#LaRoja, #LamineYamal, #ESPKSA\n#VamosEspaña"}
            value={form.hashtags}
            onChange={(v) => setForm({ ...form, hashtags: v })}
            hint="One per line or comma-separated. These anchor the search."
            textarea
          />
          <Field
            label="Seed Tweet/Post URLs (optional but recommended)"
            placeholder={"https://x.com/.../status/1234...\nhttps://reddit.com/r/soccer/comments/..."}
            value={form.seedUrls}
            onChange={(v) => setForm({ ...form, seedUrls: v })}
            hint="Viral tweets that anchor the conversation. 3-5 URLs ideal."
            textarea
          />
          <Field
            label="Player IDs to track (optional)"
            placeholder="cmqj36lcp00bordjrdro0geqk, cmqj36lci00b6rdjrsv75dxon"
            value={form.playerIds}
            onChange={(v) => setForm({ ...form, playerIds: v })}
            hint="Comma-separated WCSelectionPlayer IDs. Leave empty to track all players on selected teams."
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Refresh Interval (min)"
              placeholder="5"
              value={form.refreshInterval}
              onChange={(v) => setForm({ ...form, refreshInterval: v })}
              hint="1-60 min. 5 min recommended for live matches."
            />
            <Field
              label="Duration (hours)"
              placeholder="6"
              value={form.durationHours}
              onChange={(v) => setForm({ ...form, durationHours: v })}
              hint="1-48 hours. Auto-end after this window."
            />
          </div>

          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-xs text-[#EF4444] flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-[#6C2BD9]/5 border border-[#6C2BD9]/20 rounded-lg p-3 text-xs text-white/60">
            <p className="font-bold text-[#8B5CF6] mb-1">How it works</p>
            <p>Once created, the system will immediately run a sentiment refresh in the background (30-60s). The cron job then re-searches your hashtags every {form.refreshInterval || 5} minutes for new posts, scores them with the LLM, and updates each tracked player's Pulse Score. Monitors auto-end after {form.durationHours || 6} hours.</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#1A1A1A] border-t border-white/10 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm font-bold px-4 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-[#6C2BD9] to-[#8B5CF6] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Plus className="size-4" /> Create Monitor
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  hint,
  textarea,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  hint?: string
  textarea?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30 transition-all resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#6C2BD9] focus:ring-2 focus:ring-[#6C2BD9]/30 transition-all"
        />
      )}
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  )
}
