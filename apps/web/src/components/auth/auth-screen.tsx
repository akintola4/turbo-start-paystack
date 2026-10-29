import type { ReactNode } from "react";

import { AuthPanel } from "@/components/auth/auth-panel";
import { Wordmark } from "@/components/primitives";

/**
 * The frame every auth page shares. On desktop the page is exactly one
 * screen tall: the form column scrolls if it must, and the panel sizes its
 * art from the space it has, so neither ever pushes the page past the fold.
 */
export function AuthScreen({
  title,
  description,
  variant,
  currency,
  children,
  footer,
}: {
  title: ReactNode;
  description: ReactNode;
  /** Which page the panel speaks to. */
  variant: "sign-in" | "sign-up";
  /** The visitor's likely currency, for the panel's lit tile. */
  currency?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <div className="flex flex-col px-4 py-6 sm:px-10 sm:py-8 lg:overflow-y-auto">
        <Wordmark className="self-start" />
        <main
          className="flex flex-1 items-center py-12 outline-none"
          id="content"
          tabIndex={-1}
        >
          <div className="mx-auto grid w-full max-w-sm gap-8">
            <div className="grid gap-2">
              <h1 className="text-balance font-display font-semibold text-[32px] leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
                {title}
              </h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
            {children}
            {footer}
          </div>
        </main>
      </div>
      <AuthPanel currency={currency} variant={variant} />
    </div>
  );
}
