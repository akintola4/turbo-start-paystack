"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { ArrowUpRightIcon } from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { FEATURES, type Feature } from "@/components/landing/features/data";
import { DEMOS } from "@/components/landing/features/demos";
import { nextRadioIndex } from "@/components/landing/radio";
import { fileUrl } from "@/lib/landing";

const TOKEN =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*")|\b(const|let|await|async|function|return|if|throw|new|export|try|catch|for|of)\b|\b(\d[\d_]*)\b/g;

/** Tiny highlighter for the excerpts: comments, strings, keywords, numbers.
 *  The code surface is dark in both themes, so its colours are fixed
 *  (`--code-*` in globals.css), not the theme's semantic tokens. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) {
      out.push(line.slice(last, i));
    }
    const [text, comment, string, keyword] = m;
    const cls = comment
      ? "text-(--code-comment)"
      : string
        ? "text-(--code-string)"
        : keyword
          ? "text-(--code-keyword)"
          : "text-(--code-number)";
    out.push(
      <span className={cls} data-token key={i}>
        {text}
      </span>
    );
    last = i + text.length;
  }
  if (last < line.length) {
    out.push(line.slice(last));
  }
  return out;
}

function featureAt(index: number): Feature {
  const feature = FEATURES[index];
  if (!feature) {
    throw new Error(`No feature at index ${index}`);
  }
  return feature;
}

type Box = { x: number; y: number; w: number; h: number };

/** Header bar shared by the code and the demo, so both start on one line. */
const BAR = "flex h-12 items-center justify-between gap-3 border-b px-5";

/**
 * "Code + outcome": one tab per feature, captioned with its file. Each tab
 * pairs a real excerpt from that file with the thing it produces, working.
 * One indicator slides to the active tab (transform only); on phones the
 * tabs scroll sideways inside a padded scroller, so the indicator and the
 * press scale are never clipped.
 */
export function CodeOutcome() {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const feature = featureAt(index);

  // Measure the active tab for the indicator, again whenever the row resizes
  // (viewport, late font swap). Paint only, never layout.
  useLayoutEffect(() => {
    const measure = () => {
      const t = tabs.current[index];
      if (t) {
        setBox({
          x: t.offsetLeft,
          y: t.offsetTop,
          w: t.offsetWidth,
          h: t.offsetHeight,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) {
      ro.observe(list.current);
    }
    return () => ro.disconnect();
  }, [index]);

  // Keep the active tab in view when the row scrolls (phones).
  useEffect(() => {
    const sc = scroller.current;
    const t = tabs.current[index];
    if (!(sc && t) || sc.scrollWidth <= sc.clientWidth) {
      return;
    }
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Padding and scroll-padding are equal, so the tab's offset is the target.
    sc.scrollTo({ left: t.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  }, [index]);

  const Demo = DEMOS[feature.id];
  const lines = feature.code.split("\n");

  return (
    <div className="grid gap-4">
      <div
        className="-mx-(--gut) snap-x snap-mandatory scroll-px-(--gut) overflow-x-auto px-(--gut) py-2 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0"
        ref={scroller}
      >
        <div
          aria-label="Features"
          className="relative flex w-max gap-2 lg:grid lg:w-auto lg:grid-cols-6"
          onKeyDown={(e) => {
            const next = nextRadioIndex(e, index, FEATURES.length);
            if (next !== null) {
              setIndex(next);
              tabs.current[next]?.focus({ preventScroll: true });
            }
          }}
          ref={list}
          role="tablist"
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 left-0 rounded-card bg-card shadow-[0_0_0_1px_var(--input)] transition-[translate] duration-(--dur-thumb) ease-(--motion-ease-spring) motion-reduce:transition-none",
              !box && "opacity-0"
            )}
            data-tab-indicator
            style={
              box
                ? {
                    width: box.w,
                    height: box.h,
                    translate: `${box.x}px ${box.y}px`,
                  }
                : undefined
            }
          />
          {FEATURES.map((f, i) => {
            const on = i === index;
            return (
              <button
                aria-controls="feature-panel"
                aria-selected={on}
                className={cn(
                  "pressable pressable-lg relative grid w-[11rem] shrink-0 snap-start grid-rows-[1fr_auto] gap-1 rounded-card px-4 py-3 text-left lg:w-auto",
                  // Until the indicator is measured, the active tab paints its own fill.
                  on && !box && "bg-card shadow-[0_0_0_1px_var(--input)]",
                  !on && "hover:bg-secondary"
                )}
                data-tab={f.id}
                id={`feature-tab-${f.id}`}
                key={f.id}
                onClick={() => setIndex(i)}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                tabIndex={on ? 0 : -1}
                type="button"
              >
                <span
                  className={cn(
                    "line-clamp-2 font-semibold text-[15px] leading-snug transition-colors duration-(--dur-fast)",
                    on ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {f.title}
                </span>
                <span
                  className="truncate font-mono text-muted-foreground text-xs"
                  data-tab-file
                >
                  {f.path.split("/").at(-1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        aria-labelledby={`feature-tab-${feature.id}`}
        className="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:gap-4"
        id="feature-panel"
        role="tabpanel"
      >
        <figure
          className="grid grid-rows-[auto_1fr] overflow-hidden rounded-tile bg-(--code-bg) text-(--code-text) shadow-[0_0_0_1px_var(--code-ring)]"
          data-code
        >
          <figcaption className={cn(BAR, "border-(--code-ring)")}>
            <span className="min-w-0 truncate font-mono text-(--code-comment) text-xs">
              {feature.path}
            </span>
            <a
              className="pressable pressable-sm relative inline-flex shrink-0 items-center gap-1 rounded-chip font-medium text-(--code-comment) text-xs before:absolute before:-inset-x-2 before:-inset-y-3 hover:text-(--code-text)"
              href={fileUrl(feature.path)}
            >
              Read the file
              <ArrowUpRightIcon aria-hidden className="size-3.5" />
            </a>
          </figcaption>
          <pre
            className="animate-content overflow-x-auto px-5 py-4 font-mono text-[13px] leading-6"
            key={feature.id}
          >
            <code className="grid grid-cols-[2rem_minmax(0,1fr)]">
              {lines.map((line, i) => (
                <Fragment key={`${feature.id}-${i}`}>
                  <span
                    aria-hidden
                    className="select-none text-(--code-gutter)"
                  >
                    {i + 1}
                  </span>
                  <span className="whitespace-pre">{highlight(line)}</span>
                </Fragment>
              ))}
            </code>
          </pre>
        </figure>
        <section
          aria-label={`${feature.title}, working`}
          className="grid grid-rows-[auto_1fr] overflow-hidden rounded-tile bg-card shadow-tile"
        >
          <div className={cn(BAR, "border-border")}>
            <h3 className="truncate font-semibold text-[15px]">
              {feature.title}
            </h3>
            <span className="shrink-0 text-muted-foreground text-xs">
              What it does
            </span>
          </div>
          <div className="flex flex-col gap-5 p-5">
            <p className="text-pretty text-[15px] text-muted-foreground">
              {feature.short}
            </p>
            <div className="mt-auto animate-content" key={feature.id}>
              <Demo />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
