"use client";

import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger, useSidebar } from "@workspace/ui/components/sidebar";
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
 * dashboard-01's site header: sidebar trigger, separator, page title. It
 * sits on the page column, so the trigger's ink starts on the content edge,
 * and its 64px row is centred on the sidebar's org row.
 */
export function SiteHeader({ org }: { org: { name: string; slug: string } }) {
  const pathname = usePathname();
  const { isMobile, open, openMobile } = useSidebar();
  return (
    <TopBarRow>
      {/* (36 − 16) / 2 + 1.33 (the glyph's inset in its 24px box) puts the
          icon's ink, not the button box, on the content edge. */}
      <SidebarTrigger
        aria-expanded={isMobile ? openMobile : open}
        aria-keyshortcuts="Meta+B Control+B"
        aria-label="Toggle sidebar"
        className="-ml-[11.33px] aria-expanded:not-hover:bg-transparent"
      />
      <Separator
        className="mx-1 h-4 data-vertical:self-auto"
        orientation="vertical"
      />
      <p className="flex min-w-0 items-center gap-1.5 font-medium text-sm">
        <span className="hidden truncate text-muted-foreground sm:inline">
          {org.name}
        </span>
        <span aria-hidden className="hidden text-muted-foreground sm:inline">
          /
        </span>
        <span className="truncate">{pageTitle(pathname, org.slug)}</span>
      </p>
    </TopBarRow>
  );
}
