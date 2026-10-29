import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@workspace/tailwind-config/utils";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control border border-transparent font-semibold text-[15px] outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid pressable disabled:pointer-events-none disabled:opacity-50 data-pending:disabled:opacity-100 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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

/**
 * `pending` (when passed at all) keeps the label in its place and fades it
 * out under a centred spinner, so the button never changes width or shifts
 * its text when a request starts. It also disables the button and sets
 * aria-busy.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  pending,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
    children?: ReactNode;
  }) {
  return (
    <ButtonPrimitive
      aria-busy={pending || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      data-pending={pending || undefined}
      data-slot="button"
      disabled={disabled || pending}
      {...props}
    >
      {pending === undefined ? (
        children
      ) : (
        <>
          <span
            className={cn(
              "inline-flex items-center justify-center gap-[inherit] transition-opacity duration-(--dur-fast)",
              pending && "opacity-0"
            )}
          >
            {children}
          </span>
          {pending ? (
            <Loader2Icon
              aria-hidden
              className="absolute inset-0 m-auto animate-spin motion-reduce:animate-none"
            />
          ) : null}
        </>
      )}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
