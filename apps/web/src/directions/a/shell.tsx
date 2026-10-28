"use client";

import { Separator } from "@workspace/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import {
  ChevronsUpDownIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Monogram } from "@/components/shared/avatars";
import { OrgSwitcherMenu } from "@/components/shared/org-switcher-menu";
import { UserMenu } from "@/components/shared/user-menu";
import type { ShellData } from "@/directions/types";
import { STATUS_META } from "@/lib/format";

function pageTitle(pathname: string) {
  if (pathname.endsWith("/members")) {
    return "Members";
  }
  if (pathname.includes("/settings/billing")) {
    return "Billing";
  }
  return "Overview";
}

export function LedgerShell({
  data,
  children,
}: {
  data: ShellData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const items = [
    {
      href: data.nav.overview,
      label: "Overview",
      icon: LayoutDashboardIcon,
      exact: true,
    },
    { href: data.nav.members, label: "Members", icon: UsersIcon, exact: false },
    ...(data.nav.billing
      ? [
          {
            href: data.nav.billing,
            label: "Billing",
            icon: CreditCardIcon,
            exact: false,
          },
        ]
      : []),
  ];
  const planLine = data.plan.status
    ? `${data.plan.name} plan, ${STATUS_META[data.plan.status].label.toLowerCase()}`
    : `${data.plan.name} plan`;

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader className="h-14 justify-center p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <OrgSwitcherMenu
                current={data.org.slug}
                monogramTone="solid"
                orgs={data.orgs}
              >
                <SidebarMenuButton
                  className="h-11 gap-2.5 px-2 data-[state=open]:bg-sidebar-accent"
                  size="lg"
                >
                  <Monogram
                    className="size-7 text-[11px]"
                    name={data.org.name}
                    seed={data.org.slug}
                    shape="rounded"
                    tone="solid"
                  />
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-semibold text-[13px]">
                      {data.org.name}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {planLine}
                    </span>
                  </span>
                  <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </OrgSwitcherMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        className="relative h-8 gap-2.5 px-2 data-[active=true]:font-medium data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:-left-2 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-(--ledger-accent)"
                        isActive={active}
                      >
                        <Link
                          aria-current={active ? "page" : undefined}
                          href={item.href}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu align="start" side="top" user={data.user}>
                <SidebarMenuButton
                  className="h-11 gap-2.5 px-2 data-[state=open]:bg-sidebar-accent"
                  size="lg"
                >
                  <Monogram
                    className="size-7 text-[11px]"
                    name={data.user.name}
                    seed={data.user.email}
                    shape="circle"
                    tone="soft"
                  />
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium text-[13px]">
                      {data.user.name}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {data.user.email}
                    </span>
                  </span>
                  <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </UserMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-(--ledger-sheet) md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-[0_1px_2px_oklch(0.2_0.02_260/0.04)]">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:rounded-t-xl md:px-6">
          <SidebarTrigger className="-ml-1.5 size-8" />
          <Separator
            className="data-[orientation=vertical]:h-4"
            orientation="vertical"
          />
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2 text-sm">
              <li className="hidden min-w-0 truncate text-muted-foreground sm:block">
                <Link
                  className="hover:text-foreground"
                  href={data.nav.overview}
                >
                  {data.org.name}
                </Link>
              </li>
              <li
                aria-hidden
                className="hidden text-muted-foreground/50 sm:block"
              >
                /
              </li>
              <li aria-current="page" className="truncate font-medium">
                {pageTitle(pathname)}
              </li>
            </ol>
          </nav>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 md:px-8 md:pt-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
