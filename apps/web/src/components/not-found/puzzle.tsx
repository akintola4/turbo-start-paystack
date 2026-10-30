"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@workspace/tailwind-config/utils";
import { HouseIcon } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { NUMBER_TIMING } from "@/components/animated-number";
import { MOTION_QUERIES } from "@/lib/gsap";
import {
  inPlace,
  isSolved,
  neighbours,
  type PuzzleBoard,
  SOLVED,
  shuffleMoves,
  slide,
} from "@/lib/not-found";

/** The eight pieces in solved order: 404 on top, the currencies below. */
const PIECES = [
  { glyph: "4", word: "4", digit: true },
  { glyph: "0", word: "0", digit: true },
  { glyph: "4", word: "4", digit: true },
  { glyph: "₦", word: "naira", code: "NGN" },
  { glyph: "₵", word: "cedi", code: "GHS" },
  { glyph: "R", word: "rand", code: "ZAR" },
  { glyph: "KSh", word: "shilling", code: "KES" },
  { glyph: "$", word: "dollar", code: "USD" },
] as const;

/** Where a tile goes, keyed by (gap cell − tile cell). */
const DIRECTION: Record<number, string> = {
  [-3]: "up",
  3: "down",
  [-1]: "left",
  1: "right",
};

const STEP_MS = 110;

/** The tile's place on the board, as a translate in tile widths. */
const place = (cell: number) =>
  ({
    "--x": cell % 3,
    "--y": Math.floor(cell / 3),
  }) as React.CSSProperties;

/**
 * The 404's puzzle: a 3 x 3 board of the landing's currency tiles. The
 * server sends it solved, with the home tile in its corner, so without
 * JavaScript it is simply a link home. On load the home tile lifts out and
 * the board shuffles itself in a dozen quick slides (seeded by the path),
 * which shows the goal. Sliding it back returns the home tile and focuses it.
 * Tiles slide by click, tap or arrow keys; moves are announced politely.
 */
