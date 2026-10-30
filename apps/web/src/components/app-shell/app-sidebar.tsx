"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
} from "@workspace/ui/components/sidebar";
import {
  CreditCardIcon,
  HouseIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import { SearchButton } from "@/components/app-shell/command-palette";
import { type NavItem, NavMain } from "@/components/app-shell/nav-main";
import { NavUser } from "@/components/app-shell/nav-user";
import { TeamSwitcher } from "@/components/app-shell/team-switcher";
import { statusLabel } from "@/components/primitives";
import type { ShellData } from "@/lib/view-models";

/** The org's pages; Billing (a group) only for roles with billing:view.
 *  Settings is for everyone: its controls follow the role. */
function navItems(nav: ShellData["nav"]): NavItem[] {
  const items: NavItem[] = [
    { title: "Overview", url: nav.overview, icon: <HouseIcon /> },
    { title: "Members", url: nav.members, icon: <UsersIcon />, prefix: true },
  ];
  if (nav.billing) {
    items.push({
      title: "Billing",
      url: nav.billing,
      icon: <CreditCardIcon />,
      prefix: true,
      items: [
        { title: "Plan", url: nav.billing },
        { title: "Invoices", url: `${nav.billing}#invoices` },
        { title: "Billing details", url: `${nav.billing}#billing-details` },
      ],
    });
  }
  items.push({
    title: "Settings",
    url: nav.settings,
    icon: <SettingsIcon />,
    items: [
      { title: "General", url: `${nav.settings}#general` },
      { title: "Members & roles", url: `${nav.settings}#members` },
      { title: "Danger zone", url: `${nav.settings}#danger` },
    ],
  });
  return items;
}

/**
 * shadcn's sidebar-07: team switcher, search (⌘K), the org's pages, the
 * account, and the rail; collapsible to icons. Its nav-projects group is
 * left out: this app has no projects-like list to put there.
 */
export function AppSidebar({
  data,
  ...props
}: { data: ShellData } & ComponentProps<typeof Sidebar>) {
  const { plan } = data;
  const status =
    plan.status && plan.status !== "active"
      ? statusLabel(plan.status, plan.endsAt)
      : null;
  const planLabel = `${plan.name} plan${status ? ` · ${status}` : ""}`;
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          current={{ ...data.org, plan: planLabel }}
          teams={data.orgs}
        />
        <SidebarMenu>
          <SearchButton />
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems(data.nav)} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
