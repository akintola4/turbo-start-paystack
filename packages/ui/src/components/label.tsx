import { cn } from "@workspace/tailwind-config/utils";
import type * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor or wrap the control.
    <label
      className={cn(
        "flex select-none items-center gap-2 font-medium text-sm leading-none",
        className
      )}
      data-slot="label"
      {...props}
    />
  );
}

export { Label };