export function Puzzle({ path }: { path: string }) {
  const [board, setBoard] = useState<PuzzleBoard>(SOLVED);
  const [phase, setPhase] = useState<"intro" | "play" | "solved">("intro");
  const [lifted, setLifted] = useState(false);
  const [moves, setMoves] = useState(0);
  const [said, setSaid] = useState("");
  const home = useRef<HTMLAnchorElement>(null);

  // Shuffle: a fixed sequence of legal slides seeded by the path, played
  // quickly (or applied at once under reduced motion).
  useEffect(() => {
    const steps = shuffleMoves(path);
    const instant = window.matchMedia(MOTION_QUERIES.reduce).matches;
    const run = (b: PuzzleBoard, cell: number) => slide(b, cell) ?? b;
    if (instant) {
      setBoard(steps.reduce(run, SOLVED));
      setPhase("play");
      return;
    }
    const start = 760;
    const ids: number[] = [];
    ids.push(window.setTimeout(() => setLifted(true), start - 220));
    steps.forEach((cell, i) => {
      ids.push(
        window.setTimeout(
          () => setBoard((b) => run(b, cell)),
          start + i * STEP_MS
        )
      );
    });
    ids.push(
      window.setTimeout(
        () => setPhase("play"),
        start + steps.length * STEP_MS + 120
      )
    );
    return () => {
      for (const t of ids) {
        window.clearTimeout(t);
      }
    };
  }, [path]);

  const gap = board.indexOf(null);
  const movable = new Set(phase === "play" ? neighbours(gap) : []);
  const placed = inPlace(board);
  // The home tile sits in the gap only when the board is whole.
  const homeShown = phase === "solved" || (phase === "intro" && !lifted);

  const move = (cell: number) => {
    if (!movable.has(cell)) {
      return;
    }
    const nextBoard = slide(board, cell);
    if (!nextBoard) {
      return;
    }
    const piece = PIECES[board[cell] as number];
    setBoard(nextBoard);
    setMoves((m) => m + 1);
    if (isSolved(nextBoard)) {
      setPhase("solved");
      setSaid("Solved. The home tile is back. Press it to go home.");
      // Focus follows the found tile once it has landed.
      window.setTimeout(() => home.current?.focus(), 260);
      return;
    }
    setSaid(
      `Moved ${piece?.word} ${DIRECTION[gap - cell]}. ${inPlace(nextBoard)} of 8 in place.`
    );
  };

  // Arrow keys slide the tile on that side of the gap toward it.
  const onKeyDown = (e: KeyboardEvent) => {
    const from: Record<string, number> = {
      ArrowUp: gap + 3,
      ArrowDown: gap - 3,
      ArrowLeft: gap % 3 < 2 ? gap + 1 : -1,
      ArrowRight: gap % 3 > 0 ? gap - 1 : -1,
    };
    const cell = from[e.key];
    if (cell === undefined) {
      return;
    }
    e.preventDefault();
    if (cell >= 0 && cell < 9) {
      move(cell);
    }
  };

  return (
    <div className="@container grid w-full gap-4">
      <div className="flex items-center justify-between gap-4 text-[13px] text-panel-muted">
        <p className="flex items-baseline gap-1.5">
          Moves
          <NumberFlow
            className="font-semibold text-[15px] text-panel-foreground tabular-nums"
            value={moves}
            {...NUMBER_TIMING.count}
          />
        </p>
        <p className="flex items-baseline gap-1.5">
          In place
          <span className="font-semibold text-[15px] text-panel-foreground tabular-nums">
            <NumberFlow value={placed} {...NUMBER_TIMING.count} />
            <span className="text-panel-muted"> / 8</span>
          </span>
        </p>
      </div>

      <fieldset
        aria-describedby="puzzle-help"
        className="puzzle relative m-0 w-full min-w-0 border-0 bg-[var(--forest-950)]"
        data-phase={phase}
        onKeyDown={onKeyDown}
      >
        <legend className="sr-only">Sliding puzzle</legend>
        <div className="relative aspect-square w-full">
          {board.map((tile, cell) => {
            if (tile === null) {
              return null;
            }
            const piece = PIECES[tile] as (typeof PIECES)[number];
            const can = movable.has(cell);
            const dir = DIRECTION[gap - cell];
            return (
              <button
                aria-disabled={!can}
                aria-label={
                  can ? `${piece.word}, slide ${dir}` : `${piece.word}`
                }
                className={cn(
                  "puzzle-tile pressable pressable-sm",
                  "digit" in piece ? "is-digit" : "is-currency",
                  can && "is-movable"
                )}
                data-tile={tile}
                key={tile}
                onClick={() => move(cell)}
                style={place(cell)}
                tabIndex={can ? 0 : -1}
                type="button"
              >
                <span
                  className={cn(
                    "currency-glyph",
                    piece.glyph === "KSh" && "text-[0.6em]"
                  )}
                  data-glyph={"code" in piece ? piece.code : undefined}
                >
                  {piece.glyph}
                </span>
              </button>
            );
          })}
          <Link
            aria-hidden={!homeShown}
            className="puzzle-tile puzzle-home pressable pressable-sm"
            data-shown={homeShown ? "" : undefined}
            href="/"
            ref={home}
            style={place(8)}
            tabIndex={homeShown ? 0 : -1}
          >
            <HouseIcon
              aria-hidden
              className="size-[0.6em]"
              strokeWidth={2.25}
            />
            <span className="font-semibold text-[max(13px,0.32em)]">Home</span>
          </Link>
        </div>
      </fieldset>

      <p className="text-[13px] text-panel-muted" id="puzzle-help">
        {phase === "solved"
          ? "Found it. The home tile is back."
          : "Tap a tile next to the gap, or use the arrow keys."}
      </p>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
