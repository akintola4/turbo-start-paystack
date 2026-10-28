import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Turbo Start Paystack",
    template: "%s · Turbo Start Paystack",
  },
  description:
    "Multi-tenant SaaS starter with organizations, roles and Paystack subscriptions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
