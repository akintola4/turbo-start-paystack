import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
// Throwaway: one theme file per design direction, scoped by html[data-direction].
import "@/directions/a/theme.css";
import "@/directions/b/theme.css";
import "@/directions/c/theme.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { DirectionSwitcher } from "@/components/preview/direction-switcher";
import { getDirectionId } from "@/directions/registry";

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

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const direction = await getDirectionId();
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-direction={direction}
      lang="en"
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <Providers>
          {children}
          <DirectionSwitcher current={direction} />
        </Providers>
      </body>
    </html>
  );
}
