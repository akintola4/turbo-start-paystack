import { cn } from "@workspace/tailwind-config/utils";

import { GLYPHS, MOSAIC } from "@/components/primitives";

export type AuthPanelProps = {
  /** Which page the panel sits beside. */
  variant: "sign-in" | "sign-up";
  /** The visitor's likely currency (ISO code); its tile takes sunflower. */
  currency?: string;
};

/** The first tile of a currency in the reference grid. */
function tileOf(currency: string) {
  const glyph = GLYPHS.findIndex((g) => g.code === currency);
  return Math.max(0, MOSAIC.indexOf(glyph));
}

/**
 * The auth pages' side panel (desktop only): the reference grid on the
 * forest island, with one sunflower tile. The grid lives in a CSS size
 * container and is sized by min(width, height) of the space it has
 * (`.auth-art` / `.auth-mosaic` in globals.css), so it can't push the page
 * past the fold on wide-short screens or leave a hole on tall ones.
 *
 * This component is the whole slot: AuthScreen renders it as the second
 * grid column and passes only these props, so a new design can replace
 * its body without touching the auth pages.
 */
export function AuthPanel({ variant, currency = "NGN" }: AuthPanelProps) {
  const lit = variant === "sign-up" ? tileOf(currency) : 0;
  return (
    <aside
      aria-hidden
      className="dark relative hidden min-h-0 overflow-hidden p-10 lg:m-3 lg:grid lg:rounded-panel"
      data-auth-panel
      data-surface="panel"
    >
      <div className="auth-art">
        <div className="auth-mosaic">
          {MOSAIC.map((g, i) => {
            const item = GLYPHS[g];
            return (
              <div
                className={cn(
                  "flex select-none items-center justify-center font-bold font-money",
                  i === lit
                    ? "bg-highlight text-highlight-foreground"
                    : "bg-panel-tile text-panel-foreground"
                )}
                data-glyph={item?.glyph}
                key={`${item?.code}-${i}`}
              >
                {item?.glyph}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
