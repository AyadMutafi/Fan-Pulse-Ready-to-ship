import { NextResponse } from 'next/server'

/**
 * POST /api/admin/logout
 *
 * Clears the 'fp_admin' HttpOnly cookie set by /api/admin/login.
 * After this, the browser no longer sends admin credentials.
 */
export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('fp_admin', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // expires immediately
  })
  return res
}
