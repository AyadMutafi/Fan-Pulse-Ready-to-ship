import Script from 'next/script'

/**
 * Umami Analytics — privacy-friendly, cookie-free, GDPR-compliant.
 *
 * CONFIGURATION (optional — app works fine without it):
 *   1. Create a free account at https://cloud.umami.is (or self-host)
 *   2. Add a website → copy the Website ID
 *   3. Set env vars on Fly.io:
 *      fly secrets set NEXT_PUBLIC_UMAMI_WEBSITE_ID="<your-id>"
 *      fly secrets set NEXT_PUBLIC_UMAMI_SRC="https://cloud.umami.is/script.js"
 *
 * If NEXT_PUBLIC_UMAMI_WEBSITE_ID is not set, this component renders nothing
 * — zero overhead, zero network requests, zero privacy impact.
 *
 * Why Umami over GA/Plausible:
 *   - Free cloud tier (10k events/month) — fits the $200 budget
 *   - No cookie banner needed (no cookies, no PII)
 *   - Simple pageview + event tracking
 *   - Can self-host on Fly.io later if we outgrow the free tier
 */

const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js'

export function Analytics() {
  if (!UMAMI_WEBSITE_ID) {
    // Analytics disabled — no script loads
    return null
  }

  return (
    <Script
      src={UMAMI_SRC}
      data-website-id={UMAMI_WEBSITE_ID}
      strategy="afterInteractive"
    />
  )
}
