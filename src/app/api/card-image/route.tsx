import { ImageResponse } from 'next/og'
import { CARD_TIERS, type CardTier } from '@/lib/player-card-tiers'
import { findNationalTeam } from '@/lib/national-teams'

export const runtime = 'nodejs'
export const revalidate = 3600 // ISR: cache generated card images for 1 hour

/**
 * GET /api/card-image?name=...&nation=FRA&position=LW&score=98&scoreLabel=Pulse+Score&tier=award&club=Real+Madrid
 *
 * Generates a 1200×630 PNG of the player card front, sized for social sharing
 * (X / Twitter card, Discord, LinkedIn). Uses next/og (Satori) — no client-side
 * canvas needed. The PNG is what the Web Share API sends on mobile.
 *
 * Anti-hallucination: the route only renders the query params it is given. It
 * does NOT invent or modify scores — the caller (PlayerCard share handler)
 * passes the verified score/tier from PlayerCardData.
 *
 * Satori note: every <div> with >1 child MUST have display:'flex'. We also
 * avoid special unicode (✓) that requires a dynamically-downloaded font, since
 * the sandbox blocks external font fetches.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const name = url.searchParams.get('name') ?? 'Player'
  const nationCode = url.searchParams.get('nation') ?? ''
  const position = url.searchParams.get('position') ?? '—'
  const score = parseInt(url.searchParams.get('score') ?? '0', 10) || 0
  const scoreLabel = url.searchParams.get('scoreLabel') ?? 'Pulse Score'
  const tierKey = (url.searchParams.get('tier') ?? 'steady') as CardTier
  const club = url.searchParams.get('club') ?? ''
  const award = url.searchParams.get('award') ?? ''
  const sizeParam = url.searchParams.get('size') // 'story' → 1080×1920, else 1200×630

  const tier = CARD_TIERS[tierKey] ?? CARD_TIERS.steady
  const team = findNationalTeam(nationCode)
  const flagEmoji = team?.flag ?? ''
  const nationName = team?.name ?? nationCode

  const isStory = sizeParam === 'story'
  const width = isStory ? 1080 : 1200
  const height = isStory ? 1920 : 630

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Tier-mood tint glow (no children — display:flex harmless) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: `radial-gradient(ellipse at center, ${tier.tint} 0%, transparent 70%)`,
          }}
        />

        {/* Watermark — top right */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6C2BD9, #8B5CF6)',
              color: 'white',
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            F
          </div>
          Fan Pulse
        </div>

        {/* Main card content — centered */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: isStory ? 24 : 16,
            padding: isStory ? '80px 60px' : '40px',
          }}
        >
          {/* Tier emoji (HERO) */}
          <div style={{ display: 'flex', fontSize: isStory ? 160 : 90, lineHeight: 1 }}>
            {tier.emoji}
          </div>

          {/* Tier label */}
          <div
            style={{
              display: 'flex',
              color: tier.accent,
              fontSize: isStory ? 36 : 24,
              fontWeight: 900,
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            {tier.label}
          </div>

          {/* Award name (single child, conditional) */}
          {award ? (
            <div
              style={{
                display: 'flex',
                color: '#F59E0B',
                fontSize: isStory ? 28 : 18,
                fontWeight: 700,
              }}
            >
              {award}
            </div>
          ) : null}

          {/* Player name */}
          <div
            style={{
              display: 'flex',
              color: 'white',
              fontSize: isStory ? 64 : 44,
              fontWeight: 900,
              letterSpacing: -1,
              textAlign: 'center',
            }}
          >
            {name}
          </div>

          {/* Flag + position + nation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', fontSize: isStory ? 56 : 36 }}>{flagEmoji}</div>
            <div
              style={{
                display: 'flex',
                color: 'rgba(255,255,255,0.85)',
                fontSize: isStory ? 30 : 20,
                fontWeight: 700,
              }}
            >
              {nationName}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '4px 14px',
                color: 'white',
                fontSize: isStory ? 26 : 18,
                fontWeight: 800,
              }}
            >
              {position}
            </div>
          </div>

          {/* Hero score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                display: 'flex',
                color: 'white',
                fontSize: isStory ? 140 : 80,
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -3,
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div
              style={{
                display: 'flex',
                color: 'rgba(255,255,255,0.6)',
                fontSize: isStory ? 26 : 16,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 3,
              }}
            >
              {scoreLabel}
            </div>
          </div>

          {/* Club (single child, conditional) */}
          {club ? (
            <div
              style={{
                display: 'flex',
                color: 'rgba(255,255,255,0.7)',
                fontSize: isStory ? 28 : 18,
                fontWeight: 600,
              }}
            >
              {club}
            </div>
          ) : null}
        </div>

        {/* Footer — URL + verified badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: 32,
            right: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'rgba(255,255,255,0.5)',
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            Verified data
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 1,
              background: 'rgba(255,255,255,0.1)',
              padding: '6px 18px',
              borderRadius: 999,
            }}
          >
            fp.io
          </div>
        </div>
      </div>
    ),
    { width, height },
  )
}
