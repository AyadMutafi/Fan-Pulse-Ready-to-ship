import { PrismaClient } from '@prisma/client'
import { computeAllPulseScores } from '../src/lib/pulse-engine'

async function main() {
  const db = new PrismaClient()

  const teamCount = await db.nationalTeam.count()
  console.log(`NationalTeam count: ${teamCount}`)

  if (teamCount > 0) {
    console.log('Database already has data — skipping seed.')
    await db.$disconnect()
    return
  }

  console.log('Database is empty — seeding...')

  // Import the seed route handler
  const { POST } = await import('../src/app/api/world-cup/seed/route')
  const mockRequest = new Request('http://localhost:3000/api/world-cup/seed?force=true', {
    method: 'POST',
    headers: { 'x-admin-password': process.env.ADMIN_PASSWORD || 'fanpulse2026' },
  })

  const response = await POST(mockRequest as any)
  const result = await response.json()
  console.log('Seed result:', JSON.stringify(result).slice(0, 300))

  const newTeams = await db.nationalTeam.count()
  const newMatches = await db.match.count()
  const newPlayers = await db.wCSelectionPlayer.count()
  console.log(`After seed: ${newTeams} teams, ${newMatches} matches, ${newPlayers} players`)

  await db.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
