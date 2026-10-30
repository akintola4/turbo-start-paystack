import "./globals.css";

import { env } from "@workspace/env/client";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

/**
 * Geist and Geist Mono, from the `geist` package's variable files. Next's
 * automatic fallback is off: it is a single Arial face sized for weight 400,
 * which Chrome then fakes bold for headings, so text re-wrapped when Geist
 * arrived. The metric-matched fallbacks ("Geist Fallback", one face per
 * weight band, and "Geist Mono Fallback") live with the font stacks in
 * packages/ui globals.css.
 */
const geistSans = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: [],
});

const geistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: [],
});

/**
 * Geist has no ₦ or ₵. This 1.6 KB subset of Inter (SIL OFL) supplies only
 * those two code points, sized to Geist's cap height (710/1000 vs Inter's
 * 1490/2048) and given Geist's line metrics so mixed lines don't grow.
 */
const currencySymbols = localFont({
  src: "./fonts/currency-symbols.woff2",
  variable: "--font-currency",
  weight: "100 900",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+20A6, U+20B5" },
    { prop: "size-adjust", value: "97.6%" },
    { prop: "ascent-override", value: "103%" },
    { prop: "descent-override", value: "30.2%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

/**
 * Decides before the first paint whether the landing hero plays its intro:
 * only on "/", once per browser session, never under reduced motion. It
 * marks <html data-intro="play">; the hero hides its parts with that and
 * clears it as its timeline starts (or after 2.5s if the bundle never runs).
 */
const INTRO_GATE = `try{if(location.pathname==="/"&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem("tsp-intro")){sessionStorage.setItem("tsp-intro","1");var h=document.documentElement;h.setAttribute("data-intro","play");setTimeout(function(){h.removeAttribute("data-intro")},2500)}}catch(e){}`;

export const metadata: Metadata = {
  // Absolute URLs for the generated OG and Twitter images.
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Turbo Start Paystack",
    template: "%s | Turbo Start Paystack",
  },
  description:
    "Multi-tenant SaaS starter with organizations, roles and Paystack subscriptions.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1311" },
  ],
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${currencySymbols.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <Script id="intro-gate" strategy="beforeInteractive">
          {INTRO_GATE}
        </Script>
      </head>
      <body className="min-h-dvh">
        <a
          className="pressable fixed top-3 left-3 z-[100] -translate-y-20 rounded-control bg-primary px-4 py-2.5 font-semibold text-primary-foreground focus-visible:translate-y-0"
          href="#content"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
