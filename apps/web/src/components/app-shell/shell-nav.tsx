"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { CreditCardIcon, HouseIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ShellNav({
  nav,
}: {
  nav: { overview: string; members: string; billing: string | null };
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const items = [
    { href: nav.overview, label: "Overview", icon: HouseIcon, exact: true },
    { href: nav.members, label: "Members", icon: UsersIcon, exact: false },
    ...(nav.billing
      ? [
          {
            href: nav.billing,
            label: "Billing",
            icon: CreditCardIcon,
            exact: false,
          },
        ]
      : []),
  ];
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  className="h-11 rounded-control px-3 font-medium text-[15px] text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-surface-2 hover:text-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-foreground [&>svg]:size-[18px]"
                  isActive={active}
                  render={
                    <Link
                      aria-current={active ? "page" : undefined}
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  <item.icon aria-hidden />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
