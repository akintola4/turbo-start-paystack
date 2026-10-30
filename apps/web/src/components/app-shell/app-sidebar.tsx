"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import {
  ChevronsUpDownIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { SearchButton } from "@/components/app-shell/command-palette";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Monogram } from "@/components/avatars";
import { OrgSwitcherMenu } from "@/components/orgs/org-switcher-menu";
import { statusLabel } from "@/components/primitives";
import { roleLabel } from "@/lib/format";
import type { ShellData } from "@/lib/view-models";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  active: (pathname: string) => boolean;
};

function navItems(nav: ShellData["nav"]): NavItem[] {
  const items: NavItem[] = [
    {
      title: "Overview",
      href: nav.overview,
      icon: HouseIcon,
      active: (p) => p === nav.overview,
    },
    {
      title: "Members",
      href: nav.members,
      icon: UsersIcon,
      active: (p) => p.startsWith(nav.members),
    },
  ];
  const billing = nav.billing;
  if (billing) {
    items.push(
      {
        title: "Billing",
        href: billing,
        icon: CreditCardIcon,
        active: (p) => p.startsWith(billing) && !p.includes("/invoices/"),
      },
      {
        title: "Invoices",
        href: `${billing}#invoices`,
        icon: FileTextIcon,
        active: (p) => p.startsWith(`${billing}/invoices/`),
      }
    );
  }
  return items;
}

/** shadcn's team-switcher pattern, on this app's org switcher. */
function OrgSwitcher({ data }: { data: ShellData }) {
  const { isMobile } = useSidebar();
  const { plan } = data;
  const status =
    plan.status && plan.status !== "active"
      ? statusLabel(plan.status, plan.endsAt)
      : null;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <OrgSwitcherMenu
          current={data.org.slug}
          monogramTone="solid"
          orgs={data.orgs}
          side={isMobile ? "bottom" : "right"}
          contentClassName="min-w-64"
        >
          <SidebarMenuButton
            className="data-popup-open:bg-sidebar-accent"
            size="lg"
          >
            <Monogram
              className="size-8 shrink-0 text-[12px]"
              name={data.org.name}
              tone="solid"
            />
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate font-semibold">{data.org.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {plan.name} plan{status ? ` · ${status}` : ""}
              </span>
            </span>
            <ChevronsUpDownIcon aria-hidden className="ml-auto" />
            <span className="sr-only">Switch organization</span>
          </SidebarMenuButton>
        </OrgSwitcherMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.active(pathname);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={active}
                  render={
                    <Link
                      aria-current={active ? "page" : undefined}
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                  tooltip={item.title}
                >
                  <item.icon aria-hidden />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavUser({ user, role }: Pick<ShellData, "user" | "role">) {
  const { isMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserMenu
          align="end"
          contentClassName="min-w-60"
          side={isMobile ? "top" : "right"}
          user={user}
        >
          <SidebarMenuButton
            className="data-popup-open:bg-sidebar-accent"
            size="lg"
          >
            <Monogram
              className="size-8 shrink-0"
              name={user.name}
              shape="circle"
            />
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {roleLabel(role)}
              </span>
            </span>
            <ChevronsUpDownIcon aria-hidden className="ml-auto" />
            <span className="sr-only">Account menu</span>
          </SidebarMenuButton>
        </UserMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * shadcn's dashboard-01 sidebar, collapsible to icons: org switcher,
 * search (⌘K), the app's pages and the account menu. In icon mode each
 * button keeps its icon and shows its label as a tooltip.
 */
export function AppSidebar({
  data,
  ...props
}: { data: ShellData } & ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      {/* In icon mode the org button shrinks from 48px to 32px; 16px above
          keeps its centre on the site header's (32px). */}
      <SidebarHeader className="transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:pt-4 motion-reduce:transition-none">
        <OrgSwitcher data={data} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SearchButton />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavMain items={navItems(data.nav)} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser role={data.role} user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
