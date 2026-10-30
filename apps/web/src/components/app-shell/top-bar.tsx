import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/tailwind-config/utils";
import type { ReactNode } from "react";

import { CommandPalette } from "@/components/app-shell/command-palette";
import { Monogram } from "@/components/avatars";

/*
 * The app grid. One centred column, 1120 wide plus the 16 / 32 gutters, for
 * the top bar and the page, so the toggle's ink, the page title's ink and
 * the cards below all start on the same x, with or without the sidebar.
 */
const COLUMN = "mx-auto w-full max-w-[1184px] px-4 sm:px-8";

/** The page column under the top bar. */
export const CONTENT = cn(COLUMN, "pt-6 pb-24");

/**
 * 64px row, sticky. Its centre (32px) is the sidebar org row's centre. A
 * hairline fades in once the page scrolls under it.
 */
export function TopBarRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]"
      data-print="hide"
      data-topbar
    >
      <div className={cn(COLUMN, "flex h-16 items-center gap-2", className)}>
        {children}
      </div>
    </header>
  );
}

export function TopBar({
  org,
  role,
}: {
  org: { id: string; name: string; slug: string };
  role: string;
}) {
  return (
    <TopBarRow>
      {/* The negative margin puts the icon's ink, not the button box, on
          the content edge: (44 − 16) / 2 + 1.33 (the glyph's inset in its
          24px box) = 15.33px; 13.33px for the 40px desktop button. */}
      <SidebarTrigger
        aria-keyshortcuts="Meta+B Control+B"
        aria-label="Toggle sidebar"
        className="-ml-[15.33px] size-11 lg:-ml-[13.33px] lg:size-10"
      />
      {/* The sidebar is a drawer below lg, so the bar names the org. */}
      <span className="flex min-w-0 items-center gap-2.5 lg:hidden">
        <Monogram
          className="size-7 shrink-0 text-[11px]"
          name={org.name}
          tone="solid"
        />
        <span className="truncate font-semibold">{org.name}</span>
      </span>
      <div className="ml-auto max-sm:-mr-1.5">
        <CommandPalette org={org} role={role} />
      </div>
    </TopBarRow>
  );
}
