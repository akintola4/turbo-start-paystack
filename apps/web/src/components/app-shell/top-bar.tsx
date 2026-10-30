import { cn } from "@workspace/tailwind-config/utils";
import type { ReactNode } from "react";

/*
 * The app grid. One centred column, 1120 wide plus the 16 / 32 gutters, for
 * the page (and the top bar on pages without the sidebar).
 */
const COLUMN = "mx-auto w-full max-w-[1184px] px-4 sm:px-8";

/** The page column under the top bar. */
export const CONTENT = cn(COLUMN, "pt-6 pb-24");

/**
 * 64px row, sticky. Its centre (32px) is the sidebar org row's centre. A
 * hairline fades in once the page scrolls under it. `edge` runs it across
 * the whole inset, as in sidebar-07, so the sidebar toggle stays beside the
 * sidebar instead of drifting with the centred column.
 */
export function TopBarRow({
  className,
  children,
  edge = false,
}: {
  className?: string;
  children: ReactNode;
  edge?: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]"
      data-print="hide"
      data-topbar
    >
      <div
        className={cn(
          edge ? "w-full px-4" : COLUMN,
          "flex h-16 items-center gap-2",
          className
        )}
      >
        {children}
      </div>
    </header>
  );
}
