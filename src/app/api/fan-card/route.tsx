import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { NATIONAL_TEAMS } from '@/lib/national-teams'

export const runtime = 'edge'

// ── Mood configuration ───────────────────────────────────────────────────────
// Mirrors the 5-level emoji scale used on the frontend (page.tsx
// getFanMoodEmoji), but expressed as text labels + colors for crisp PNG
// rendering. Satori (the engine behind ImageResponse) doesn't render color
// emoji without a ~10MB emoji font, so we use text + color bars instead —
// looks cleaner in a shareable image anyway.
interface MoodConfig {
  label: string
  subtitle: string
  bgGradient: [string, string]
  accentColor: string
}

function getMoodConfig(score: number): MoodConfig {
  if (score >= 80) return {
    label: 'ON FIRE',
    subtitle: 'Fans are absolutely buzzing',
    bgGradient: ['#6C2BD9', '#10B981'],
    accentColor: '#10B981',
  }
  if (score >= 65) return {
    label: 'HAPPY',
    subtitle: 'Fans are feeling positive',
    bgGradient: ['#6C2BD9', '#8B5CF6'],
    accentColor: '#8B5CF6',
  }
  if (score >= 45) return {
    label: 'NEUTRAL',
    subtitle: 'Fans are on the fence',
    bgGradient: ['#6C2BD9', '#FF6B35'],
    accentColor: '#FF6B35',
  }
  if (score >= 25) return {
    label: 'WORRIED',
    subtitle: 'Fans are getting nervous',
    bgGradient: ['#6C2BD9', '#F59E0B'],
    accentColor: '#F59E0B',
  }
  return {
    label: 'FURIOUS',
    subtitle: 'Fans are not happy at all',
    bgGradient: ['#6C2BD9', '#EF4444'],
    accentColor: '#EF4444',
  }
}

// FIFA-to-ISO mapping for flagcdn.com (same as FlagImage component)
const FIFA_TO_ISO: Record<string, string> = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz', CAN: 'ca', BIH: 'ba',
  QAT: 'qa', SUI: 'ch', BRA: 'br', HAI: 'ht', MAR: 'ma', SCO: 'gb-sct',
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr', GER: 'de', CUW: 'cw',
  CIV: 'ci', ECU: 'ec', NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz', ESP: 'es', CPV: 'cv',
  KSA: 'sa', URU: 'uy', FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo', POR: 'pt', COD: 'cd',
  UZB: 'uz', COL: 'co', ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamCode = (searchParams.get('team') || '').toUpperCase()
  const score = Math.min(100, Math.max(0, parseInt(searchParams.get('score') || '50', 10)))

  const team = NATIONAL_TEAMS.find(t => t.code === teamCode)
  if (!team) {
    return new Response('Team not found', { status: 404 })
  }

  const iso = FIFA_TO_ISO[teamCode] || teamCode.toLowerCase()
  const mood = getMoodConfig(score)

  // Fetch the flag image from flagcdn.com server-side so Satori can render it.
  // Satori needs images as buffers/data-URIs — it can't resolve external URLs
  // at render time without us fetching them first.
  let flagDataUri: string | null = null
  try {
    const flagRes = await fetch(`https://flagcdn.com/w640/${iso}.png`)
    if (flagRes.ok) {
      const buf = Buffer.from(await flagRes.arrayBuffer())
      flagDataUri = `data:image/png;base64,${buf.toString('base64')}`
    }
  } catch {
    // Flag fetch failed — card will render without the flag image (text-only fallback)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fan-pulse.fly.dev'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(135deg, ${mood.bgGradient[0]} 0%, #1A1A1A 60%, ${mood.bgGradient[1]} 100%)`,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* ── Top bar: Fan Pulse branding ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '40px 60px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 900,
              color: '#6C2BD9',
            }}>F</div>
            <div style={{
              color: 'white',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
            }}>Fan Pulse</div>
          </div>
          <div style={{
            marginLeft: 'auto',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '18px',
            fontWeight: 600,
          }}>World Cup 2026</div>
        </div>

        {/* ── Main content: flag + team + mood ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          padding: '0 60px',
          gap: '50px',
        }}>
          {/* Flag image (or fallback colored box) */}
          {flagDataUri ? (
            <img
              src={flagDataUri}
              width={240}
              height={160}
              style={{
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                objectFit: 'cover',
              }}
              alt=""
            />
          ) : (
            <div style={{
              width: 240,
              height: 160,
              borderRadius: '16px',
              background: mood.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '72px',
              fontWeight: 900,
              color: 'white',
            }}>{team.flag}</div>
          )}

          {/* Team name + mood */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '2px',
            }}>{teamCode}</div>
            <div style={{
              color: 'white',
              fontSize: '64px',
              fontWeight: 900,
              letterSpacing: '-2px',
              lineHeight: 1,
            }}>{team.name}</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '8px',
            }}>
              <div style={{
                background: mood.accentColor,
                color: 'white',
                padding: '8px 24px',
                borderRadius: '999px',
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '1px',
              }}>{mood.label}</div>
              <div style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '20px',
                fontWeight: 500,
              }}>{mood.subtitle}</div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar: score + prominent URL CTA ── */}
        {/* The URL is the SEO-critical element here — it's what gets OCR'd by
            search engines and read by humans when the card is shared as a
            thumbnail on Twitter/X, WhatsApp forwards, and IG stories. So we
            make it BIG, high-contrast, and centered as a clear CTA badge. */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '32px 60px 40px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          gap: '32px',
        }}>
          {/* Score (compact, left) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 700, letterSpacing: '1.5px' }}>FAN MOOD SCORE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ color: 'white', fontSize: '52px', fontWeight: 900, lineHeight: 1 }}>{score}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '22px', fontWeight: 700 }}>/100</span>
            </div>
          </div>

          {/* URL CTA pill (prominent, right) — high contrast for SEO + clicks */}
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'rgba(255,255,255,0.95)',
            padding: '14px 28px',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            border: `2px solid ${mood.accentColor}`,
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: mood.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 900,
              color: 'white',
              flexShrink: 0,
            }}>F</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{
                color: '#1A1A1A',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '2px',
                lineHeight: 1,
              }}>VOTE NOW →</span>
              <span style={{
                color: '#1A1A1A',
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                lineHeight: 1,
              }}>{siteUrl.replace(/^https?:\/\//, '')}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
