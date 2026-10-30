import { buttonVariants } from "@workspace/ui/components/button";
import { LayoutGridIcon } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { CONTENT, TopBarRow } from "@/components/app-shell/top-bar";
import { Wordmark } from "@/components/primitives";
import { LAST_ORG_COOKIE, landingOrg, SIDEBAR_COOKIE } from "@/lib/org-view";
import { listMyOrganizations, requireSession } from "@/server/session";
import { loadShell } from "@/server/views";

/**
 * The account belongs to the person, not an organization, but it opens in
 * the shell of the organization they were last in (else their first), so
 * the sidebar stays where they left it. With no organization yet, a plain
 * top bar.
 */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession("/app/account");
  const jar = await cookies();
  const slugs = (await listMyOrganizations(session.user.id)).map((o) => o.slug);
  const slug =
    landingOrg(slugs, jar.get(LAST_ORG_COOKIE)?.value) ?? slugs[0] ?? null;
  if (slug) {
    return (
      <AppShell
        data={await loadShell(slug)}
        sidebarOpen={jar.get(SIDEBAR_COOKIE)?.value !== "false"}
      >
        {children}
      </AppShell>
    );
  }
  return (
    <div className="min-h-dvh bg-background">
      <TopBarRow className="justify-between">
        <Wordmark href="/app" />
        <Link
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          href="/app"
        >
          <LayoutGridIcon aria-hidden />
          Organizations
        </Link>
      </TopBarRow>
      <main className={CONTENT} id="content">
        {children}
      </main>
    </div>
  );
}
