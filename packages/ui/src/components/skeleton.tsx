import { cn } from "@workspace/tailwind-config/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-skeleton rounded-chip bg-surface-2 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
