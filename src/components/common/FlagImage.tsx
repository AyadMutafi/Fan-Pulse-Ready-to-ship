'use client'

import Image from 'next/image'

/**
 * Mapping from FIFA 3-letter country codes to ISO 3166-1 alpha-2 codes
 * for use with flagcdn.com image service.
 */
const FIFA_TO_ISO: Record<string, string> = {
  // ── WC 2026: 48 teams across 12 groups (A-L) ──
  // Group A
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
  // Group B
  CAN: 'ca', BIH: 'ba', SUI: 'ch', DEN: 'dk',
  // Group C
  BRA: 'br', MAR: 'ma', SCO: 'gb-sct', CPV: 'cv',
  // Group D
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  // Group E
  GER: 'de', CUW: 'cw', SWE: 'se', NGA: 'ng',
  // Group F
  ARG: 'ar', COL: 'co', UZB: 'uz', CMR: 'cm',
  // Group G
  ITA: 'it', CHI: 'cl', ECU: 'ec', ALG: 'dz',
  // Group H
  FRA: 'fr', POR: 'pt', PER: 'pe', JAM: 'jm',
  // Group I
  NED: 'nl', SEN: 'sn', CRC: 'cr', WAL: 'gb-wls',
  // Group J
  ENG: 'gb-eng', URU: 'uy', POL: 'pl', GHA: 'gh',
  // Group K
  ESP: 'es', CRO: 'hr', HON: 'hn', ISL: 'is',
  // Group L
  JPN: 'jp', BEL: 'be', NZL: 'nz', KSA: 'sa',
}

interface FlagImageProps {
  nationCode: string
  size?: number
  className?: string
  fallbackEmoji?: string
}

export default function FlagImage({ nationCode, size = 24, className = '', fallbackEmoji = '🏳️' }: FlagImageProps) {
  const isoCode = FIFA_TO_ISO[nationCode.toUpperCase()]

  if (!isoCode) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size * 0.67 }}
      >
        {fallbackEmoji}
      </span>
    )
  }

  return (
    <Image
      src={`https://flagcdn.com/w80/${isoCode}.png`}
      alt={`${nationCode} flag`}
      width={size}
      height={Math.round(size * 0.67)}
      className={`rounded-sm object-cover ${className}`}
      style={{ width: size, height: Math.round(size * 0.67) }}
      unoptimized
    />
  )
}

/**
 * Get the flagcdn.com URL for a nation code
 */
export function getFlagUrl(nationCode: string, width: number = 80): string | null {
  const isoCode = FIFA_TO_ISO[nationCode.toUpperCase()]
  if (!isoCode) return null
  return `https://flagcdn.com/w${width}/${isoCode}.png`
}
