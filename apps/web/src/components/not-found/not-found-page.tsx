"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { opticalEdge } from "@/components/landing/display";
import { Puzzle } from "@/components/not-found/puzzle";
import { Panel, Wordmark } from "@/components/primitives";
import { fileUrl, REPO } from "@/lib/landing";
import { displayPath } from "@/lib/not-found";

const TITLE = "This page isn’t in the ledger.";

/** The path chip never wraps: 28 mono characters fit a 300px screen. */
const PATH_MAX = 28;

/**
 * The site's 404: the landing's forest panel with the copy on the left and
 * the lost-tile puzzle on the right (stacked, copy first, up to 768px).
 * The requested path is shown decoded and middle-truncated; React escapes it.
 */
export function NotFoundPage() {
  const path = usePathname() ?? "/";

  return (
    <div className="flex min-h-dvh flex-col pt-(--edge)">
      <Panel as="div" className="landing-bleed flex flex-1 flex-col p-0 sm:p-0">
        <div className="landing-inner flex flex-1 flex-col pb-(--gut)">
          <header className="flex items-center justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
            <Wordmark className="text-panel-foreground" />
            <a
              className={cn(
                buttonVariants(),
                "bg-panel-tile text-panel-foreground hover:bg-panel-line"
              )}
              href={REPO}
            >
              GitHub
            </a>
          </header>
          <main
            className="grid flex-1 content-center items-center gap-10 py-[clamp(24px,5vh,64px)] min-[769px]:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] min-[769px]:gap-12 lg:gap-16"
            id="content"
          >
            <div className="grid justify-items-start gap-6">
              <h1 className="display-l max-w-[16ch]" style={opticalEdge(TITLE)}>
                {TITLE}
              </h1>
              <p className="max-w-[32rem] text-pretty text-[17px] text-panel-muted">
                Nothing is filed under{" "}
                <code
                  className="whitespace-nowrap rounded-chip bg-panel-tile px-1.5 py-0.5 font-mono text-[0.86em] text-panel-foreground"
                  title={path}
                >
                  {displayPath(path, PATH_MAX)}
                </code>
                . The link may be old, or it has a typo.
              </p>
              <div className="grid w-full gap-2.5 min-[420px]:flex min-[420px]:w-auto min-[420px]:flex-wrap">
                <Link className={buttonVariants({ size: "lg" })} href="/">
                  Back home
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-panel-tile text-panel-foreground hover:bg-panel-line"
                  )}
                  href="/#start"
                >
                  Clone the starter
                </Link>
              </div>
            </div>
            <Puzzle path={path} />
          </main>
        </div>
      </Panel>
      <footer className="landing-section flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 text-[13px] text-muted-foreground">
        <p>
          Turbo Start Paystack ·{" "}
          <a
            className="pressable pressable-sm rounded-chip underline-offset-4 hover:text-foreground hover:underline"
            href={fileUrl("LICENSE")}
          >
            MIT licence
          </a>
        </p>
        <p>Not affiliated with Paystack.</p>
      </footer>
    </div>
  );
}
