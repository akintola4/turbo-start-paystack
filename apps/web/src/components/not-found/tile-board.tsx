"use client";

import { CURRENCIES, type Currency } from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import { MousePointer2Icon } from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  useRef,
  useState,
} from "react";

import { opticalEdge } from "@/components/landing/display";
import { type OptionProps, PathChip } from "@/components/not-found/parts";
import { gsap, MOTION_QUERIES, useGSAP } from "@/lib/gsap";
import { currencyMeta } from "@/lib/landing";
import {
  BOARD_COLS,
  BOARD_ROWS,
  boardPixels,
  boardStep,
} from "@/lib/not-found";

const TITLE = "This page isn’t in the ledger.";
const PIXELS = boardPixels();
const COUNT = BOARD_COLS * BOARD_ROWS;
/** Pointer trail: how long a tile stays lit after the pointer leaves it. */
const TRAIL_MS = 420;
/** Then it fades back over this long (matches the CSS). */
const FADE_MS = 520;

const next = (c: Currency): Currency =>
  CURRENCIES[(CURRENCIES.indexOf(c) + 1) % CURRENCIES.length] as Currency;

/** Off tiles hide a currency each, spread so no two neighbours match. */
function initialFaces(currency: Currency): Currency[] {
  return Array.from({ length: COUNT }, (_, i) => {
    if (PIXELS[i]) {
      return currency;
    }
    const x = i % BOARD_COLS;
    const y = Math.floor(i / BOARD_COLS);
    return CURRENCIES[(x * 2 + y * 3) % CURRENCIES.length] as Currency;
  });
}

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One tile. Its colour comes from CSS: checker, "404" pixel, lit, cursor. */
function BoardTile({
  index,
  code,
  revealed,
  cursor,
  ref,
}: {
  index: number;
  code: Currency;
  revealed: boolean;
  cursor: boolean;
  ref: Ref<HTMLDivElement>;
}) {
  const x = index % BOARD_COLS;
  const y = Math.floor(index / BOARD_COLS);
  const pixel = PIXELS[index];
  const { glyph } = currencyMeta(code);
  return (
    <div
      aria-hidden
      className={cn(
        "board-tile",
        pixel && "is-pixel",
        (x + y) % 2 === 1 && "is-dim",
        revealed && "is-revealed",
        cursor && "is-cursor"
      )}
      data-cell={index}
      data-col={x}
      data-pixel={pixel ? "" : undefined}
      ref={ref}
    >
      <span
        className={cn(
          "currency-glyph board-glyph",
          glyph === "KSh" && "is-wide"
        )}
        data-glyph={code}
      >
        {glyph}
      </span>
    </div>
  );
}

/**
 * Option A: "404" drawn in sunflower tiles on a checker board of the hero's
 * currency tiles. The pointer leaves a short trail that shows the currency
 * under each tile; a click flips a tile to the next currency and nudges its
 * neighbours. From the keyboard, a sunflower tile moves with the arrows and
 * Enter flips the tile under it.
 */
