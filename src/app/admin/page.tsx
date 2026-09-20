'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Lock,
  LogOut,
  Sparkles,
  Trash2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Twitter,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerLite {
  id: string
  playerName: string
  nationCode: string
  position: string
  pulseScore: number
  trend: string
  matchInfo: string | null
}

interface CuratedPost {
  id: string
  postId: string
  author: string
  content: string
  sourceUrl: string | null
  sentiment: number
  sentimentLabel: string | null
  ratingHint: number | null
  likes: number
  replies: number
  shares: number
  postedAt: string
  curatedAt: string | null
}

interface AiResult {
  ok: boolean
  player: { id: string; name: string; nationCode: string; position: string }
  ai: {
    score: number
    label: string
    confidence: number
    reasoning: string
    perPost: Array<{ postId: string; sentimentLabel: string; ratingHint: number }>
  }
  postCount: number
  breakdown: {
    overall: number
    matchPerformance: number
    fanSentiment: number
    aiNarrative: number
    momentumTrend: number
    notes: {
      matchPerformance: string
      fanSentiment: string
      aiNarrative: string
      momentumTrend: string
    }
  } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const labelColor: Record<string, string> = {
  positive: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  negative: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  neutral: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  mixed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

function scoreColor(s: number): string {
  if (s >= 75) return 'text-emerald-400'
  if (s >= 60) return 'text-lime-400'
  if (s >= 40) return 'text-amber-400'
  if (s >= 20) return 'text-orange-400'
  return 'text-rose-400'
}

function trendIcon(t: string) {
  if (t === 'rising') return <TrendingUp className="h-3 w-3 text-emerald-400" />
  if (t === 'falling') return <TrendingDown className="h-3 w-3 text-rose-400" />
  return <Minus className="h-3 w-3 text-zinc-400" />
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)

  // Session check on mount.
  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return <LoginGate onAuthed={() => setAuthed(true)} />
  }

  return <Dashboard onLogout={() => setAuthed(false)} router={router} />
}

// ── Login Gate ───────────────────────────────────────────────────────────────

