'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Lock, RefreshCw, Link2, Trophy, Activity, Globe, Zap, Shield, List } from 'lucide-react'

const ADMIN_PASSWORD_KEY = 'fanpulse_admin_pw'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_PASSWORD_KEY)
    if (stored) {
      setPassword(stored)
      setAuthed(true)
    }
  }, [])

  const handleLogin = () => {
    if (!password.trim()) {
      setLoginError('Please enter the admin password')
      return
    }
    localStorage.setItem(ADMIN_PASSWORD_KEY, password.trim())
    setAuthed(true)
    setLoginError('')
  }

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_PASSWORD_KEY)
    setPassword('')
    setAuthed(false)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">FanPulse Admin</CardTitle>
            <CardDescription>Enter your password to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter password..."
                  autoFocus
                />
              </div>
              {loginError && <p className="text-sm text-red-500">{loginError}</p>}
              <Button className="w-full" onClick={handleLogin}>
                Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              FanPulse Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage all features from one place</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <Tabs defaultValue="curate" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-1 h-auto">
            <TabsTrigger value="curate" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Link2 className="h-4 w-4" />
              Curate
            </TabsTrigger>
            <TabsTrigger value="links" className="flex flex-col items-center gap-1 py-2 text-xs">
              <List className="h-4 w-4" />
              Links
            </TabsTrigger>
            <TabsTrigger value="feed" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Activity className="h-4 w-4" />
              Feed Monitor
            </TabsTrigger>
            <TabsTrigger value="pulse" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Zap className="h-4 w-4" />
              Pulse Refresh
            </TabsTrigger>
            <TabsTrigger value="seed" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Globe className="h-4 w-4" />
              WC Seed
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex flex-col items-center gap-1 py-2 text-xs">
              <RefreshCw className="h-4 w-4" />
              Live Matches
            </TabsTrigger>
            <TabsTrigger value="health" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Activity className="h-4 w-4" />
              Health
            </TabsTrigger>
            <TabsTrigger value="ballon" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Trophy className="h-4 w-4" />
              Ballon d&rsquo;Or
            </TabsTrigger>
          </TabsList>

          <TabsContent value="curate" className="mt-4">
            <CurateTab password={password} />
          </TabsContent>
          <TabsContent value="links" className="mt-4">
            <CuratedLinksTab password={password} />
          </TabsContent>
          <TabsContent value="feed" className="mt-4">
            <FeedMonitorTab password={password} />
          </TabsContent>
          <TabsContent value="pulse" className="mt-4">
            <SimpleActionTab
              password={password}
              title="Pulse Score Refresh"
              description="Manually recompute all pulse scores from the latest data"
              endpoint="/api/compute-pulse-scores"
              method="POST"
              buttonText="Refresh Pulse Scores"
            />
          </TabsContent>
          <TabsContent value="seed" className="mt-4">
            <SimpleActionTab
              password={password}
              title="World Cup Seed Data"
              description="Re-seed World Cup stages, matches, and team data"
              endpoint="/api/world-cup/seed"
              method="POST"
              buttonText="Seed World Cup Data"
            />
          </TabsContent>
          <TabsContent value="matches" className="mt-4">
            <SimpleActionTab
              password={password}
              title="Fetch Live Matches"
              description="Pull the latest live match data from external APIs"
              endpoint="/api/fetch-live-matches"
              method="GET"
              buttonText="Fetch Live Matches"
            />
          </TabsContent>
          <TabsContent value="health" className="mt-4">
            <HealthTab />
          </TabsContent>
          <TabsContent value="ballon" className="mt-4">
            <BallonDorTab password={password} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ── Curate Tab ──────────────────────────────────────────────────────────[...] 
