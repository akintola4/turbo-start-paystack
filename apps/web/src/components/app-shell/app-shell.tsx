import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { ChevronsUpDownIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Monogram } from "@/components/avatars";
import { OrgSwitcherMenu } from "@/components/orgs/org-switcher-menu";
import { RememberOrg } from "@/components/app-shell/remember-org";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { ShellData } from "@/lib/view-models";
import { roleLabel } from "@/lib/format";
import { ShellNav } from "@/components/app-shell/shell-nav";
import { CONTENT, TopBar } from "@/components/app-shell/top-bar";
import { statusLabel } from "@/components/primitives";

export function AppShell({
  data,
  sidebarOpen,
  children,
}: {
  data: ShellData;
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  const { plan } = data;
  const status =
    plan.status && plan.status !== "active"
      ? statusLabel(plan.status, plan.endsAt)
      : null;
  return (
    <SidebarProvider
      className="bg-background"
      defaultOpen={sidebarOpen}
      style={{ "--sidebar-width": "18rem" } as CSSProperties}
    >
      <Sidebar className="border-r-0" collapsible="offcanvas" variant="sidebar">
        {/* The org row (52px) is centred on the 64px top bar: (64 − 52) / 2
            = 6px above it, plus the notch inset the top bar also takes. 22px
            below puts the first nav row (44px) on the page title's line box
            (64 + 24). */}
        <SidebarHeader className="px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-[22px]">
          <OrgSwitcherMenu
            current={data.org.slug}
            monogramTone="solid"
            orgs={data.orgs}
          >
            <button
              className="flex h-13 w-full items-center gap-3 rounded-control px-2 text-left transition-colors duration-(--dur-fast) hover:bg-surface-2 data-[popup-open]:bg-surface-3"
              type="button"
            >
              <Monogram
                className="size-9 text-[13px]"
                name={data.org.name}
                tone="solid"
              />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-semibold text-[15px] leading-tight">
                  {data.org.name}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {plan.name} plan{status ? ` · ${status}` : ""}
                </span>
              </span>
              <ChevronsUpDownIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="sr-only">Switch organization</span>
            </button>
          </OrgSwitcherMenu>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <ShellNav nav={data.nav} />
        </SidebarContent>
        <SidebarFooter className="px-4 pb-5">
          <UserMenu align="start" side="top" user={data.user}>
            <button
              className="flex min-h-12 w-full items-center gap-3 rounded-control p-2 text-left transition-colors duration-(--dur-fast) hover:bg-surface-2 data-[popup-open]:bg-surface-3"
              type="button"
            >
              <Monogram
                className="size-9"
                name={data.user.name}
                shape="circle"
              />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-medium text-sm leading-tight">
                  {data.user.name}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {roleLabel(data.role)}
                </span>
              </span>
              <ChevronsUpDownIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="sr-only">Account menu</span>
            </button>
          </UserMenu>
        </SidebarFooter>
      </Sidebar>
      <RememberOrg slug={data.org.slug} />
      <SidebarInset className="bg-background">
        <TopBar org={data.org} />
        <main className={CONTENT} id="content">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
