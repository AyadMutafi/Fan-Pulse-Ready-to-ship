import { PrismaClient } from '@prisma/client'

async function main() {
  const db = new PrismaClient()

  // Check current state
  const teamCount = await db.nationalTeam.count()
  const matchCount = await db.match.count()
  const playerCount = await db.wCSelectionPlayer.count()

  console.log(`DB State: ${teamCount} teams, ${matchCount} matches, ${playerCount} players`)

  if (teamCount === 0 || matchCount === 0) {
    console.log('Database is empty — seeding World Cup data...')

    const { POST } = await import('../src/app/api/world-cup/seed/route')
    const mockRequest = new Request('http://localhost:3000/api/world-cup/seed?force=true', {
      method: 'POST',
      headers: { 'x-admin-password': process.env.ADMIN_PASSWORD || 'fanpulse2026' },
    })

    const response = await POST(mockRequest as any)
    const result = await response.json()
    console.log('WC Seed:', JSON.stringify(result).slice(0, 300))
  } else {
    console.log('Database already has data — skipping seed.')
  }

  await db.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
