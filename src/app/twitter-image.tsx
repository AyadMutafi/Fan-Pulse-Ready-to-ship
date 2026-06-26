import { ImageResponse } from 'next/og'

// ── Twitter Card image ───────────────────────────────────────────────────────
// Used for Twitter/X `summary_large_image` cards. Reuses the OG design —
// keeping brand consistency across platforms is more important than having
// two distinct designs. Twitter crops to 2:1, so the URL pill stays inside
// the safe area (centered horizontally, lower-third vertically).

export const runtime = 'edge'
export const alt = 'Fan Pulse — Real-Time Fan Sentiment for World Cup 2026'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function TwitterImage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fan-pulse.fly.dev'
  const displayUrl = siteUrl.replace(/^https?:\/\//, '')

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
          position: 'relative',
          padding: '60px',
        }}
      >
        {/* ── Top: Brand ── */}
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

        {/* ── Center: Hero headline ── */}
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
          }}>Real-Time</div>
          <div style={{
            color: 'white',
            fontSize: '84px',
            fontWeight: 900,
            letterSpacing: '-3px',
            lineHeight: 1,
            display: 'flex',
          }}>
            <span>Fan&nbsp;</span>
            <span style={{
              background: 'linear-gradient(90deg, #10B981, #FF6B35)',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitBackgroundClip: 'text',
            }}>Sentiment</span>
          </div>
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

        {/* ── Bottom: prominent URL CTA pill ── */}
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
            background: 'linear-gradient(135deg, #6C2BD9, #10B981)',
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
