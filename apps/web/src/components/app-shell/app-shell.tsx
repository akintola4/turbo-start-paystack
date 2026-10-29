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
      className="bg-background"
      style={{ "--sidebar-width": "18rem" } as CSSProperties}
    >
      <Sidebar className="border-r-0" collapsible="offcanvas" variant="sidebar">
        <SidebarHeader className="px-4 pt-6 pb-2">
          <OrgSwitcherMenu
            current={data.org.slug}
            monogramTone="solid"
            orgs={data.orgs}
          >
            <button
              className="flex min-h-12 w-full items-center gap-3 rounded-control p-2 text-left transition-colors duration-(--dur-fast) hover:bg-surface-2 data-[popup-open]:bg-surface-3"
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
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b bg-background px-4 pt-[env(safe-area-inset-top)] md:hidden">
          <SidebarTrigger
            aria-label="Open navigation"
            className="-ml-2 size-11"
          />
          <Mark className="size-6" />
          <span className="truncate font-semibold">{data.org.name}</span>
        </header>
        <main
          className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-24 sm:px-8 md:pt-10"
          id="content"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
