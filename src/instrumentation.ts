/**
 * Next.js Instrumentation — Auto-seed the database on server startup.
 *
 * This runs ONCE when the Next.js server starts (before any request).
 * If the database is empty (0 NationalTeam records), it triggers the seed
 * endpoint to populate all verified World Cup data, EPL teams, and players.
 *
 * This solves the "database wiped" problem permanently: if the DB is ever
 * empty on startup, it auto-seeds without manual intervention.
 */

export async function register() {
  // Only run on the server (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { PrismaClient } = await import('@prisma/client')
      const db = new PrismaClient()

      // Check if database is empty
      const teamCount = await db.nationalTeam.count().catch(() => 0)
      const matchCount = await db.match.count().catch(() => 0)

      if (teamCount === 0 || matchCount === 0) {
        console.log('[instrumentation] Database is empty — auto-seeding...')

        // Import and run the seed function directly
        const { db: dbInstance } = await import('@/lib/db')
        const { computeAllPulseScores } = await import('@/lib/pulse-engine')

        // Dynamically import the seed route's POST handler
        const seedModule = await import('@/app/api/world-cup/seed/route')
        const mockRequest = new Request('http://localhost:3000/api/world-cup/seed?force=true', {
          method: 'POST',
          headers: {
            'x-admin-password': process.env.ADMIN_PASSWORD || '123456789',
          },
        })

        const response = await seedModule.POST(mockRequest as any)
        const result = await response.json()
        console.log('[instrumentation] Auto-seed result:', JSON.stringify(result).slice(0, 200))
      } else {
        console.log(`[instrumentation] Database has ${teamCount} teams, ${matchCount} matches — skipping seed.`)
      }

      await db.$disconnect()
    } catch (error) {
      console.error('[instrumentation] Auto-seed failed (non-fatal):', error)
    }
  }
}
