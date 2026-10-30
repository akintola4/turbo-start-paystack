"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LayoutGridIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";

import { MarkAvatar } from "@/components/mark-avatar";

type Team = { id: string; name: string; slug: string };

/** shadcn sidebar-07's team switcher, for the user's organizations. */
export function TeamSwitcher({
  teams,
  current,
}: {
  teams: Team[];
  current: Team & { plan: string };
}) {
  const { isMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                size="lg"
              />
            }
          >
            <MarkAvatar seed={current.id} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{current.name}</span>
              <span className="truncate text-xs">{current.plan}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
            <span className="sr-only">Switch organization</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-fit min-w-56"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizations
              </DropdownMenuLabel>
              {teams.map((team) => (
                <DropdownMenuItem
                  className="gap-2 p-2"
                  key={team.slug}
                  render={<Link href={`/app/${team.slug}`} />}
                >
                  <MarkAvatar
                    className="size-6 rounded-md p-[2px]"
                    seed={team.id}
                  />
                  {team.name}
                  {team.slug === current.slug ? (
                    <CheckIcon aria-label="Current" className="ml-auto" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 p-2"
                render={<Link href="/app" />}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <LayoutGridIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  All organizations
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 p-2"
                render={<Link href="/app#new" />}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add organization
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
