import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import "./theme.css";

import { GeistMono } from "geist/font/mono";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Turbo Start Paystack",
    template: "%s · Turbo Start Paystack",
  },
  description:
    "Multi-tenant SaaS starter with organizations, roles and Paystack subscriptions.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={GeistMono.variable} lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