function CurateTab({ password }: { password: string }) {
  const [matchLabel, setMatchLabel] = useState('')
  const [matchId, setMatchId] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!matchLabel.trim()) {
      setError('Match label is required')
      return
    }
    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean)
    if (urlList.length === 0) {
      setError('At least one URL is required')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({
          matchLabel: matchLabel.trim(),
          matchId: matchId.trim() || null,
          urls: urlList,
          hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Curate Fan Talk Links
        </CardTitle>
        <CardDescription>
          Paste real social/news URLs for a match. The AI reads each page and scores the sentiment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="matchLabel">Match Label *</Label>
            <Input
              id="matchLabel"
              value={matchLabel}
              onChange={(e) => setMatchLabel(e.target.value)}
              placeholder="e.g. Arsenal vs Chelsea — EPL Sep 5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="matchId">Match ID (optional)</Label>
            <Input
              id="matchId"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="Auto-generated if empty"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hashtags">Hashtags (comma-separated)</Label>
          <Input
            id="hashtags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#Arsenal, #COYG, #Chelsea"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="urls">URLs (one per line) *</Label>
          <Textarea
            id="urls"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={'https://x.com/...\nhttps://www.espn.com/...\nhttps://www.reddit.com/...'}
            rows={8}
          />
          <p className="text-xs text-muted-foreground">
            Allowed: x.com, twitter.com, reddit.com, instagram.com, facebook.com, tiktok.com, espn.com, bbc.com, skysports.com, goal.com, etc.
          </p>
        </div>
        {error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Curating links...
            </>
          ) : (
            'Curate Links'
          )}
        </Button>
        {result && (
          <div className="p-4 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <Badge className="bg-green-600">Added: {result.added}</Badge>
              <Badge variant="secondary">Skipped: {result.skipped}</Badge>
              <Badge variant="outline">Total: {result.total}</Badge>
            </div>
            {result.results && result.results.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.results.map((r: any, i: number) => (
                  <div key={i} className="text-xs p-2 rounded bg-white dark:bg-gray-900 border">
                    <span className={`font-semibold ${r.status === 'added' ? 'text-green-600' : r.status === 'error' ? 'text-red-500' : 'text-yellow-600'}`}>
                      {r.status.toUpperCase()}
                    </span>
                    {' — '}
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {r.url.slice(0, 80)}{r.url.length > 80 ? '...' : ''}
                    </a>
                    {r.author && <span className="text-muted-foreground"> ({r.author})</span>}
                    {r.sentimentScore !== undefined && <span className="text-muted-foreground"> — Score: {r.sentimentScore}</span>}
                    {r.reason && <div className="text-muted-foreground mt-1">{r.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Curated Links Tab (view existing) ─────────────────────────────────────────
function CuratedLinksTab({ password }: { password: string }) {
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadLinks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/curated-links', {
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setLinks(data.links || data || [])
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Curated Links
            </CardTitle>
            <CardDescription className="mt-1">All links you've curated for fan talk</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLinks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No curated links yet. Use the Curate tab to add some.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {links.map((link: any, i: number) => (
              <div key={i} className="p-3 rounded border bg-white dark:bg-gray-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{link.matchLabel}</div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                      {link.url}
                    </a>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">{link.platform}</Badge>
                      {link.author && <span className="text-xs text-muted-foreground">{link.author}</span>}
                      {link.sentimentScore !== undefined && (
                        <Badge variant={link.sentimentScore >= 65 ? 'default' : link.sentimentScore <= 35 ? 'destructive' : 'secondary'}>
                          Score: {link.sentimentScore}
                        </Badge>
                      )}
                      {link.sentimentLabel && <Badge variant="secondary">{link.sentimentLabel}</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Feed Monitor Tab ────────────────────────────────────────────────────────[...]
function FeedMonitorTab({ password }: { password: string }) {
  const [monitors, setMonitors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState<string | null>(null)

  const loadMonitors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/feed-monitor', {
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setMonitors(data.monitors || data || [])
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => {
    loadMonitors()
  }, [loadMonitors])

  const refreshMonitor = async (id: string) => {
    setRefreshing(id)
    try {
      const res = await fetch(`/api/admin/feed-monitor/${id}/refresh`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        await loadMonitors()
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setRefreshing(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Feed Monitors
            </CardTitle>
            <CardDescription className="mt-1">Live feed monitors tracking fan sentiment across matches</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadMonitors} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No feed monitors found. Monitors are created automatically when fans view match cards.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {monitors.map((m: any) => (
              <div key={m.id} className="p-3 rounded border bg-white dark:bg-gray-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.matchLabel || m.id}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                        {m.status || 'unknown'}
                      </Badge>
                      {m.postCount !== undefined && (
                        <Badge variant="outline">{m.postCount} posts</Badge>
                      )}
                      {m.lastRefreshedAt && (
                        <span className="text-xs text-muted-foreground">
                          Updated: {new Date(m.lastRefreshedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshMonitor(m.id)}
                    disabled={refreshing === m.id}
                  >
                    {refreshing === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Simple Action Tab (for one-button actions) ────────────────────────────────
function SimpleActionTab({
  password,
  title,
  description,
  endpoint,
  method,
  buttonText,
}: {
  password: string
  title: string
  description: string
  endpoint: string
  method: 'GET' | 'POST'
  buttonText: string
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleAction = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'x-admin-password': password,
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify({}) } : {}),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleAction} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            buttonText
          )}
        </Button>
        {error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        {result && (
          <div className="p-4 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <pre className="text-xs whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Health Tab ───────────────────��──────────────────────────────────────[...]
function HealthTab() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const checkHealth = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription className="mt-1">Check database and API status</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={checkHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Check
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={result.ok ? 'bg-green-600' : 'bg-red-600'}>
                {result.ok ? 'HEALTHY' : 'UNHEALTHY'}
              </Badge>
              {result.database && (
                <Badge variant="outline">DB: {result.database}</Badge>
              )}
            </div>
            <pre className="text-xs whitespace-pre-wrap p-3 rounded bg-gray-50 dark:bg-gray-900">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BallonDorTab({ password }: { password: string }) {
  const [tab, setTab] = useState<'weekly' | 'overall' | 'manage'>('weekly')
  const [contenders, setContenders] = useState<any[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const loadContenders = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ballon-dor/contenders', {
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setContenders(data.contenders || [])
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const refreshTrending = async () => {
    setRefreshing(true)
    setError('')
    setWeekly([])
    try {
      const res = await fetch('/api/ballon-dor/refresh-trending', {
        method: 'POST',
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setWeekly(data.trending || [])
        await loadContenders()
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadContenders()
  }, [])

  const startEdit = (c: any) => {
    setEditingId(c.id)
    setEditForm({ ...c })
  }

  const saveEdit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ballon-dor/contenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          id: editingId,
          name: editForm.name,
          clubName: editForm.clubName,
          clubCode: editForm.clubCode,
          nationCode: editForm.nationCode,
          position: editForm.position,
          adminNotes: editForm.adminNotes,
          manualBuzzScore: editForm.manualBuzzScore ? Number(editForm.manualBuzzScore) : null,
          verifiedMatchFact: editForm.verifiedMatchFact,
          reason: editForm.reason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
      } else {
        setEditingId(null)
        await loadContenders()
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const overall = contenders
    .map((c) => ({
      name: c.name, club: c.clubName, nation: c.nationCode, position: c.position,
      score: c.ballonDorScore, trend: c.trend, manualBuzz: c.manualBuzzScore,
      adminNotes: c.adminNotes, snapshotCount: c._count?.weeklySnapshots || 0,
    }))
    .sort((a, b) => b.score - a.score)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Ballon d&rsquo;Or Management
        </CardTitle>
        <CardDescription>Weekly buzz + overall ranking + contender management</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 border-b pb-2">
          <Button size="sm" variant={tab === 'weekly' ? 'default' : 'ghost'} onClick={() => setTab('weekly')}>Weekly Buzz</Button>
          <Button size="sm" variant={tab === 'overall' ? 'default' : 'ghost'} onClick={() => setTab('overall')}>Overall Buzz</Button>
          <Button size="sm" variant={tab === 'manage' ? 'default' : 'ghost'} onClick={() => setTab('manage')}>Manage Contenders</Button>
        </div>

        {error && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">{error}</div>
        )}

        {tab === 'weekly' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Searches the web for each contender&rsquo;s current buzz, saves a weekly snapshot, and ranks them. Takes 2-3 minutes.
            </p>
            <Button onClick={refreshTrending} disabled={refreshing} className="w-full">
              {refreshing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching web for all contenders...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />Refresh Weekly Buzz</>
              )}
            </Button>
            {weekly.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">This Week&rsquo;s Ranking (live):</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {weekly.map((p: any, i: number) => (
                    <div key={i} className="p-3 rounded border bg-white dark:bg-gray-900">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-medium text-sm">#{i + 1} {p.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.finalBuzzScore >= 70 ? 'default' : p.finalBuzzScore >= 50 ? 'secondary' : 'destructive'}>{p.finalBuzzScore}</Badge>
                          <Badge variant="outline">{p.trend}</Badge>
                          {p.scoreSource === 'admin-override' && <Badge variant="secondary">admin</Badge>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.club} · {p.nation} · {p.position}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Mentions: {p.mentionCount} · 👍 {p.positiveMentions} · 👎 {p.negativeMentions}
                        {p.scoreSource === 'admin-override' && <span className="ml-2 text-orange-500">(live was {p.liveBuzzScore})</span>}
                      </div>
                      {p.adminNotes && (
                        <div className="text-xs mt-1 p-2 rounded bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">📝 {p.adminNotes}</div>
                      )}
                      {p.topSnippet && (
                        <div className="text-xs mt-2 p-2 rounded bg-gray-50 dark:bg-gray-800 italic">&ldquo;{p.topSnippet}&rdquo;</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'overall' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Overall ranking (current ballonDorScore)</p>
              <Button size="sm" variant="outline" onClick={loadContenders} disabled={loading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Reload
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : overall.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No contenders loaded. Click Reload.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {overall.map((p: any, i: number) => (
                  <div key={i} className="p-3 rounded border bg-white dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium text-sm">#{i + 1} {p.name}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.score >= 70 ? 'default' : p.score >= 50 ? 'secondary' : 'destructive'}>{Math.round(p.score)}</Badge>
                        <Badge variant="outline">{p.trend}</Badge>
                        {p.manualBuzz !== null && p.manualBuzz !== undefined && <Badge variant="secondary">admin: {p.manualBuzz}</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{p.club} · {p.nation} · {p.position} · {p.snapshotCount} snapshots</div>
                    {p.adminNotes && (
                      <div className="text-xs mt-1 p-2 rounded bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">📝 {p.adminNotes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'manage' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Edit contender info (fix clubs, add notes, set manual buzz overrides).</p>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {contenders.map((c: any) => (
                  <div key={c.id} className="p-3 rounded border bg-white dark:bg-gray-900">
                    {editingId === c.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Name" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                          <Input placeholder="Club" value={editForm.clubName || ''} onChange={(e) => setEditForm({ ...editForm, clubName: e.target.value })} />
                          <Input placeholder="Club Code" value={editForm.clubCode || ''} onChange={(e) => setEditForm({ ...editForm, clubCode: e.target.value })} />
                          <Input placeholder="Nation" value={editForm.nationCode || ''} onChange={(e) => setEditForm({ ...editForm, nationCode: e.target.value })} />
                          <Input placeholder="Position" value={editForm.position || ''} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                          <Input placeholder="Manual Buzz (0-99)" type="number" value={editForm.manualBuzzScore ?? ''} onChange={(e) => setEditForm({ ...editForm, manualBuzzScore: e.target.value })} />
                        </div>
                        <Textarea placeholder="Admin notes (e.g. 'Bad season at Liverpool')" value={editForm.adminNotes || ''} onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })} rows={2} />
                        <Textarea placeholder="Verified match fact" value={editForm.verifiedMatchFact || ''} onChange={(e) => setEditForm({ ...editForm, verifiedMatchFact: e.target.value })} rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={loading}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {c.name} <span className="text-muted-foreground">· {c.clubName} · {c.nationCode}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Score: {Math.round(c.ballonDorScore)} · Trend: {c.trend}
                            {c.manualBuzzScore !== null && c.manualBuzzScore !== undefined && <span className="ml-2 text-orange-500">manual: {c.manualBuzzScore}</span>}
                          </div>
                          {c.adminNotes && <div className="text-xs mt-1 text-orange-600 dark:text-orange-400">📝 {c.adminNotes}</div>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
