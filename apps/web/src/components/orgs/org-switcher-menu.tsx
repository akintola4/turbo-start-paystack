"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { CheckIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import type { OrgListItem } from "@/lib/view-models";
import { roleLabel } from "@/lib/format";
import { Monogram } from "@/components/avatars";

export function OrgSwitcherMenu({
  orgs,
  current,
  children,
  align = "start",
  side = "bottom",
  contentClassName,
  monogramTone = "soft",
}: {
  orgs: OrgListItem[];
  current: string;
  /** The trigger. */
  children: ReactElement;
  align?: "start" | "end" | "center";
  side?: "bottom" | "right" | "top";
  contentClassName?: string;
  monogramTone?: "soft" | "solid" | "mono";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent
        align={align}
        className={contentClassName ?? "w-(--anchor-width) min-w-64"}
        side={side}
        sideOffset={6}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              render={<Link className="gap-2" href={`/app/${org.slug}`} />}
            >
              <Monogram
                className="size-6 text-[10px]"
                name={org.name}
                seed={org.slug}
                tone={monogramTone}
              />
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              {org.slug === current ? (
                <CheckIcon aria-label="Current" className="size-4" />
              ) : (
                <span className="text-muted-foreground text-xs">
                  {roleLabel(org.role)}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app" />}>
          <LayoutGridIcon />
          All organizations
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app#new" />}>
          <PlusIcon />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
