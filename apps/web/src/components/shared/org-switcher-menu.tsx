"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { CheckIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { OrgListItem } from "@/directions/types";
import { roleLabel } from "@/lib/format";
import { Monogram } from "./avatars";

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
  children: ReactNode;
  align?: "start" | "end" | "center";
  side?: "bottom" | "right" | "top";
  contentClassName?: string;
  monogramTone?: "soft" | "solid" | "mono";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={
          contentClassName ?? "w-(--radix-dropdown-menu-trigger-width) min-w-64"
        }
        side={side}
        sideOffset={6}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Organizations
        </DropdownMenuLabel>
        {orgs.map((org, i) => (
          <DropdownMenuItem asChild key={org.id}>
            <Link className="gap-2" href={`/app/${org.slug}`}>
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
              {i < 9 ? (
                <DropdownMenuShortcut className="sr-only">
                  ⌘{i + 1}
                </DropdownMenuShortcut>
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app">
            <LayoutGridIcon />
            All organizations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app#new">
            <PlusIcon />
            New organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
