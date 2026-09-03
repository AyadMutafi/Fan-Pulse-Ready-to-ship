'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Lock, RefreshCw, Link2, Trophy, Activity, Globe, Zap, Shield } from 'lucide-react'

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
    if (password.trim()) {
      localStorage.setItem(ADMIN_PASSWORD_KEY, password.trim())
      setAuthed(true)
      setLoginError('')
    } else {
      setLoginError('Please enter the admin password')
    }
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
            <TabsTrigger value="feed" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Activity className="h-4 w-4" />
              Feed Monitor
            </TabsTrigger>
            <TabsTrigger value="pulse" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Zap className="h-4 w-4" />
              Pulse Refresh
            </TabsTrigger>
            <TabsTrigger value="r32" className="flex flex-col items-center gap-1 py-2 text-xs">
              <Trophy className="h-4 w-4" />
              R32 Refresh
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
              Ballon d'Or
            </TabsTrigger>
          </TabsList>

          <TabsContent value="curate" className="mt-4">
            <CurateTab password={password} />
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
          <TabsContent value="r32" className="mt-4">
            <SimpleActionTab
              password={password}
              title="R32 Elite/Crisis Refresh"
              description="Re-rank Round of 32 Elite XI and Crisis XI from live buzz data"
              endpoint="/api/world-cup/r32-refresh?force=true"
              method="POST"
              buttonText="Refresh R32 Teams"
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
            <HealthTab password={password} />
          </TabsContent>
          <TabsContent value="ballon" className="mt-4">
            <SimpleActionTab
              password={password}
              title="Ballon d'Or Management"
              description="View and manage Ballon d'Or contenders and sources"
              endpoint="/api/ballon-dor"
              method="GET"
              buttonText="Load Ballon d'Or Data"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ── Curate Tab ─────────────────────────────────────────────────────────────────
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
            placeholder="https://x.com/...&#10;https://www.espn.com/...&#10;https://www.reddit.com/..."
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
            <div className="flex items-center gap-4 mb-3">
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
            {result.errors && result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-muted-foreground">Errors ({result.errors.length})</summary>
                <div className="text-xs mt-2 space-y-1">
                  {result.errors.map((e: string, i: number) => (
                    <div key={i} className="text-red-500">{e}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Feed Monitor Tab ──────────────────────────────────────────────────────────
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

// ── Health Tab ─────────────────────────────────────────────────────────────────
function HealthTab({ password }: { password: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const checkHealth = async () => {
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
  }

  useEffect(() => {
    checkHealth()
  }, [])

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
