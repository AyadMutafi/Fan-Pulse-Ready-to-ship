// Verify site-url.ts env var resolution.
// Env var must be set BEFORE the process starts (module-load time).
import { getSiteUrl, getDisplayUrl, url } from '../src/lib/site-url'

console.log('NEXT_PUBLIC_APP_URL =', process.env.NEXT_PUBLIC_APP_URL || '(not set)')
console.log('NEXT_PUBLIC_SITE_URL =', process.env.NEXT_PUBLIC_SITE_URL || '(not set)')
console.log('getSiteUrl():', getSiteUrl())
console.log('getDisplayUrl():', getDisplayUrl())
console.log('url("/icon.svg"):', url('/icon.svg'))
