'use client'

import Image from 'next/image'

/**
 * Mapping from FIFA 3-letter country codes to ISO 3166-1 alpha-2 codes
 * for use with flagcdn.com image service.
 */
const FIFA_TO_ISO: Record<string, string> = {
  // Group A
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
  // Group B
  CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
  // Group C
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  // Group D
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  // Group E
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  // Group F
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  // Group G
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  // Group H
  ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  // Group I
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  // Group J
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  // Group K
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  // Group L
  ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
  // Extra teams that might appear in seed data
  CMR: 'cm', ITA: 'it', NGA: 'ng', CAM: 'kh',
  POL: 'pl', SUI: 'ch', DEN: 'dk', UKR: 'ua',
  SRB: 'rs', CHI: 'cl', PER: 'pe', VEN: 've',
  RUS: 'ru', CHN: 'cn', THA: 'th', MAS: 'my',
  IDN: 'id', PHI: 'ph', PRK: 'kp', SAU: 'sa',
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
