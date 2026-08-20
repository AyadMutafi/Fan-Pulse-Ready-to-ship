import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // allow up to 60s for the backup to complete

/**
 * Cron-triggered DB backup endpoint.
 *
 * This route exists because background processes (nohup/setsid loops) get
 * reaped by the sandbox between tool sessions. The Next.js dev server,
 * however, persists — so an endpoint inside it is the reliable way to
 * run scheduled tasks. An external free cron service (cron-job.org,
 * GitHub Actions, UptimeRobot cron) hits this endpoint daily.
 *
 * AUTH: caller must send either:
 *   - x-admin-password header matching process.env.ADMIN_PASSWORD
 *   - X-Cron-Secret header matching process.env.CRON_SECRET
 * Both env vars must be set in .env.local (gitignored). In production
 * without ADMIN_PASSWORD, admin auth fails closed (see src/lib/admin-auth.ts).
 *
 * WHAT IT DOES:
 *   1. Authenticates via admin password or cron secret
 *   2. Runs scripts/backup-db.sh (snapshots + encrypts + pushes to GitHub
 *      db-backups branch)
 *   3. Returns the script's stdout + exit status as JSON
 *
 * Trigger example (set up at cron-job.org or via curl):
 *   curl -X POST https://e1v0s5v6hje1-d.space-z.ai/api/cron/backup \
 *        -H "X-Cron-Secret: $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const adminPwd = request.headers.get('x-admin-password')
  const cronSecret = request.headers.get('x-cron-secret')

  // ── Auth ──
  const expectedAdmin = process.env.ADMIN_PASSWORD || ''
  const expectedCron = process.env.CRON_SECRET || ''
  const adminOk =
    expectedAdmin.length > 0 && adminPwd !== null && timingSafeEqualStr(adminPwd, expectedAdmin)
  const cronOk =
    expectedCron.length > 0 && cronSecret !== null && timingSafeEqualStr(cronSecret, expectedCron)

  if (!adminOk && !cronOk) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    )
  }

  // ── Run the backup script ──
  const projectRoot = process.env.PROJECT_ROOT || path.resolve(process.cwd())
  const scriptPath = path.join(projectRoot, 'scripts', 'backup-db.sh')

  if (!existsSync(scriptPath)) {
    return NextResponse.json(
      { ok: false, error: `backup script not found at ${scriptPath}` },
      { status: 500 }
    )
  }

  try {
    const stdout = execSync(`bash ${scriptPath}`, {
      cwd: projectRoot,
      timeout: 55000, // 55s — under the 60s maxDuration
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // .env.local is loaded by Next.js automatically in dev; in case
        // it isn't (production), the script reads .env.local itself.
        PROJECT_ROOT: projectRoot,
      },
    })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      output: stdout.trim().split('\n').slice(-5), // last 5 lines
    })
  } catch (err: unknown) {
    const errorOutput =
      err !== null && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr?: unknown }).stderr || '')
        : String(err)
    return NextResponse.json(
      {
        ok: false,
        error: 'backup script failed',
        detail: errorOutput.slice(-500),
      },
      { status: 500 }
    )
  }
}

// Also accept GET for simple cron services that can't send headers
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const expectedCron = process.env.CRON_SECRET || ''
  if (
    expectedCron.length === 0 ||
    secret === null ||
    !timingSafeEqualStr(secret, expectedCron)
  ) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  // Re-run the POST logic by constructing a fake request
  return POST(
    new NextRequest(request.url, {
      headers: new Headers({ 'x-cron-secret': secret }),
    })
  )
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')
  if (bufA.length !== bufB.length) return false
  try {
    // timingSafeEqual already imported
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

// Helper to read .env.local in case process.env doesn't have the secret
// (e.g., if Next.js didn't reload it). This is a fallback.
function loadEnvLocal() {
  try {
    const projectRoot = path.resolve(process.cwd())
    const envLocalPath = path.join(projectRoot, '.env.local')
    if (existsSync(envLocalPath)) {
      const content = readFileSync(envLocalPath, 'utf-8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_]+)=(.*)$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2]
        }
      }
    }
  } catch {
    // ignore — env vars may already be set
  }
}

loadEnvLocal()