function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      toast.success('Welcome back, admin')
      onAuthed()
    } catch {
      setError('Network error — please retry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/30">
            <Lock className="h-6 w-6 text-cyan-400" />
          </div>
          <CardTitle className="text-zinc-100">Admin Access</CardTitle>
          <CardDescription className="text-zinc-400">
            Fan Pulse · Semi-auto rating pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw" className="text-zinc-300">
                Admin password
              </Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="••••••••••••"
                  autoFocus
                  disabled={loading}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  spellCheck={false}
                  className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Tip: click the eye icon to reveal what you&rsquo;re typing —
                browser autofill often silently substitutes a stale saved
                password.
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {error}. You typed{' '}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px]">
                    {password.length}
                  </code>{' '}
                  characters
                  {password.length > 0 && (
                    <>
                      {' — visible value: '}
                      <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px] break-all">
                        {showPassword ? password : '•'.repeat(password.length)}
                      </code>
                    </>
                  )}
                  .
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-200">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                <div className="space-y-1">
                  <p className="font-semibold text-cyan-100">
                    Sandbox / dev password
                  </p>
                  <p>
                    Use{' '}
                    <code className="rounded bg-cyan-950/60 px-1.5 py-0.5 font-mono text-cyan-200">
                      123456789
                    </code>{' '}
                    (9 digits). Type it manually — do NOT let your browser
                    autofill. Click the eye icon above to verify each character
                    before submitting.
                  </p>
                  <p className="text-cyan-400/70">
                    Production deployments set a strong ADMIN_PASSWORD env var;
                    this hint only appears in dev/sandbox.
                  </p>
                </div>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Authenticating…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Enter dashboard
                </>
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-zinc-500">
            This page is intentionally unlinked from the public site.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({
  onLogout,
  router,
}: {
  onLogout: () => void
  router: ReturnType<typeof useRouter>
}) {
  const [players, setPlayers] = useState<PlayerLite[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [posts, setPosts] = useState<CuratedPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Form state for pasting a tweet.
  const [form, setForm] = useState({
    text: '',
    author: '',
    sourceUrl: '',
    postedAt: '',
    likes: '',
    replies: '',
    shares: '',
  })
  const [adding, setAdding] = useState(false)

  // Load the player list once.
  useEffect(() => {
    fetch('/api/social-posts?include=players', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d.players ?? [])
      })
      .catch(() => toast.error('Failed to load players'))
  }, [])

  // Load curated posts whenever the selected player changes.
  const refreshPosts = useCallback(async (playerId: string) => {
    if (!playerId) {
      setPosts([])
      return
    }
    setPostsLoading(true)
    try {
      const res = await fetch(
        `/api/social-posts?playerId=${encodeURIComponent(playerId)}`,
        { cache: 'no-store' },
      )
      const d = await res.json()
      setPosts(d.posts ?? [])
    } catch {
      toast.error('Failed to load curated tweets')
    } finally {
      setPostsLoading(false)
    }
  }, [])

  useEffect(() => {
    setAiResult(null)
    setAiError(null)
    refreshPosts(selectedPlayerId)
  }, [selectedPlayerId, refreshPosts])

  async function handleAddTweet(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlayerId) {
      toast.error('Pick a player first')
      return
    }
    if (!form.text.trim()) {
      toast.error('Tweet text is required')
      return
    }
    const player = players.find((p) => p.id === selectedPlayerId)
    if (!player) return
    setAdding(true)
    try {
      const res = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: form.text.trim(),
          author: form.author.trim(),
          sourceUrl: form.sourceUrl.trim(),
          playerId: selectedPlayerId,
          playerName: player.playerName,
          nationCode: player.nationCode,
          postedAt: form.postedAt || undefined,
          likes: Number(form.likes) || 0,
          replies: Number(form.replies) || 0,
          shares: Number(form.shares) || 0,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d.error ?? 'Failed to add tweet')
        return
      }
      toast.success('Tweet added as evidence')
      setForm({
        text: '',
        author: '',
        sourceUrl: '',
        postedAt: '',
        likes: '',
        replies: '',
        shares: '',
      })
      refreshPosts(selectedPlayerId)
    } catch {
      toast.error('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/social-posts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Delete failed')
        return
      }
      toast.success('Tweet removed')
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast.error('Network error')
    }
  }

  async function handleRate() {
    if (!selectedPlayerId) return
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    try {
      const res = await fetch('/api/ai-rate-player', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId: selectedPlayerId }),
      })
      const d = await res.json()
      if (!res.ok) {
        setAiError(d.error ?? 'AI rating failed')
        return
      }
      setAiResult(d as AiResult)
      toast.success(`AI rating: ${d.ai.score} (${d.ai.label})`)
      // Refresh the posts so per-post labels show up.
      refreshPosts(selectedPlayerId)
    } catch {
      setAiError('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    toast.success('Signed out')
    onLogout()
    router.refresh()
  }

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/30">
              <Sparkles className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Fan Pulse · Admin</h1>
              <p className="text-[11px] text-zinc-500">
                Semi-auto rating pipeline
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Pipeline explainer */}
        <Alert className="border-cyan-500/30 bg-cyan-500/5 text-cyan-100">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <AlertTitle className="text-cyan-200">How the pipeline works</AlertTitle>
          <AlertDescription className="text-cyan-100/80">
            1. Pick a player → 2. Paste tweets as evidence → 3. Click{' '}
            <strong>Rate with AI</strong> → 4. AI derives a social score (0-100)
            from the tweets → 5. Score flows into the player&apos;s Pulse
            Breakdown (fan sentiment component) → 6. Front-end Sentiments &amp;
            Pulse Elite update live. AI suggests, admin approves.
          </AlertDescription>
        </Alert>

        {/* Player selector */}
        <Card className="border-zinc-800 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">1 · Select a player</CardTitle>
            <CardDescription className="text-zinc-400">
              Choose which player to curate social evidence for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-950">
                <SelectValue placeholder="Search a player…" />
              </SelectTrigger>
              <SelectContent className="max-h-80 border-zinc-700 bg-zinc-900">
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.playerName}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {p.nationCode} · {p.position} · {p.pulseScore}
                    </span>
                    <span className="ml-2 inline-flex">{trendIcon(p.trend)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlayer && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                  {selectedPlayer.nationCode}
                </Badge>
                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                  {selectedPlayer.position}
                </Badge>
                <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                  Pulse {selectedPlayer.pulseScore}
                </Badge>
                {selectedPlayer.matchInfo && (
                  <span className="text-zinc-500">
                    Last match: {selectedPlayer.matchInfo}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tweet paste form */}
        <Card className="border-zinc-800 bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-base">2 · Paste tweet as evidence</CardTitle>
            <CardDescription className="text-zinc-400">
              Copy a tweet&apos;s text, author handle, and URL. Engagement metrics
              (likes/replies/shares) help the AI weight viral tweets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTweet} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text" className="text-zinc-300">
                  Tweet text <span className="text-rose-400">*</span>
                </Label>
                <Textarea
                  id="text"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder="Paste the full tweet text here…"
                  rows={4}
                  disabled={!selectedPlayerId || adding}
                  className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="author" className="text-zinc-300">
                    Author handle
                  </Label>
                  <Input
                    id="author"
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="FabrizioRomano"
                    disabled={!selectedPlayerId || adding}
                    className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-zinc-300">
                    Tweet URL
                  </Label>
                  <Input
                    id="url"
                    value={form.sourceUrl}
                    onChange={(e) =>
                      setForm({ ...form, sourceUrl: e.target.value })
                    }
                    placeholder="https://x.com/…/status/123…"
                    disabled={!selectedPlayerId || adding}
                    className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="postedAt" className="text-zinc-300">
                    Posted at
                  </Label>
                  <Input
                    id="postedAt"
                    type="datetime-local"
                    value={form.postedAt}
                    onChange={(e) =>
                      setForm({ ...form, postedAt: e.target.value })
                    }
                    disabled={!selectedPlayerId || adding}
                    className="border-zinc-700 bg-zinc-950 text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="likes" className="text-zinc-300">
                    Likes
                  </Label>
                  <Input
                    id="likes"
                    type="number"
                    min="0"
                    value={form.likes}
                    onChange={(e) => setForm({ ...form, likes: e.target.value })}
                    placeholder="0"
                    disabled={!selectedPlayerId || adding}
                    className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replies" className="text-zinc-300">
                    Replies
                  </Label>
                  <Input
                    id="replies"
                    type="number"
                    min="0"
                    value={form.replies}
                    onChange={(e) => setForm({ ...form, replies: e.target.value })}
                    placeholder="0"
                    disabled={!selectedPlayerId || adding}
                    className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shares" className="text-zinc-300">
                    Shares
                  </Label>
                  <Input
                    id="shares"
                    type="number"
                    min="0"
                    value={form.shares}
                    onChange={(e) => setForm({ ...form, shares: e.target.value })}
                    placeholder="0"
                    disabled={!selectedPlayerId || adding}
                    className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={!selectedPlayerId || adding || !form.text.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add tweet
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Curated tweets list + rate button */}
        <Card className="border-zinc-800 bg-zinc-900/40">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">
                3 · Curated evidence{' '}
                {posts.length > 0 && (
                  <span className="ml-1 text-zinc-500">({posts.length})</span>
                )}
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Tweets the AI will use to derive the player&apos;s social score.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshPosts(selectedPlayerId)}
                disabled={!selectedPlayerId || postsLoading}
                className="border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-zinc-100"
              >
                <RefreshCw
                  className={`h-4 w-4 ${postsLoading ? 'animate-spin' : ''}`}
                />
              </Button>
              <Button
                onClick={handleRate}
                disabled={!selectedPlayerId || posts.length === 0 || aiLoading}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 text-white hover:from-cyan-500 hover:to-emerald-500"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> AI rating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Rate with AI
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedPlayerId ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Pick a player to see their curated tweets.
              </p>
            ) : postsLoading ? (
              <div className="flex items-center justify-center py-8 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No curated tweets yet for this player. Paste one above.
              </p>
            ) : (
              <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {posts.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Twitter className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="font-medium text-zinc-300">
                          {p.author ? `@${p.author}` : 'anonymous'}
                        </span>
                        <span>·</span>
                        <span>{new Date(p.postedAt).toLocaleString()}</span>
                        {(p.likes > 0 || p.replies > 0 || p.shares > 0) && (
                          <span className="text-zinc-500">
                            · ❤ {p.likes} 💬 {p.replies} 🔁 {p.shares}
                          </span>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-zinc-800 bg-zinc-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-zinc-100">
                              Remove this tweet?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">
                              The tweet will no longer be used as evidence for
                              future AI ratings. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-zinc-700 bg-zinc-950 text-zinc-300">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(p.id)}
                              className="bg-rose-600 text-white hover:bg-rose-500"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-zinc-200">
                      {p.content}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {p.sentimentLabel && (
                        <Badge
                          variant="outline"
                          className={labelColor[p.sentimentLabel] ?? ''}
                        >
                          {p.sentimentLabel}
                        </Badge>
                      )}
                      {p.ratingHint !== null && (
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-zinc-400"
                        >
                          hint {p.ratingHint}
                        </Badge>
                      )}
                      {p.sourceUrl && (
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* AI result */}
        {(aiLoading || aiError || aiResult) && (
          <Card className="border-cyan-500/30 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-cyan-400" /> AI rating result
              </CardTitle>
              <CardDescription className="text-zinc-400">
                AI-derived social score for{' '}
                {selectedPlayer?.playerName ?? 'this player'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiLoading && (
                <div className="flex items-center gap-3 py-6 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">
                    Reading {posts.length} tweets and deriving the social score…
                  </span>
                </div>
              )}
              {aiError && !aiLoading && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{aiError}</AlertDescription>
                </Alert>
              )}
              {aiResult && !aiLoading && (
                <div className="space-y-5">
                  {/* Score hero */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-5xl font-bold ${scoreColor(aiResult.ai.score)}`}
                      >
                        {aiResult.ai.score}
                      </span>
                      <span className="text-sm text-zinc-500">/ 100</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        labelColor[aiResult.ai.label] ?? 'border-zinc-700'
                      }
                    >
                      {aiResult.ai.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-zinc-400"
                    >
                      confidence {Math.round(aiResult.ai.confidence * 100)}%
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-zinc-400"
                    >
                      {aiResult.postCount} tweet
                      {aiResult.postCount === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  <p className="text-sm text-zinc-300">
                    <strong className="text-zinc-100">Reasoning:</strong>{' '}
                    {aiResult.ai.reasoning}
                  </p>

                  <Separator className="bg-zinc-800" />

                  {/* Recomputed pulse breakdown */}
                  {aiResult.breakdown && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-zinc-200">
                          Updated Pulse Breakdown
                        </h4>
                        <Badge
                          variant="outline"
                          className="border-cyan-500/30 text-cyan-300"
                        >
                          Overall {aiResult.breakdown.overall}
                        </Badge>
                      </div>
                      <BreakdownRow
                        label="Match Performance"
                        weight="40%"
                        value={aiResult.breakdown.matchPerformance}
                        note={aiResult.breakdown.notes.matchPerformance}
                      />
                      <BreakdownRow
                        label="Fan Sentiment (AI-derived)"
                        weight="25%"
                        value={aiResult.breakdown.fanSentiment}
                        note={aiResult.breakdown.notes.fanSentiment}
                        highlight
                      />
                      <BreakdownRow
                        label="AI Narrative"
                        weight="20%"
                        value={aiResult.breakdown.aiNarrative}
                        note={aiResult.breakdown.notes.aiNarrative}
                      />
                      <BreakdownRow
                        label="Momentum Trend"
                        weight="15%"
                        value={aiResult.breakdown.momentumTrend}
                        note={aiResult.breakdown.notes.momentumTrend}
                      />
                      <p className="pt-1 text-xs text-zinc-500">
                        The fan sentiment component above now reflects the
                        AI-derived social score. The player&apos;s Sentiments tab
                        card &amp; Pulse Elite rating have updated accordingly.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

function BreakdownRow({
  label,
  weight,
  value,
  note,
  highlight,
}: {
  label: string
  weight: string
  value: number
  note: string
  highlight?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300">
          {label}{' '}
          <span className="text-xs text-zinc-500">({weight})</span>
        </span>
        <span className={`font-medium ${scoreColor(value)}`}>{value}</span>
      </div>
      <Progress
        value={value}
        className={`h-1.5 ${highlight ? 'bg-cyan-950' : 'bg-zinc-800'}`}
      />
      <p className="text-xs text-zinc-500">{note}</p>
    </div>
  )
}
