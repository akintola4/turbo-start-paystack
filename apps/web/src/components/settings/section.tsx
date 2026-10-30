import { cn } from "@workspace/tailwind-config/utils";
import type { ReactNode } from "react";

import { Tile } from "@/components/primitives";

/**
 * One settings card: a heading, one line on what it controls, then the
 * controls. The id is the anchor the sidebar and ⌘K link to; the scroll
 * margin keeps it clear of the sticky top bar.
 */
export function SettingsSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  /** One control on the heading's row, e.g. "Sign out everywhere else". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tile
      aria-labelledby={`${id}-title`}
      className={cn("grid scroll-mt-24 gap-5", className)}
      id={id}
    >
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="grid min-w-0 gap-1">
          <h2 className="font-semibold text-lg" id={`${id}-title`}>
            {title}
          </h2>
          {description ? (
            <p className="text-pretty text-muted-foreground text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="justify-self-start">{action}</div> : null}
      </div>
      {children}
    </Tile>
  );
}

/**
 * A row inside a section: what it is on the left, its one action on the
 * right; stacked on phones. Rows after the first get a divider.
 */
export function SettingsRow({
  title,
  description,
  children,
  className,
  ...props
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "title">) {
  return (
    <div
      className={cn(
        "grid gap-3 border-border border-t pt-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6",
        className
      )}
      {...props}
    >
      <div className="grid min-w-0 gap-1">
        <div className="font-medium">{title}</div>
        {description ? (
          <div className="text-pretty text-muted-foreground text-sm">
            {description}
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {children}
        </div>
      ) : null}
    </div>
  );
}
