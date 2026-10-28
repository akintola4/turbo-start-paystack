import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import { ChevronsUpDownIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Monogram } from "@/components/avatars";
import { OrgSwitcherMenu } from "@/components/orgs/org-switcher-menu";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { ShellData } from "@/lib/view-models";
import { roleLabel, STATUS_META } from "@/lib/format";
import { ShellNav } from "@/components/app-shell/shell-nav";
import { Mark } from "@/components/primitives";

export function AppShell({
  data,
  children,
}: {
  data: ShellData;
  children: ReactNode;
}) {
  const status = data.plan.status ? STATUS_META[data.plan.status].label : null;
  return (
    <SidebarProvider
      className="bg-canvas"
      style={{ "--sidebar-width": "18rem" } as CSSProperties}
    >
      <Sidebar className="p-3" collapsible="offcanvas" variant="floating">
        <SidebarHeader className="p-3">
          <OrgSwitcherMenu
            current={data.org.slug}
            monogramTone="solid"
            orgs={data.orgs}
          >
            <button
              className="flex w-full items-center gap-3 rounded-[14px] border bg-background p-2.5 text-left shadow-tile outline-none transition-[border-color] hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[popup-open]:border-primary/40"
              type="button"
            >
              <Monogram
                className="size-10 rounded-[10px] font-display text-sm"
                name={data.org.name}
                seed={data.org.slug}
                tone="solid"
              />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-display font-semibold text-[15px] leading-tight">
                  {data.org.name}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {data.plan.name} plan
                  {status && data.plan.status !== "active"
                    ? `, ${status.toLowerCase()}`
                    : ""}
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
        <SidebarContent className="px-1">
          <ShellNav nav={data.nav} />
        </SidebarContent>
        <SidebarFooter className="p-3">
          <UserMenu align="start" side="top" user={data.user}>
            <button
              className="flex w-full items-center gap-3 rounded-[14px] p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[popup-open]:bg-sidebar-accent"
              type="button"
            >
              <Monogram
                className="size-9"
                name={data.user.name}
                seed={data.user.email}
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
      <SidebarInset className="bg-canvas">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-canvas/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger
            aria-label="Open navigation"
            className="-ml-1 size-9"
          />
          <Mark className="size-6" />
          <span className="truncate font-display font-semibold">
            {data.org.name}
          </span>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 sm:px-6 md:pt-[22px] md:pr-8 md:pl-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
