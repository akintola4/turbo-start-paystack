/** Pure helpers for the 404 page, kept here so they can be unit tested. */

/**
 * The requested path as a reader should see it: decoded where that is safe,
 * and cut in the middle when long, so the start and the end both survive.
 * React escapes the result; nothing here builds HTML.
 */
export function displayPath(raw: string, max = 44): string {
  let path = raw || "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    // A malformed escape (e.g. "%E0%A4%A") stays as typed.
  }
  // Control characters would render as nothing or as boxes.
  path = path.replace(/\p{Cc}/gu, "");
  if (path.length <= max) {
    return path;
  }
  const tail = Math.floor((max - 1) / 3);
  return `${path.slice(0, max - 1 - tail)}…${path.slice(-tail)}`;
}

/** A 32-bit FNV-1a hash: stable between server and client renders. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

/** A small deterministic PRNG (mulberry32) seeded from a string. */
function seeded(seed: string): () => number {
  let s = hash(seed);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------- sliding puzzle */

/**
 * The board is 9 cells. `board[cell]` is the tile in that cell, or null for
 * the gap. Tiles 0-7 are the pieces; solved is [0..7, null].
 */
export type PuzzleBoard = (number | null)[];

export const SOLVED: PuzzleBoard = [0, 1, 2, 3, 4, 5, 6, 7, null];

/** Cells next to `cell` on a 3 x 3 board. */
export function neighbours(cell: number): number[] {
  const x = cell % 3;
  const y = Math.floor(cell / 3);
  const out: number[] = [];
  if (y > 0) {
    out.push(cell - 3);
  }
  if (y < 2) {
    out.push(cell + 3);
  }
  if (x > 0) {
    out.push(cell - 1);
  }
  if (x < 2) {
    out.push(cell + 1);
  }
  return out;
}

/** Slides the tile in `cell` into the gap, if they touch. */
export function slide(board: PuzzleBoard, cell: number): PuzzleBoard | null {
  const gap = board.indexOf(null);
  if (!neighbours(gap).includes(cell)) {
    return null;
  }
  const next = [...board];
  next[gap] = board[cell] ?? null;
  next[cell] = null;
  return next;
}

export function isSolved(board: PuzzleBoard): boolean {
  return board.every((t, i) => t === SOLVED[i]);
}

/** How many tiles sit in their home cell. */
export function inPlace(board: PuzzleBoard): number {
  return board.filter((t, i) => t !== null && t === i).length;
}

/**
 * A shuffle made of `moves` legal slides from solved (so it is always
 * solvable), never undoing the previous slide, seeded by the path so the
 * server and the client agree. Returns the cells slid, in order.
 */
export function shuffleMoves(seed: string, moves = 12): number[] {
  const rand = seeded(seed);
  let board = [...SOLVED];
  let previousGap = -1;
  const out: number[] = [];
  for (let i = 0; i < moves; i++) {
    const gap = board.indexOf(null);
    const options = neighbours(gap).filter((c) => c !== previousGap);
    const cell = options[Math.floor(rand() * options.length)] as number;
    board = slide(board, cell) as PuzzleBoard;
    out.push(cell);
    previousGap = gap;
  }
  // A shuffle that lands back on solved would be no puzzle at all.
  if (isSolved(board)) {
    return shuffleMoves(`${seed}+`, moves);
  }
  return out;
}
