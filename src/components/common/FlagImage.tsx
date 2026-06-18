'use client'

import Image from 'next/image'

/**
 * Mapping from FIFA 3-letter country codes to ISO 3166-1 alpha-2 codes
 * for use with flagcdn.com image service.
 */
const FIFA_TO_ISO: Record<string, string> = {
  // ── WC 2026: 48 teams across 12 groups (A-L) ──
  // Official groups verified against FIFA.com + olympics.com + Wikipedia
  // Group A: Mexico, South Africa, Korea Republic, Czechia
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
  // Group B: Canada, Bosnia and Herzegovina, Qatar, Switzerland
  CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
  // Group C: Brazil, Haiti, Morocco, Scotland
  BRA: 'br', HAI: 'ht', MAR: 'ma', SCO: 'gb-sct',
  // Group D: USA, Paraguay, Australia, Türkiye
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  // Group E: Germany, Curaçao, Côte d'Ivoire, Ecuador
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  // Group F: Netherlands, Japan, Sweden, Tunisia
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  // Group G: Belgium, Egypt, Iran, New Zealand
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  // Group H: Spain, Cabo Verde, Saudi Arabia, Uruguay
  ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  // Group I: France, Senegal, Iraq, Norway
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  // Group J: Argentina, Algeria, Austria, Jordan
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  // Group K: Portugal, DR Congo, Uzbekistan, Colombia
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  // Group L: England, Croatia, Ghana, Panama
  ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
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
