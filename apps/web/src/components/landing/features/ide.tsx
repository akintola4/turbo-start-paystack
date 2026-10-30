"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { ArrowUpRightIcon, FileCodeIcon, GitBranchIcon } from "lucide-react";
import {
  Fragment,
  type ReactNode,
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

/** Two-digit index: 01, 02… */
const nth = (i: number) => String(i + 1).padStart(2, "0");

/** The file name, without its folders. */
const fileName = (path: string) => path.split("/").at(-1) ?? path;

/** An excerpt with line numbers. `typing` types each line in, top down. */
function CodeLines({ feature, typing }: { feature: Feature; typing: boolean }) {
  const lines = feature.code.split("\n");
  return (
    <pre className="overflow-x-auto px-5 py-5 font-mono text-(--code-text) text-[14px] leading-[22px]">
      <code className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
        {lines.map((line, i) => (
          <Fragment key={`${feature.id}-${i}`}>
            <span aria-hidden className="select-none text-(--code-gutter)">
              {i + 1}
            </span>
            <span
              className={cn("whitespace-pre", typing && "animate-type-line")}
              style={typing ? { animationDelay: `${i * 24}ms` } : undefined}
            >
              {highlight(line)}
            </span>
          </Fragment>
        ))}
      </code>
    </pre>
  );
}

/** Window chrome on the code surface, dark in both themes. */
const BAR =
  "flex h-11 items-center justify-between gap-3 border-(--code-ring) border-b px-5 font-mono text-(--code-comment) text-[13px]";

/*
 * Every file's panel sits in one grid cell, so the editor is always as tall
 * as the tallest and switching never moves the page. Without JavaScript the
 * tree hides and the files stack in order.
 */
const SAME_CELL =
  "[@media(scripting:enabled)]:col-start-1 [@media(scripting:enabled)]:row-start-1";

/**
 * The features proof: the repo open in one editor. The file tree is the tab
 * list (one highlight slides between rows on a transform); picking a file
 * types its excerpt in and the preview pane beside it runs the demo.
 *
 * Every panel sits in one grid cell, so the editor is as tall as the tallest
 * and switching never moves the page. Panels swap visibility in one frame
 * (no fade on the panel itself: a panel fading in over the editor showed the
 * dark editor through the light preview); only the new content fades, over
 * an already opaque pane. Without JavaScript the tree hides and every file
 * stacks, code over preview.
 */
export function FeatureIde() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(false);
  const [y, setY] = useState<{ top: number; height: number } | null>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    const measure = () => {
      const el = rows.current[index];
      if (el) {
        setY({ top: el.offsetTop, height: el.offsetHeight });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    const list = rows.current[0]?.parentElement;
    if (list) {
      ro.observe(list);
    }
    return () => ro.disconnect();
  }, [index]);

  const pick = (i: number) => {
    setTyped(true);
    setIndex(i);
  };

  return (
    <div className="grid overflow-hidden rounded-tile bg-(--code-bg) text-(--code-text) shadow-[0_0_0_1px_var(--code-ring)] lg:[@media(scripting:enabled)]:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="grid content-start border-(--code-ring) max-lg:border-b lg:border-r no-js:hidden">
        <div className={BAR}>
          <span className="flex items-center gap-2">
            <GitBranchIcon aria-hidden className="size-3.5" />
            main
          </span>
          <span>6 files</span>
        </div>
        <div
          aria-label="Features"
          className="relative flex gap-1 overflow-x-auto overscroll-x-contain p-2 [scrollbar-width:none] lg:grid lg:overflow-visible"
          onKeyDown={(e) => {
            const next = nextRadioIndex(e, index, FEATURES.length);
            if (next !== null) {
              pick(next);
              rows.current[next]?.focus();
            }
          }}
          role="tablist"
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 right-2 left-2 rounded-card bg-(--code-ring) transition-transform duration-(--dur-thumb) ease-(--motion-ease-out) motion-reduce:transition-none max-lg:hidden",
              !y && "opacity-0"
            )}
            style={
              y
                ? { height: y.height, transform: `translateY(${y.top}px)` }
                : undefined
            }
          />
          {FEATURES.map((f, i) => {
            const on = i === index;
            return (
              <button
                aria-controls={`ide-${f.id}`}
                aria-selected={on}
                className={cn(
                  "pressable pressable-lg relative grid shrink-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-card px-3 py-2.5 text-left transition-colors duration-(--dur-fast)",
                  on
                    ? "text-(--code-text) max-lg:bg-(--code-ring)"
                    : "text-(--code-comment) hover:text-(--code-text)",
                  on && !y && "lg:bg-(--code-ring)"
                )}
                id={`ide-tab-${f.id}`}
                key={f.id}
                onClick={() => pick(i)}
                ref={(el) => {
                  rows.current[i] = el;
                }}
                role="tab"
                tabIndex={on ? 0 : -1}
                type="button"
              >
                {/* 20px line, 16px icon: 2px down centres it on the line. */}
                <FileCodeIcon aria-hidden className="mt-0.5 size-4" />
                <span className="truncate font-mono text-[14px] leading-5">
                  {fileName(f.path)}
                </span>
                <span className="col-start-2 truncate text-(--code-gutter) text-[13px] leading-5 max-lg:hidden">
                  {f.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid">
        {FEATURES.map((f, i) => {
          const Demo = DEMOS[f.id];
          const on = i === index;
          return (
            <div
              aria-labelledby={`ide-tab-${f.id}`}
              className={cn(
                "grid min-w-0 2xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]",
                SAME_CELL,
                !on && "[@media(scripting:enabled)]:invisible",
                i > 0 && "no-js:border-(--code-ring) no-js:border-t"
              )}
              id={`ide-${f.id}`}
              inert={on ? undefined : true}
              key={f.id}
              role="tabpanel"
            >
              <div className="grid min-w-0 content-start">
                <div className={BAR}>
                  <span className="min-w-0 truncate">{f.path}</span>
                  <a
                    className="pressable pressable-sm relative inline-flex shrink-0 items-center gap-1 rounded-chip font-medium hover:text-(--code-text) before:absolute before:-inset-x-2 before:-inset-y-3"
                    href={fileUrl(f.path)}
                  >
                    Read the file
                    <ArrowUpRightIcon aria-hidden className="size-3.5" />
                  </a>
                </div>
                <CodeLines
                  feature={f}
                  key={on && typed ? `typed-${f.id}` : f.id}
                  typing={on && typed}
                />
              </div>
              {/* The preview pane: page colours, a browser beside the editor. */}
              <section
                aria-label={`${f.title}, working`}
                className="grid grid-rows-[auto_1fr] bg-card text-card-foreground max-2xl:border-(--code-ring) max-2xl:border-t"
              >
                {/* A browser bar: the pane is a page running beside the editor. */}
                <div className="flex h-11 items-center gap-2 border-border border-b px-5 font-mono text-[13px] text-muted-foreground">
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-success"
                  />
                  localhost:3300
                </div>
                <div
                  className={cn(
                    "grid content-center gap-6 p-6 sm:p-8",
                    on && typed && "animate-content"
                  )}
                  key={on && typed ? `shown-${f.id}` : f.id}
                >
                  <div className="grid gap-2">
                    <span className="font-mono text-[13px] text-muted-foreground uppercase tracking-[0.02em]">
                      Preview · {nth(i)}
                    </span>
                    <h3 className="font-medium text-[24px] leading-tight tracking-[-0.025em]">
                      {f.title}
                    </h3>
                    <p className="text-pretty text-[18px] text-muted-foreground leading-[1.45]">
                      {f.short}
                    </p>
                  </div>
                  <Demo />
                </div>
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
}
