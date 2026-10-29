import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@workspace/tailwind-config/utils";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control border border-transparent font-semibold text-[15px] outline-none transition-[background-color,color,scale] duration-(--dur-fast) ease-out active:not-aria-[haspopup]:scale-[0.97] active:duration-(--dur-press) disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        highlight:
          "bg-highlight text-highlight-foreground hover:bg-highlight-hover",
        outline:
          "bg-surface-1 text-foreground shadow-tile hover:bg-surface-2 aria-expanded:bg-surface-2",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-3 aria-expanded:bg-surface-3",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "bg-destructive-bg text-destructive hover:bg-destructive hover:text-background",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-4",
        sm: "h-9 gap-1.5 px-3 text-sm before:absolute before:-inset-1",
        lg: "h-12 gap-2 px-5",
        icon: "size-11",
        "icon-sm": "size-9 before:absolute before:-inset-1",
        "icon-xs":
          "size-7 rounded-chip before:absolute before:-inset-2 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
