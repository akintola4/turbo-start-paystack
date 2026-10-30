/**
 * "Your mark": a 5×5 tile mark drawn deterministically from a string (an
 * email). Pure and DOM-free, so it can be tested and reused (an org's
 * avatar, later). Nothing here sends or stores the input.
 *
 * The mark is mirrored around its centre column. Columns 0–2 hold 15
 * slots; each typed character redraws one slot (slot k is redrawn by
 * characters k, k + 15, …) and its mirror in columns 3–4. Once the input
 * is long enough, exactly one centre-column cell turns sunflower: "yours".
 */

export const GRID = 5;
export const SLOTS = 15;
/** Characters before the sunflower cell appears. */
export const SUN_AFTER = 6;

export type MarkColour = "tile" | "off" | "line" | "ghost" | "sun";
export type Quarter = 0 | 1 | 2 | 3;
export type HalfDir = "up" | "right" | "down" | "left";

export type MarkShape =
  | { kind: "quarter"; q: Quarter; colour: MarkColour }
  | { kind: "half"; dir: HalfDir; colour: MarkColour }
  | { kind: "circle"; colour: MarkColour }
  | { kind: "leaf"; q: 0 | 1; colour: MarkColour }
  | { kind: "glyph"; glyph: string; colour: MarkColour }
  | { kind: "square"; colour: MarkColour };

/** One slot of the mark: null is an undrawn seed dot. */
export type MarkSlot = MarkShape | null;

export const MARK_GLYPHS = ["₦", "₵", "R", "KSh", "$"] as const;

/** FNV-1a, 32-bit. */
export function hash(input: string) {
  let h = 0x81_1c_9d_c5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01_00_01_93);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, [0, 1). */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The order slots are drawn in: [row, column] for columns 0–2, shuffled
 *  once with a fixed seed so every mark builds the same way. */
export const SLOT_ORDER: readonly (readonly [number, number])[] = (() => {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push([r, c]);
    }
  }
  const random = rng(20_251_029);
  // Fisher–Yates, so the order is a fair shuffle.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [
      cells[j] as [number, number],
      cells[i] as [number, number],
    ];
  }
  return cells;
})();

const DIRS: readonly HalfDir[] = ["up", "right", "down", "left"];

function colourFor(x: number): MarkColour {
  if (x < 0.29) {
    return "off";
  }
  return x < 0.8 ? "tile" : "line";
}

/** The shape a seed draws. Never sunflower: that is placed once, later. */
export function shapeFor(seed: number): MarkShape {
  const random = rng(seed);
  const t = random();
  const colour = colourFor(random());
  const dir = DIRS[Math.floor(random() * 4)] ?? "up";
  const q = Math.floor(random() * 4) as Quarter;
  if (t < 0.24) {
    return { kind: "quarter", q, colour };
  }
  if (t < 0.42) {
    return { kind: "half", dir, colour };
  }
  if (t < 0.54) {
    return { kind: "circle", colour: colour === "line" ? "ghost" : colour };
  }
  if (t < 0.66) {
    return { kind: "leaf", q: (q % 2) as 0 | 1, colour };
  }
  if (t < 0.86) {
    const glyph = MARK_GLYPHS[Math.floor(random() * MARK_GLYPHS.length)] ?? "₦";
    return {
      kind: "glyph",
      glyph,
      colour: colour === "line" ? "tile" : colour,
    };
  }
  return { kind: "square", colour };
}

const MIRROR_Q: Record<Quarter, Quarter> = { 0: 1, 1: 0, 2: 3, 3: 2 };
const MIRROR_DIR: Record<HalfDir, HalfDir> = {
  up: "up",
  down: "down",
  left: "right",
  right: "left",
};

/** The shape reflected across the vertical axis. */
export function mirror(shape: MarkShape): MarkShape {
  switch (shape.kind) {
    case "quarter":
      return { ...shape, q: MIRROR_Q[shape.q] };
    case "half":
      return { ...shape, dir: MIRROR_DIR[shape.dir] };
    case "leaf":
      return { ...shape, q: shape.q === 0 ? 1 : 0 };
    default:
      return shape;
  }
}

const HALF_RADIUS: Record<HalfDir, string> = {
  up: "50% 50% 0 0 / 100% 100% 0 0",
  down: "0 0 50% 50% / 0 0 100% 100%",
  left: "100% 0 0 100% / 50% 0 0 50%",
  right: "0 100% 100% 0 / 0 50% 50% 0",
};

/** CSS border-radius that cuts the tile into the shape; `square` takes
 *  the brand tile radius passed in. */
export function radiusOf(shape: MarkShape, square: string) {
  switch (shape.kind) {
    case "quarter": {
      const r = ["0", "0", "0", "0"];
      r[shape.q] = "100%";
      return r.join(" ");
    }
    case "half":
      return HALF_RADIUS[shape.dir];
    case "leaf":
      return shape.q ? "0 100% 0 100%" : "100% 0 100% 0";
    case "circle":
      return "50%";
    default:
      return square;
  }
}

/** The 15 slots for an input. */
export function slotsFor(input: string): MarkSlot[] {
  const slots: MarkSlot[] = new Array(SLOTS).fill(null);
  for (let i = 0; i < input.length; i++) {
    slots[i % SLOTS] = shapeFor(
      hash(input.slice(0, i + 1)) ^ Math.imul(i, 2_654_435_761)
    );
  }
  if (input.length >= SUN_AFTER) {
    // One sunflower, on a drawn centre-column slot, so the mirror can't
    // double it.
    const centre = slots
      .map((s, k) => (s && SLOT_ORDER[k]?.[1] === 2 ? k : -1))
      .filter((k) => k >= 0);
    const k = centre[hash(input) % centre.length];
    const shape = k === undefined ? null : slots[k];
    if (k !== undefined && shape) {
      slots[k] = { ...shape, colour: "sun" };
    }
  }
  return slots;
}

/** The full 5×5 grid, row-major, mirrored. */
export function markGrid(input: string): MarkSlot[] {
  const grid: MarkSlot[] = new Array(GRID * GRID).fill(null);
  slotsFor(input).forEach((shape, k) => {
    const [r, c] = SLOT_ORDER[k] ?? [0, 0];
    grid[r * GRID + c] = shape;
    if (c !== 2) {
      grid[r * GRID + (GRID - 1 - c)] = shape ? mirror(shape) : null;
    }
  });
  return grid;
}

/** "No. 1A2B3C": a short code for the mark, empty for no input. */
export function markCode(input: string) {
  return input
    ? `No. ${hash(input).toString(16).toUpperCase().padStart(8, "0").slice(0, 6)}`
    : "";
}

/** A stable key for a slot, to skip repainting unchanged cells. */
export function slotKey(slot: MarkSlot) {
  return slot ? JSON.stringify(slot) : "seed";
}