export function TileBoard({ path, shown, currency }: OptionProps) {
  const root = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  const timers = useRef(new Map<number, number>());
  const [faces, setFaces] = useState(() => initialFaces(currency));
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    new Array(COUNT).fill(false)
  );
  const [cursor, setCursor] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const lastCursor = useRef(3 * BOARD_COLS);

  // One entrance: the pixels flip up column by column. The CSS hides them
  // before hydration only when this will run (motion allowed, scripting on).
  useGSAP(
    () => {
      const board = root.current?.querySelector<HTMLElement>("[data-board]");
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES, (ctx) => {
        board?.setAttribute("data-ready", "");
        if (!ctx.conditions?.motion) {
          return;
        }
        const pixels = gsap.utils.toArray<HTMLElement>("[data-pixel]");
        gsap.fromTo(
          pixels,
          { opacity: 0, rotateX: -90, transformPerspective: 500 },
          {
            opacity: 1,
            rotateX: 0,
            duration: 0.7,
            ease: "expo.out",
            delay: 0.1,
            stagger: (i, el: HTMLElement) =>
              Number(el.dataset.col) * 0.045 + (i % 5) * 0.012,
            clearProps: "transform,opacity",
          }
        );
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  const flip = (i: number) => {
    setFaces((f) => f.map((c, j) => (j === i ? next(c) : c)));
    setRevealed((r) => r.map((v, j) => v || j === i));
    if (reduced()) {
      return;
    }
    tiles.current[i]?.animate(
      [
        { transform: "perspective(500px) rotateX(-100deg)" },
        { transform: "perspective(500px) rotateX(0deg)" },
      ],
      { duration: 360, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
    const x = i % BOARD_COLS;
    const y = Math.floor(i / BOARD_COLS);
    tiles.current.forEach((el, j) => {
      const d = Math.hypot(
        (j % BOARD_COLS) - x,
        Math.floor(j / BOARD_COLS) - y
      );
      if (el && j !== i && d < 2.9) {
        el.animate([{ scale: 1 }, { scale: 0.86 }, { scale: 1 }], {
          duration: 340,
          delay: d * 45,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        });
      }
    });
  };

  const light = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") {
      return;
    }
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!el) {
      return;
    }
    const i = Number(el.dataset.cell);
    el.removeAttribute("data-fade");
    el.setAttribute("data-lit", "");
    window.clearTimeout(timers.current.get(i));
    timers.current.set(
      i,
      window.setTimeout(() => {
        el.removeAttribute("data-lit");
        el.setAttribute("data-fade", "");
        timers.current.set(
          i,
          window.setTimeout(() => el.removeAttribute("data-fade"), FADE_MS)
        );
      }, TRAIL_MS)
    );
  };

  const announce = (i: number) => {
    const meta = currencyMeta(faces[i] as Currency);
    const row = Math.floor(i / BOARD_COLS) + 1;
    const col = (i % BOARD_COLS) + 1;
    setSaid(
      `Row ${row}, column ${col}${PIXELS[i] ? ", part of 404" : ""}: ${meta.word}`
    );
  };

  // Keyboard: arrows move the cursor tile (instantly; keyboard moves are
  // never animated), Enter or Space flips the tile under it.
  const onKeyDown = (e: KeyboardEvent) => {
    const at = cursor ?? lastCursor.current;
    const to = boardStep(at, e.key);
    if (to !== undefined) {
      e.preventDefault();
      if (to !== null) {
        setCursor(to);
        lastCursor.current = to;
        announce(to);
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip(at);
      const meta = currencyMeta(next(faces[at] as Currency));
      setSaid(`Flipped to ${meta.word}`);
    }
  };

  return (
    <div
      className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,46rem)] lg:gap-16"
      ref={root}
    >
      <div className="grid justify-items-start gap-6">
        <h1 className="display-l max-w-[16ch]" style={opticalEdge(TITLE)}>
          {TITLE}
        </h1>
        <p className="max-w-[32rem] text-pretty text-[17px] text-panel-muted">
          Nothing is filed under <PathChip path={path} shown={shown} />. The
          link may be old, or it has a typo.
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

      <div className="grid gap-3">
        <div
          aria-describedby="board-hint"
          aria-label="404, drawn in currency tiles"
          aria-roledescription="tile board"
          className="tile-board @container grid touch-manipulation select-none rounded-card outline-offset-4"
          data-board
          onBlur={() => setCursor(null)}
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-cell]"
            );
            if (el) {
              flip(Number(el.dataset.cell));
            }
          }}
          onFocus={(e) => {
            if (e.target.matches(":focus-visible")) {
              setCursor(lastCursor.current);
              announce(lastCursor.current);
            }
          }}
          onKeyDown={onKeyDown}
          onPointerOver={light}
          role="application"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
          }}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the board is one keyboard control (arrows move a cursor, Enter flips); its tiles are not separate tab stops.
          tabIndex={0}
        >
          {faces.map((code, i) => (
            <BoardTile
              code={code}
              cursor={cursor === i}
              index={i}
              key={i}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              revealed={revealed[i] ?? false}
            />
          ))}
        </div>
        <p
          className="flex items-center gap-2 text-[13px] text-panel-muted"
          id="board-hint"
        >
          <MousePointer2Icon aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="pointer-coarse:hidden">Point at the board. </span>
            Tap a tile to flip its currency, or focus the board and use the
            arrow keys.
          </span>
        </p>
        <p aria-live="polite" className="sr-only">
          {said}
        </p>
      </div>
    </div>
  );
}
