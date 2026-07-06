import { NextResponse, type NextRequest } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'

export const runtime = 'nodejs'

/** GET /api/admin/session — returns { authed } for the current cookie. */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: isAdminAuthed(req) })
}
