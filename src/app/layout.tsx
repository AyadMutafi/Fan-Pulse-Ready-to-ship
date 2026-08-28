import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/context/LanguageContext";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/Analytics";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // font-display: swap prevents FOIT (flash of invisible text) — text renders
  // immediately with a system fallback, then swaps to Geist once loaded.
  // This is the recommended setting for body/UI fonts where readability
  // matters more than avoiding FOUT (flash of unstyled text).
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// ── SEO + Social sharing metadata ────────────────────────────────────────────
// metadataBase is REQUIRED for relative OG image paths to resolve. Without it,
// link previews on X / Discord / WhatsApp show nothing — killing the
// "share → visit → vote" marketing funnel at the click-through step.
//
// DYNAMIC URL: the site URL is resolved via @/lib/site-url, which checks
// NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → fallback. This ensures all
// og:url / og:image / JSON-LD URLs resolve to the ACTUAL deployment domain,
// not a hardcoded fan-pulse.fly.dev string. Set NEXT_PUBLIC_APP_URL in .env
// to the real deployment URL.
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Fan Pulse — Real-Time Fan Sentiment for World Cup 2026",
    template: "%s · Fan Pulse",
  },
  description:
    "Track real-time fan mood, AI-powered player ratings, and live World Cup 2026 sentiment. Vote on your team's pulse and see what fans worldwide are feeling.",
  keywords: [
    "Fan Pulse",
    "World Cup 2026",
    "FIFA World Cup",
    "fan sentiment",
    "football",
    "soccer",
    "player ratings",
    "fan mood",
    "live matches",
  ],
  authors: [{ name: "Fan Pulse" }],
  icons: {
    // Fan Pulse bolt logo — locally hosted (no external CDN dependency).
    // icon.svg = purple #6C2BD9 rounded square + white lightning bolt.
    // apple-touch-icon.png = 180×180 PNG version for iOS home screen.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Fan Pulse — Real-Time Fan Sentiment for World Cup 2026",
    description:
      "Track real-time fan mood, AI-powered player ratings, and live World Cup 2026 sentiment. Vote on your team's pulse and see what fans worldwide are feeling.",
    siteName: "Fan Pulse",
    // OG image is generated dynamically by src/app/opengraph-image.tsx
    // (Next.js file convention — automatically injected as og:image).
    // The dynamic version bakes the site URL into the image for SEO/brand recall.
  },
  twitter: {
    card: "summary_large_image",
    title: "Fan Pulse — Real-Time Fan Sentiment for World Cup 2026",
    description:
      "Track real-time fan mood, AI-powered player ratings, and live World Cup 2026 sentiment.",
    // Twitter image is generated dynamically by src/app/twitter-image.tsx
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A1A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // JSON-LD structured data — helps Google/Bing understand this is a web app,
  // improves rich-result eligibility, and bakes the URL into the page's
  // semantic markup (separate from <meta> tags). This is the #1 on-page SEO
  // signal after <title>.
  //
  // Both WebApplication.url and publisher.url use the DYNAMIC siteUrl (resolved
  // from NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → fallback) so structured
  // data always points at the real deployment domain.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Fan Pulse",
    url: siteUrl,
    description:
      "Real-time fan sentiment, AI-powered player ratings, and live World Cup 2026 mood tracking. Vote on your team's pulse and share fan cards.",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "Fan Pulse",
      url: siteUrl,
    },
    about: {
      "@type": "SportsEvent",
      name: "FIFA World Cup 2026",
    },
    keywords: [
      "Fan Pulse",
      "World Cup 2026",
      "FIFA World Cup",
      "fan sentiment",
      "football",
      "soccer",
      "player ratings",
      "fan mood",
    ].join(", "),
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* JSON-LD structured data — dynamic siteUrl for WebApplication.url + publisher.url */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Fan Pulse bolt icon — locally hosted SVG (purple #6C2BD9 + white lightning bolt). */}
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LanguageProvider>
            {children}
            <SonnerToaster position="bottom-center" richColors />
            <Analytics />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
