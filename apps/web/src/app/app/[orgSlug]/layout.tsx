import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { loadShell } from "@/server/views";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Membership is checked here on the server for every page under the org.
  return <AppShell data={await loadShell(orgSlug)}>{children}</AppShell>;
}
