import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/admin/diagnose
 *
 * Admin-only diagnostic endpoint that returns DB health + Prisma error details.
 * Used to debug production issues where error messages are normally sanitized.
 *
 * AUTH: x-admin-password header matching ADMIN_PASSWORD env var.
 */

export async function GET(request: NextRequest) {
  const adminPwd = request.headers.get('x-admin-password')
  const expectedAdmin = process.env.ADMIN_PASSWORD || ''

  if (!adminPwd || !expectedAdmin || adminPwd !== expectedAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')
      : '(not set)',
    runtime: process.env.NEXT_RUNTIME,
  }

  // Check if DB file exists (for SQLite)
  const dbUrl = process.env.DATABASE_URL || ''
  if (dbUrl.startsWith('file:')) {
    const path = dbUrl.replace('file:', '')
    try {
      const fs = await import('node:fs')
      const exists = fs.existsSync(path)
      diagnostics.dbFile = {
        path,
        exists,
        size: exists ? fs.statSync(path).size : 0,
      }
      // List parent dir
      const dir = path.substring(0, path.lastIndexOf('/'))
      if (dir && fs.existsSync(dir)) {
        diagnostics.dbDir = {
          path: dir,
          entries: fs.readdirSync(dir),
        }
      } else {
        diagnostics.dbDir = { path: dir, exists: false }
      }
    } catch (e) {
      diagnostics.dbFile = { error: e instanceof Error ? e.message : String(e) }
    }
  }

  // Try to instantiate Prisma and run queries
  try {
    const { PrismaClient } = await import('@prisma/client')
    const db = new PrismaClient({ log: ['warn', 'error'] })

    // Try a simple query
    const tableCounts: Record<string, number> = {}
    const tables = [
      'nationalTeam',
      'match',
      'leagueTeam',
      'leaguePlayer',
      'leagueMatch',
      'fPLPlayer',
      'fPLFixture',
      'fPLGameweek',
      'fanVote',
      'teamOfTheWeek',
      'socialPost',
      'curatedLink',
    ]

    for (const table of tables) {
      try {
        // Use any to avoid TS errors for tables that might not exist on the model
        const count = await (db as any)[table].count()
        tableCounts[table] = count
      } catch (e) {
        tableCounts[table] = `ERROR: ${e instanceof Error ? e.message : String(e)}`
      }
    }

    diagnostics.tableCounts = tableCounts

    // Try to fetch one row from nationalTeam to verify schema
    try {
      const sample = await db.nationalTeam.findFirst({ select: { id: true, name: true } })
      diagnostics.sampleNationalTeam = sample
    } catch (e) {
      diagnostics.sampleNationalTeamError = e instanceof Error ? e.message : String(e)
    }

    await db.$disconnect()
    diagnostics.prismaConnection = 'OK'
  } catch (e) {
    diagnostics.prismaConnection = `FAILED: ${e instanceof Error ? e.message : String(e)}`
    if (e instanceof Prisma.PrismaClientInitializationError) {
      diagnostics.prismaInitError = {
        errorCode: e.errorCode,
        message: e.message,
        clientVersion: e.clientVersion,
      }
    }
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
