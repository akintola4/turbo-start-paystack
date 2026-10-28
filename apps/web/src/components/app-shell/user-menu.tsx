"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  LayoutGridIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactElement, ReactNode } from "react";

import type { UserRef } from "@/lib/view-models";
import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };
}

export function ThemeRadio() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuRadioGroup onValueChange={setTheme} value={theme ?? "system"}>
      <DropdownMenuRadioItem value="light">
        <SunIcon /> Light
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">
        <MoonIcon /> Dark
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system">
        <MonitorIcon /> System
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

export function UserMenu({
  user,
  children,
  align = "end",
  side = "bottom",
  contentClassName,
}: {
  user: UserRef;
  children: ReactElement;
  align?: "start" | "end" | "center";
  side?: "bottom" | "right" | "top";
  contentClassName?: string;
}) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent
        align={align}
        className={contentClassName ?? "w-(--anchor-width) min-w-60"}
        side={side}
        sideOffset={6}
      >
        <div className="grid gap-0.5 px-2 py-1.5">
          <span className="truncate font-medium text-sm">{user.name}</span>
          <span className="truncate text-muted-foreground text-xs">
            {user.email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app" />}>
          <LayoutGridIcon />
          Organizations
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <SunIcon className="size-4 text-muted-foreground" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ThemeRadio />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignOutButton({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const signOut = useSignOut();
  return (
    <button className={className} onClick={signOut} type="button">
      {children ?? "Sign out"}
    </button>
  );
}
