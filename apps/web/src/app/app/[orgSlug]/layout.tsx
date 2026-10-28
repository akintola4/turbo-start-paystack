import type { ReactNode } from "react";

import { getDirection } from "@/directions/registry";
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
  const [D, data] = await Promise.all([getDirection(), loadShell(orgSlug)]);
  return <D.AppShell data={data}>{children}</D.AppShell>;
}
