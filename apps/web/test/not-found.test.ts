import { describe, expect, it } from "vitest";

import {
  displayPath,
  inPlace,
  isSolved,
  neighbours,
  SOLVED,
  shuffleMoves,
  slide,
} from "../src/lib/not-found";

describe("displayPath", () => {
  it("decodes escapes and keeps short paths whole", () => {
    expect(displayPath("/caf%C3%A9")).toBe("/café");
  });

  it("leaves a malformed escape as typed", () => {
    expect(displayPath("/bad%E0%A4%A")).toBe("/bad%E0%A4%A");
  });

  it("drops control characters", () => {
    expect(displayPath("/a%0Ab")).toBe("/ab");
  });

  it("cuts long paths in the middle, keeping both ends", () => {
    const long = `/start/${"x".repeat(80)}/the-end`;
    const shown = displayPath(long, 44);
    expect(shown).toHaveLength(44);
    expect(shown.startsWith("/start/")).toBe(true);
    expect(shown.endsWith("the-end")).toBe(true);
    expect(shown).toContain("…");
  });

  it("returns markup as text for React to escape", () => {
    expect(displayPath("/%3Cscript%3E")).toBe("/<script>");
  });
});

describe("sliding puzzle", () => {
  it("lists the cells next to a cell", () => {
    expect(neighbours(4).sort()).toEqual([1, 3, 5, 7]);
    expect(neighbours(0).sort()).toEqual([1, 3]);
  });

  it("slides only a tile that touches the gap", () => {
    expect(slide(SOLVED, 7)).toEqual([0, 1, 2, 3, 4, 5, 6, null, 7]);
    expect(slide(SOLVED, 0)).toBeNull();
  });

  it("shuffles deterministically into an unsolved, solvable board", () => {
    const moves = shuffleMoves("/missing");
    expect(shuffleMoves("/missing")).toEqual(moves);
    const board = moves.reduce((b, cell) => slide(b, cell) ?? b, SOLVED);
    expect(isSolved(board)).toBe(false);
    // Undoing the slides in reverse order solves it, so it is solvable.
    let back = board;
    let gap = SOLVED.indexOf(null);
    const gaps = [gap];
    for (const cell of moves) {
      gaps.push(cell);
      gap = cell;
    }
    for (let i = moves.length - 1; i >= 0; i--) {
      back = slide(back, gaps[i] as number) ?? back;
    }
    expect(isSolved(back)).toBe(true);
    expect(inPlace(SOLVED)).toBe(8);
  });
});
