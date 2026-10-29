import type { Currency } from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";

export type OptionProps = {
  /** The raw requested path, for seeding (references, shuffles). */
  path: string;
  /** The path as shown: decoded and middle-truncated. React escapes it. */
  shown: string;
  currency: Currency;
};

/** The requested path in a mono chip; the full path is in the title. */
export function PathChip({
  path,
  shown,
  className,
}: {
  path: string;
  shown: string;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "rounded-chip bg-panel-tile px-1.5 py-0.5 font-mono text-[0.86em] text-panel-foreground [box-decoration-break:clone] [overflow-wrap:anywhere]",
        className
      )}
      title={path}
    >
      {shown}
    </code>
  );
}
