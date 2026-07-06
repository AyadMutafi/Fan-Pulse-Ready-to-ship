import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAdminPassword,
  createAdminToken,
  adminCookieAttributes,
  ADMIN_COOKIE,
  ADMIN_ID,
  getAdminFromRequest,
} from '@/lib/admin-auth'

/** POST /api/admin/auth — login with { password } → sets httpOnly cookie. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!password) {
      return NextResponse.json({ ok: false, error: 'Password required' }, { status: 400 })
    }

    if (!verifyAdminPassword(password)) {
      // constant-ish response time, avoid user-enumeration signals
      await new Promise((r) => setTimeout(r, 400))
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 })
    }

    const token = createAdminToken(ADMIN_ID)
    const res = NextResponse.json({
      ok: true,
      adminId: ADMIN_ID,
      message: 'Logged in',
    })
    res.headers.set('Set-Cookie', `${ADMIN_COOKIE}=${token}; ${adminCookieAttributes()}`)
    return res
  } catch (err) {
    console.error('admin login error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

/** GET /api/admin/auth — check current session. */
export async function GET(request: NextRequest) {
  const adminId = getAdminFromRequest(request)
  if (!adminId) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, authenticated: true, adminId })
}

/** DELETE /api/admin/auth — logout (clear cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true, message: 'Logged out' })
  res.headers.set(
    'Set-Cookie',
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  )
  return res
}
