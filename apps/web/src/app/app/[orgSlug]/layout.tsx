import Link from "next/link";
import type { ReactNode } from "react";

import { OrgSwitcher } from "@/components/org-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { listMyOrganizations, requireOrgBySlug } from "@/server/session";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Membership is checked here on the server for every page under the org.
  const membership = await requireOrgBySlug(orgSlug);
  const orgs = await listMyOrganizations(membership.session.user.id);
  const base = `/app/${orgSlug}`;

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <OrgSwitcher current={orgSlug} orgs={orgs} />
          <nav className="flex gap-4 text-sm">
            <Link href={base}>Overview</Link>
            <Link href={`${base}/members`}>Members</Link>
            {membership.can("billing:view") ? (
              <Link href={`${base}/settings/billing`}>Billing</Link>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-muted-foreground text-sm">
            <span>
              {membership.session.user.email} · {membership.member.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
