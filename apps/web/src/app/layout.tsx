import "./globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

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

export const metadata: Metadata = {
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${currencySymbols.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <a
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-control bg-primary px-4 py-2.5 font-semibold text-primary-foreground focus-visible:translate-y-0"
          href="#content"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
