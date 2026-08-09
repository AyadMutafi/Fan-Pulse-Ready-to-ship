'use client'

import { useState } from 'react'
import { getClubCrest, shouldUseDarkText } from '@/lib/club-crests'
import { getClubLogoUrl } from '@/lib/club-logos'

export interface ClubLogoProps {
  /** 3-4 letter club code (e.g. 'ARS', 'LIV', 'FCB'). */
  code: string
  /**
   * Optional club name — used to disambiguate colliding codes (FCB = Barcelona
   * vs Bayern; BRE = Brentford vs Werder Bremen; ALH = Al-Hilal vs Al-Ettifaq).
   */
  name?: string
  /** Pixel size (width = height). Default 24. */
  size?: number
  /** Optional title/tooltip. Defaults to the club name or code. */
  title?: string
  /** Extra classes for the wrapper. */
  className?: string
}

/**
 * ClubLogo — renders a football club's authentic official crest.
 *
 * - Tries the real PNG logo from Football-Data.org's public CDN first
 *   (verified per-club in club-logos.ts).
 * - Falls back to a professional SVG monogram shield (brand colors + code)
 *   when the real logo isn't available OR fails to load (network error,
 *   404, broken image). This guarantees the UI never shows a broken image.
 * - Disambiguates colliding club codes via the `name` prop.
 *
 * Drop-in replacement for emoji badges (`⚽🔴🔵`) and plain-text club names.
 */
export default function ClubLogo({
  code,
  name,
  size = 24,
  title,
  className,
}: ClubLogoProps) {
  const logoUrl = getClubLogoUrl(code, name)
  // Track which URL failed. When logoUrl changes, `imageFailed` auto-resets
  // to false (since failedUrl no longer matches). Avoids useEffect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const imageFailed = failedUrl === logoUrl

  const crest = getClubCrest(code, name)
  const darkText = shouldUseDarkText(crest.primary)
  const textColor = darkText ? '#1A1A1A' : '#FFFFFF'
  const label = title ?? name ?? code

  // Scale the monogram font with the crest size.
  const fontSize = size < 20 ? 18 : size < 32 ? 20 : 24

  const SvgCrest = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
    >
      <title>{label}</title>
      {/* Shield outline (secondary/accent) */}
      <path
        d="M50 4 L92 16 L92 50 Q92 82 50 96 Q8 82 8 50 L8 16 Z"
        fill={crest.secondary}
      />
      {/* Shield fill (primary) — inset by 2px to show a thin accent ring */}
      <path
        d="M50 8 L88 19 L88 50 Q88 78 50 92 Q12 78 12 50 L12 19 Z"
        fill={crest.primary}
      />
      {/* Monogram */}
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontFamily="'Inter', system-ui, -apple-system, sans-serif"
        fontSize={fontSize}
        fontWeight="800"
        fill={textColor}
        letterSpacing="0.5"
        style={{ dominantBaseline: 'middle' }}
      >
        {crest.monogram}
      </text>
    </svg>
  )

  // No verified logo URL → straight to SVG fallback
  if (!logoUrl) {
    return SvgCrest
  }

  // Have a logo URL → render the image, fall back to SVG on error
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        verticalAlign: 'middle',
        position: 'relative',
      }}
    >
      {imageFailed ? (
        SvgCrest
      ) : (
        <img
          src={logoUrl}
          alt={label}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(logoUrl)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'inline-block',
          }}
        />
      )}
    </span>
  )
}
