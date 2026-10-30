"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger, useSidebar } from "@workspace/ui/components/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TopBarRow } from "@/components/app-shell/top-bar";

function pageTitle(pathname: string, orgSlug: string) {
  const rest = pathname.replace(`/app/${orgSlug}`, "");
  if (rest.startsWith("/settings/billing/invoices/")) {
    return "Invoice";
  }
  if (rest.startsWith("/settings/billing")) {
    return "Billing";
  }
  if (rest.startsWith("/members")) {
    return "Members";
  }
  return "Overview";
}

/**
 * sidebar-07's header: trigger, separator, breadcrumb (org / page). 64px,
 * 48px with the sidebar in icon mode, as in the block, so its centre stays
 * on the team switcher's (which shrinks from 48px to 32px). It sits on the
 * page column, so the trigger's ink starts on the content edge.
 */
export function SiteHeader({ org }: { org: { name: string; slug: string } }) {
  const pathname = usePathname();
  const { isMobile, open, openMobile } = useSidebar();
  return (
    <TopBarRow className="gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 motion-reduce:transition-none">
      {/* (36 − 16) / 2 + 1.33 (the glyph's inset in its 24px box) puts the
          icon's ink, not the button box, on the content edge. */}
      <SidebarTrigger
        aria-expanded={isMobile ? openMobile : open}
        aria-keyshortcuts="Meta+B Control+B"
        aria-label="Toggle sidebar"
        className="-ml-[11.33px] aria-expanded:not-hover:bg-transparent"
      />
      <Separator
        className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        orientation="vertical"
      />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink render={<Link href={`/app/${org.slug}`} />}>
              {org.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle(pathname, org.slug)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </TopBarRow>
  );
}
