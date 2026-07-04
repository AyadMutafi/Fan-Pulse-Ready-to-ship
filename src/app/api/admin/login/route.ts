import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/admin-auth'

/**
 * POST /api/admin/login
 *
 * H4 SECURITY FIX: Replaces the old localStorage-based admin auth.
 *
 * Previously, the admin password was stored in localStorage ('fp_admin_pw'),
 * where any XSS (even from a third-party dependency) could exfiltrate it.
 * Combined with 'unsafe-inline'/'unsafe-eval' in CSP, this was a privilege-
 * escalation path.
 *
 * Now: the client POSTs the password here. The server validates it and sets
 * an HttpOnly + Secure + SameSite=Strict cookie. The browser sends the cookie
 * automatically on subsequent requests, but JavaScript CANNOT read it — so
 * XSS cannot steal the password.
 *
 * NOTE: Storing the password itself in a cookie is still imperfect (a more
 * robust design uses a signed session token / server-side session store).
 * But HttpOnly means JS can't read it, which closes the XSS exfiltration path.
 * A signed-token refactor is planned post-launch.
 *
 * Body: { password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 },
      )
    }

    // Validate the password by constructing a fake request with the header
    // and delegating to the existing timing-safe helper.
    const fakeReq = new Request('https://x/admin-login-check', {
      headers: { 'x-admin-password': body.password },
    })
    if (!isAdminAuthorized(fakeReq)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 },
      )
    }

    // Set the HttpOnly cookie. The cookie value is the password itself (the
    // server compares it timing-safely on every admin request). Next.js's
    // cookies.set() URL-encodes the value automatically, so we pass the raw
    // password — the admin-auth helper decodes it with decodeURIComponent on
    // read. (Do NOT double-encode with encodeURIComponent here.)
    const res = NextResponse.json({ success: true })
    res.cookies.set('fp_admin', body.password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return res
  } catch (error) {
    console.error('[admin/login] error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 },
    )
  }
}
