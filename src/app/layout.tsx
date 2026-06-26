import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/context/LanguageContext";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ── SEO + Social sharing metadata ────────────────────────────────────────────
// metadataBase is REQUIRED for relative OG image paths to resolve. Without it,
// link previews on X / Discord / WhatsApp show nothing — killing the
// "share → visit → vote" marketing funnel at the click-through step.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fan-pulse.fly.dev";

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
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
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
