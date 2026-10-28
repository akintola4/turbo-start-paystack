import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@workspace/tailwind-config/utils";

/** Status chips: rounded square, Lucide icon + word, never colour alone. */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 select-none items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-chip px-2 font-semibold text-[12.5px] leading-none transition-[background-color,color] duration-(--dur-base) [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        destructive: "bg-destructive-bg text-destructive",
        info: "bg-info-bg text-info",
        quiet: "bg-quiet-bg text-quiet",
        highlight: "bg-highlight text-highlight-foreground",
        outline: "text-foreground shadow-tile",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
