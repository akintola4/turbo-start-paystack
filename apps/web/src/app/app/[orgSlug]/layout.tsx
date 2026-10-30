import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { SIDEBAR_COOKIE } from "@/lib/org-view";
import { loadShell } from "@/server/views";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";
  // Membership is checked here on the server for every page under the org.
  return (
    <AppShell data={await loadShell(orgSlug)} sidebarOpen={sidebarOpen}>
      {children}
    </AppShell>
  );
}
