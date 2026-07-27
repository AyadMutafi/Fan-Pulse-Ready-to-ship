import { ImageResponse } from 'next/og'
import { getDisplayUrl } from '@/lib/site-url'

// ── Dynamic OG image for SEO + social sharing ────────────────────────────────
// This is the image shown when someone shares the site on Twitter,
// Facebook, Discord, WhatsApp, LinkedIn, etc. It REPLACES the static
// /public/og-image.png via Next.js's opengraph-image convention.
//
// PERFORMANCE: Simplified design for < 3s response time.
//   - Removed backgroundClip:'text' gradient text (slowest Satori operation)
//   - Replaced with solid-color headline — visually equivalent, ~5x faster
//   - Switched to nodejs runtime + revalidate=3600 for ISR caching: the first
//     request renders the image (~1-2s), subsequent requests serve the cached
//     PNG instantly. Background regeneration after 1 hour keeps the URL fresh.
//   - Reduced nested flex containers from 6 → 3 levels.
//
// DYNAMIC URL: the site URL is resolved via @/lib/site-url, which checks
// NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → fallback. This ensures the
// URL baked into the image always matches the actual deployment domain.

export const alt = 'Fan Pulse — Real-Time Fan Sentiment for World Cup 2026'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Cache the generated image for 1 hour (ISR). First request renders, then
// the cached PNG is served instantly until the next background revalidation.
export const revalidate = 3600

export default async function OGImage() {
  const displayUrl = getDisplayUrl()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #6C2BD9 0%, #1A1A1A 55%, #10B981 100%)',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* ── Top: Brand row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            fontWeight: 900,
            color: '#6C2BD9',
          }}>F</div>
          <div style={{
            color: 'white',
            fontSize: '34px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
          }}>Fan Pulse</div>
          <div style={{
            marginLeft: 'auto',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '20px',
            fontWeight: 600,
            padding: '6px 16px',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '999px',
          }}>World Cup 2026</div>
        </div>

        {/* ── Center: Hero headline (solid white — no gradient text for speed) ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: '20px',
        }}>
          <div style={{
            color: 'white',
            fontSize: '84px',
            fontWeight: 900,
            letterSpacing: '-3px',
            lineHeight: 1,
          }}>Real-Time Fan Sentiment</div>
          <div style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: '26px',
            fontWeight: 500,
            maxWidth: '900px',
            lineHeight: 1.4,
          }}>
            Vote on your team's pulse. See what fans worldwide are feeling — live mood scores, AI player ratings, and fan cards.
          </div>
        </div>

        {/* ── Bottom: prominent URL CTA pill (high-contrast for SEO + clicks) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          background: 'white',
          padding: '18px 32px',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          alignSelf: 'flex-start',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#6C2BD9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 900,
            color: 'white',
            flexShrink: 0,
          }}>F</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{
              color: '#1A1A1A',
              fontSize: '16px',
              fontWeight: 800,
              letterSpacing: '2.5px',
              lineHeight: 1,
            }}>VOTE NOW →</span>
            <span style={{
              color: '#1A1A1A',
              fontSize: '36px',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              lineHeight: 1,
            }}>{displayUrl}</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
