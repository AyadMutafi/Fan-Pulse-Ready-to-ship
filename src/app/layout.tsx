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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fan Pulse — World Cup 2026 Real-Time Fan Sentiment",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fan Pulse — Real-Time Fan Sentiment for World Cup 2026",
    description:
      "Track real-time fan mood, AI-powered player ratings, and live World Cup 2026 sentiment.",
    images: ["/og-image.png"],
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
  return (
    <html lang="en" suppressHydrationWarning>
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
