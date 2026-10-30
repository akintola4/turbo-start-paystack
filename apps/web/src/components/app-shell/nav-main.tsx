"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type NavItem = {
  title: string;
  url: string;
  icon: ReactNode;
  /** Active for this path and everything under it. */
  prefix?: boolean;
  items?: { title: string; url: string }[];
};

/**
 * shadcn sidebar-07's nav-main. Items with sub-items are collapsible
 * groups that open when you enter one of their pages; the rest are links.
 */
export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isActive = (item: NavItem) =>
    item.prefix ? pathname.startsWith(item.url) : pathname === item.url;
  const close = () => setOpenMobile(false);
  const activeGroup =
    items.find((item) => item.items?.length && isActive(item))?.title ?? null;
  // Controlled, so a group can open when navigation enters it (a default
  // can't change after mount), while the user can still close it.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeGroup ? { [activeGroup]: true } : {}
  );
  const entered = useRef(activeGroup);
  useEffect(() => {
    if (activeGroup && entered.current !== activeGroup) {
      setOpen((o) => ({ ...o, [activeGroup]: true }));
    }
    entered.current = activeGroup;
  }, [activeGroup]);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          item.items?.length ? (
            <Collapsible
              className="group/collapsible"
              key={item.title}
              onOpenChange={(next) =>
                setOpen((o) => ({ ...o, [item.title]: next }))
              }
              open={open[item.title] ?? false}
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={isActive(item)}
                    tooltip={item.title}
                  />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        render={<Link href={subItem.url} onClick={close} />}
                      >
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive(item)}
                render={
                  <Link
                    aria-current={isActive(item) ? "page" : undefined}
                    href={item.url}
                    onClick={close}
                  />
                }
                tooltip={item.title}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
